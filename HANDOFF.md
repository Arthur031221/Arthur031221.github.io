# PE//1 — architecture and handoff

Written so another agent, or a future session, can extend this site without
re-deriving the decisions. Read this before touching anything.

**Status (2026-07-29, ink revision):** this document is the current contract. It replaces the
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
| `assets/runtime.js` | Loop broker, event bus, shared state, seeded RNG, modality and language, settling, rail, depth axis, HUD, console, lightbox, filters. |
| `assets/substrate.js` | The 水墨 fluid: two-field ping-pong simulation in WebGL, with a Canvas2D wash that follows the same rules without the fluid. |
| `assets/instruments.js` | The hero and the five figures. |
| `assets/fonts/` | Spectral, Martian Mono and Instrument Sans, self-hosted, Latin subsets only. |
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
3. **Two modalities, not an inversion.** `in vivo` is a live recording on a
   night sheet and it moves. `fixed` is ink on dry 宣紙 and it does not evolve —
   the substrate's clock stops and the hero sampler anneals to T = .05. Do not
   "fix" that stillness; it is the point.
4. **Chroma is semantic.** Magenta (胭脂) = top-down prediction. Teal (花青) =
   bottom-up evidence. Violet (石青) = inhibition. If it is frame, rule or
   label, it is achromatic. The single exception is 朱砂 vermilion, reserved
   for the seal, because a seal is an identity and not a measurement. Never
   introduce another.
5. **Every number is measured, cited, or from the record.** The instruments
   print what they actually computed. They must never print the papers'
   benchmark figures as if this page had measured them.
6. **Reduced motion is honoured everywhere,** with a designed static state.
7. **Accuracy outranks impressiveness.** Statuses stay as they stand: "under
   review", "preprint, under submission", "accepted poster".
8. **Content cannot be held hostage by an effect.** Sections settle by a scroll
   sweep with a 4-second hard fallback. Keep that fallback.
9. **Nothing appears more than twice.** Each page has exactly one job and
   owns its content outright — see §9. A second appearance may only be a
   compact reference: a teaser sentence, a listing without its citation, a
   link. A third appearance is a bug, and there is an audit for it.
10. **No custom cursor.** Hiding the system cursor and drawing a follower that
    lags behind it makes a page feel unsteady. The reader's own pointer is
    more precise than anything drawn for them.

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

## 4. The substrate — 水墨, simulated

`substrate.js` is not a procedural picture of an ink wash. It is a wash: a
two-field fluid ping-ponged between two framebuffers, where every mark got
there by the route ink takes on paper.

