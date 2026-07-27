# Chi-Wei Lee — NeuroAI

The generated output of Chi-Wei Lee's bilingual academic portfolio, published
with GitHub Pages at `arthur031221.github.io`.

The site is nine static HTML routes with no package manager, framework, CDN,
external stylesheet, or runtime JavaScript dependency. Its two visual registers
are a phosphor research instrument and an ivory publication figure. Interactive
figures use handwritten CSS, SVG, and Canvas2D.

## Routes

- `index.html` — Hopfield retrieval and an eight-mode Langevin instrument
- `research.html` — four research threads and four accessible figures
- `publications.html` — status filter, evidence, citations, finite acquisitions
- `field.html` — trip index, deterministic comparator, contact sheet
- `field-nsf.html` and `field-igem.html` — bilingual long-form essays
- `record.html` — public record and photography
- `about.html` — bio, honours, career raster, contact
- `404.html` — bilingual recovery page

## Local viewing

No installation is required. Serve this directory so relative navigation and
View Transitions behave like GitHub Pages:

```bash
python -m http.server 8080
```

The authored sources and build/QA scripts live in the sibling `CV` workspace.
Generated HTML in this repository should not be edited by hand. See
`HANDOFF.md` for the source map, runtime constraints, build commands and factual
publication rules.

## Runtime contract

- Every visible UI string has English and Traditional Chinese variants.
- Dark and light are distinct scientific registers, not colour inversions.
- One continuous animation owner is enforced site-wide.
- Reduced-motion receives a static, fully readable result.
- Every displayed number is computed, cited, or sourced from the public record.
- Anonymous submissions remain venue-neutral until disclosure is permitted.
