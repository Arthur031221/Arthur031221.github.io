# arthur031221.github.io — architecture and handoff

Written so another agent (Codex, or a future session) can extend this site without
re-deriving the design decisions. Read this before touching anything.

**V3 status (2026-07-28):** `SPEC_V3.md` is the current visual/runtime contract.
`SPEC_V2.md` is design history. Where either conflicts with this handoff's older
examples, the non-negotiables below and `SPEC_V3.md` win.

---

## 1. Where things live

The published site is the repo `Arthur031221/Arthur031221.github.io`, cloned at
`D:\桌面\site`. **Do not hand-edit the HTML there** — it is generated. The sources
are in `D:\桌面\CV`:

| File | What it is |
|---|---|
| `chi_wei_lee_cv.yaml` | Private CV source; authoritative for factual record and dates. |
| `build_content.py` | Composes the public bilingual model; currently manual, so cross-check it against the YAML. |
| `extracted/content.json` | Generated factual/copy model; component UI labels remain paired in JS. |
| `extracted/timeline.json` | Generated once from the old site; holds the two long essays. |
| `site_template.html` | The page shell: tokens, base CSS, header/footer, boot. |
| `site_extra.css` | Legacy/base component CSS. |
| `site_v3.css` | Current Probabilistic Instrumentarium art direction and responsive overrides. |
| `site_pages.js` | Per-page renderers. One function per page in `RENDER`. |
| `site_runtime.js` | Exclusive animation-loop broker, seeded RNG, visibility pooling, frame metrics. |
| `site_v3.js` | V21–V40: rails, HUD, scientific controls and page-specific instruments. |
| `site_figures.js` | Four accessible research figures. Research page only. |
| `site_hero.js` | The Hopfield + 8-mode Langevin hero. Home page only. |
| `site_spectacle.js` | Direction-aware navigation transit; no ambient animation. |
| `build_site.py` | Assembles nine static routes and publishes the public CV. |
| `shoot.py` | Playwright screenshots for visual QA. |
| `qa_matrix.py` | 108 visual states plus reduced-motion and no-JS gates. |
| `qa_interactions.py` | Direct interaction/controller browser tests. |
| `qa_quality.py` | Asset, dependency, a11y-smoke and performance gates. |
| `SPEC_V3.md` | Current art direction, 20 added features and 10 motion signatures. |

### Build

```bash
python build_content.py      # rebuild content.json after editing build_content.py
python build_site.py         # -> ../site/_index.html …  (preview, safe)
python build_site.py --live  # -> ../site/index.html  …  (what gets published)
python shoot.py              # screenshots into shots/
python qa_matrix.py          # 9 × 3 × 2 × 2 browser states
python qa_interactions.py    # exercise the interactive suite
python qa_quality.py         # asset/a11y/performance gates
```

The build step runs locally. GitHub Pages only ever sees plain static files —
no bundler, no client-side router, no framework.

---

## 2. Non-negotiables

These are not stylistic preferences; breaking them breaks the thesis of the site.

1. **Zero runtime JS dependencies.** No React, no GSAP, no three.js, no Tailwind
   CDN. A technical reader will open view-source, and the dependency list is
   itself the signal. Everything is hand-written CSS + Canvas2D.
2. **Bilingual parity.** Every user-visible string exists in both `en` and `zh`.
   Emit both with `bi({en, zh})`; CSS reveals exactly one via `[data-en]/[data-zh]`.
   Never ship an English-only string.
3. **Two themes are two scientific registers, not an inversion.**
   `dark` = instrument display (phosphor on near-black — never `#000`).
   `light` = publication figure (ivory paper, ink hairlines, *no filled colour*).
4. **Chroma is reserved.** In OKLCH terms, chroma ≥ 0.12 means the colour encodes
   a quantity. Below that is chrome: frame, rule, label. Nothing in between.
5. **Every number on the page is measured, cited, or a fact from the CV.**
   The hero readout reports what the live simulation actually computes. It must
   never print the papers' benchmark figures as if it measured them.
6. **`prefers-reduced-motion` is honoured everywhere.** Animations either skip to
   their end state or do not run.
7. **Accuracy outranks impressiveness.** Statuses are stated as they actually
   stand: "under review", "preprint, under submission", "accepted poster".

---

## 3. The hero, and why it is what it is

`site_hero.js` runs both of his manuscripts, in order, on his own name:

1. **Retrieval.** The name is rasterised to a ±1 lattice and stored as one of
   three patterns. The lattice starts at 42% bit-flip noise and is recovered by
   asynchronous Hopfield sweeps. This is manuscript #1 — associative memory as
   the Bayesian denoiser predictive coding implicitly requires.
