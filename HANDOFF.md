# arthur031221.github.io — architecture and handoff

Written so another agent (Codex, or a future session) can extend this site without
re-deriving the design decisions. Read this before touching anything.

---

## 1. Where things live

The published site is the repo `Arthur031221/Arthur031221.github.io`, cloned at
`D:\桌面\site`. **Do not hand-edit the HTML there** — it is generated. The sources
are in `D:\桌面\CV`:

| File | What it is |
|---|---|
| `chi_wei_lee_cv.yaml` | The CV. Single source of truth for the research record. |
| `build_content.py` | Composes `extracted/content.json` — the bilingual content model. |
| `extracted/content.json` | Generated. Every string on the site, in `{en, zh}` pairs. |
| `extracted/timeline.json` | Generated once from the old site; holds the two long essays. |
| `site_template.html` | The page shell: tokens, base CSS, header/footer, runtime. |
| `site_extra.css` | All component CSS. |
| `site_pages.js` | Per-page renderers. One function per page in `RENDER`. |
| `site_hero.js` | The Hopfield + Langevin hero. Home page only. |
| `build_site.py` | Assembles everything into five static HTML files. |
| `shoot.py` | Playwright screenshots for visual QA. |
| `extracted/SPEC.md` | The 78k-word design spec the current build follows. |

### Build

```bash
python build_content.py      # rebuild content.json after editing build_content.py
python build_site.py         # -> ../site/_index.html …  (preview, safe)
python build_site.py --live  # -> ../site/index.html  …  (what gets published)
python shoot.py              # screenshots into shots/
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
   positions and descend into a multimodal energy landscape under
   `dz = -M∇U dt + G dW` with `GGᵀ = 2M`. This is manuscript #2 — the
   fluctuation–dissipation pairing that makes the target the unique stationary
   density, so walkers cover every mode instead of collapsing onto the MAP peak.

**The trap, if you touch the Hopfield code:** text rasters are ~85% background
(`-1`). Under the plain Hebb rule that shared mean swamps the cue and the network
lands in the widest basin regardless of what you asked for — it retrieved the
decoy every time. It uses the **covariance rule** instead: patterns are centred by
subtracting mean activity `A`, and the field is `h_i = Σ_μ Z[μ][i]·m_μ − (P/N)·s_i`
where `Z = X − A`. Do not "simplify" this back to raw `X`.

The two controls are the two mechanisms: the **language toggle is a retrieval cue**
(re-corrupt, converge on `李騏維` instead), the **theme toggle is a temperature
quench**. Keep that coupling.

---

## 4. Pages

| id | file | contains |
|---|---|---|
| `index` | `index.html` | Hero, research threads, three selected papers, two honours |
| `research` | `research.html` | The four research threads at full length |
| `publications` | `publications.html` | All five entries with status badges |
| `record` | `record.html` | The two long essays + photo galleries |
| `about` | `about.html` | Bio, all honours, contact |

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

- One animating canvas per viewport, enforced with `IntersectionObserver`.
  Pause on `visibilitychange` and when scrolled out of view.
- Easing: `cubic-bezier(.22,1,.36,1)` is the house curve (`--ease`).
- Anything above ~250 ms needs a reason.
- Every effect needs a reduced-motion path and a mobile path.
- If it does not relate to neural computation, inference, or his actual work,
  it is decoration — and decoration is what makes an applicant look unserious.
  That is the bar, not "is it cool".

### Known-good places to add motion

- Section entry reveals (currently a plain rise; could become a scan-line sweep).
- The publication cards for the two NeurIPS papers — a denoise-in reveal would be
  *content*, because those papers are about denoising.
- Number counters on the honours page ("1 of 8", "600+ teams").
- Photo galleries: masked reveal on scroll, parallax within the frame.
- Page transitions between the five pages via View Transitions named elements.

---

## 6. Open items

- [ ] Author lists for the two NeurIPS submissions are `C.-W. Lee (co-first author) et al.`
      — the co-authors are not named because the submissions are anonymous. Fill in
      when the decisions land.
- [ ] Both submission PDFs contain a hidden white-on-white prompt-injection block on
      page 2 aimed at LLM reviewers. It must be removed before rebuttal.
- [ ] `S__16670722.webp` is optimised but not yet used anywhere on the site.
- [ ] The old single-page version is kept at `index.old.html`; delete once settled.
