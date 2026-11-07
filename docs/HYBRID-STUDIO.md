# Hybrid Design Studio

**26 October runtime boundary:** this remains an active local editor and saved
floor renderer. The synthetic domain-candidate surface reuses its artwork via
`web/office-art-scene.js`, but does not enable Studio/shared scene writes. The
default Office shell keeps the illustrated campus/Lobby and fixed HUD. Agent
identity/status is separate from physical characters; current meshes are usable
temporary assets, not final visual approval. See [the source/status map](README.md).

**25 October experience refinement:** the current actor rig uses adult proportions,
distance-driven gait with planted feet and eased turns/sitting. Business-status
bubbles consume separately sourced transient states; ambient movement never
invents working/thinking. Unknown stays unknown, idle stays idle. Auto idle breaks
have named destinations and dwell/return phases. Sofa cushions have independent
reservations and anchors transformed with scale/yaw. Without the 3D navigation
adapter, fallback walking is disabled. See [people design](superpowers/specs/historical/2026-10-25-office-people-design.md).

The Studio button **ใช้แปลนแนะนำ · โต๊ะคู่ + มุมพัก** applies the measured recommended
layout as an undoable draft, preserving item/Agent IDs and counts. Save is still
explicit per floor; existing saved floor files are never silently migrated. The
arrangement separates workstations, the board discussion area and lounge/cooler;
the fixed-camera composition also keeps seated people clear of doorway frames.

For local end-to-end workspace testing use
`node scripts/serve-marketing-app.mjs --legacy-art --workspace` (:4184), or append
`--worker` after build (:4185). The visible synthetic notice identifies a fresh
memory bucket using actual existing Worker APIs. Chat queue, review and Knowledge
operations remain local test data; stopping the harness resets that test workspace.
Browser scene saves use their existing per-floor store and are not reset with it.

**24 October owner correction:** Projects' original Office image now stays visible
while depth-only wall geometry and alpha-tested original furniture art share the
Three.js buffer with people. The shared renderer selects this only for Projects
Office rooms without explicit custom blueprints. Studio previews use their actual
floor context; imported custom geometry keeps its own renderer. See the
[design](superpowers/specs/historical/2026-10-24-projects-painted-skeleton-design.md) and
[implementation/evidence plan](superpowers/plans/historical/2026-10-24-projects-painted-skeleton.md).
Painted actor artwork scale is 1.5 times the procedural edition to fit the larger
illustrated furniture; character IDs/count/roles and stored transforms are unchanged.
The existing navigation ground footprints and 0.3 m foot clearance remain authoritative.
Without WebGL this Projects presentation stays static, retaining the original images.

Applied floors use a frameless fullscreen room with fixed HUD/dock; Team/business
details open in a modal. At Full HD the 3:2 art covers the viewport with pannable
overflow, preserving proportions. Mobile retains at least 1,440 px of room width
with native scrolling, blank-ground drag and arrow keys. Studio itself remains an
editor; its room state, validation and explicit per-floor save are unchanged.

**Proposed Tycoon extension (23 October):** [Tycoon design §9.1–9.2](superpowers/specs/historical/2026-10-23-office-tycoon-design.md) specifies a new GLB `tycoon3d` edition including Lobby, a separate local store and v2 floor files. Existing Lobby/Hybrid/native snapshots and v1 readers remain intact. Only the new edition may render context-isolated local presentation drafts alongside live Zuri data; the connected-mode suppression described below remains the legacy behavior. These are reviewed design targets, not current implementation or runtime evidence.

Latest 23 October refinement: [Measured Office blueprints](OFFICE-BLUEPRINTS.md) adds orthogonal metric S/M/L templates, shared plan/Three.js/navigation dimensions and explicit per-floor draft application. Legacy saved shells remain readable until a template is deliberately applied. Lobby retains its existing scene.

Direct blueprint authoring now adds draggable rectangular walls, door/window positions, numeric measurements and a separate named structural-template library. `room.blueprintPlan` is included in floor/room JSON; geometry changes retain existing props. Read the linked blueprint document for limits, transient preview/Undo semantics, template-versus-floor save and current evidence.

Interior authoring adds drawable orthogonal partitions, connecting doors, meeting/work/rest labels, and a transient room-connection walking probe with Stop. Optional `blueprintPlan.partitions` / `areas` use the same metric geometry as Three.js and navigation and persist with templates and each floor. Read the Interior rooms section in [Office blueprints](OFFICE-BLUEPRINTS.md) for limits, route rerouting and local acceptance.

