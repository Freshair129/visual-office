# Original 3D floor editing

**Current edition boundary (26 October):** the additive `tycoon3d` Lobby/Projects
editor, v2 floor files, prefab/custom GLB tools and local per-floor saves are
implemented; see [GLB Studio](OFFICE-BLUEPRINTS.md). The default surface preserves
the original art; GLB is an explicit saved edition. “Lobby remains 2D” below
describes the original Native v1 edition, not every current renderer. Retain
`office-3d/v1` and existing Hybrid snapshots without silent migration. Shared
Zuri persistence and connected Agent acceptance remain gated; dynamic Studio is
disabled until its scoped scene contract exists.

Implemented locally on 20 October 2026 at `http://127.0.0.1:4181/#office/studio`, tab **แก้ฉาก 3D ประจำชั้น**. This extends the original Office renderer and geometry; it does not replace the scene with a screenshot or the separate procedural model prototype.

## Workflow

1. On an original 3D domain floor, choose **แก้ฉาก 3D ชั้นนี้**. Studio opens its native editor with that floor selected. The Hybrid floor toolbar also links to the corresponding native editor.
2. Select furniture by clicking its mesh or list entry. The catalog adds desks, chairs, plants, coffee tables and cabinets (up to 48 movable objects per floor). Duplicate copies the transform and interaction with a new prop ID; Delete removes the selected object and clears selection to avoid deleting a different item by accident. Both operations support Undo/Redo and respect locks/Play mode. Drag on the ground plane, nudge with arrows, or enter X/Z metres and rotation degrees. Desks and chairs move independently. Existing slot identities remain fixed.
3. Lock a piece to protect its transforms and interaction. Undo/Redo changes the draft only. “หมุนมุมกล้อง” lets drag orbit the camera instead of moving furniture; zoom and reset are separate controls.
4. Configure a text popup, elevator directory or a destination floor. “ค่าเริ่มต้นของชิ้นงาน” retains role selection for original seat furniture; added props have no role action. Test directly or use Play; Play disables object edits.
5. **บันทึก 3D และใช้กับชั้นนี้** writes an independent floor snapshot and selects the native edition. **เข้าดูชั้นนี้** opens the actual floor with the same geometry, transforms and interaction. Unsaved changes prompt before floor switching, leaving the native tab or navigating through its controls.
6. Export `visual-office-<floor>-3d.json`. Opening it validates the file, names the target floor, then loads a draft for visual inspection; it does not apply until Save. The Hybrid importer routes native files to this editor.

The 14 existing domain floors have 3D scenes. Lobby is a 2D scene and remains in Hybrid. Floor names and role identities still come from the existing preview catalog; this work does not resume upstream Zuri model/API/role integration.

## One scene state for editor and runtime

- `web/native-state.js` owns the original DESKS coordinates, extensible furniture catalog, stable original seat identities, bounds, validator and history. `web/office.js` imports those defaults instead of maintaining another coordinate list.
- `Office` owns each actual mesh group by `desk-0..5` and `chair-0..5`. `setNativeRoom` reconciles additions, removals, kind changes and transforms; new desks share the original GLTF asset, while generated chair/decor geometry is released on removal; `snapshotNativeRoom` can read their transforms. Editing uses camera raycasting and a ground-plane intersection, with one history change per completed drag. Cancel/lost capture restores the starting transform.
- Existing avatars and role labels follow their original chair transform. Removing that chair leaves the same agent standing at its default role position. Added/duplicated furniture never receives a slot or creates an avatar; duplication strips the original slot. Undo restores the original chair binding. Furniture edits never remap agent identity or role. The editor uses the same `Office` class, room/desk GLTF assets and `makeChair` geometry as the actual floor.
- Renderer labels/loading nodes are scoped to the instance so Studio does not write into the main Office's labels. Hidden editors suspend rendering, pending loads honor disposal, and owned GLTF/geometry resources are released on exit.
- `web/office-interaction.js` renders popup text with `textContent` and dispatches only allowlisted local floor/elevator actions. Actual floors also expose configured furniture actions as accessible buttons.

## Built-in asset library

The 3D Studio includes an **OFFICE ASSET LIBRARY** below the scene. Use **ทั้งหมด / เฟอร์นิเจอร์ / ของตกแต่ง** or search by display name, source file or stable Asset ID. Each card previews its image, name, Asset ID and model format; clicking it places that model in the current floor draft, selects it in the inspector and allows the existing move, resize, finish, interaction, duplicate, group and layer tools to edit it. The current catalog has 20 placeable entries: 15 GLBs plus the five original native desk/chair/decor implementations. The GLB kit covers three desk tiers, an ergonomic chair, meeting table, lounge sofa, coffee table, storage cabinet, reception counter, bookcase, floor lamp, whiteboard, coffee station, elevator bay and a movable plant. Each floor still has the existing 48 movable-object limit.