2. **Release.** The retrieved `+1` cells become particles at their exact screen
   positions and enter an eight-mode equal-weight, equal-variance GMM. The actual
   Euler–Maruyama update is `z += η M ∇log p + sqrt(ηT) Gξ`, with
   `M = diag(1,.68)` and `GGᵀ = 2M`. PHOSPHOR targets `T=1`; PAPER anneals to
   `T=.05` with a `.40 s` exponential schedule. Do not replace `sqrt(T)` with
   `T`, and do not heat both directions.

**The trap, if you touch the Hopfield code:** text rasters are ~85% background
(`-1`). Under the plain Hebb rule that shared mean swamps the cue and the network
lands in the widest basin regardless of what you asked for — it retrieved the
decoy every time. It uses the **covariance rule** instead: patterns are centred by
subtracting mean activity `A`, and the field is `h_i = Σ_μ Z[μ][i]·m_μ − (P/N)·s_i`
where `Z = X − A`. Do not "simplify" this back to raw `X`.

The language toggle remains a retrieval cue. The theme toggle is a real
temperature schedule: dark→light quenches and light→dark heats. The public
`HeroController` API and `SiteRuntime.loop` ownership contract are tested; keep
the coupling and do not add a second continuous rAF chain.

---

## 4. Pages

| id | file | contains |
|---|---|---|
| `index` | `index.html` | Hero instrument, research threads, selected papers and honours |
| `research` | `research.html` | Four threads, four live/schematic figures, relationship map |
| `publications` | `publications.html` | Five entries, filter, citations, evidence, finite acquisitions |
| `field` | `field.html` | Two trip entries, deterministic comparator, contact sheet |
| `field-nsf` | `field-nsf.html` | NSF/AAAI long essay and its photographs |
| `field-igem` | `field-igem.html` | iGEM long essay and its photographs |
| `record` | `record.html` | Public career/photo record |
| `404` | `404.html` | Bilingual recovery page |
| `about` | `about.html` | Bio, honours, factual career raster and contact tools |

Add a page by adding an entry to `PAGES` in **both** `build_site.py` (title,
description, canonical) and `site_pages.js` (nav label), then a renderer function
in `RENDER`.

Cross-document View Transitions are enabled via `@view-transition{navigation:auto}`.

---

## 5. If you are adding animations

**Do not generate video, Lottie, or GIF assets, and do not add an animation
library.** Three reasons, in order of importance:

1. Every visual must respond to the theme toggle. A baked asset cannot become a
   publication figure when the user switches to light — it will sit there as a
   dark rectangle on ivory paper and expose the whole conceit.
2. Weight. The entire site is ~64 KB per page. One Lottie file undoes that.
3. The zero-dependency claim is load-bearing (see §2.1).

Hand-write it as CSS or Canvas2D. Read colours from custom properties at runtime
(`getComputedStyle(root).getPropertyValue('--accent')`) so they follow the theme,
and re-read them on the `themechange` event.

### Rules for new motion

- One continuous animation owner per viewport, enforced by
  `SiteRuntime.loop.claim(id, frame, onYield)`. Observers must release ownership
  off-screen; finite one-shot frames can use `SiteRuntime.loop.frame`.
- Easing: `cubic-bezier(.22,1,.36,1)` is the house curve (`--ease`).
- Anything above ~250 ms needs a reason.
- Every effect needs a reduced-motion path and a mobile path.
- If it does not relate to neural computation, inference, or his actual work,
  it is decoration — and decoration is what makes an applicant look unserious.
  That is the bar, not "is it cool".

### Current motion vocabulary

The ten V3 signatures are retrieval acquisition, release handoff, stepped theme
quench, section scan, finite denoise acquisition, HOPE pathway state, true
relationship edge draw, dated career spikes, photographic aperture and measured
value hard-lock. Add a new signature only when it communicates a new state; do
not add bubbles, cursor trails, generic parallax or permanent ambient motion.

---

## 6. Open items

- [ ] The two anonymous submissions intentionally use `C.-W. Lee (co-first author)
      et al.` and no venue name in public HTML/PDF. Fill author lists and venue only
      after the review process permits disclosure.
- [ ] Audit submission PDFs separately before any external distribution; internal
      review notes must never enter the public website repository.
- [ ] `index.old.html` remains as a recovery copy. Remove only after the V3 deploy is
      accepted and its deletion is explicitly authorised.
- [ ] Rotate any GitHub personal access token that was ever embedded in a remote URL.
      `origin` must remain the credential-free HTTPS URL.
