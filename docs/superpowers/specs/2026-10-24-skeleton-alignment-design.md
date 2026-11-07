# Per-floor skeleton alignment

Owner requests Studio Dev controls to position/scale the 3D skeleton against the original art, with per-floor Save and no changes to images, logo or Agent inventory/roles.

Use optional room.skeletonAlignment {x,y,scale}: x/y are offsets in the fixed original 1536x1024 reference-image pixels; scale is uniform .5..1.5, around ground anchor (50%,65%). Offset limits +/-400 reference px. Defaults are identity and legacy files are unchanged. Reject unknown fields and nonfinite/out-of-range imported values. Existing RoomHistory, revision-checked per-floor Save and floor JSON exchange carry this optional presentation field.

The original raster artwork and authored prop image positions remain fixed. Apply the calibration to a shared physical Three.js group (room/wall masks/characters/procedural props) and the navigation display. Planner coordinates remain local to that group, so its collision, routes and stations transform together. Painted furniture stays on the original art layer. This is global alignment, not per-wall/per-prop geometry editing or Agent editing; existing blueprint/prop tools remain separate.

In the Studio draft, Dev opens image-only / structure-only / overlay controls, numeric X/Y/scale and opacity plus a whole-stage drag handle. Keep aspect/projection fixed. A drag previews transiently and commits one Undo on pointer-up; cancel restores the prior room. Changing floor or leaving Dev cancels gestures. Slider opacity/view mode do not persist. Explicit Save stores alignment in only the selected floor, guarded by existing stale-revision checks; reload and file roundtrip retain it.

A separate identity reference image layer lets the user compare original art and props against the structure. No asset byte changes or business/Agent writes. If WebGL is unavailable, show an unavailable message rather than claiming geometry alignment.

Verification: bounded validation and legacy roundtrip, matrix/projected offset and shared group ownership, floor isolation and stale-save rejection, editor drag/cancel/Undo, app/Worker Save/reload and original-art restoration. Use synthetic only. Physical-device gestures and live acceptance remain separate.
