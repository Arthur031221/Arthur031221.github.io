# Aizuri notebook — architecture and handoff

Current contract as of 2026-07-29. This replaces the earlier instrumentarium
and procedural-suminagashi handoff.

## 1. Source map

| path | responsibility |
|---|---|
| `src/content.json` | bilingual facts, publications, awards, essays, photo metadata |
| `src/build.py` | nine route renderers and shared HTML helpers |
| `src/shell.html` | document head, header, drawer, dialogs, footer, script order |
| `assets/site.css` | tokens, fixed/vivo themes, composition, responsive rules |
| `assets/runtime.js` | state, one animation loop, navigation, reveal, language/theme, lightbox |
| `assets/substrate.js` | restrained background ink; static in fixed/reduced-motion modes |
| `img/art/` | nine original aizuri/sumi illustrations and responsive derivatives |
| `img/` | documentary photography and responsive derivatives |

Root `*.html` is generated output. Keep obsolete HTML out of the publish root:
Git history is the recovery path, and a stale file would still be served by
GitHub Pages even when it is no longer linked.

## 2. Visual contract

The site is an editorial research notebook, not a dashboard.

- Paper: warm kozo, never pure white.
- Ink: Prussian indigo, charcoal, and desaturated asagi.
- Accent: one vermilion family, used sparingly.
- Image language: authentic pigment bloom and granulation plus restrained
  Edo-period aizuri-e key lines. No famous-print quotation, generic spiral,
  liquid-chrome 3D form, neon, text, logo, or watermark.
- Day (`fixed`): ink on dry paper; background simulation is stopped.
- Night (`vivo`): dark rubbing; chapter art is toned and the background wash
  may evolve slowly.
- Reduced motion: the same composition in a settled frame.
- Tech register: mono labels, thin rules, semantic layer badges, and small
  focus/hover responses. It must never compete with the content.

The old canvas figures, career raster, depth axis, right rail, HUD, and boot
sequence are intentionally gone. Do not restore them as decoration.

## 3. Illustration set

`art(name, alt)` in `src/build.py` emits responsive `<picture>`-style `srcset`
markup when the corresponding WebP exists.

| asset | use | master ratio |
|---|---|---|
| `home-ink` | home hero, eager and high priority | 20:9 |
| `research` | four ideas joining one indigo current | 8:3 |
| `papers` | five sheet-like strata | 8:3 |
| `field` | two routes crossing a coast | 8:3 |
| `record` | four terraces carrying milestones | 8:3 |
| `thread-pc` | memory and prediction crossing | 4:3 |
| `thread-langevin` | probability basin and paths | 4:3 |
| `thread-fmri` | head contour with spatial lattice | 4:3 |
| `thread-diffusion` | legible QR-like lattice through mist | 4:3 |

Every master has 400 and 800 px derivatives; wide masters also have 1200 px
derivatives. Keep source ratios and intrinsic dimensions. The production prompt
set is recorded in `CODEX_ART_BRIEF.md`.

## 4. Content ownership

| page | owns |
|---|---|
| Home | concise research identity and selected entry points |
| Research | the four research programmes |
| Papers | full publication status, author, venue, note, and external link |
| Field | trip overview and documentary contact sheet |
| NSF / iGEM essays | the two first-person field narratives |
| Record | all twelve 2023–2026 milestones and full honours notes |
| About | biography, profile facts, contact, and CV |

Avoid repeating full paragraphs. A short cross-link or compact selected item is
enough. Claims with numbers must come from the record or an authoritative
source. In particular:

- Year 1: 20iterations placed second in the overall competition. The 600+
  participation figure covers entries across the three tasks and must be kept
  as a separate clause, not treated as the overall-ranking denominator.
- Year 2: second in Imageomics: Sentinel Beetles and tied fourth overall.
- Mei Yi-Chi Memorial Medal: one of eight university-wide recipients and the
  sole College of Science recipient in the published NTHU list.

The CV is a separate PDF source; audit it separately when factual entries change.

## 5. Adding or changing content

1. Edit `src/content.json` for facts or reader-facing copy.
2. Add a route renderer only when a page has a distinct job.
3. Emit both languages with `bi()`; do not hide missing translations behind CSS.
4. Use `img()` / `plate()` / `art()` so dimensions, srcsets, loading, object
   position, and alt metadata stay correct.
5. Rebuild preview, test, then run the live build.

Do not hand-edit generated HTML. Do not regenerate the art with the deleted
legacy NumPy spiral script; the committed WebP masters are the canonical set.

## 6. Runtime rules

- `PE.loop` is the only animation owner.
- Hidden documents stop work; fixed and reduced-motion modes remove the
  substrate loop completely.
- Content settles via IntersectionObserver and a hard four-second fallback.
- Theme and language persist in local storage (`pe.mode`, `pe.lang`).
- The drawer, command palette, filter controls, mail copy, and lightbox must be
  keyboard-operable.
- A failed WebGL context must recover to a valid static or live state matching
  the current theme.

## 7. Release QA

Run:

```bash
python3 -m py_compile src/build.py
python3 src/build.py
python3 src/build.py --live
node --check assets/runtime.js
node --check assets/substrate.js
git diff --check
```

Then inspect all nine routes at desktop and 390 px mobile widths in both themes
and languages. Check:

- one `h1`, no duplicate ids, no broken fragments;
- no missing alt text or unnamed controls;
- no horizontal overflow, clipped title, overlapping text, or blank art board;
- chronology has 4 year groups and 12 event links/cards;
- day/night persistence and reduced-motion static state;
- drawer, filter, lightbox, email copy, CV, DOI/arXiv/GitHub links;
- no console exception, failed same-origin request, or broken image;
- deployed asset hashes match the local live build.

## 8. Open items

- Keep the two anonymous submissions venue-neutral until disclosure is allowed.
- Audit `Chi-Wei_Lee_CV.pdf` separately whenever an award or status changes.
- Keep the Git remote credential-free.
