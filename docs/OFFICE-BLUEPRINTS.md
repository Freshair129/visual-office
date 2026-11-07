# Measured Office blueprints

**26 October scope:** these are active local presentation/editor tools, including
the additive GLB adapter sections below. Native/Hybrid/GLB saves remain separate
compatible editions. The authorized-domain synthetic surface does not enable
Studio or shared scene saves before a scoped Zuri contract exists. Furniture,
seats, groups and navigation never create Agent identities/roles. Current runtime
and evidence boundaries are indexed in [the documentation guide](README.md).

Current local implementation, 23 October 2026. Owner requested measured, reusable room templates after the image-derived Three.js shell appeared skewed. This describes the Office editor and introduces no Zuri platform authority.

| Template | Clear interior | Area | Outer plaster extent | Sample workstations |
| --- | --- | --- | --- | --- |
| S · Compact | 8 × 6 m | 48 m² | 8.4 × 6.4 m | 2 |
| M · Team | 12 × 8 m | 96 m² | 12.4 × 8.4 m | 6 |
| L · Open office | 16 × 10 m | 160 m² | 16.4 × 10.4 m | 8 |

Workstations are furniture examples, not Agent capacity or roles. Open offices have lounge, work area and a 2 m circulation strip. Entry clear width is 1.2 m. Walls are 0.2 m thick, rear/left height 2.8 m; foreground cutaway height is 0.65 m. Oak caps may extend beyond the plaster extent. These are simulation templates, not construction or building-code drawings.

## One measured source

`web/office-blueprints.js` owns metre dimensions and orthogonal local x/z coordinates. `blueprintPoint` projects them through `office-projection.js` into the existing normalized editor. One world unit equals one metre and 100 fixed **design px**. CSS pixels depend on camera, viewport and zoom; dimensions are not estimated from a painted picture.

`blueprintLayout` supplies the same boundary, zones and walls to `office-architecture.js` and `office-navigation.js`. The shell is real Three.js geometry with one-metre joints along world axes. Furniture/characters share the camera and depth buffer. The directory arrow is real ground geometry. Desk approaches are in front of matched chairs; tests require every template station to be reachable from the circulation strip.

`blueprintSVG` creates the top view from the same source, including dimensions, entry, furniture, avatars and route/forbidden overlays. For an applied template it uses actual current draft positions. Unsupported legacy sprite props are not architectural footprints. Cards preview template furniture; selecting a card alone changes no floor.

## Studio workflow

1. Select the department floor. Lobby retains its 2D scene and cannot receive an Office blueprint.
2. Select S/M/L in **BLUEPRINTS** and inspect the measured plan.
3. Choose **ใช้แม่แบบกับแบบร่างชั้นนี้**. This replaces furniture/navigation in the draft and retains avatar IDs, kinds and count. Over-capacity, dense or oversized avatar inventories are rejected before normalization; the original draft stays intact. Furniture IDs avoid preserved avatar IDs. Initial avatar spacing reserves a scale-dependent walking envelope in the 2 m circulation strip; this is not a general crowd/actor-to-actor avoidance system.
4. Move furniture, edit paths/interactions and test walking. Undo/Redo includes template selection.
5. **บันทึกชั้นนี้** saves only the selected local floor. Other department floors can reuse it through the existing assignment flow.
6. Download SVG or room JSON. Normal floor export retains `office-floor/v1`; downloads alone do not save a floor.

Optional `room.blueprint` allowlists `small`, `medium`, `large` in `office-room/v1`, only with Office background. Old files without it retain their original shell. Saved rooms are not silently migrated; explicitly apply a template to straighten them. Strict import rejects unknown values and blueprint floor files for Lobby.

## Reusable files and verification

`scripts/build-office-blueprints.mjs`, included in `npm run assets`, creates deterministic SVG/JSON under `web/assets/office-blueprints/`. Static JSON contains no avatars or platform identity. Studio retains the selected draft's decorative avatars when applying.

- [Small SVG](../web/assets/office-blueprints/small.svg) / [room JSON](../web/assets/office-blueprints/small.json)
- [Medium SVG](../web/assets/office-blueprints/medium.svg) / [room JSON](../web/assets/office-blueprints/medium.json)
- [Large SVG](../web/assets/office-blueprints/large.svg) / [room JSON](../web/assets/office-blueprints/large.json)