Doors now have optional persisted `open` booleans (legacy omitted = open), clickable 3D panels and accessible state controls. Closed doors block navigation; occupied thresholds reject closure. Studio changes are undoable drafts requiring floor Save, while clicks on a saved Visual Office floor use revision-checked immediate local saves. Read the Interactive door state section in [Office blueprints](OFFICE-BLUEPRINTS.md) for scope and verification.

Delivered locally on 20 October 2026: `http://127.0.0.1:4181/#office/studio`.

The default Studio now opens a playable room editor with **Painted 2.5D backgrounds, separate Soft 3D furniture sprites, the existing 2D Anime duo and 12 generic anime avatar sprites**. The three-style comparison and original procedural 3D room remain separate tabs. Follow [design sources](DESIGN-SOURCES.md) for the application profile and character authority.

## Generic avatar set (20 October 2026)

The object drawer now has separate **Furniture**, **Decor** and **Characters** groups. Characters includes the existing Zuri/Wangjai duo plus 12 addable generic avatar illustrations (`avatar-01` to `avatar-12`). The atlas lives at `web/assets/office-world/hybrid/characters/avatar-atlas-12.png`; each SVG wrapper presents one 4×3 atlas cell as an independent catalog item. The shared renderer crops each runtime avatar directly from the atlas so browser restrictions on external images inside SVG do not hide the characters.

The 12 avatars are visual placeholders for room composition only. They are deliberately unnamed and are not mapped to a Zuri AgentDefinition, role, permission, tenant, business or live agent status. They are 2D sprite art with standing, walk-stride and seated atlases, not GLB models or skeletal rigs. Scene files persist only an approved local catalog key and placement, without agent identity. Keep the existing default-room cast unchanged; add an avatar explicitly from the catalog when designing a room.

## Office Idle floor refinement (23 October 2026)

The owner selected an Office Idle reference with an elevated isometric cutaway room,
rear work area and front circulation/lounge zone. Domain baselines now use
`background: "office"`: a Painted 2.5D architectural backdrop at approximately
35-degree elevation / 45-degree yaw, matching Soft 3D isometric computer desks
and ergonomic task chairs. This camera supersedes the earlier straight-on room
baseline for new domain defaults; existing Garden/City and saved rooms retain their
original composition. The shared renderer and Current Edition use the same room.

New catalog items: `work-desk`, `task-chair`, `team-sofa`, `whiteboard`, `printer`.
Work desks have open leg space, dual monitors and keyboard/mouse/document accessories;
the original curved desk and Sage chair remain independent reception-style catalog
items. All newly placed props can be selected, moved, duplicated and saved through
the existing local floor workflow. Shelving, the architectural lounge and wall-side
fixtures painted into the backdrop are background pixels, not separately editable
geometry; the catalog sofa is a separate addable object.

In floor view, Current Edition and Studio Play, generic avatars cycle through
seated work, thinking, walking and idle, with compact thought bubbles. Clicking an
avatar without a custom interaction opens local action controls (Auto, Work,
Walk, Think, Rest). Custom popup/floor/elevator interactions take precedence.
The HUD explicitly labels these activities as simulation, and accessible character
names repeat that boundary. These captions are not Agent run telemetry.

`web/office-activity.js` samples a bounded 36-second ambient loop; the shared
`HybridScene` owns animation timing, stride/standing frame changes, seated pose,
depth ordering and thought bubbles. Walking follows a short aisle route near the
actor's current placement, not a collision-aware navigation mesh. Editing restores
the exact authored positions. Pause stops both the frame loop and CSS movement;
hidden documents stop frame scheduling; reduced-motion uses static seated/idle
poses; dispose removes frame callbacks and listeners. Per-character action choices
and playback time are transient presentation state and are not written into floor
JSON, Business data, role counts or agent identity.

The isometric room uses the back part of the canvas. Valid object anchors now allow
`y: 18..94` (previously 38..94), including matching drag/import/AI-handoff bounds;
all previously valid files remain valid. Assets and summarized generation provenance
are under `web/assets/office-world/hybrid/`, with the current set listed in
`workfloor-v1.provenance.json`. Tests: `tests/office-activity.test.mjs` plus the
shared floor/editor regressions.

Local verification on 23 October: `npm test` passes 238 tests with zero skipped;
`npm run build` succeeds with 298 embedded assets. Independent review found and
verified fixes for catalog-added avatars' desk lookup and atlas-aware alpha hit
testing. Browser checks cover the Projects floor, matching Studio Current Edition,
local character action selection, pause, editing, catalog sofa addition and Undo;
the browser error/warning query is empty. Evidence is in the ignored local
`reports/office-workfloor-{tests,build}.log` and
`reports/office-workfloor-20261023/studio-isometric.png`. These are host-browser
checks, not physical-mobile performance or live Zuri telemetry acceptance.

