# Chi-Wei Lee — PE//1

Bilingual academic portfolio for Chi-Wei Lee (李騏維), NeuroAI, published with
GitHub Pages at `arthur031221.github.io`.

Nine static routes. No package manager, no framework, no CDN, no runtime
dependency — the whole site is hand-written CSS, Canvas2D and one WebGL
fragment shader. Every page is real HTML: with JavaScript switched off you
still get the entire site, in both languages.

## The idea

The cortex does not transmit the signal. It transmits the residual between
what it predicted and what arrived. The site is built on that rule, because
it is also what the research is about.

- The **substrate** behind every page is a cortical counterflow field.
  Prediction descends from L1, evidence ascends from L6, and what is drawn is
  the surface where the two exactly cancel — a phase map of the residual,
  quantised through an 8×8 Bayer matrix at sensor resolution.
- The two colour registers are **two imaging modalities, not an inversion**:
  `in vivo` is a live two-photon recording and it moves; `fixed` is a stained
  histology plate and it does not. The toggle runs a real temperature schedule
  on the hero sampler — quenching one way, heating the other.
- **Chroma is semantic.** Magenta is top-down prediction, teal is bottom-up
  evidence, violet is inhibition. Frames, rules and labels stay achromatic.
- Scroll depth is **cortical depth**: the left axis names the lamina you are
  in, and the right rail is a spike raster that records each section as it
  fires, not a scrollbar.

## Routes

| file | what is on it |
|---|---|
| `index.html` | Hopfield retrieval of the name, released into an eight-mode Langevin sampler; threads, selected papers, honours, field |
| `research.html` | Four threads, four live instruments, and a relationship map whose edges are only the real ones |
| `publications.html` | Five entries with status stated as it actually stands, and a filter |
| `field.html` | Two trips, a contact sheet, a lightbox |
| `field-nsf.html`, `field-igem.html` | The two long-form essays, in full, in both languages |
| `record.html` | The public record, and the whole of it drawn as a spike train |
| `about.html` | Bio, facts, honours, contact |
| `404.html` | An unresolved residual, and a way back |

## Build

The HTML is generated. Edit `src/`, never the root `*.html`.

```bash
python3 src/build.py          # preview → _index.html, _research.html, …
python3 src/build.py --live   # publish → index.html, research.html, …
python3 -m http.server 8080   # serve, so relative paths behave like Pages
```

`src/content.json` is the single source of truth for every fact and every
string. `src/shell.html` is the page shell; `src/build.py` composes the routes.

## Runtime contract

- Every user-visible string exists in English and Traditional Chinese, and both
  are in the HTML. Parity is checked at build review time.
- One animation owner site-wide (`PE.loop`); nothing starts a second rAF chain.
- Everything pauses when the tab is hidden or the element is off-screen.
- `prefers-reduced-motion` gets a designed static state, never a blank hole.
- Content settles by scroll sweep with a hard 4-second fallback, so no effect
  can cost a reader the text.
- Every displayed number is computed live, cited, or taken from the record.
  The instruments print what they measured, not what the papers reported.
- Anonymous submissions stay venue-neutral until disclosure is permitted.

See `HANDOFF.md` before changing anything.