Model metadata and IDs are owned by `web/office-assets.js`; generated GLB metadata is also recorded in `web/assets/models/studio/manifest.json`. A placed prop stores its stable `assetId` in that floor's `office-3d/v1` state, so save/reload and JSON export resolve the same bundled model. The library is a fixed inventory shipped with the browser app: it does not upload assets, browse a server/R2 bucket or create Zuri business/domain records. Room templates and presentation-only mannequin models remain non-placeable and hidden from the furniture/decor categories. Adding a model never adds an Agent, role or seat assignment.

## Storage and compatibility

The existing local storage key `zuri-office:hybrid-studio:v1` gains `nativeFloors` and `editions`. Keys remain `preview:<floor>`. A native save atomically stores a validated layout and selects `native3d`; existing Hybrid data is retained as an inactive alternative. Applying Hybrid selects its edition again. Returning to original selects the unmodified built-in scene.

`office-floor/v1` now accepts `edition: "native3d"` with an `office-3d/v1` room:

```json
{
  "schemaVersion": "office-3d/v1",
  "objects": [
    {"id":"desk-0","kind":"desk","slot":0,"x":-3.25,"z":-2.5,"rotation":0,"locked":false,"interaction":{"type":"none"}}
  ]
}
```

The example is valid as shown. Rooms allow zero to 48 movable objects, including deletion of original pieces. Existing 12-piece v1 files remain readable. Original IDs `desk-0..5` / `chair-0..5` retain their matching slot; new IDs use `prop-<uuid>` and must omit slot. Kinds are desk, chair, plant, coffee-table and cabinet. Copies retain only furniture/interaction state, never agent metadata. X is bounded to -5.5..5.5, Z to -3.8..3.8, rotation to -180..180 degrees. Interaction shapes are none/elevator, popup with title up to 80 and plain body up to 1,000 characters, or a known preview floor. Unknown fields, external URLs, arbitrary scripts, foreign scopes, duplicate identities, forged prop slots and invalid transforms are rejected. Geometry is referenced by the app's fixed assets, not embedded into JSON.

Save compares the current floor edition/layout against the revision loaded by the editor. An intervening write causes a conflict message and preserves the draft. Denied storage also preserves the draft. Hybrid saves detect native edition changes as well.

Connected Zuri Business views suppress local preview layouts and reset to original geometry. No tenant/business IDs, business operations or agent capabilities are changed.

## Verification and limits