Tests: `tests/office-blueprints.test.mjs`, `tests/hybrid-studio.test.mjs`, `tests/hybrid-office-3d.test.mjs`. Local evidence: `reports/office-blueprints-20261023/`. Hosted CI, physical-device performance and live Zuri API/Agent integration are separate and unrun. Zuri contracts remain paused.

## Direct structural authoring — 23 October refinement

In an applied Office blueprint, choose **แก้ผนัง / ประตูหน้าต่าง**. Orange handles move the four walls with the opposite edge anchored; cyan moves the door, purple moves windows. Dragging an opening to another edge transfers it to that wall. Numeric fields select the wall and edit width, depth, opening offset and opening width. Keyboard arrows move a selected handle by 0.1 m; Shift moves 1 m. New windows can be added to a free span, and the selected window removed.

Dragging previews real Three.js geometry immediately. Releasing creates one Undo entry. Pointer cancellation, loss of capture or Escape restores the draft without saving the preview. The normal Studio Undo/Redo controls include structural edits. Geometry changes rebuild/dispose the shell while preserving furniture models, positions, scales, IDs, interactions, avatar inventory and authored navigation. Collision wall spans and the SVG use the same new doorway position. Window-bearing foreground walls rise high enough for their openings.

Authoring is currently **orthogonal rectangular rooms**, 8–16 m wide and 6–10 m deep, within the fixed camera frame. Invalid dimensions, overlapping door/windows, openings beyond wall ends or more than eight windows are rejected with a message. The doorway is at least 1.2 m; openings keep 0.2 m from corners and 0.15 m from one another. Resizing does not automatically reflow furniture: warning checks known scaled/oriented planning footprints (including conservative avatar envelopes), not just centers. Legacy sprite-only props use their ground anchors when no physical planning footprint exists. Rearrange the scene before using a layout with overlap warnings; save does not certify navigation or a construction drawing.

**บันทึกเป็นเทมเพลต** stores a named structural plan in the separate local library `zuri-office:blueprint-templates:v1` (max 20). This does not save a floor. Existing floors can load a named plan directly from **นำแปลนที่บันทึกมาใช้**; this preserves inventory even for Garden/City source scenes, while switching the architecture to Office. On an existing blueprint the same library appears inside its editing controls. The geometry-only path must not trigger historical printer removal or lift remapping. Some preserved legacy props remain sprite-rendered.

**บันทึกชั้นนี้** uses the existing selected-floor revision check and persists the plan alongside the room. Other floors remain unchanged. Downloaded room/floor JSON includes the plan; named library entries are structural only. Storage survives refresh on the same browser/origin and is not a shared Zuri database. Export files for portable backup.

Optional `room.blueprintPlan` contains `{version:1, base, width, depth, originX, originZ, door:{wall,offset,width}, windows:[{id,wall,offset,width,sill,top}]}`. `base` matches `room.blueprint`; offsets and origins are in metres. Unknown fields, non-finite values and malformed templates are rejected by strict imports. Legacy rooms without this field remain unchanged. `office-blueprint-state.js` owns validation and the template library; `office-blueprint-editor.js` owns authoring and previews. Tests are in `office-blueprint-authoring.test.mjs`, `office-blueprint-editor.test.mjs` and the existing Studio/3D suites. Current delivery evidence lives in `reports/office-blueprint-authoring-20261023/`.

## Interior rooms and connecting doors — 23 October refinement

Open blueprint editing and choose **วาดผนังกั้น**, then drag on the top view. The dominant drag axis determines an orthogonal wall, snapped to 0.1 m. Boundary starts snap inside the thick outside wall. Green centre handles move a partition; endpoint handles adjust its length. The target selector and keyboard arrows also select/move partitions. Choose **เพิ่มประตูเชื่อมห้อง** on a selected partition, then drag its cyan handle or enter its offset/width. **ลบช่องประตู** fills that opening; **ลบผนัง / พื้นที่ที่เลือก** removes the selected interior element, with ordinary Undo/Redo.

Choose a meeting/work/rest type and name, then **วาดพื้นที่ห้อง** and drag a rectangle to colour/label its use. Its amber centre handle moves the label area. **ใช้ชื่อ / ประเภทกับห้องที่เลือก** updates its classification. These areas are presentation labels, not automatic enclosures: walls and door gaps determine physical reachability, and labels do not create domains or Agents. Furniture remains in its existing position; moving a wall through furniture requires rearranging that furniture.