Avatar verification on 20 October: the full local suite passes **224 tests with zero skipped**, the build succeeds with **262 embedded assets**, and the local Studio server returns HTTP 200 for the first avatar wrapper and its atlas. The DOM test checks all 12 wrappers, catalog grouping, sprite metadata and that no generic avatar is added to the starter room.

## Floor workspace and interaction editor (20 October follow-up)

**Native 3D update:** original domain scenes are now editable in the **แก้ฉาก 3D ประจำชั้น** tab. See [NATIVE-STUDIO.md](NATIVE-STUDIO.md) for shared runtime state, movement, interaction and per-floor save. The read-only embedded view below remains a Current Edition comparison, not the editing surface. Lobby remains 2D.

The top floor selector is now the editor context. Opening a floor loads **that floor's saved snapshot**, never an unrelated last-used library design. Edition selects the editable draft or the snapshot currently used by Visual Office. The latter stays unchanged until an explicit save. Saved-state labels distinguish a floor snapshot from a library copy.

- **บันทึกชั้นนี้** writes only the selected local preview floor, including background, object positions, interactions and effects. The existing Visual Office route uses the same renderer and stored room. Another tab changing that floor causes a conflict message instead of a silent overwrite; export the draft, then reload the floor.
- **เก็บเข้าคลังแบบ** saves a reusable design independently. **คัดลอกไปชั้นอื่น…** retains the explicit preview-and-apply workflow. Saving to the library does not bypass the unsaved-floor guard.
- **ส่งออกไฟล์ชั้น** downloads `visual-office-<floor>-<draft|current>.json`, matching the selected Edition. **เปิดไฟล์ชั้น** validates and previews the named floor before loading a draft. Acceptance changes the selected floor to the file's floor, prompts over unsaved work, and never applies automatically.
- A domain floor without a saved snapshot opens on its shared Painted 2.5D / Soft 3D / 2D Anime team baseline in the Current Edition. “ปรับแต่งฉากทีมนี้” starts an editable draft from that same baseline; the current scene stays unchanged until the user saves. `original` resets to this visual baseline. A saved `native3d` snapshot remains an explicit separate edition and is not converted into editable sprite objects.
- Changing floors or navigating through Studio's own controls prompts before abandoning an unapplied draft. Browser unload warnings are also registered; browser behavior governs their display. Same-document navigation outside Studio controls does not provide a durable autosaved draft.

Select a prop in the canvas or layer list, then configure:

| Property | Supported behavior |
| --- | --- |
| Interaction | None; text popup; elevator directory; navigation to an allowlisted preview floor |
| Popup | Title up to 80 characters and plain text up to 1,000; no HTML execution |
| Effects | Opacity 25–100%, additional soft shadow 0–24 px, warm glow, hover/focus lift or outline |
| Test | “ทดสอบ Interaction” or Play; the applied floor supports the same behavior |
| Motion | Reduced-motion replaces the hover lift with an outline |

Position locks also protect properties from edits. Popups do not execute business commands. Hover effects and glow are sprite presentation, not physically simulated lighting.

Floor files use `office-floor/v1`, `scope: "local-preview"`, `floor`, `edition: "hybrid" | "original" | "native3d"` and `room` (an `office-room/v1` object, null for original, or `office-3d/v1` for native). Native files open in the native editor for review. Assets are allowlisted references supplied by this app, not embedded in JSON; reopen with a compatible Visual Office build. Import rejects foreign scopes, unknown keys, unsupported floor IDs, external URLs and out-of-bounds effects.

Room objects now accept these optional fields without invalidating older room files:

```json
{
  "interaction": {"type":"popup","title":"โต๊ะร่วมออกแบบ","body":"พื้นที่ทำงานร่วมกันระหว่างคนกับ AI"},
  "effects": {"opacity":1,"shadow":0,"glow":true,"hover":"lift"}
}
```

Other interaction shapes: `{"type":"none"}`, `{"type":"elevator"}`, `{"type":"floor","floor":"customer"}`. An omitted interaction keeps the existing default: lift opens the directory; other props have no configured action. AI handoff includes these allowlisted shapes and still requires proposal review.

Follow-up validation: **193 tests passed, zero skipped**, build passed with 235 embedded assets. Browser evidence covers Lobby/Customer isolation, original Projects viewport, popup on both Studio and actual Lobby after reload, effects persistence, real JSON download/file-chooser import, and unsaved floor-switch protection. Evidence is in `reports/floor-studio-20261020/`. The prior section below records the original delivery.

## Human editing flow

