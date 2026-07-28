# PE//1 — architecture and handoff

Written so another agent, or a future session, can extend this site without
re-deriving the decisions. Read this before touching anything.

**Status (2026-07-28):** this document is the current contract. It replaces the
V2/V3 "probabilistic instrumentarium" handoff; that design and its external
`CV` build workspace are gone. Everything needed to build the site is now in
this repository.

---

## 1. Where things live

| path | what it is |
|---|---|
| `src/content.json` | **The single source of truth.** Every fact and every string, paired `{en, zh}`. Extracted from the previous site's authoritative content model. |
| `src/shell.html` | The page shell: head, chrome, HUD, dialogs, script tags. `{{placeholders}}` only. |
| `src/build.py` | Composes nine routes. One renderer function per page in `RENDER`. |
| `assets/site.css` | The whole design system, in 30 numbered sections. |
| `assets/runtime.js` | Loop broker, event bus, shared state, seeded RNG, modality and language, settling, rail, depth axis, HUD, cursor, console, lightbox, filters. |
| `assets/substrate.js` | The cortical counterflow field. WebGL, with a Canvas2D field that computes the same thing. |
| `assets/instruments.js` | The hero and the five figures. |
| `assets/fonts/` | Martian Mono and Instrument Sans, self-hosted, Latin subsets only. |
| `img/` | Photographs. `X.webp` is the full frame, `X-400/800/1200.webp` are derivatives for the srcset, `X.thumb.webp` is a 24 px placeholder — **not** a source. |

Root `*.html` is generated. Do not hand-edit it.

```bash
python3 src/build.py          # preview  → _index.html …   (safe)
python3 src/build.py --live   # publish  → index.html …
```

---

## 2. Non-negotiables

Breaking these breaks the thesis, not just the styling.

1. **Zero runtime dependencies.** No React, no GSAP, no three.js, no Tailwind.
   A technical reader will open view-source, and the dependency list is itself
   the signal. Hand-write it.
2. **Bilingual parity.** Every user-visible string ships in both languages,
   emitted by `bi({en, zh})`; CSS reveals exactly one. Never ship an
   English-only string. Check parity by counting `.en` against `.zh` per page.
3. **Two modalities, not an inversion.** `in vivo` is a live recording and it
   moves. `fixed` is a fixed section and it does not evolve — the substrate's
   clock stops and the hero sampler anneals to T = .05. Do not "fix" that
   stillness; it is the point.
4. **Chroma is semantic.** Magenta = top-down prediction. Teal = bottom-up
   evidence. Violet = inhibition. If it is frame, rule or label, it is
   achromatic. Never introduce a fourth accent for decoration.
5. **Every number is measured, cited, or from the record.** The instruments
   print what they actually computed. They must never print the papers'
   benchmark figures as if this page had measured them.
6. **Reduced motion is honoured everywhere,** with a designed static state.
7. **Accuracy outranks impressiveness.** Statuses stay as they stand: "under
   review", "preprint, under submission", "accepted poster".
8. **Content cannot be held hostage by an effect.** Sections settle by a scroll
   sweep with a 4-second hard fallback. Keep that fallback.

---

## 3. The hero, and the trap

`instruments.js → hero()` runs both manuscripts, in order, on his own name.

**Retrieval.** The name is rasterised to a ±1 lattice and stored as one of
three patterns. The lattice starts at 42 % bit-flip noise and is recovered by
asynchronous sweeps.

**The trap.** Text rasters are ~85 % background. Under the plain Hebb rule that
shared mean swamps the cue and the network lands in the widest basin regardless
of what you asked for. It uses the **covariance rule**: patterns are centred by
subtracting mean activity `A`, and the field is

    Z = X − A,    h_i = Σ_μ Z[μ][i]·m_μ − (P/N)·s_i

Do not "simplify" this back to raw `X`. The overlaps `m_μ` are maintained
incrementally on each flip; keep that or the sweep goes quadratic.

**Release.** Every recovered `+1` cell becomes a particle at its exact screen
position and enters an eight-mode, equal-weight, equal-variance sampler:

    z += η·M·∇log p + √(ηT)·G·ξ,   M = diag(1, .68),   GGᵀ = 2M