**ลองเดินเชื่อมห้อง** finds free standing points near the centres of the named areas, then generates collision-safe paths between them in their saved order. It reports inaccessible/fully obstructed rooms; it does not teleport across a sealed wall. A real transient 3D character follows the generated path, reports completion, and **หยุดลองเดิน** returns actors to their authored positions. Reduced motion keeps its existing no-animation behavior. Generated probes are bounded at 512 vertices; authored navigation routes remain 2–32 vertices per route. When partitions obstruct an existing authored route edge, runtime reroutes that edge around current geometry, retaining the saved route data and forbidden zones. A blocked endpoint or disconnected room stays unreachable. Exact authored-route tests still test their actual vertices rather than silently rewriting them.

Optional plan extensions, all in metres:

```json
{
  "partitions": [{"id":"partition-1","axis":"z","at":3,"start":0,"end":8,"door":{"offset":6.1,"width":1.4}}],
  "areas": [{"id":"area-1","type":"meeting","name":"ห้องประชุม","x":0.2,"z":0.2,"width":2.6,"depth":3.4}]
}
```

`axis:x` runs along local x at fixed z; `axis:z` runs along z at fixed x. Door offset is measured from `start`. Maximum 16 partitions, length ≥1 m, inside the clear room and at least 0.3 m from parallel exterior walls. One optional 1.2–3 m door per partition, with ≥0.2 m at each end; walls shorter than 1.6 m cannot receive a door. T/cross junctions are allowed, parallel overlaps rejected; doors must stay 0.3 m from a junction. Maximum 12 named areas, each dimension ≥0.5 m. Areas may overlap; coincident walking anchors produce an overlap explanation. Invalid explicit null/falsey collections are rejected, while old omitted fields remain readable. Exterior resizing retains interior elements' world anchors and rejects changes that would put them outside the room.

Partition spans are split around door gaps once in `blueprintLayout`, then consumed by SVG, Three.js and collision/navigation. Interior wall meshes use 0.2 m thickness and a 1.2 m visible cutaway height so occupants remain visible. Room-area floor patches use the shared metric projection. Named templates and floor JSON include both optional arrays; template save does not save a floor, and floor save affects only the selected floor. No inventory/role/count changes result from structural editing.

Implementation: `office-interior-editor.js` composes with the existing structural editor. Verification: `tests/office-partitions.test.mjs`, blueprint editor, navigation, Hybrid Studio and 3D suites; local browser evidence in `reports/office-interior-20261023/`. This is a local simulation editor, not a building-code CAD system or a shared Zuri scene service.

## Interactive door state — 23 October refinement

Exterior and interior doors have actual Three.js jambs, headers and sliding panels. Click a closed panel directly, or its keyboard-accessible **เปิดอยู่ / ปิดอยู่** control, to toggle it. The blueprint editor also has an **เปิด/ปิดประตูที่เลือก** button. This toggles the leaf state; **ลบช่องประตู** is a separate structural edit that removes the doorway entirely. Open panels retract out of view; closed panels fill the threshold. The state change is immediate, without a swing/slide tween. Frames are 2.25 m high for adult head clearance even where adjoining walls are cut away to 1.2 m.

Both `blueprintPlan.door` and each `partitions[].door` accept optional `open:boolean`. Omitted means **open**, preserving previous plans and saved templates. Explicit false closes the door; malformed non-boolean values are rejected by strict imports. The shared layout emits door records and closed-door collision segments, so mesh state, SVG and navigation agree. Furniture, forbidden areas and all other wall blockers remain active.

Closed doors prevent route generation across that doorway; opening them restores reachability if the rest of the route is clear. Existing moving actors revalidate their next segment, detour if another safe path exists, or stop. A character within 0.4 m of the threshold prevents closing until it clears, rather than being relocated through the wall. If 3D is unavailable, blueprint fallback characters remain static; fallback animation does not ignore closed-door collision.

In Studio, toggling changes the draft, is undoable, and requires **บันทึกชั้นนี้** for persistence. Named templates and floor/room JSON include the boolean state. In Visual Office's saved local floor, clicks save that floor immediately with a fresh revision check. A stale tab or failed storage write leaves its previous scene state intact and reports failure. Current-edition/file/library previews are read-only. Closing a door does not change roles, permissions, Agent data or any other floor. This remains local browser storage; no shared Zuri persistence is implied.