- Tests: native schema/file round-trip, floor isolation, atomic denied writes, conflict checks, draft guards, interaction/HTML exclusion, numeric input before blur, late renderer disposal, and original Three geometry transforms/seat positions/pointer cancellation.
- Actual browser: dragged desk 1 and chair 5 separately; set desk 1 to X -3/Z -2.8 and chair 5 to X 1.2/Z 3.1/rotation 30; saved, switched floors, returned from actual Office and verified values. Popup rendered in Studio and actual Projects after reload.
- Evidence: `reports/native-studio-20261020/`; final commands/results recorded in docs/records/design-qa.md`.

This is a local catalog-based furniture editor, not a general mesh modeller. Walls, floor and windows support finish editing with fixed geometry. The eight original decor pieces support transforms, duplication and deletion as described below. There is no collision solver, automatic walking/pathfinding, seat-to-desk alignment, arbitrary external mesh import, server synchronization or multi-user revision history. Moving a chair can separate its character from the desk; the editor does not claim to resolve that arrangement automatically.

## Furniture catalog verification — 20 October 2026

- `npm test`: 204 passing tests. Adds catalog/empty-room round-trips, locks/Play, undo/delete, original-file compatibility, cap validation, malicious slot/role rejection, per-floor reload and geometry disposal checks. The renderer test retains identical agent objects, avatars and role-label count through chair deletion, added props, empty rooms and restoration.
- `npm run build`: passed, 238 embedded assets.
- Browser: duplicate/delete original furniture; delete original chair while retaining four visible role labels; Undo; add three decorations, configure a plant popup, drag the new plant, save Projects, inspect Customer's unchanged 12-object native layout, visit the actual Projects floor, reload and open the new popup.
- Mobile: 390px viewport, no horizontal overflow, catalog and duplicate/delete controls are 44px high; add/copy/delete and Undo/Redo exercised. Temporary test furniture removed and original furniture restored.
- Saved example: Projects has its original 12 pieces plus plant, coffee table and cabinet. Original desk popup/transforms and chair-5 transform remain. Customer and Lobby editions remain unchanged.
- Evidence: `reports/native-catalog-20261020/`. Storage remains this browser's local preview; there is no platform write or agent dispatch.

## Original room finishes — 20 October 2026

Choose a visible surface directly in the 3D scene, or use **ผนัง พื้น และของเดิมในห้อง** under the canvas. The inspector switches to **ROOM FINISH**. Pick a material, a palette swatch, a custom color picker or a six-digit HEX color. **คืนสีและวัสดุเดิม** removes the override for that part. Save uses the same floor snapshot and conflict checks as furniture; Undo/Redo and Play protection also apply.

17 stable targets: left/back walls, tiled floor/base, three separate window frames and three panes, lounge sofa/table, coffee cabinet/kit, pinboard and three original plants. Materials: original, matte, wood, stone, fabric, metal and frosted glass. Wood/stone/fabric use bounded local procedural texture maps; these are renderer presets, not scanned material assets or optical refraction. The original multicolor materials return exactly when reset. Structural surfaces remain fixed. Original movable decor now also supports transforms, deletion and duplication; see the refinement below.

Optional `surfaces` in an existing `office-3d/v1` room:

```json
{"wall-left":{"color":"#a6b9b3","material":"matte"},"floor":{"color":"#9b7352","material":"wood"}}
```

Only allowlisted surface IDs and material IDs and `#RRGGBB` colors are accepted. Old files without surfaces retain the original finishes. External texture URLs, scripts, unknown fields and identity/role data are rejected. `web/room-surfaces.js` owns target IDs and preset metadata; `web/models.js` exports stable `surfaceId` extras into room/floor-tile GLTF assets. `web/surface-finish.js` owns instance-local material overrides and procedural maps. `Office` restores source materials before constructing the shared overview template, so one edited floor cannot recolor every floor or dispose a material retained by the tower.

Verification: `npm test` 207 passing; `npm run build` 240 assets. Includes schema/backward compatibility, edit/reset/undo, file round-trip, floor conflicts/isolation, independent material instances, original material restoration, cleanup and tower template isolation. Actual browser verified direct wall picking, changes across wall/floor/window/sofa, saving and reload, Customer remaining original, and reset/Undo. Evidence: `reports/room-finishes-20261020/`.

## Movable original decor and furniture finishes — 20 October 2026

Select the original sofa, lounge table, coffee cabinet, coffee kit, pinboard or any of three original plants. The same object inspector now moves, rotates, locks, duplicates or deletes it. Direct mesh drag and numeric/nudge controls both work. Deleted originals display **นำกลับ: …** in the room list; this restores just that original item at its default position as an undoable draft edit. Play blocks restore and all edits. Original seat and agent identities remain unchanged.

All furniture, including added desks/chairs, has a color/material panel. A copy inherits the current finish, transform and interaction as independent data. Desk finishes affect its top/cabinet; chair finishes affect upholstery, preserving electronics and hardware. Reset clears that item's override. Original decor retains its previously saved room-surface finish until explicitly overridden/reset. Changes to a copy cannot recolor its source or another floor.

Compatibility: optional `decor` is an explicit array of surviving original pieces with reserved IDs `builtin-<source>`, `kind: "room-decor"`, an allowlisted source and the standard transform/lock/interaction plus optional `finish`. Omitted decor means the eight original pieces; an empty array means all were removed. The first edit materializes this inventory with inherited legacy finishes. A duplicate goes in `objects` with a fresh `prop-…` ID, same source and no agent slot. Ordinary objects also accept a validated optional `finish` `{color,material}`. Existing v1 files still load, and all state travels in the per-floor file/store. The 48-object inventory cap remains; up to eight original decor pieces are additional. The UI counts both and reports remaining capacity.

Rendering uses independently positioned clones of the original GLTF groups with a stable pivot per source; there is no asset replacement. Original source geometry/materials remain owned by the GLTF loader. Removed clones release only their private finish overrides; shared geometry survives until Office disposal. Hidden source groups cannot intercept picking. The building overview temporarily uses original source groups and finishes.

Validation: 212 tests passed; build 240 assets. Includes original transform/duplicate/delete/restore, legacy color preservation, floor/file round-trip, slot/source/finish injection rejection, copy material isolation, actual geometry/pivots and cleanup, and primary-furniture paint masks. Browser evidence in `reports/movable-decor-20261020/`.
# Scale, perspective, group transforms and textures — 20 October 2026