Do not replace `√T` with `T`, and do not heat both directions. `in vivo` holds
T = 1; `fixed` anneals to T = .05.

The language toggle is a new retrieval cue and rebuilds the lattice. The
modality toggle is a real temperature schedule.

---

## 4. The substrate

`substrate.js` advects two FBM fields through six laminae in opposite
directions and draws the **zero set of their difference**, not the difference
itself. This matters: filling area with the residual gives billowing clouds
that fight the text; drawing the surfaces where prediction exactly cancels
evidence gives a quiet phase map that says the same thing more honestly.

The image is then quantised through a recursive 8×8 Bayer matrix at one render
pixel per dither cell (`image-rendering: pixelated`), which is also why the
canvas renders at 1/2 to 1/4 resolution and costs almost nothing.

Two rules keep it readable, and both are load-bearing:

- `colm` damps amplitude to 16 % across the central column, so motion never
  runs under the reading line.
- `PE.targetIntensity` drops to .26 whenever a `.reading` or `.prose` block is
  centred in the viewport.

If you raise the gain, raise it at the edges, never in the column.

---

## 5. The ten structural departures

Each of these replaces a convention rather than decorating it. Removing one is
a design decision, not a cleanup.

1. Cortical counterflow substrate — the residual field, Bayer-dithered.
2. Prediction-error typography — display type only, resolved on an error
   schedule, never body copy.
3. Cortical depth axis (left) — scroll position reads as L1…L6.
4. Raster-plot rail (right) — replaces the scrollbar; each fired section leaves
   a spike.
5. Two imaging modalities instead of dark/light.
6. Language switching as stimulus re-encoding.
7. Six live instruments that compute rather than illustrate.
8. Recording-electrode cursor with a receptive-field readout (`pointer: fine`).
9. Stimulus console — `⌘K` or `/`, with `T` `L` `S` `E` as direct keys.
10. Vitals HUD whose LFP trace is the real measured frame duration, plus the
    baseline-acquisition boot and cross-document view transitions.

---

## 6. Adding things

**A page.** Add it to `PAGES` (nav label and channel number), `TITLES` and
`DESCS` in `build.py`, then write a renderer and register it in `RENDER`.
`section()` gives you the lamina badge, rail label and console entry for free.

**An instrument.** Add a `data-fig="name"` block from the renderer, then a
function in `instruments.js` registered in the `R` table. Use `mount(el, id,
frame, onSize)` so it runs only while visible. Read colours through
`PE.colors()` so they follow the modality, and never cache them across a
`modechange`.

**Motion.** House curve is `cubic-bezier(.22,1,.36,1)`. Anything over ~300 ms
needs a reason. Every effect needs a reduced-motion path and a mobile path. Do
not add cursor trails, particle constellations, tilt-on-hover cards or
fade-up-on-everything: they read as template regardless of execution. An effect
earns its place by encoding something true about the content.

---

## 7. QA

There is no test runner in the repo; QA is a browser pass. Serve the site and
check, in both modalities and both languages:

- every figure prints a computed readout, not `—`
- console opens on `/` and `⌘K`; `T` `L` `S` `E` respond
- scrolling to the bottom settles every section and fires every rail tick
- reduced motion: nothing hidden, no boot gate, substrate not looping
- JavaScript disabled: the whole page is still there, in both languages
- 390 px wide: no horizontal overflow, drawer opens
- images: every `<img>` has `alt`, every button has a name, one `<h1>`, no
  duplicate ids

---

## 8. Open items

- [ ] The two anonymous submissions intentionally use `C.-W. Lee (co-first
      author) et al.` and no venue name. Fill in authors and venue only after
      the review process permits disclosure.
- [ ] Audit submission PDFs separately before any external distribution;
      internal review notes must never enter this repository.
- [ ] `index.old.html` is a recovery copy of the pre-PE//1 site. Remove only
      once this design is accepted and its deletion is explicitly authorised.
- [ ] Rotate any GitHub personal access token that was ever embedded in a
      remote URL. `origin` must stay the credential-free HTTPS URL.
- [ ] `img/` is 3.3 MB across 39 files. If that grows, drop the 1200 px
      derivatives before dropping quality.
