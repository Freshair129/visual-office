# Quarter-turn implementation plan

Execute inline with superpowers:executing-plans; independent review at closure.

**Goal:** 90° physical and illustrated furniture rotation in grid placement.
**Spec:** ../specs/2026-10-25-quarter-turn-design.md

- [x] Add strict backward-compatible rotation state and rotated candidate/anchor tests.
- [x] Generate 90/180/270 geometry references and registered illustrated atlases;
  share orientation-specific projection and measured bounds with the renderer.
- [x] Add transient rotate, confirm/cancel and cell preview to Projects/Studio;
  carry pending angle through click/drag and cancel safely.
- [x] Verify grid/nav, per-floor Save/reload, four-turn identity, material/texture
  cleanup and asset errors; run tests/build and independent review.
- [x] Exercise the final built Worker in browser and record actual evidence.

Review focus: yaw units/legacy flip, anchoring and normals, invalid rotations,
pending preview leakage, orientation image load races and sparse old files.

## Delivery evidence — 25 October 2026

- Full `npm test`: **667 passed, 0 failed, 0 skipped**;
  `reports/dynamic-context/quarter-tests.log`.
- `npm run build`: passed, **411 embedded Worker assets**;
  `reports/dynamic-context/quarter-build.log`.
- Read-only independent GPT-6 Luna Max review `/root/quarter_turn_review` closed
  with no remaining actionable code findings. Reviewer did not run tests or UI.
  Fixed measured flipped-seat validation, shared kind restrictions, inspector
  resize/flip/effects retention, chair-seat tolerance and pending-preview teardown.
- Built Worker `http://127.0.0.1:4185/#office/projects`: rotated desk to 90°;
  invalid original placement rendered red and could not confirm. Clicked a free
  cell to place the turned desk; rotated board through 90/180/270/0 and back,
  observing actual front/back artwork and green/red occupancy changes.
- Save during an unconfirmed rotation was refused without losing the draft.
  Confirmed board at 90°, saved only Projects, refreshed and verified identical
  saved desk/board projected bounds. Then rotated chair with R, placed it facing
  the turned desk, saved and refreshed with identical desk/chair/board bounds.
- Studio loaded the same saved 90° chair; R previewed 180°, Escape restored its
  saved pose. No residual draft/save occurred. The final Projects view is back
  in play with original 16 objects/four actor IDs and ready skins.
- Explicit runtime **เดินในสำนักงาน** accepted for the first actor after saved
  desk/chair rotation. Deterministic tests additionally complete desk/water/sofa
  tours on a correctly arranged rotated workstation, checking every segment
  against actual grid/mesh blockers. A physically obstructed approach is allowed
  to be unavailable; the system never manufactures a route through furniture.
- Raster provenance: 0/90/180/270 reference and final atlas hashes in
  `web/assets/office-world/skins/manifest.json`; exact built-in imagegen prompts
  under that folder. Back panel fixes for cooler orientations 180/270 inspected.
- Screenshots: `reports/dynamic-context/projects-quarter-preview-final.png`
  (ready skin with green cells), `projects-quarter-preview.png` (board example).
- Synthetic/local presentation only. No hosted CI, physical mobile, live Zuri,
  production, commit/push/merge or shared persistence acceptance is claimed.

Rulings: real geometry clips raster skins, retaining depth/picking and collision.
Quarter-turn images are not old artwork arbitrarily warped around new sides.
Legacy non-sheet flip semantics remain isolated; sheets now consistently compose
flip as a half turn with the optional quarter-turn angle. Source actor IDs and
roles are never changed by these controls.
