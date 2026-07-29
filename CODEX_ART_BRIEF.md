# Aizuri illustration production record

The nine site illustrations were generated on 2026-07-29 with Codex's built-in
image generation mode, then cropped and encoded as responsive WebP assets. This
file records the final prompt family so future work can extend the same series
without returning to the old procedural spirals.

## Shared production prompt

**Type:** stylized concept illustration for a world-class bilingual academic
portfolio.

**Material and palette:** warm natural kozo paper (`#F1EBDD`); Prussian indigo
(`#173B57`); charcoal sumi (`#172027`); desaturated asagi (`#6E8FA2`); at most
one tiny vermilion accent (`#B64232`). Authentic sumi capillary bloom,
watercolour granulation, dry-brush edges, and restrained Edo aizuri-e woodblock
key lines. Visible paper fibres and pigment pooling, generous deliberate space.

**Composition:** calm editorial asymmetry, a clear focal current, readable at a
wide crop or card size, and enough low-detail space for nearby interface text.
The image should feel like an original scientific notebook plate rather than a
decorative background.

**Exclude:** words, letters, numerals, signatures, logos, watermark, frame,
famous ukiyo-e composition, direct Great Wave quotation, generic concentric
spiral, glossy liquid chrome, 3D render, neon, cyberpunk interface, photoreal
human, stock gradient, or unexplained floating object.

## Asset-specific prompt additions

| master | scene direction |
|---|---|
| `img/art/home-ink.webp` | A broad indigo current rises from layered mountain/island contours into a translucent ink cloud; one tiny red seal/circuit junction; open right-side paper for the name. |
| `img/art/research.webp` | Four distinct tributaries—memory lattice, probabilistic basin, neural topography, diffusion grid—join one continuous indigo river without literal labels. |
| `img/art/papers.webp` | Five quiet paper/rock strata settle like archived sheets, linked by one thin indigo current and a tiny vermilion registration mark. |
| `img/art/field.webp` | Two travel routes cross an imagined coast: one toward a geometric American city silhouette, one toward a Parisian exhibition hall; no landmarks copied literally. |
| `img/art/record.webp` | Four terraced river levels carry twelve small milestone stones, dense enough to imply chronology but never a chart or axis. |
| `img/art/thread-pc.webp` | A memory lattice and descending prediction stream meet; the uncancelled residual continues as one clean indigo branch. |
| `img/art/thread-langevin.webp` | Several brush paths sample a soft multimodal probability basin instead of converging on one peak. |
| `img/art/thread-fmri.webp` | An abstract head/topographic contour contains a sparse three-dimensional spatial lattice and one denser decoded region. |
| `img/art/thread-diffusion.webp` | A QR-like square lattice remains optically legible while passing through a controlled indigo mist and edited brush field. |

## Masters and derivatives

- `home-ink`: 2000 × 900; `-400`, `-800`, `-1200`.
- `research`, `papers`, `field`, `record`: 2000 × 750; `-400`, `-800`, `-1200`.
- Four thread cards: 1200 × 900; `-400`, `-800`.
- WebP masters use quality 88; derivatives use quality 84.

The committed masters are the production source. When extending the series,
generate one semantic scene at a time with the shared prompt, inspect it at day
and night contrast, produce the same responsive widths, and rebuild with
`python3 src/build.py --live`.