1. Name the room. Drag furniture or select it from the room list. Desk and chair are independent objects.
2. Add desk, chair, plant, lift, character duo or one of 12 generic avatar sprites from the catalog. Catalog cards are grouped by furniture, decor and characters. Duplicate, remove, resize (60–150%), mirror, lock, nudge with buttons or arrow keys (Shift for a larger step). Maximum 40 objects.
3. Choose Office Idle / Isometric, Garden or City painted room backgrounds; placement survives the change. Zoom from 100–180% and scroll the scene viewport to pan. At default zoom the complete room fits mobile width.
4. Use Undo/Redo. “ลองเล่น” stops editing and makes objects inspectable; the lift opens floor selection.
5. “เก็บเข้าคลังแบบ” updates the current saved design; “บันทึกเป็นแบบใหม่” creates another saved design (maximum 20). “แบบของฉัน” opens saved rooms. Unsaved work prompts before library replacement or the Studio Back button, and registers a browser before-unload warning. Browser behavior determines whether its warning is displayed.
6. “คัดลอกไปชั้นอื่น…” previews a room and offers G/Lobby and the existing 14 preview floors. “บันทึกและใช้กับชั้นนี้” saves an independent room snapshot for that floor. “เข้าดูชั้นนี้” opens the actual floor route. “คืนฉากเดิมของชั้น” removes only the assignment; the saved design remains.

Editing a saved design does not silently update floor snapshots. Reapply when ready. A custom Lobby retains reception, work board, conversation, knowledge and elevator actions. Domain rooms retain the existing team list beside the decorated room.

## Human + AI collaboration

The collaboration drawer is a **manual handoff workflow**, not a connected AI agent:

- Write the room brief and copy the brief plus current room JSON into an AI conversation.
- Alternatively download `visual-office-room.json`; the downloaded file can be parsed by the same validator.
- Ask the AI for `office-room/v1` JSON using only the supplied catalog IDs and background keys.
- Paste the returned JSON and choose “ตรวจและดูข้อเสนอ”. A separate scene preview and change summary appear; the editor is unchanged.
- Accept to draft or reject. Acceptance is undoable and does not save or apply a floor.
- If the draft changes after review, the proposal must be reviewed again. Locked objects cannot be changed or removed through an imported proposal.

No prompt is sent to an external service by the editor. The user controls the handoff. Validation rejects malformed or oversized input, duplicate IDs, unknown properties, external image URLs, business/agent payloads, invalid kinds and out-of-range values.

### Room exchange contract

```json
{
  "schemaVersion": "office-room/v1",
  "name": "ห้องริมสวน",
  "background": "garden",
  "brief": "เว้นทางเดินกลางห้อง",
  "objects": [
    {"id":"desk-1","kind":"desk","x":56,"y":83,"scale":1,"flip":false,"locked":false},
    {"id":"chair-1","kind":"chair","x":53,"y":65,"scale":1,"flip":false,"locked":false}
  ]
}
```

Allowed backgrounds: `office`, `garden`, `city`. Kinds: `work-desk`, `task-chair`, `team-sofa`, `whiteboard`, `printer`, `desk`, `chair`, `plant`, `lift`, `duo`, `avatar-01` through `avatar-12`. Unique IDs use letters, digits, `_` or `-`, at most 60 characters. Coordinates are percentages of a fixed 3:2 scene: x 8–92, y 18–94. Scale .6–1.5. Name max 80, brief max 4,000 characters, pasted payload max 80,000 characters, max 40 objects. Coordinates are placement anchors, not world metres or business locations.

## Storage and isolation

`localStorage["zuri-office:hybrid-studio:v1"]` holds version 1, saved designs and floor snapshots. Assignments are explicitly `preview:lobby`, `preview:customer`, etc. They do not contain tenant/business IDs, canonical role assignments, rewards or agent execution commands.

The new key does not migrate or overwrite either old Studio preference key. Storage failures retain the draft and do not report a successful floor assignment. Applying saves the design first; a later assignment failure leaves that saved design available.

**Connected Zuri Business views keep scene data separate while sharing the art direction.** They show a read-only Painted 2.5D / Soft 3D / 2D Anime baseline with generic decorative characters. The baseline is not an agent status or a Business floor snapshot; connected views never read or apply this browser's saved preview decorations. Custom floor snapshots remain local until Zuri provides an owner-approved shared scene contract. Platform model/API/role/economy work remains paused. Existing floor names come from the current preview catalog, not a newly verified upstream taxonomy.

## Renderer and sources