Source: `office-blueprint-state.js`, `office-blueprints.js`, `office-architecture.js`, `office-navigation.js`, `hybrid-office-3d.js`, `hybrid-scene.js`; actual-floor persistence guard: `office-door-save.js`. Tests: `office-doors.test.mjs`, `office-door-save.test.mjs` and Studio/renderer/BuildingView regression suites. Evidence: `reports/office-doors-20261023/`.


## GLB Studio adapter — 24 October 2026

The owner approved bringing the existing blueprint, path, seat and door workflow into the
Tycoon GLB edition for Lobby and Projects. This is local presentation authoring; it adds no
Zuri schema, Agent, role or business authority. Start at **Design Studio → แต่ง Tycoon GLB**.

1. Select **G · Lobby** or **01 · Projects**. The editor loads that floor's saved Tycoon room.
2. In **แปลน / ห้อง / ประตู**, choose S/M/L or drag a wall. Orange handles resize the room;
   cyan/purple handles move doors/windows. Numeric dimensions use metres (100 design px/m).
   Draw interior partitions, add a connecting door and label meeting/work/rest areas.
3. In **ทางเดิน / พื้นที่ห้ามเดิน / จุดนั่ง**, add a route or forbidden polygon. Drag its
   points, add/remove points or use the keyboard. Select a desk/sofa/coffee point to edit its
   approach; desk/sofa points also expose the seat anchor. Invalid access is diagnosed.
4. Use **ลองเดิน** or **ลองใช้จุดนี้ใน 3D**. One generic GLB probe follows the collision map,
   approaches a matched chair/sofa, sits, works, stands and returns. Stop removes the probe.
   Editing, changing floors/tools or hiding Studio stops it. No probe becomes a saved Agent.
5. Click a door in 3D or use its named button. Closed doors add both a visible panel and a
   collision barrier. An occupied threshold refuses closing. Studio toggles are drafts with Undo.
6. **บันทึกเป็นเทมเพลต** stores structure only in the existing bounded local template library;
   it does not save the floor. **บันทึกชั้นนี้** saves the full room independently of other floors.
   Undo/Redo includes structural/navigation changes. JSON export/import retains both optional
   fields in `office-floor/v2`; routes in progress and reservations are never exported.
7. **เข้าดูชั้นนี้** opens the saved GLB floor. Local runtime door clicks save with the loaded
   revision; conflict/storage failure keeps the old visible state. Business-selected views
   cannot save local door changes or run the local probe as a business Agent.

Floor saves, runtime door saves and edition selection acquire the same origin-scoped Web Lock
before reading/checking/writing the shared Tycoon storage blob. Two tabs cannot both commit the
same revision. A waiting save uses an immutable captured draft; later edits stay dirty and a
completed save cannot replace another loaded floor. In-app navigation waits for a pending save
to finish (or time out), so it never offers to discard a draft that is still being committed.
Missing Web Locks or a lock timeout refuses
the write and leaves JSON export available. This is local browser coordination, not a Zuri
transaction or shared multi-user save; reload older tabs before editing with this version.

Implementation routing:

- `web/tycoon-blueprint.js`: GLB structural compiler, rotated/scaled footprint adapter,
  station matching and navigation factory. `tycoon-scene.js` assembles versioned GLBs.
- `tycoon-studio.js`: shared editors, draft history, transient preview, template/floor save.
- `tycoon-activity.js`: route/station probe, reservation lifecycle, occupied-door guard.
- `tycoon-state.js`: optional validated `blueprintPlan` / `navigation`; legacy keys stay separate.
- `tycoon-view.js`: runtime local door revision boundary and accessible object/door actions.

Coordinates have one explicit translation: legacy blueprint world = GLB world − (2,2) metres
on X/Z. `tycoonGround` and `tycoonWorld` are inverses. Plan origins, navigation points and named
structural templates remain compatible with the existing editors; GLB furniture keeps its
world position when walls move. Actual wall/window spans and door widths come from the same
`blueprintLayout`. GLB blockers use catalog footprints after scale/yaw, with 0.3 m actor
clearance; metric wall and forbidden-edge margins avoid relying only on projected percentages.
Shrinking a room retains out-of-bounds inventory and reports it; it never removes or clamps props.

A desk uses one nearby unused chair (within 2 m), and an authored seat must remain on that chair.
Seats must be on floor-level furniture; a raised chair is diagnosed rather than used as a
teleport target. Routes cannot cross closed doors, walls, props or forbidden zones. Station
probes start from the current safe position or a real aisle spawn, never from the destination
when the destination is unreachable. Seated contact may ignore only its own chair/sofa blocker.
Ambient motion is disabled for reduced motion; explicitly requested probes remain available.