The native editor now has **ขนาด / ตำแหน่ง** and **สี / พื้นผิว** inspector tabs.

- Resize any furniture/decor object, including original room props, through W/H/D inputs or percentage (10–400% per axis). Keep proportions on, or disable it to edit individual axes. Width/height/depth measure the complete unrotated object geometry, including its attached monitor/accessories.
- Dimensions use **100 design px = 1 world metre**. The selection frame separately reports projected CSS pixel bounds; those change with camera, zoom and viewport. The values are not interchangeable.
- Choose Isometric or Perspective 3D per floor. The selection frame's corner handle uniformly scales selected meshes and, for a multi-item selection, their spacing around the set center. X/Z tilt (−60° to 60°) and yaw preserve actual 3D geometry. This is 3D projection and scaling, not Photoshop four-corner raster warping.
- Shift/Ctrl/Command-click objects or layer rows, or use **เลือกหลายชิ้น** for touch. Dragging an already-selected object moves the selection without collapsing it. Group translations and duplicates preserve spacing and use one undo step. New copies have no agent slots. Locked pieces remain unchanged; the drag-resize handle is disabled if the selection includes a locked piece.
- Snap grids at 10/25/50 design px use world X/Z axes. Optional alignment snapping uses nearby unselected object origins (12 design px tolerance). **จัด X ตรงกัน / จัด Z ตรงกัน** align to the primary selection. Group translation clamps the whole group at its anchor limits, preserving relative spacing. Grid, selection and inspector tabs are session tools, not floor content.
- Upload PNG/JPEG/WebP into an object's or structural surface's finish. Adjust U/V repetition, offsets, rotation and opacity; existing surface color tints the image. The editor normalizes to embedded PNG, at most 512 × 512 and 180 KB of data URL, reducing resolution for complex images. Input files are limited to 8 MB / 32 megapixels. No external texture URLs, SVG, layered PSD import, paint brush, UV unwrapping or per-face selection are implemented.
- Saves and floor JSON include scales, tilt, projection and embedded texture. Room payload is capped at 2 MB; imported floor files at 2.5 MB. Storage quota errors retain the draft for export. Undo retains at most 60 snapshots / approximately 12 MB of serialized past snapshots.

Schema extensions retain `office-3d/v1`: object `scale:{x,y,z}`, `tilt:{x,z}`; room `projection:'orthographic'|'perspective'`; finish `texture:{data,repeatX,repeatY,offsetX,offsetY,rotation,opacity}` (null removes an image). Omitted fields preserve previous layouts. Texture resources are instance-owned, disposed on changes, and image-load callbacks are generation-guarded.

## Marquee selection, saved groups and layer stack

Drag on empty room space to draw a selection rectangle around projected object bounds. The rectangle selects every intersected furniture/decor item; Shift/Ctrl/Command adds to the current selection. Selecting one member of a saved group selects the whole group. **จัดกลุ่ม** saves a shared `groupId`; **แยกกลุ่ม** removes it while keeping the pieces and their transforms. Moving, resizing and duplicating a group act on the full set in one undo step. A copied group receives new furniture IDs and a new group ID; source agent-seat bindings are never copied. Group membership is stored in the selected floor's native snapshot and its JSON export.

The layer panel is ordered front-to-back: its first item is the front editor layer. **นำมาไว้หน้า**, **เลื่อนขึ้น**, **เลื่อนลง** and **ส่งไปหลัง** reorder selected items; a saved group moves as one block. This stack is local to that floor and appears in the exported `office-3d/v1` file. Optional item `groupId` values use `group-<uuid>` and each group has at least two adjacent members. Optional room `layers` is a complete, unique front-to-back list of object IDs; old files without either field keep their original order and remain valid. The layer stack controls editor order and transparent draw priority; solid 3D occlusion continues to follow camera and geometry.

Validation: **219 tests pass, none skipped; build includes 242 assets**. Browser proof includes group selection/move/duplicate/Undo on desktop and mobile, perspective corner drag from 115% to approximately 142.52% and undo, upload/UV edits, save/reload, native-floor rendering, floor isolation, and actual file download/import. Final Projects sample retains 26 objects: new desk at 115%, X tilt 5°, repeated/rotated embedded test texture; Customer remains unchanged. Four agent role labels remain intact. Browser error log empty. Evidence and logs: `reports/transform-texture-20261020/`.
