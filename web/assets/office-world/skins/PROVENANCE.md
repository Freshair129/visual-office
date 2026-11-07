# Projects painted skins v1

## Quarter-turn extension

Three additional 1536×1024 atlases at 90/180/270 degrees use independently
rendered geometry references from the same `objectSkinFrame` and model factory.
Each retains the same 3×2 cell order. `r90-prompt.md`, `r180-prompt.md` and
`r270-prompt.md` record exact built-in imagegen prompts; the latter two include
the targeted correction removing front controls from the cooler's back panel.
The manifest pins all reference/final raster bytes and the extended frame source.
Default 0-degree projection and existing artwork remain unchanged.

Generated backgrounds are clipped by original physical geometry, not trusted
as alpha cutouts. References are edit targets; the original painted atlas is
style only. No external stock asset, Agent data or live business content was used.

25 October 2026. Built-in imagegen; no external stock assets or live business
data. `projects-reference-v1.png` is a deterministic geometry reference rendered
from `makeOfficeProp(kind, 'signature')`, `objectSkinFrame`, the Office light
palette and orthographic camera. `manifest.json` pins geometry sources, file
hashes, raster sizes and cell order. Rebuild/re-register artwork if geometry or
projection changes. Image backgrounds are clipped by actual mesh geometry;
the shader never derives collision from image alpha.

Reference page source: `scripts/skin-reference.html` (temporarily served from web
for authoring). The 3×2 atlas order is desk, chair, sofa / cooler, board, plant.

## Exact object-atlas prompt

Edit target is this exact 3-column by 2-row game furniture atlas. Keep canvas aspect 1536x1024, equal 512px square cells, EXACT placement, silhouettes, scale, angle, screen corners, desk corners, edges, chair arms, sofa cushions, water bottle, board frame and planter. This is a projection-mapped game skin; changing shape or location breaks the game. Repaint only within existing silhouettes into premium hand-painted 2.5D office tycoon illustration: warm honey oak fine wood grain, cream enamel cabinetry, dark teal monitor with subtle pale work UI, sage upholstery with fine woven texture and stitched seams, soft hand-painted warm edge highlights, refined ambient shading, illustrated leaves inside the existing plant outline. More detailed painterly office/lobby illustration, not pixel art, not low-poly flat material. Preserve the existing warm cream/sage/gold colours. Transparent background, no backdrop, no ground, no cast shadow outside silhouette, no text or grid lines or labels. Top row desk, chair, sofa; bottom row water cooler, whiteboard, potted plant. Do not add or remove objects. Stay precisely registered with the reference in all six cells.

The returned atlas has a painted backdrop despite the transparent request.
Geometry projection intentionally masks it; it must not be used as an unmasked
sprite or advertised as an alpha cutout.

## Exact architecture-atlas prompt

Create a seamless architectural texture atlas for premium hand-painted 2.5D office tycoon game, warm classic illustrated lobby palette. Square canvas split into exactly TWO equal vertical halves. LEFT HALF: warm ivory cream plaster wall, very subtle painterly brush grain, a soft warm luminous surface, no objects, no trim, no shadows or directional gradients, seamless. RIGHT HALF: honey oak parquet office floor, straight parallel fine wood planks with subtle seams and organic painted grain, top-down flat material swatch, no perspective, no objects, no border, no lettering. Restrained elegant cozy office illustration. This is texture data to wrap existing 3D surfaces, not a rendered room. Both halves fill edge to edge and have uniform illumination.
# Cross-platform source hashing

`manifest.json` declares `geometrySourceEncoding: utf8-lf`: geometry source
digests are SHA-256 of UTF-8 text after CRLF-to-LF normalization. This keeps the
same admitted geometry contract on Windows checkouts and Linux CI. Image hashes
remain SHA-256 of the exact original binary bytes; no image is rewritten.
