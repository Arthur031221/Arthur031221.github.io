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

- The **substrate** is ink dropped into still water, simulated: a dye field
  advected through a divergence-free curl-noise flow, with one extra force —
  ink is denser than water, so it sinks. A drop billows, breaks into lobes,
  stretches into tendrils and dissolves into haze, and all of it is
  consequence, not effect. Drops are the only source; the still water is
  留白, the part of the world the model already predicted. The register is
  aizuri-e — Prussian blue on pale water by day, luminous ink in dark
  indigo water at night, under a bokashi band.
- **Figures are still by default** and run only while you engage them. One
  moving thing at a time.
- **Images first.** Every page has artwork slots that activate the moment
  the pieces exist in `img/art/` — `CODEX_ART_BRIEF.md` is the complete
  generation brief.
- **Two families of type.** Spectral and 明體 for headings and the essays,
  Martian Mono for every label, readout and axis. The painting is old and the
  instrument is not.
- The two registers are **two sheets, not an inversion**: `in vivo` inverts the
  paper the way a rubbing (拓本) inverts carved stone — the sheet is night and
  the ink is luminous, and it moves. `fixed` is ink on dry 宣紙 and it does not,
  because a dry sheet has stopped. The toggle runs a real temperature schedule
  on the hero sampler — quenching one way, heating the other.
- **Chroma is semantic.** 胭脂 carmine is top-down prediction, 花青 indigo is
  bottom-up evidence, 石青 violet is inhibition. Frames, rules and labels stay
  achromatic. 朱砂 vermilion is used once, for the seal.
- Scroll depth is **cortical depth**: the left axis names the lamina you are
  in, and the right rail is a spike raster that records each section as it
  fires, not a scrollbar.
- **Nothing appears more than twice.** Every fact belongs to one page, which
  writes it out in full; elsewhere it may appear once more only in short. The
  record plots the papers without naming them; about counts the honours and
  links to the record that owns them.

## Routes

| file | what is on it |
|---|---|
| `index.html` | The name, and nothing drawn in front of it; threads, selected papers, honours, field |
| `research.html` | Four threads, four live instruments, and a relationship map whose edges are only the real ones |
| `publications.html` | Five entries with status stated as it actually stands, and a filter |
| `field.html` | Two trips, a contact sheet, a lightbox |
| `field-nsf.html`, `field-igem.html` | The two long-form essays, in full, in both languages |
| `record.html` | Every honour with its citation, the field work, and all of it on one axis |
| `about.html` | Biography, facts, contact |
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
- No custom cursor and no blended full-screen overlay layer.
- Everything pauses when the tab is hidden or the element is off-screen.
- `prefers-reduced-motion` gets a designed static state, never a blank hole.
- Content settles by scroll sweep with a hard 4-second fallback, so no effect
  can cost a reader the text.
- Every displayed number is computed live, cited, or taken from the record.
  The instruments print what they measured, not what the papers reported.
- Anonymous submissions stay venue-neutral until disclosure is permitted.

See `HANDOFF.md` before changing anything.
