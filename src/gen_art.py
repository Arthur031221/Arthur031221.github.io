#!/usr/bin/env python3
"""Offline suminagashi — the site's own marbling math at print resolution.

Same physics as assets/substrate.js: three dyes, alternating rings, a
divergence-free curl flow, wandering vortices, crimson+blue bleeding into
sumi where they meet. Each artwork slot gets its own composition per
CODEX_ART_BRIEF.md."""

import numpy as np
from PIL import Image
import os, sys

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "img", "art")
os.makedirs(OUT, exist_ok=True)

PAPER   = np.array([0xF4, 0xF0, 0xE5], dtype=np.float32) / 255
CRIMSON = np.array([0x8E, 0x3A, 0x4C], dtype=np.float32) / 255
BLUE    = np.array([0x27, 0x50, 0x7B], dtype=np.float32) / 255
SUMI    = np.array([0x3F, 0x47, 0x50], dtype=np.float32) / 255

def vnoise_grid(h, w, cells, rng):
    g = rng.random((cells + 2, int(cells * w / h) + 2)).astype(np.float32)
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)
    return np.asarray(im, dtype=np.float32) / 255

def fbm(h, w, rng, t=0.0):
    return (vnoise_grid(h, w, 3, rng) * 0.62 +
            vnoise_grid(h, w, 7, rng) * 0.28 +
            vnoise_grid(h, w, 14, rng) * 0.10)

def curl(psi):
    gy, gx = np.gradient(psi)
    return gy, -gx   # vx, vy

def sample(f, X, Y):
    """bilinear gather"""
    h, w = f.shape
    x0 = np.clip(np.floor(X).astype(np.int32), 0, w - 2)
    y0 = np.clip(np.floor(Y).astype(np.int32), 0, h - 2)
    fx = np.clip(X - x0, 0, 1); fy = np.clip(Y - y0, 0, 1)
    a = f[y0, x0]; b = f[y0, x0 + 1]; c = f[y0 + 1, x0]; d = f[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

def ring(h, w, cx, cy, r, sigma_frac=0.16, core=0.35):
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.hypot(X / w - cx, (Y / h - cy) * (h / w) * (w / h))
    d = np.hypot((X / w - cx) * (w / h), Y / h - cy)   # aspect-corrected
    rg = np.exp(-((d - r * 0.78) / (r * sigma_frac)) ** 2)
    co = np.exp(-(d ** 2) / (r * r * 0.16)) * core
    return rg + co

def marble(w_out, h_out, seed, touches, vortices, steps, speed=1.3, diff=0.028,
           density=1.0, drift=(0.0, 0.0)):
    """touches: list of (step, x, y, radius, dye, amount); dye 0=crimson 1=blue 2=sumi"""
    rng = np.random.default_rng(seed)
    h, w = h_out // 2, w_out // 2
    R = np.zeros((h, w), np.float32); G = np.zeros_like(R); B = np.zeros_like(R)
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)

    psi_a, psi_b = fbm(h, w, rng), fbm(h, w, rng)
    touch_map = {}
    for st, x, y, r, dye, amt in touches:
        touch_map.setdefault(int(st), []).append((x, y, r, dye, amt))

    for step in range(steps):
        tt = step / max(1, steps)
        psi = psi_a * (1 - 0.5 * np.sin(tt * 3.1)) + psi_b * (0.5 * np.sin(tt * 3.1))
        vx, vy = curl(psi)
        vx = vx * speed * w * 0.02 + drift[0] * w * 0.002
        vy = vy * speed * w * 0.02 + drift[1] * w * 0.002
        for cx, cy, vr, s in vortices:
            dx = (X / w - cx) * (w / h); dy = Y / h - cy
            d2 = dx * dx + dy * dy
            k = s * np.exp(-d2 / (vr * vr)) * w * 0.012
            vx += -dy * k; vy += dx * k
        Xb = X - vx; Yb = Y - vy
        Rn = sample(R, Xb, Yb); Gn = sample(G, Xb, Yb); Bn = sample(B, Xb, Yb)
        for F, Fn in ((R, Rn), (G, Gn), (B, Bn)):
            blur = (np.roll(Fn, 1, 0) + np.roll(Fn, -1, 0) + np.roll(Fn, 1, 1) + np.roll(Fn, -1, 1)) * 0.25
            F[:] = Fn * (1 - diff) + blur * diff
        meet = np.minimum(R, G)
        B += meet * 0.055; R -= meet * 0.03; G -= meet * 0.03
        if step in touch_map:
            for x, y, r, dye, amt in touch_map[step]:
                rg = ring(h, w, x, y, r) * amt * density
                (R if dye == 0 else G if dye == 1 else B).__iadd__(rg)
        np.clip(R, 0, 1, R); np.clip(G, 0, 1, G); np.clip(B, 0, 1, B)

    # upscale fields, then colorize at print resolution
    up = lambda F: np.asarray(Image.fromarray((F * 255).astype(np.uint8))
                              .resize((w_out, h_out), Image.BILINEAR), np.float32) / 255
    R, G, B = up(R), up(G), up(B)
    sstep = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
    sr, sb, sg = sstep(.012, .52, R), sstep(.012, .52, G), sstep(.016, .60, B)

    col = np.broadcast_to(PAPER, (h_out, w_out, 3)).copy()
    col = col * (1 - (sr * 0.88)[..., None]) + CRIMSON * (sr * 0.88)[..., None]
    kb = (sb * (1 - sr * 0.35) * 0.88)[..., None]
    col = col * (1 - kb) + BLUE * kb
    col = col * (1 - (sg * 0.62)[..., None]) + SUMI * (sg * 0.62)[..., None]
    total = sr + sb + sg
    col *= (1 - 0.16 * sstep(.9, 1.9, total))[..., None]
    gy, gx = np.gradient(R + G + B)
    edge = sstep(.012, .06, np.hypot(gx, gy))
    col = col * (1 - (edge * 0.30)[..., None]) + SUMI * (edge * 0.30)[..., None]
    rng2 = np.random.default_rng(seed + 1)
    col += (rng2.random((h_out, w_out, 1)).astype(np.float32) - 0.5) * 0.016
    return Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8))

