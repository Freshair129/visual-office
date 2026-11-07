# Perspective art and individual skeleton calibration

Owner requests angle-corrected newly generated art first, then independent wall/desk/chair skeleton position/scale editing without moving raster art or changing Agent count/roles.

## Art pass
Built-in imagegen generated sibling office-isometric-v5.png, work-desk-isometric-v2.png and task-chair-isometric-v2.png using original style plus the actual Three.js screenshot as angle authority. Orthographic camera is unchanged: azimuth45/elevation31.33. Original assets remain. Optional officeArt enum legacy-v4/perspective-v5 selects the reference/art pack per floor; absence means original, so existing saved scenes do not migrate. Generation approximates camera geometry, not a proof of pixel-exact reconstruction; Studio overlay and per-piece calibration are the final alignment tool. No logo/UI is baked into these images.

## Per-piece state
Optional skeletonParts list contains bounded {id,x,y,scale}, same reference-pixel translation and uniform .5..1.5 scale as global alignment. Stable targets: seven legacy wall IDs and physical non-character prop IDs. Avatars, Agent fields, arbitrary URLs, unknown/duplicate targets and blueprint-wall IDs are rejected. Offset/scale defaults are identity; deleting furniture prunes only its dormant override. Whole-floor alignment stays separate. Piece offsets are local to the physical group, divided by global scale during pointer drags so mouse travel remains aligned.

Derive a transient physical room for mesh/collision/stations from authored objects plus overrides; never rewrite authored x/y/scale or image positions. Wall groups and built-in fixtures transform together; nav wall spans and fixture footprints use the same transform. Floor bounds remain the original footprint: this is calibration, not building expansion. Moved rear walls become explicit blockers. Custom approach/seat anchors follow their corresponding physical targets; blocked stations fail closed. Painted art and its image anchors do not follow physical overrides.

## Studio
Add a target selector (whole structure, walls, furniture), retain numeric controls and whole-stage drag for the selected target. Add picking/select from a target list and selected-target indication. Drag previews and commits one Undo on release; cancel/navigation/Undo restores. Reset affects only the selected target. Target changes cancel pending gestures. Switching art pack is explicit, Undoable and saved per floor. View modes/opacity/selection remain transient. Existing revision-checked Save and floor JSON carry optional fields.

## Acceptance
Strict codec and legacy/file roundtrip; art/inventory unchanged by calibration; independent wall/desk/chair editing, single Undo/cancel, floor isolation and stale-save protection; renderer/nav agreement; generated asset alpha and selectable legacy/new references; browser built Worker Save/reload. Synthetic only, no live calls.
