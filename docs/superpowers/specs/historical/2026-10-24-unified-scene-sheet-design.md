# Unified Scene Sheet rebuild — owner correction

The previous approach is rejected: independent generated room/prop pictures and independently authored greybox geometry cannot be fixed by switching renderers or per-piece offsets. Remove that approach from the rebuilt Projects floor. This instruction supersedes the earlier painted-skeleton interpretation for this new edition.

## One source

Use a measured orthogonal metric plan plus stable object IDs/positions/scale/yaw in the existing room JSON, tagged sceneSheet=office-sheet/v1. Rebuild Projects from a 12x8m plan with orthogonal walls, real door opening, rear windows, four existing workstations, lounge/water/board/corridor. Preserve avatar IDs/kinds/count and interactions; do not author Agent roles. V1 automatically rebuilds only supported 1–4 workstation inventories with matched chairs, no extra unpaired avatars, one of each main fixture and up to two plants. Reject unsupported inventory without changing the draft; larger automatic layouts are future work. Clear rejected image-match offsets and independently generated room-art selection only in this explicitly rebuilt floor. Original assets/files remain historical inputs, not active layer sources.

## Image means a layer, not a different room

Build the actual Three.js meshes once. A render target bakes their static beauty appearance with the same orthographic camera into a camera-aligned image plane. Static meshes stay in the same scene and supply depth/occlusion; actors remain live. Dev hides only that baked image plane and exposes wireframe on those same static meshes. It must not dispose/recreate the renderer, change room/camera/viewport/object transforms, stop actors, switch routes, or load another PNG/greybox. Studio art/structure/overlay also operate these same layers. Re-bake after source edits, retain image/geometry correspondence through zoom and resize, clean GPU resources on disposal/context loss.

## Layout and navigation

The sheet compiler validates the metric plan and compiles wall spans and canonical furniture transforms. Desk and chair orientation must share world x/z axes; avoid camera-facing furniture cards. Derive furniture footprints from actual rendered model bounds, padded for actors, and pass those to navigation rather than use an independent approximation. Door/wall geometry and nav share the existing validated measured blueprint spans. The navigation editor and walk tests use the same source. Source edits move beauty, geometry and collision together; old per-piece image matching controls are hidden for this edition.

## Delivery

Add a Studio rebuild action, explicit per-floor Save/file exchange and a layer inspector on the same page. New default Projects can use this sheet; old saved drafts are rebuilt only by the explicit action. Do not reset unrelated floor saves, branch state, logo or global theme. Rich warm ivory/oak materials, soft shadows and measured soft 3D furniture retain the office tone; no claim of exact reproduction of the old independently generated painting.

Acceptance: orthogonal metric transforms; same camera/node identities before/after Dev; static bake camera registration; actor mode/position/path preserved; actual model bounds == nav blockers; source edit updates both art and geometry; Save/reload and floor isolation; browser side-by-side layer screenshots and route audit; synthetic only. Record art quality separately from structural acceptance.

## Composition and cleanup details

The image-only helper pass contains one camera-aligned quad, not another room.
It composites first with alpha; a static depth pass (actors hidden) follows,
then the same scene renders live actors with static nodes hidden. This handles
depth-writing transparent bottles before actors while intentional glass keeps
depthWrite=false. Wireframe uses the same static geometry. Grid lines participate
in layer configuration instead of drawing twice. Original material/render order
states restore at sync/edition boundaries and on disposal; architecture-owned
textures are explicitly released. No independent image source is loaded by a
sheet-tagged scene, including hidden sprite images.
