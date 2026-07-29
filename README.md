# Chi-Wei Lee — Aizuri Research Notebook

Bilingual academic portfolio for Chi-Wei Lee (李騏維), published with GitHub
Pages at [arthur031221.github.io](https://arthur031221.github.io/).

The site combines warm kozo paper, Prussian-indigo aizuri-e, restrained sumi
diffusion, and a small amount of vermilion with a contemporary research
notebook. It is static HTML with hand-written CSS and JavaScript: no framework,
package manager, CDN, or runtime dependency.

## Design system

- **Day / fixed** is warm paper with living wet pigment at a restrained pace.
- **Night / vivo** is a dark indigo rubbing with a quicker ink current.
- **Reduced motion** always receives a composed static frame.
- A single canvas bubble layer turns real refraction into sparse ukiyo-e
  keylines; it shares the site's one animation clock.
- Five original chapter illustrations in `img/art/` replace the old fluid
  plots. Their production record and prompt family live in
  `CODEX_ART_BRIEF.md`.
- Spectral and a local Ming/Song fallback carry the editorial voice; Martian
  Mono and Instrument Sans provide the technical register.
- Vermilion is reserved for the 李 seal and small navigational accents.
- The Record is semantic HTML: four year chapters and twelve readable event
  cards, rather than a sparse or hover-dependent canvas.
- Documentary photography is organised as event-linked memory rivers. Award
  certificates remain uncropped, unfiltered evidence rather than decoration.

## Routes

| route | purpose |
|---|---|
| `index.html` | identity, research focus, selected work, current direction |
| `research.html` | four research threads and verified research-place photos |
| `publications.html` | five papers/preprints with status and links |
| `field.html` | the NSF and iGEM journeys plus a curated contact sheet |
| `field-nsf.html` | concise NSF HDR field essay |
| `field-igem.html` | concise iGEM field essay |
| `record.html` | 2023–2026 chronology, honours, and field work |
| `about.html` | biography, profile, contact, CV |
| `404.html` | direct recovery navigation |

## Build

Root HTML is generated. Edit `src/`, not the root pages.

```bash
python3 src/build.py          # preview → _index.html, _research.html, …
python3 src/build.py --live   # publish → index.html, research.html, …
python3 -m http.server 8080   # local HTTP preview
```

- `src/content.json` is the factual and bilingual content source.
- `src/build.py` owns route composition and responsive image markup.
- `src/shell.html` owns the shared head, navigation, dialogs, and footer.
- `assets/site.css` owns both themes and all responsive layout.
- `assets/runtime.js` owns navigation, language/theme state, reveal, filters,
  lightbox, and the single animation broker.
- `assets/substrate.js` owns the subtle background wash.
- `assets/bubbles.js` owns the floating air and woodblock registration lines.
- `img/moments/` contains metadata-free responsive documentary photographs;
  `img/evidence/` contains the small, verified award evidence set.

The build adds content hashes to CSS and JavaScript so a GitHub Pages
deployment does not combine stale assets with fresh HTML.

## Content and accessibility contract

- Every reader-facing sentence is available in English and Traditional Chinese.
- Page content remains complete without JavaScript.
- Each page has one `h1`; images carry intrinsic dimensions and alt text.
- Controls use native buttons/links and visible keyboard focus.
- No custom cursor, autoplaying content instrument, boot gate, scroll-jacking,
  or canvas-only information.
- Active-review author lists remain abbreviated; the current CV identifies the
  two co-first-author submissions as NeurIPS 2026 under review.
- Competition and award wording should be checked against the official source
  before it is changed.

See `HANDOFF.md` for the maintenance contract and QA checklist.