State, packed into one RGBA texture at ~340 px wide (the wash is smooth; it
does not need the screen's resolution):

| channel | is |
|---|---|
| R | suspended pigment, still in the water |
| G | water |
| B | pigment that has settled — what you actually see |
| A | how much the sheet can still take (積墨: a second wash over a first lays down differently and leaves its overlap edge) |

**Every ink behaviour here is a consequence, not an effect.** Do not "add" any
of them as a separate term; if one looks wrong, the physics above it is wrong.

- **暈染** — water diffuses, faster along the paper fibre than across it
  (`fibre()` gives per-texel anisotropy), and drags pigment with it.
- **邊緣濃聚 / pooled terminus** — evaporation is fastest where the wet patch
  ends, so the flow velocity `-∇water` runs outward and strands pigment at the
  rim. The dark edge is emergent. There is no code that draws a ring.
- **水痕** — fresh water re-suspends pigment that had already dried and carries
  it out to a hard cauliflower boundary.
- **五墨** — the settled value is read back in discrete tones, 焦 濃 重 淡 清.
- **飛白** — applied to thin strokes only. A loaded brush lays solid ink; a
  starved one breaks into streaks along its travel.

**The composition rule is 留白.** Ink enters from exactly two places: a drop
(`PE.drop(x, y, r, amount)`, also fired by a click, by `S`, and on an ambient
timer into the margins), and the residual — the sheet gets wet where
prediction and evidence fail to cancel. The empty paper is not restraint. It
is the part of the world the model already predicted.

Format: half-float where the driver will filter it, `UNSIGNED_BYTE` otherwise.
Ink tolerates 8 bits; the diffusion just quantises harder. The framebuffer is
probed for completeness before use, and the whole thing falls back to a
Canvas2D wash that follows the same rules without the fluid.

Cost control, all of it load-bearing on phones:

- the residual source is the expensive half of a step and sits behind
  `if (uInject > 0.03)` — a coherent branch on a uniform, so it is skipped
  outright while the reader is inside a block of copy;
- `fbm` is three octaves. The sign of the residual is decided by its low
  frequencies and five octaves buys detail nobody sees;
- one simulation step per frame after the first ~60 frames, which run two.

Two rules keep it readable, and both are load-bearing:

- `colm` damps the wash to 13 % across the width the copy occupies. A scroll
  keeps its painting in the margins.
- `PE.targetIntensity` drops to .26 whenever a `.reading` or `.prose` block is
  centred, which also switches the source term off entirely.

There is **no grain overlay layer**. A full-viewport element in a blend mode is
an expensive composited layer on exactly the devices that can least afford one.
The tooth, the 斑點 foxing and the 毛邊 deckle all belong to the sheet and are
drawn in the render pass.

## 4a. Typography

Two families, and the split is the whole idea: **the painting is old and the
instrument is not.**

- `--f-display` / `--f-serif` — Spectral for Latin, 明體 for Chinese
  (`Noto Serif TC` → `Source Han Serif TC` → `Songti TC` → `PMingLiU`). All
  headings, the hero, and the essays.
- `--f-mono` — Martian Mono. Every label, readout, chip, axis and piece of
  chrome. Nothing that belongs to the instrument is ever set in the book face.
- `--f-body` — Instrument Sans, for UI prose that is neither.

Self-hosted, Latin subsets only. Do not add a CJK webfont: the full 明體 is
several megabytes and every target platform already ships one.

## 5. The ten structural departures

Each of these replaces a convention rather than decorating it. Removing one is
a design decision, not a cleanup.

1. A simulated 水墨 substrate — the residual is ink, and 留白 is what the
   model got right.
2. Prediction-error typography — display type only, resolved on an error
   schedule, never body copy.
   The front page carries no instrument at all: the name is the hero, and
   nothing is drawn in front of it.
3. Cortical depth axis (left) — scroll position reads as L1…L6.
4. Raster-plot rail (right) — replaces the scrollbar; each fired section leaves
   a spike.
5. Two imaging modalities instead of dark/light.
6. Language switching as stimulus re-encoding.
7. Six live instruments that compute rather than illustrate.
8. The author's seal (朱砂 vermilion, 李) as the site mark — the one colour
   on the site that encodes nothing, allowed because a seal is an identity
   and not a measurement.
9. Stimulus console — `⌘K` or `/`, with `T` `L` `S` `E` as direct keys.
10. Vitals HUD whose LFP trace is the real measured frame duration, plus the
    baseline-acquisition boot and cross-document view transitions.

---

## 9. Who owns what

Every fact belongs to one page. That page writes it out in full; anywhere
else it may appear once more, in short.

| page | owns | may reference |
|---|---|---|
| `index` | the name, and the pitch | thread first sentences, three papers without their citations, two honours, the trips as dates and places |
| `research` | the four threads in full, and the instruments | — |
| `publications` | every paper with its authors, venue, status and citation | — |
| `field` | the trip cards and every photograph | — |
| `field-nsf` / `field-igem` | the essays, and each photograph a second time in context | — |
| `record` | every honour with its citation, and the axis | papers as ticks, never as titles |
| `about` | the biography, the facts, the contact routes | the honours as a count and a link |

Two consequences worth stating, because both look like omissions:

- `record` plots the papers but never names them. The titles are on `index`
  and `publications`; a third printing is what this rule exists to prevent.
- `about` does not list the honours. It says how many there are and links to
  the record, which owns them.

To check, grep a distinctive substring of any content across the built
routes. Three hits in `*.html` (excluding `index.old.html`) means something
needs cutting, not renaming.

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