Compatibility: older Tycoon rooms without these optional fields remain valid and retain their
inventory. Historical imported sizes outside the blueprint range (8–16 × 6–10 m) retain a basic
GLB shell and export/edit access; select a supported structural size explicitly to enable the
new tools. The editor does not silently normalize those older dimensions.

Local tests: `tests/tycoon-{blueprint,activity,state,studio,scene,view}.test.mjs`, together with the
existing blueprint/navigation suites. Browser and command evidence are recorded in
`reports/office-tycoon-design/`; current delivery results live in the implementation-plan ledger.
Shared Zuri saves and live roster/commands remain separate gates. GLB group/layer/texture tools are implemented locally (see below).


## GLB selection, groups, layers and textures (24 October 2026)

In Design Studio choose **แต่ง Tycoon GLB**, then Lobby or Projects. Click or Shift-click
props, drag a rectangle over empty space, or use the Layers checkboxes. Group creates one
flat group; selecting any member selects the set. Ungroup preserves positions. Move mode
supports pointer drag and arrow keys; numeric X/Z deltas and Snap align the shared pivot.
Scale uses one uniform factor around the group center. Rotation and duplicate also apply
to the selected set; copies have fresh object/group IDs. One action is one Undo.

Layers supports front/up/down/back and persists the complete object order. Actual 3D depth
testing remains enabled; raising a layer cannot make furniture show through a wall.
Material/Texture targets the selected props, floor or walls. Upload PNG/JPEG/WebP (8 MB max),
normalize to embedded PNG up to 512 px, and adjust repeat/offset/rotation/opacity. The scene
is capped at 2,000,000 UTF-8 bytes; JSON export/import retains the texture without external URLs.

Save commits only the selected floor. Preview/runtime consume the same room state; no build
is required to use a saved design. Local storage and exported JSON are local presentation
state, not shared platform persistence. Groups never create agents or change roles. Authored
seat/approach points follow selected furniture and copies; test walking after changing layout.

Code: `tycoon-transform.js` (atomic transforms/groups/layers), `tycoon-selection.js`
(projected selection and pointer gestures), `tycoon-edit-tools.js` (controls/import guards),
`tycoon-state.js` (validation/save), `tycoon-scene.js` and `surface-finish.js` (owned materials).
Source GLBs remain shared and unchanged; instance finishes are disposed on rebuild and cached
source textures on scene disposal. Canvas textures retain allocation dimensions during decode.

## Reusable furniture sets in Asset Library (24 October 2026)

In **แต่ง Tycoon GLB**, select a desk/chair group (or multiple furniture pieces), enter a
name under **Asset Library · ชุดของฉัน**, and press **บันทึกชุดที่เลือก**. The card preview
renders only the selected GLBs using their saved materials/textures. Texture decoding finishes
before capture. A changed floor, draft or selection cancels an in-flight save.

Choose Lobby or Projects, set placement X/Z in metres, and press **วางชุด**. The set becomes
one new group in that floor's draft with fresh object IDs, copied seat/approach anchors,
relative positions, sizes, rotation, colors, textures and layer order. Placement is one Undo.
Test the seat/walk path against the destination room, then Save the floor explicitly. Existing
floor contents, routes and all Agent counts/roles remain unchanged. Obstacles at the new
location may require moving the set or its interaction points; a prefab does not grant a path
through furniture or walls.

Library records use `office-furniture-set/v1` under separate per-entry browser keys beginning
`zuri-office:furniture-set:v1:`. There are up to 24 local sets, each with 2–40 furniture pieces,
a bounded PNG thumbnail and the existing 2 MB room limit. Room shell, full routes, forbidden
areas, lift/domain navigation and business/Agent bindings cannot enter this payload. The
current card category is personal local furniture sets; it is not a shared model service.
Storage errors are shown without overwriting existing sets or changing floor state. Reload
Library refreshes cards saved in another tab. Floor JSON export includes placed furniture and
its anchors/textures; it does not export the personal library itself.

Code: `web/tycoon-prefabs.js` owns validation, relative capture, fresh-ID placement and storage;
`web/tycoon-prefab-library.js` owns cards and save guards; `TycoonScene.furnitureThumbnail`
uses an isolated scene/render target and disposes temporary materials/texture resources.
Tests: `tests/tycoon-prefabs.test.mjs` proves cross-floor anchors, visual metadata, fresh IDs,
invalid payload rejection, storage failure, default seat capture, Undo/save and stale capture.