| File | Responsibility |
| --- | --- |
| `web/hybrid-state.js` | Catalog, allowlist validation, history, saved designs and floor snapshots |
| `web/hybrid-scene.js` | Shared sprite scene, depth order, pointer drag, keyboard movement and alpha hit testing |
| `web/hybrid-studio.js` | Editor, catalog, background picker, library, assignment and AI handoff |
| `web/hybrid-studio.css` | Responsive editor, dialogs and applied-floor presentation |
| `web/design-studio.js` | Tab integration; hybrid default, comparison and legacy model retained |
| `web/building-view.js` | Applied preview-floor rendering and navigation |
| `tests/hybrid-studio.test.mjs` | Room/schema/storage/interaction/import contract tests |
| `tests/domain-office.test.mjs` | Floor isolation, connected-mode suppression and retained Lobby services |

New original raster assets:

- `web/assets/office-world/hybrid/backgrounds/{garden,city}.png`: 1536×1024 Painted room backdrops, same composition.
- `web/assets/office-world/hybrid/props/{desk,chair}.png`: independent 1254×1254 RGBA props.
- Sibling provenance files record actual ImageGen prompts and references.
- Existing `studio-styles/soft3d/{plant,lift}.png` and `studio-styles/shared/duo.png` reused unchanged.

Rendering baseline: the Office Idle domain preset uses an approximately 35-degree elevated isometric view; earlier Garden/City rooms use approximately 30 degrees. Warm upper-left light and a 3:2 canvas remain shared. Props use a 50% horizontal / 90% vertical sprite anchor and ground-y ordering. Transparent pixels preserve visible overlap; a small 128×128 alpha map permits selecting the chair through transparent desk pixels. Original pixels are not altered by hit testing. Solid desk pixels occlude characters placed behind them. This is a sprite composition, not calibrated 3D geometry or a wall-aware occlusion engine.

## Verification