def rings_at(rng, n, cx, cy, spread, r0, r1, start=0, gap=26, dyes=(0, 1, 0, 1, 2)):
    out = []
    for i in range(n):
        out.append((start + i * gap,
                    cx + (rng.random() - .5) * spread,
                    cy + (rng.random() - .5) * spread,
                    r0 + rng.random() * (r1 - r0),
                    dyes[i % len(dyes)],
                    .7 + rng.random() * .3))
    return out

J = []
rng = np.random.default_rng(7)

# 1. home-ink — rich marble in the left third, right two-thirds empty
J.append(("home-ink", 2000, 900,
          rings_at(rng, 14, .18, .5, .26, .06, .13, gap=18),
          [(.2, .45, .16, 9), (.3, .6, .12, -8), (.14, .3, .1, 7)], 320, 1.25, {"density": 1.7}))

# 2. research — two clusters at the edges, centre empty
J.append(("research", 2000, 700,
          rings_at(rng, 5, .1, .5, .2, .05, .09) + rings_at(rng, 5, .9, .5, .2, .05, .09, start=10),
          [(.1, .5, .13, 8), (.9, .5, .13, -8)], 280, 1.2, {"density": 1.5}))

# 3. papers — a thin settled band along the bottom
J.append(("papers", 2000, 560,
          [(i * 22, .06 + i * .105, .82 + (i % 3) * .04, .05, (0, 1, 1, 2)[i % 4], .55) for i in range(9)],
          [(.5, .85, .3, 3)], 260, 0.9, {"density": 1.35}))

# 4. field — one energetic splash in the right third
J.append(("field", 2000, 700,
          rings_at(rng, 8, .78, .45, .22, .04, .10),
          [(.78, .45, .13, 14), (.7, .6, .09, -11)], 240, 1.6, {"density": 1.5}))

# 5. record — five blooms on a line, progressively more folded
J.append(("record", 2000, 560,
          [(200 - i * 45, .12 + i * .19, .5, .06, (0, 1, 2, 1, 0)[i], .8) for i in range(5)],
          [(.5, .5, .5, 2.5)], 260, 1.0, {"density": 1.6}))

# 6-9. the four threads
J.append(("thread-pc", 1200, 900,
          rings_at(rng, 4, .22, .5, .18, .06, .1, dyes=(0,)) + rings_at(rng, 4, .78, .5, .18, .06, .1, start=8, dyes=(1,)),
          [(.5, .5, .2, 5)], 300, 1.1, {"drift": (0, 0)}))
J.append(("thread-langevin", 1200, 900,
          [(0, .5, .45, .34, 1, .5)] + [(30 + i * 12, .5 + .26 * np.cos(a), .47 + .26 * np.sin(a), .045, (0, 2)[i % 2], .65)
           for i, a in enumerate(np.linspace(0, 2 * np.pi, 8, endpoint=False))],
          [(.5, .47, .3, 6)], 280, 1.15, {"density": 1.3}))
J.append(("thread-fmri", 1200, 900,
          [(i * 14, .2 + (i % 4) * .2, .22 + (i // 4) * .25, .035, (1, 1, 0, 2)[i % 4], .6) for i in range(12)],
          [(.45, .5, .35, 7)], 300, 1.5, {"density": 1.5}))
J.append(("thread-diffusion", 1200, 900,
          [(i * 20, .15, .18 + i * .13, .05, (1, 0)[i % 2], .85) for i in range(6)],
          [(.4, .5, .3, 5)], 300, 1.3, {"drift": (0.8, 0.0), "density": 1.4}))

for job in J:
    name, w, h, touches, vorts, steps, speed = job[0], job[1], job[2], job[3], job[4], job[5], job[6]
    kw = job[7] if len(job) > 7 else {}
    img = marble(w, h, abs(hash(name)) % (2**31), touches, vorts, steps, speed=speed, **kw)
    path = os.path.join(OUT, name + ".webp")
    img.save(path, "WEBP", quality=82, method=6)
    print(f"{name:<20} {w}x{h}  {os.path.getsize(path)/1024:6.1f} KB")
print("done")