Before saving or placing a set, local validation checks grounded, scaled/rotated seat
footprints and the approach-to-seat segment against selected furniture (0.3 m clearance).
The matching chair/sofa is excluded at the seat endpoint. Unrelated destination obstacles
remain the floor navigation system's responsibility. Independent review findings on these
checks were fixed and reviewed again with no remaining findings in the changed scope.

### Portable furniture-set files

Press **ส่งออกชุด** on a card to download `.office-set.json`. On another installation,
open **แต่ง Tycoon GLB → Asset Library → นำเข้าชุดจากไฟล์**. Import adds a new library
card; it does not change any floor. Place the set and explicitly Save the destination floor.

`office-furniture-bundle/v1` embeds the validated set, PNG preview, colors/materials,
embedded textures, transforms/layers, seat/approach anchors and deduplicated GLB bytes.
The complete file is limited to 8,000,000 UTF-8 bytes. It needs no source-browser storage.
The receiving app must have the same compatible Tycoon kit: import verifies its revision,
canonical catalog/geometry fingerprint, GLB headers and SHA-256 hashes. Unsupported or
modified bundles are rejected before storage. This is compatible-kit portability, not an
arbitrary custom-model installer. After verification, the library references the byte-identical
installed GLBs rather than storing duplicate binaries. Export embeds those bytes again.

`web/tycoon-prefab-files.js` owns the codec. `tests/tycoon-prefab-files.test.mjs` covers
round-trip preservation, fresh storage, mismatch/corruption rejection and no-floor-mutation
UI imports. Neither the file nor import creates Agents or changes their roles.

### Custom GLB library (24 October 2026)

In **Asset Library → ＋ นำเข้าโมเดล GLB ของฉัน**, choose a GLB, name, category and physical
height. The model is centered on X/Z and grounded at its bottom; dimensions retain the source
aspect ratio. Choose decoration, standing interaction or seating, then enter local metre
coordinates for the approach and optional seat, seat height and facing. **ดูพรีวิวโมเดลและจุด**
renders the actual model with green approach/purple seat markers. **บันทึกโมเดลเข้าคลัง** adds
a card without editing the floor. Place it, test walking, then explicitly Save the floor.

Custom objects use their measured rectangular footprint for collision, not a bundled prop's
size. This conservative footprint can block gaps in irregular furniture. The navigation editor
can override approach/seat on a placed instance; transforms and duplication carry those points.
Custom chairs with a seat interaction can also serve an adjacent bundled desk. Categories are
visual metadata, never permissions or Agent roles. The initial editor supports one approach and
one optional seat per object. It imports static props, not animated/rigged character replacement.

Accepted input: GLB 2 with embedded geometry and PNG/JPEG textures, at most 16 MB, 200,000
triangles including instances, 2048 primitive instances, 4096 px per image and 16,777,216 aggregate image pixels.
Unsupported extensions/compression, external resources, rigs, animation and malformed assets
fail with an explanation. Model bytes are immutable SHA-256 entries in IndexedDB
`zuri-office-custom-models`; small card/descriptor records and floor snapshots retain their
existing stores. Refresh does not erase them. Clearing browser site data does; export files
are the portable backup. Storage failures do not report success or modify a floor.

Custom or mixed sets use `office-furniture-set/v2` and portable `office-furniture-bundle/v2`
(64 MB max), embedding each custom binary once, bundled dependencies, texture overrides,
preview and all points. Custom-only files need no installed model kit. Mixed sets verify the
referenced built-in models and metric geometry contract. Legacy v1 files remain supported.
Import validates every dependency before writing model blobs and then adding a fresh card.
An interrupted card write can leave an unreferenced deduplicated blob; no automatic deletion
is performed. Existing floors and Agents are never changed by import.

Floor JSON still carries model references, not binary archives: on another machine import the
portable asset sets as well. A missing binary is reported and never replaced with a default
model. Descriptor snapshots on placed objects prevent later library imports from changing
existing floors. Source materials and embedded textures are preserved unless the user applies
an instance finish override.

Implementation: `web/custom-assets.js` (inspection, normalization, descriptor, binary store),
`web/custom-asset-panel.js` (authoring and preview), plus the existing scene, navigation,
prefab and portable codec adapters. See the custom GLB design and implementation plan under
`docs/superpowers/`; tests are in `tests/custom-assets.test.mjs`.
