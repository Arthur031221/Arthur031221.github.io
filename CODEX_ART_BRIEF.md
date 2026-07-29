# Aizuri illustration production record

The five chapter illustrations were regenerated on 2026-07-29 with Codex's built-in
image generation mode, then cropped and encoded as responsive WebP assets. This
file records the final prompt family so future work can extend the same series
without returning to the removed card-level fluid pictures.

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
| `img/art/home-ink.webp` | A Hokusai-inspired indigo current blooms into branching neural contours; broad upper-left paper remains open for the name. |
| `img/art/research.webp` | Four distinct tributaries—wet wash, carved waves, a neural arbor and a data lattice—converge around a deliberate white *ma*. |
| `img/art/papers.webp` | Five quiet pigment strata settle like archived sheets, with only faint signal traces and one vermilion registration point. |
| `img/art/field.webp` | Two indigo routes cross once at a small island, then separate toward distant imagined shores. |
| `img/art/record.webp` | Four compact terraced rivers carry exactly twelve milestone circles, avoiding the visual sparsity of a stretched axis. |

## Masters and derivatives

- `home-ink`: 1635 × 736; `-400`, `-800`, `-1200`.
- `research`: 1823 × 684; `papers`: 1855 × 696; `field`: 1828 × 686;
  `record`: 1844 × 692. Each has `-400`, `-800`, and `-1200` derivatives.
- WebP masters and derivatives use quality 82 / method 6 with metadata removed.
- The four obsolete card-level fluid illustrations were removed; research cards
  now let the verified UCLA, NTHU and Academia Sinica photographs carry the page.

The committed masters are the production source. When extending the series,
generate one semantic scene at a time with the shared prompt, inspect it at day
and night contrast, produce the same responsive widths, and rebuild with
`python3 src/build.py --live`.
