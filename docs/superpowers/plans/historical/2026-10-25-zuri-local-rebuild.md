# Zuri local reconstruction from visual references

> Use superpowers:executing-plans for this owner-requested local reconstruction.

**Goal:** build an editable local Zuri GLB that follows the visible Tripo preview
and approved sheet, without extracting provider assets or invoking another job.

**Authority:** the owner explicitly requested local modeling from what is visible
if extraction is unavailable. This is execution of that fallback, not a new brand
direction. The original approved sheets remain unchanged; the provider preview
is visual reference only. The owner has already requested execution, so no new
concept or spending approval is required.

**Approach:** keep the established Three.js authoring/export/rig pipeline, replace
Zuri's head surfaces and bob rather than adjust the rejected generic head. Use
an original ImageGen face albedo derived from the owner's approved input, mapped
onto actual rounded geometry. It is a surface texture, not a billboard or claimed
provider download. Preserve separate eyewear, ears, clip, blink and body rig.
Refine Zuri's garment silhouette/folds within the same measured dimensions.

**Alternatives:** provider export remains account-gated; cache extraction is not
used. Reusing the rejected generic head unchanged does not satisfy the owner.
The local editable mesh plus original painted surface is the integrator's choice
for the requested rebuild, with the cost that likeness still needs visual review.

## Constraints and review focus

- Zuri only; staff and Wangjai bytes must remain unchanged.
- Keep 1.60 m nominal body, +Z front, y=0 ground, <120k triangles, <5 MiB.
- No floor replacement, Agent role/count changes, live calls, new provider spend.
- Preserve anatomical-right orange clip and brown bob, round glasses, cream
  windowpane cardigan, dark trousers and cream/orange shoes.
- Inspect real exported GLB front/side/back/face, blink, walking and seated.
- Verify deforming garment contact, ground contact and portable embedded textures.
- Visual resemblance is a review result, never inferred from passing unit tests.

## Tasks

- [x] Preserve current Zuri source/GLB and screenshots in ignored reports.
- [x] Generate and retain an original face texture with prompt and provenance.
- [x] Implement Zuri-specific head geometry/materials and curved bob in
  `web/characters/zuri-head.js`; integrate only for `kind === 'zuri'` in human.js.
- [x] Refine Zuri garment silhouette and embed its texture in the GLB builder.
- [x] Test reconstruction provenance, non-billboard geometry, texture/animation
  portability, model budgets and unchanged staff/Wangjai outputs.
- [x] Export, inspect in Character Lab on source/Worker, correct observed issues.
- [x] Run focused regressions, sequential build/full tests and independent review;
  record actual evidence and remaining visual limitations.

## Execution rulings

- Existing isolated Office worktree and dirty changes are preserved. No commit or
  publication is part of this pass. Do not install Blender or switch providers.
- Existing collision, walking, seating and animation tests remain the behavioral
  acceptance suite. New tests target changed asset contracts; appearance is judged
  by actual rendered geometry beside the source image.