- `npm test`: **188 passed, 0 failed, 0 skipped**.
- `npm run build`: **passed, 235 embedded assets**.
- Scoped `git diff --check`: passed.
- In-app browser: add independent chair, nudge, background swap, name, save/reload, apply Customer and Lobby, visit actual floor, return to edit, retain reception modal, play/lift, zoom/reset, copy brief, invalid JSON rejection, proposal preview/accept/reject, undo and actual JSON download.
- Real pointer input moved the chair from x53/y65 to x46.3929/y48.6605 through the desk's transparent region; Undo restored it. Character drag also changed x32/y79 to x24.6786/y91.0537 and was undone.
- Desktop 1440×1060; mobile 390×844 and 320×780. At 320: body client/scroll width 305; editor child bounds x10..295. Full-page screenshots can reflow scrollbar width; the viewport capture confirms actual fit.
- Final browser error/warning query returned no entries. This does not certify physical-device performance.
- Evidence: `reports/hybrid-studio-20261020/` (screenshots, tests and build logs). Visual review in root docs/records/design-qa.md`.

## Remaining boundaries

The shared duo remains static. Generic avatars use separate standing/walk/seated sprite poses and ambient motion, not skeletal animation or live agent execution. There is no furniture collision/navigation mesh, floor-plan measurement, full foreground-mask animation system, room resizing, true prop rotation, dynamic light simulation, multi-user synchronization or online AI execution. Mirroring is a sprite flip, not a physically relit model. Large PNG optimization and mobile device benchmarking remain polish work. These limitations do not prevent the delivered edit/save/apply/manual-AI-handoff workflow.

Local preview only. No deployment, PR, commit, database mutation or real domain/agent change.

Native catalog refinement (20 October 2026): the original 3D editor now adds, duplicates and deletes desks/chairs/plant/coffee-table/cabinet props, with independent floor snapshots and unchanged agent identities. See [NATIVE-STUDIO.md](NATIVE-STUDIO.md) for schema, limits and evidence.


## Current refinement — 23 October 2026: actual 3D work-floor activity

This section supersedes the earlier sprite-only rendering and animation limitations **for background `office`**. The owner requested generic 3D adults using an Office Idle reference. Garden/City rooms keep their prior sprites. Zuri/Wangjai masters, Agent roles and business data ownership do not change.

- `office-isometric-v3.png` is a Painted 2.5D architectural backdrop with a blank floor-name frame and inset elevator. Its baked sofa was removed so the movable model is not duplicated. A DOM sign shows the current floor name; the elevator is a hotspot over the painted door, not a floating sprite.
- `office-projection.js` defines a fixed orthographic 45-degree yaw camera, ground-axis slope .52 (elevation about 31.3 degrees), and reversible percentage/world transforms. Desk, independent chair, sofa, water cooler, whiteboard and twelve generic articulated adult variants render in one transparent WebGL canvas. They are actual geometry with a common depth buffer and light, not rotatable PNG claims.
- `office-navigation.js` defines permitted work-room, doorway/corridor and lounge polygons. A bounded A* search avoids wall bases and expanded furniture footprints; no diagonal corner cutting. Scaling/moving props rebuilds these obstacles. The overlay button shows safe zones, obstacles, interaction approaches and current routes.
- `hybrid-office-3d.js` owns transient activity. People walk at a bounded world speed, face their movement direction, then sit at a desk, drink at the water cooler or rest at the sofa. One person reserves a station at a time. Interaction seating is an explicit transition from a safe approach to the seat anchor; it is not free roaming through furniture. Invisible wall geometry writes depth so foreground walls obscure people, and furniture naturally obscures people in the same 3D pass. These masks are calibrated for this fixed painted room, not arbitrary imported architecture.
- Click a person to choose an activity; click a desk/water cooler/sofa to route the selected or nearest character to it. Blocked/reserved destinations report failure. Editing freezes movement; reduced motion retains static poses. Runtime positions, animation, paths and reservations never write the room snapshot or alter Agent identities/counts/roles. Authoring and per-floor saves still use the existing validated room/floor JSON contract.
- The whiteboard has declarative interaction `{type:"tasks"}`. It shows only fresh live jobs explicitly scoped to the selected floor. Missing/stale/unscoped feeds and the pending Zuri task contract show unavailable, with no invented tasks. This remains separate from simulated character thoughts.
- WebGL creation/context failure produces an explicit 2D fallback notice. The fallback is presentation only and does not promise 3D collision or depth guarantees. Browser device performance is not certified.

Sources: `web/hybrid-office-3d.js`, `web/office-characters.js`, `web/office-navigation.js`, `web/office-projection.js`, `web/floor-tasks.js`. Tests cover rig bounds/actions, camera roundtrips, safe navigation, interaction reservations/cancellation, unchanged authored state, reduced-motion poses and honest task scoping. Current verification is recorded separately in `reports/office-3d-*`; older evidence above does not certify this revision.


## Latest refinement — editable navigation and Three.js room shell

The owner requested a real Three.js office structure after requesting editable walk paths. On `office`, `web/office-architecture.js` builds actual floor/wall/window geometry in the same camera and depth buffer as furniture and characters. The old painted-room description and invisible-wall-mask implementation above are historical for the first pass; actual visible walls now supply occlusion. Garden/City remain the prior sprite editions. `office-isometric-v4.png`, with printer/elevator removed, remains the explicit 2D fallback. The work-floor uses a projected ground arrow to open the existing directory. Legacy office lift kinds normalize to that arrow; printers are removed from this office preset. Explicit authored interactions are preserved, while the standard arrow uses `elevator`.

### Use the Studio navigation editor

Select the floor and editable Edition, then **ทางเดิน / จุดใช้งาน**. Add a route or forbidden area, select its numbered point and drag it on the ground. Arrow keys move 1 percentage point; Shift moves 5. The numeric fields use the same normalized 0–100 ground coordinates. Add points by arming **เพิ่มจุดบนพื้น** and clicking the floor; route minimum is two points, polygon minimum three. Use Undo/Redo for authored changes. Select a desk, sofa or water cooler in the navigation target list to edit its approach (gold) and supported seat (purple). A desk needs a matching chair; seats must stay on their corresponding furniture. Water coolers have approach points only.

**ลองเดินเส้นทางนี้** checks every exact segment against permitted floor, walls, furniture and forbidden areas, then animates one existing generic character along those vertices. Invalid paths report the failing segment. Stop returns to the authored layout. Reduced motion reports that animation is disabled rather than claiming a walk ran. The test neither adds an Agent nor saves transient animation state.

Save using **บันทึกชั้นนี้**, or export the existing `office-floor/v1` file. Navigation is part of the selected floor snapshot, not a global editor preference. Runtime movement uses authored route edges when present; blocked/disconnected route graphs fail closed. Interaction entry/exit uses local checked paths that bypass route-graph constraints but never walls or forbidden areas. A blocked station override is reported and omitted, never silently replaced with a different default.

### Optional room data

```json
{
  "navigation": {
    "version": 1,
    "routes": [{"id":"route-1","points":[{"x":43,"y":48},{"x":32,"y":56}]}],
    "forbidden": [{"id":"area-1","points":[{"x":18,"y":72},{"x":25,"y":72},{"x":25,"y":78},{"x":18,"y":78}]}],
    "stations": [{"objectId":"floor-sofa","approach":{"x":23.8,"y":62},"seat":{"x":21,"y":59}}]
  }
}
```

`office-nav-state.js` strictly validates imports: finite bounded coordinates, unique bounded IDs, max 16 routes with 2–32 points, max 16 forbidden polygons with 3–24 points, max 40 station overrides, known object IDs, no unknown executable fields, no self-intersecting/degenerate polygons. Older rooms omit navigation and keep automatic safe paths. `hybrid-state.js` retains history, local storage and floor-file compatibility. Structural validity allows temporarily blocked authoring; the walk test and runtime report physical reachability separately.

Source routing: `office-nav-editor.js` owns SVG authoring; `office-nav-state.js` owns validation; `office-navigation.js` owns collision/route graph; `hybrid-office-3d.js` owns transient movement; `hybrid-scene.js` shares rendering with applied floors. The room shell is a procedural Three.js model, not a newly published GLB catalog package. Navigation is a bounded local floor graph, not a general-purpose imported-mesh navigation baker. Platform contracts remain paused.


### Fullscreen floor zoom and inspection (24 October 2026)

The fullscreen floor viewport now supports anchored mouse-wheel zoom, two-finger
pinch, accessible +/- controls, whole-floor Fit and baseline Reset. HUD/dialogs
stay viewport-fixed. Native canvas wheel and touch camera controls yield to map
zoom; native mouse orbit remains available. All view settings are transient.
Projects painted baseline exposes Dev structure inspection; it swaps painted art
for existing procedural geometry and preserves actor activity and hitboxes.
Other scene editions do not advertise this toggle. See
[design](superpowers/specs/historical/2026-10-24-floor-zoom-design.md) and
[verification](superpowers/plans/historical/2026-10-24-floor-zoom.md).


### Dev skeleton alignment per floor (24 October 2026)

In **แต่งห้องแบบผสม**, choose a floor and editable draft, then **Dev · ปรับแนวโครง 3D**.
Use image / structure / overlay, opacity, reference-pixel X/Y and uniform scale, or
drag the entire skeleton. One drag is one Undo; cancellation restores the prior draft.
Use **บันทึกชั้นนี้** explicitly. Optional `room.skeletonAlignment` travels through
local per-floor revisions and floor JSON export/import; view/opacity remain transient.
Original image/prop art positions and Agent inventory are not edited. The physical
room, actors, props, masks and navigation display share the transform. Navigation
authoring converts displayed pointer positions back into local planning coordinates.
This is global alignment; individual wall/prop authoring remains separate.
Baseline Office rooms on each floor can author alignment; operational painted art
remains Projects-only. Blueprint rooms keep their existing structural tools.
See [design](superpowers/specs/historical/2026-10-24-skeleton-alignment-design.md) and
[plan/evidence](superpowers/plans/historical/2026-10-24-skeleton-alignment.md).


### Per-piece skeleton calibration and new perspective art

Dev now offers **โครงที่กำลังแก้**: whole structure, seven wall groups, and physical
non-character props (including each desk/chair). Numeric/drag changes update only
optional `skeletonParts`; authored image x/y/scale and Agent records remain unchanged.
Select from the list or enable **เลือกชิ้นจากฉาก**. A miss in picking mode is a no-op.
Reset affects the selected target. Targets/opacity/mode are transient; explicit floor
Save and floor-file exchange preserve overrides with the existing revision guard.
Navigation walls, furniture footprints, paired chair seats and custom anchors use the
physical transform. Nav authoring inversely maps pointer coordinates through it.

**ชุดภาพอ้างอิง** explicitly chooses legacy-v4 or generated perspective-v5, saved
per floor as `officeArt`; old floors/assets are not silently replaced. The new pack
contains one background and two transparent desk/chair images. Image generation is
camera-guided artwork; per-piece calibration handles remaining raster/mesh mismatch.
See [design](superpowers/specs/historical/2026-10-24-skeleton-parts-design.md),
[plan/evidence](superpowers/plans/historical/2026-10-24-skeleton-parts.md) and
[production prompts](superpowers/specs/historical/2026-10-24-skeleton-parts-art-prompts.md).


### Current Projects reset: one Scene Sheet

The previous independent-art/geometry calibration experiment is superseded for
Projects. Fresh Projects uses `defaultOfficeRoom` in both Office and Studio.
Existing drafts can explicitly use **ขึ้นใหม่จาก Scene Sheet เดียว**, then
**บันทึกชั้นนี้**. V1 automatic layout accepts 1–4 matched workstations, up to
one of each main fixture and two plants; unsupported inventory is rejected
before changing the draft. Rebuild retains all supported IDs/kinds and avatar
count, removes rejected matching offsets, and authors a real 12×8m plan.

The same Three.js meshes render the static beauty into a camera-aligned image
layer; live actors use the actual static depth. **Dev · ปิดเลเยอร์ภาพ** hides
that image and exposes those same static meshes as wireframe. Camera, renderer,
transforms, actor mode/path and route stay unchanged. The Studio layer button
uses the same operation; normal prop editing and measured wall/door tools now
edit the common source and invalidate its image bake. Independent background/
prop PNGs and legacy image-match controls are not used for this edition.
Navigation/editor footprints come from the same asset factory/model bounds.

[Design](superpowers/specs/historical/2026-10-24-unified-scene-sheet-design.md) and
[verification](superpowers/plans/historical/2026-10-24-unified-scene-sheet.md) separate
structural acceptance from future art polish and live integration. Only the
explicit local preview marker admits local saved presentation alongside the
synthetic connector; non-preview connected storage isolation is unchanged.
# Projects object skins — 25 October 2026

Projects now refines the measured Scene Sheet with illustrated object-local
skins. **สกิน 2.5D**, **โมเดล** and **Wireframe** are independent transient view
controls in the floor and Studio. With skin and model both on, the illustration
replaces model colour while retaining its actual depth. Turn skin off to inspect
solid models; turn model off and wireframe on to inspect the skeleton. All-off
hides static presentation without removing collision or actors.

The desk/chair/sofa/water/board/plant atlas is projected onto the original mesh,
not placed in screen coordinates. A moved or resized item carries its artwork;
ordinary explicit **บันทึกชั้นนี้** persists its transform only to that floor.
Room-wall and work-floor material images use the same geometry. Artwork never
changes Agent metadata, navigation or interaction anchors. Failed images show
an explicit warning and fallback model surfaces. The geometry-reference atlas,
generated art, manifest hashes and prompts are under
`web/assets/office-world/skins/`. Fixed isometric camera; no free orbit claim.

See [design](superpowers/specs/historical/2026-10-25-projects-object-skins-design.md) and
[implementation/evidence](superpowers/plans/historical/2026-10-25-projects-object-skins.md).
# Projects grid placement — 25 October 2026

In Projects, **จัดห้อง · ช่องกริด** enters a paused local furniture draft.
Select a movable item, drag it or click a destination floor cell. Objects snap
on measured 0.5 m intersections; red cells are occupied and unavailable for
walking. Invalid drops restore both the original mesh and its skin. Furniture
cannot overlap other props, walls, actors or doorway access. Existing occupants
of a chair/sofa retain their seat-owner exception. Floor signage remains fixed.

**บันทึกผังชั้นนี้** explicitly applies that floor; **ยกเลิกจัดห้อง** restores
its saved snapshot; **ย้อนกลับ** undoes a complete move. Door toggling is disabled
while rearranging furniture; edit doors using Studio's structural tools.
In Studio, enable **จัดวางเป็นช่อง** for the same snapping/validation, including
arrow-key movement. Ordinary floor Save, Undo and file exchange remain in force.

`placementGrid: {cellSize: 0.5}` is optional in `office-room/v1`. A saved grid
blocks whole occupied cells plus the existing precise depth/clearance bounds.
Exact segment/cell intersection prevents diagonal corner shortcuts. Moving an
item moves its attached custom approach/seat; invalid anchor translations are
rejected before normalization can discard navigation. Seat entry ignores only
its current owner through the existing navigation contract. No Agent count or
role changes, live writes or shared platform persistence are introduced.
# Furniture quarter turns — 25 October 2026

In grid mode select a desk, chair or movable decoration and press **หมุน 90° · R**
(or R while focused on the item). The original metric pivot stays fixed and
preview cells show the full turned footprint. Green can be confirmed with
**วางชิ้นนี้** or Enter; red cannot commit. Rotate further, move to a free cell,
or **ยกเลิกพรีวิว** / Escape to restore the original mesh and skin. Floor Save
requires confirming or cancelling a pending rotation first. One confirmation
is one Undo; Save remains explicit and per floor.

The optional object `rotation` accepts only 0/90/180/270 on the six movable
furniture/decor kinds. Older files omit it. The renderer, measured blockers,
grid occupancy, default approaches and attached custom anchors share this angle.
Four source-geometry reference atlases drive four illustrated views, including
actual backs of monitors and boards. They are lazily loaded with safe model
fallback; a late image cannot replace a different current angle. Legacy flip
also turns sheet furniture by 180°, including sofas and boards.

Inspector scale/flip/effects edits in grid mode retain their values without
silently snapping the item's origin. Size/flip changes are measured again.
Custom chair seats use the same measured 0.3 m ownership tolerance before and
after rotation. Preview is cancelled before renderer teardown; disposed skin
owners cannot recreate resources. Rearranging may make a station unreachable;
normal movement reports that rather than walking through objects.
