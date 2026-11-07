# Hybrid desk sprite

- Generated 2026-10-20 with built-in `image_gen`; precise-object-edit.
- Edit reference: `web/assets/studio-styles/soft3d/desk.png`.
- Source direction: `F:/zuri-product/design/application-profiles/visual-office/README.md`, current brand entry and Character Kit v0.9.4 routing. No character generated in this asset.
- Original output: `C:/Users/suanr/.codex/generated_images/01a1589e-5d6b-7603-b4c5-05a3bafb4208/exec-3d862b0a-3932-4d69-b0c6-cc420307b3a2.png`.
- Delivered byte-preserved PNG sprite, 1254 × 1254, RGBA (requested 1024 square); not a rotatable mesh.
- Camera target: fixed orthographic, approximately 30-degree elevation, front/right visible.
- Lighting: upper-left soft key, baked contact shadow. Do not add a second strong runtime shadow.
- Suggested ground anchor: normalized `(0.51, 0.86)`; desk footprint roughly `x .08–.95`, `y .53–.84`. Runtime composition must verify these visual estimates.
- Whole sprite is solid foreground suitable for character-behind-desk occlusion. Separate back/front layers are not delivered.
- Visual inspection: chair removed, desk preserved, no people/text. Minor faint isolated alpha specks near former chair area may be visible against high-contrast backgrounds; no postprocessing performed.
- Runtime placement/scale not verified by asset producer.

## Generation prompt

Use case: precise-object-edit. Asset: one separate draggable Soft 3D desk sprite for Zuri Visual Office hybrid design studio. Input image is the actual edit target and design reference. Remove the sage chair ENTIRELY, including its back, arms, seat, legs and shadow. No chair and no people anywhere. Preserve the recognizable cream rounded crescent/oval desktop, warm light-wood vertical slatted curved solid front fascia, tasteful amber accent edging, blue rear-facing monitor, keyboard, cup and small plant on the desktop. Maintain smooth rounded premium mobile simulation game rendering, front and right visible, approximately 30-degree elevated orthographic camera, upper-left soft key light. Desk must be complete, centered, largely fill a requested 1024x1024 square while retaining safe clear transparent margin. Solid desk front fascia must remain suitable for depth occlusion, monitor at rear of desktop visible. Background genuinely transparent, only subtle local contact shadow, no floor slab, no room, no typography, no text, no UI, no logos. Do not crop desk, do not add any chair or person. Preserve original furniture design while separating chair away.
