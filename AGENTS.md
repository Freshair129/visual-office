# Visual Office — agent entry point

## External assets

Brand characters, ImageGen artwork, Zuri brand marks and third-party character
candidates are not in Git. `asset-store/manifest.json` records their paths and
hashes; the files themselves are ordinary gitignored files on the owner's
machine. Without them the app uses procedural/placeholder fallbacks and the
affected tests skip. Run `npm run assets:verify` to check local bytes and
`npm run assets:manifest` to register a new approved file. New brand or ImageGen
assets belong in the manifest, never in Git. A dedicated RustFS store is used
only for handoff to another developer (`assets:push` by the sender,
`assets:pull` by the recipient); never put its real URL or credentials in this
repository. See [setup, handoff and policy](docs/EXTERNAL-ASSETS.md).

## Office design handoff client (31 October 2026)

The local handoff client sends a saved design package to a Zuri-origin popup;
the receiver selects active Business Workspaces from the current OWNER session,
and only a committed, re-read revision provides Zuri design-ID mappings. The
Office deployment's trusted Zuri origins are configured in
`web/office-zuri-config.json` (empty by default); a loopback `--preview` may
instead use `OFFICE_HANDOFF_ZURI_ORIGIN`. Zuri independently configures trusted
Office origins. The same principal, Workspace and exact ZIP in one browser
profile retain the original retry key/version across popup closure; session and
CSRF credentials stay with Zuri. Design IDs do not create runtime Agents,
permissions or business approval. Local tests do not qualify deployment or a
real Business import. See [the handoff contract](docs/game-design/OFFICE-ZURI-REGISTRATION-HANDOFF.md).

## Accepted low-rate MVP baseline (31 October 2026)

The owner accepted the measured low-rate Visual Office slice for MVP and
authorized Git delivery. Start continuation work at the
[acceptance and retained limits](docs/game-design/OFFICE-MVP-ACCEPTANCE-20261031.md).
Preserve checked pose transactions, supported furniture refusals, local
draft/save/Undo and linked design-ID export boundaries. The 30 FPS path draws
the previous committed pose before the next solve; do not describe this as
physical 33.3 ms delivery on every frame or a new pose every frame.

The illustrated campus/Lobby and Business-scoped context/privacy behavior below
remain the main runtime baseline. Local department roles/workflows and exported
IDs are design proposals, not canonical Agents, permissions or DB registration.
Keep actual API errors, source-bound GPU measurements, owner MVP acceptance and
exact-head CI separate. Preserve sealed evidence; do not commit raw trace/archive
payload copies. Run the repository documentation, full-test, build and pinned
compatibility checks on the composed integration tree before merge.
MVP desk/chair variants belong in `web/tycoon-furniture-models.js`; preserve
`web/studio-models.js` and the existing painted-artwork geometry registration.

## Functional continuation and gap analysis (27 October 2026)

The owner accepted the current human models for temporary use and deferred final art
polish. Start functional follow-ups at [system gaps](docs/SYSTEM-GAP-ANALYSIS.md)
and [closure plan](docs/superpowers/plans/historical/2026-10-27-system-gap-closure.md).
Stable appearance `zuri` now uses the unchanged R4 GLB; historical R3 remains a
Lab comparison. Do not resume sculpting or change Agent counts/roles implicitly.
Work review UI sends `baseUpdatedAt`; Worker checks stale edit bases and ETag
CAS separately. Retain drafts on typed `REVIEW_CONFLICT` and require explicit
latest reload. These local changes and synthetic success do not qualify live
Zuri, shared saves, mobile use, native lifecycle or final art.

## Current face correction review (26 October 2026)

The owner rejected revision3's head, cheeks, mouth and nose, then clarified that
the 3D profile needs a natural human nasal bridge, philtrum, lips and chin.
Read [face revision4](docs/game-design/characters/2026-10-25-brand-study/FACE-R4-REVIEW.md)
and [its plan](docs/superpowers/plans/historical/2026-10-26-zuri-face-r4.md).
`build-zuri-face-r4.py` / `review-zuri-face-r4.py` under `scripts/blender/`
produce and inspect the separate `candidates/zuri-face-r4` Blend/GLB/metadata.
Lab defaults to this review; revision3 is the explicit before choice. The flat
ellipse experiment is rejected. The 27 October temporary-use decision above
supersedes the former Lab-only restriction. Do not overwrite baseline assets or
treat temporary use as final art approval.

## Temporary characters and Character Lab (26 October 2026)

The owner authorized using the current models while deferring final art polish.
Read [temporary runtime](docs/game-design/characters/TEMPORARY-RUNTIME.md),
[its plan](docs/superpowers/plans/historical/2026-10-26-temporary-character-runtime.md) and
[main reconciliation](docs/superpowers/plans/historical/2026-10-26-character-runtime-reconciliation.md).
`web/characters/runtime-catalog.js` allowlists Zuri face revision 4, Wangjai and
Staff A/B. `runtime.js` owns hashed loading/independent instances; `seat-fit.js`
owns leg fitting. Hybrid avatar `appearance` is floor-scoped presentation data;
GLB Studio's character is a transient navigation probe, never a roster edit.
Preserve Agent count/roles, navigation, sourced status and original asset bytes.
Character Lab at `character-lab.html?model=zuri-anime` retains historical visual
comparisons and credits; see [character documents](docs/game-design/characters/README.md).
Editable sources are in `assets-source/characters/`; the current Zuri derivative
is `candidates/zuri-face-r4.blend`. Earlier rejected faces remain historical trials.
Temporary runtime use supersedes older Lab-only restrictions for those four
appearances; it does not approve art, authorize paid generation or enable live.

## Documentation entry and current runtime (26 October 2026)

Start documentation/path/index work at [docs/README.md](docs/README.md). It owns
navigation and family placement; [SRS](docs/VISUAL-OFFICE-SRS.md) owns Office
requirement status. Run `npm run docs:check` after a document addition, move or
link/heading change. The checker validates portable targets and family coverage;
ignored `reports/` evidence and external design checkouts are separate locators.
See [this reconciliation plan](docs/superpowers/plans/historical/2026-10-26-documentation-reconciliation.md).

The current default shell retains the canonical illustrated campus/Lobby. The
synthetic dynamic-domain surface uses `OfficeArtScene` with the same artwork;
an explicitly saved `tycoon3d` edition and Native/GLB Studio remain supported.
The old green prototype is not the default art direction. Building-only cover/Fit
uses 25% overscan; ordinary floor Fit remains contain-style. Later corrections
in DESIGN-SOURCES take precedence over older dated “latest” refinements below.
Character assets remain provisional; runnable models do not imply art approval.

## Before writing a document

Search the [document inventory](docs/DOCUMENT-INVENTORY.md) and indexes first;
extend an existing source when it covers the topic. Link each new document from
its nearest index in the same change. `npm run docs:check` enforces reachability.

## Runtime cleanup and endpoint ownership (26 October 2026)

For **old UI / wrong preview / unused code / hard-coded data / endpoint audit**,
read [the audit](docs/API-ENDPOINT-AUDIT.md) and
[cleanup plan](docs/superpowers/plans/historical/2026-10-26-runtime-cleanup.md).
`shared/office-api-routes.js` owns Office transport methods/consumers;
`scripts/office-proxy.mjs` forwards browser routes only, preserving binary files.
Payload/auth rules remain in Worker handlers. `web/office-art-scene.js` reuses
the painted/hybrid scene for dynamic context; SVG logo/art are not replaced by
a second theme. Keep GLB/Native Studio and saved formats active. The retired
direct browser T3 client is deleted; T3 bridge/queue transport is still active.
Run `node scripts/audit-runtime.mjs`, focused route tests, full tests/build and
synthetic browser verification. No fixture proves a live Zuri contract.

## Scene → workspace actions (26 October 2026)

For **character/desk/board clicks, Chat refresh, or missing Work links**, read
[the scoped audit and plan](docs/superpowers/plans/historical/2026-10-26-scene-workspace-actions.md).
Entry points: `scene-workspace-actions.js`, `HybridScene`, `BuildingView`,
`floor-tasks.js`, `chat-selection.js`, `app.js`, and `work-view.js` under `web/`.
Exact floor slots may identify a proposed role; appearances/copies never assign
Agents. Synthetic board scope comes only from explicit fixture domain keys.
`#chat/<thread>` must resolve through current conversation choices before fetching.
Keep simulation actions separate, retain Zuri unavailable gates and temporary art.

## Workspace readiness and grounded people (25 October 2026)

For **Chat/Work/menu gaps, synthetic workspace, status bubbles, routines, sofa
seats or recommended layout**, read [experience design](docs/superpowers/specs/historical/2026-10-25-office-experience-gaps-design.md),
[experience plan](docs/superpowers/plans/historical/2026-10-25-office-experience-gaps.md),
and [people design](docs/superpowers/specs/historical/2026-10-25-office-people-design.md).
`workspace-context.js` owns source readiness and safe presentation-only return
routes. Unavailable Zuri workspace contracts must not appear as empty legacy data
or offer legacy writes. `--workspace` on the loopback harness supplies isolated
synthetic memory storage to the actual Worker handlers; it never enables live.
`office-agent-state-view.js` maps fresh bound roles; HybridScene/HybridOffice3D keep
these sourced states transient and separate from physical activities. Unknown
does not mean working; fallback without navigation cannot walk. The recommended
paired work/lounge arrangement is an explicit Studio draft template, not an
automatic rewrite of saved floors. Preserve all Agent IDs/count/roles and art.

## Retired dashboard / workspace shell (25 October 2026)

For **sidebar / old UI / refresh flash / แชท / งาน / เมนูเพิ่มเติม**, read
[shell retirement](docs/superpowers/specs/historical/2026-10-25-retire-legacy-shell-design.md)
and [plan/evidence](docs/superpowers/plans/historical/2026-10-25-retire-legacy-shell.md).
`index.html` starts with an empty Office host; do not reintroduce the Marketing/CRM
dashboard, rail, quick-chat slot or duplicate task list. `office-workspace.css`
owns the shared warm HUD-style page shell; `conversation-content.css` owns rich
conversation content. Chat has one permanent composer. Feature controllers retain
their existing API contracts. Native saved floors and Native Studio still use
`office.js`; their renderer is an active dependency, loaded on demand for floors.
Retired CSS files are deleted, not hidden or embedded in Worker assets. All-floor
reload acceptance is synthetic, not live Zuri qualification.

## Quarter-turn furniture (25 October 2026)

For **หมุน 90 / rotate / มุมหมุน / preview cells**, read
[quarter-turn design](docs/superpowers/specs/historical/2026-10-25-quarter-turn-design.md)
and [plan/evidence](docs/superpowers/plans/historical/2026-10-25-quarter-turn.md).
`office-rotation.js` owns allowed angles/kinds and metric anchor transforms.
Optional object `rotation` is 0/90/180/270 degrees; `sheetYaw` composes it with
the original orientation and legacy flip. Placement measures the turned mesh.
`office-grid-editor.js` owns pending rotate/confirm/cancel; never persist preview
angles. The skin owner selects four registered atlases through the shared frame;
never wrap the single front image over the backs. Keep original material state,
per-floor revision checks and all Agent identities. For sheet custom seats use
actual measured bounds, retaining legacy non-sheet footprint interpretation.

## Sims-style grid placement (25 October 2026)

For **จัดห้อง / ช่องกริด / snap / คลิกวาง / occupied cells / Sims**, read
[the grid design](docs/superpowers/specs/historical/2026-10-25-grid-placement-design.md)
and [plan/evidence](docs/superpowers/plans/historical/2026-10-25-grid-placement.md).
`office-placement-grid.js` owns measured 0.5 m cells, candidate checks and anchor
translation; `office-grid-editor.js` owns transient SVG/drag/click previews;
`office-grid-build.js` and `office-grid-save.js` own applied-floor local drafts
and revision-checked Save. HybridScene and Studio reuse those checks.
Optional `placementGrid` persists per floor; occupied cells and crossed-cell
segments are checked inside `office-navigation.js`. Do not rasterize a screen
grid, move Agent records, make signage block walking or auto-save on drag.

## Latest owner refinement — object skins (25 October 2026)

The Projects top visual layer must be illustrated 2.5D artwork over individual
physical objects, not just another beauty render of the solid models. Read
[the skin design](docs/superpowers/specs/historical/2026-10-25-projects-object-skins-design.md)
and [plan](docs/superpowers/plans/historical/2026-10-25-projects-object-skins.md).
`office-object-skins.js` owns projected skins and transient skin/model/wireframe
visibility; `office-skin-frame.js` is the shared reference/runtime projection.
Art and provenance live in `web/assets/office-world/skins/`. The actual geometry
still owns depth, collision, picking and per-floor transforms. Never create an
independently positioned sprite or change Agent count/roles. This supersedes the
whole-scene beauty-bake interpretation below for the active Projects view.

## Latest owner correction — one Scene Sheet (24 October 2026)

The independent generated-picture vs greybox approach is rejected for Projects.
Read [the unified-sheet design](docs/superpowers/specs/historical/2026-10-24-unified-scene-sheet-design.md)
and [plan/evidence](docs/superpowers/plans/historical/2026-10-24-unified-scene-sheet.md).
`office-scene-sheet.js` owns the measured rebuild/compiler. Shared
`defaultOfficeRoom` is the Projects default in both Studio and BuildingView.
`office-prop-models.js` is the shared geometry factory; `office-sheet-bounds.js`
derives actual mesh collision. `office-sheet-layer.js` bakes the static beauty
image from those same nodes and camera, keeps their depth for live actors, and
Dev toggles only this image layer. Never restore a second PNG/greybox scene or
swap the renderer for Dev. Static state and owned textures must restore/dispose.
Rebuilt rooms use `sceneSheet: office-sheet/v1` with a validated metric plan;
source edits update image/geometry/nav together. Old per-piece image matching UI
is hidden there. Preserve original files/legacy imports, logo and Agent identity.
The explicit local art preview meta may read local presentation saves alongside
synthetic connector data; actual non-preview connected storage isolation stays
in force. No live contract or business write is enabled. This correction takes
precedence over historical art interpretations below for the rebuilt edition.

## Owner visual correction — 24 October 2026

Restore the original illustrated campus, brand mark and Lobby presentation before
further art work. The owner clarified that 3D is the structural skeleton for depth,
collision, walking and interaction underneath the established visual design, not
permission to replace it with the green GLB prototype aesthetic. This clarification
takes precedence over earlier renderer/art interpretations below. Keep newer code,
saved scenes and synthetic integration regressions intact.
Local visual rollback: `node scripts/serve-marketing-app.mjs --worker --legacy-art`
after build, at :4185. This explicit preview uses the retained BuildingView; it is
separate from `--dynamic` qualification and cannot be combined with it. Its static
floor directory is not an authorized domain list. No storage migration or live
connection is enabled by this preview. Projects now has a scoped painted/depth
adapter in `web/painted-office-skeleton.js` through HybridScene/HybridOffice3D;
read [its design](docs/superpowers/specs/historical/2026-10-24-projects-painted-skeleton-design.md)
and [plan/evidence](docs/superpowers/plans/historical/2026-10-24-projects-painted-skeleton.md).
Explicit custom blueprints keep the geometry renderer. Other floors have not been
converted to the painted skeleton. Internal floors use the frameless shell in
`web/office-floor-viewport.js` / `.css`: a large pannable scene, fixed HUD and
contextual Team dialog rather than a permanent sidebar. Mobile keeps 1,728 px
minimum scene width. Wheel/pinch zoom, Fit/Reset and transient Projects Dev structure
inspection are documented in [the zoom plan](docs/superpowers/plans/historical/2026-10-24-floor-zoom.md).
For **Studio Dev alignment / ปรับแนวโครง / เทียบภาพเดิม**, read
[the alignment plan](docs/superpowers/plans/historical/2026-10-24-skeleton-alignment.md).
`office-skeleton-alignment.js` owns bounded reference-pixel calibration;
`office-skeleton-editor.js` owns transient overlay/drag UI. For **รายชิ้น / ผนัง โต๊ะ เก้าอี้ / perspective art v5**, also read
[the per-piece plan](docs/superpowers/plans/historical/2026-10-24-skeleton-parts.md).
`office-skeleton-parts.js` owns target validation, physical-room derivation and seat
ownership; `officeArt` is an explicit per-floor versioned art choice. Never apply the physical
transform to original artwork or Agent records. Preserve all existing source image and brand bytes.

For **P1-B / dynamic Business domains / candidate context**, read
[the dynamic-context plan](docs/superpowers/plans/historical/2026-10-24-marketing-dynamic-context.md).
Run the existing app harness with `--dynamic` (or `--worker --dynamic` after build).
This explicit synthetic profile uses `office-context-data.js`, `office-domain-context.js`,
`office-context-route.js` and `tycoon-domain-view.js`; default static pilot is unchanged.
Never persist authorization context or treat fixture hints as live grants. Dynamic Studio
is disabled pending a scope-safe scene contract. Keep producer compatibility, local
app/Worker acceptance, hosted CI and live acceptance separate.

For **GLB recovery / context loss / local gap audit**, read [the recovery plan](docs/superpowers/plans/historical/2026-10-24-local-scene-recovery.md). Synthetic fault controls are harness-only; never use them as live acceptance.

For **Marketing main-app / Worker synthetic integration**, read
[the integration plan](docs/superpowers/plans/historical/2026-10-24-marketing-app-worker.md) and
[dependency scope](docs/game-design/MARKETING-INTEGRATION-SCOPE.md). Use
`node scripts/serve-marketing-app.mjs` (:4184) or append `--worker` (:4185, after build).
These exercise the actual app and built Worker locally; they do not qualify deployment/live.

For **Marketing blank overview / P1 browser / synthetic playtest**, read
[the P1 plan](docs/superpowers/plans/historical/2026-10-24-marketing-p1.md). Use the isolated
`:4183` fixture server; preserve P0 evidence. Never launch this harness as live auth.

For **Marketing read pilot / Campaign board / AskMarketing**, read
[the Office execution plan](docs/superpowers/plans/historical/2026-10-24-marketing-read-pilot.md)
and the latest refinement in TYCOON-INTEGRATION-AND-ACCEPTANCE. The `growth` Tycoon
floor is a labeled pilot, not a dynamically authorized domain directory. Existing
entry/Campaign/Ask reads only; no generic Agent dispatch or new auth. Keep producer
qualification, consumer fixtures and live acceptance separate.

## Design source routing

Before changing requirements, integration boundaries or a user-visible Office flow, read
[the Visual Office SRS](docs/VISUAL-OFFICE-SRS.md) and [system architecture/diagrams](docs/ARCHITECTURE.md).
The SRS owns requirement status, verification and unresolved Zuri dependencies; the
architecture document owns context, component, data, sequence and deployment views.

Before changing visual assets, scene composition or UI for **Visual Office, Design Studio, office idle, simulation, hybrid art, Painted 2.5D, Soft 3D, 2D Anime, แบรนด์, คาแรกเตอร์ หรือออฟฟิศจำลอง**, read [docs/DESIGN-SOURCES.md](docs/DESIGN-SOURCES.md), then its current brand entry and Visual Office application profile.

The latest 23 October owner refinement uses actual Three.js room architecture, Soft 3D furniture and articulated generic 3D adults on the Office work-floor. Painted architecture is retained only as a 2D fallback. Earlier Garden/City scenes retain 2D anime sprites. This explicit refinement supersedes the older profile only for generic work-floor characters; brand character masters are unchanged. The linked profile owns the detailed rules. Do not silently replace it with voxel/pixel art or redesign existing characters.

This routing rule is loaded through AGENTS.md; no executable prompt hook or global keyword listener is installed.

For the approved Tycoon slice, the renderer camera is azimuth 45° and elevation
`asin(0.52)` ≈31.33°; older “about 35 degrees” prose is approximate history.
The additive GLB Lobby/editor and v2 files are implemented locally; see
OFFICE-BLUEPRINTS. “Lobby remains 2D” describes the original Native v1 boundary.
The default illustrated shell and synthetic dynamic candidate are separate from
an explicitly saved GLB edition. Dynamic Studio/shared scene saves remain gated.

## Locate implementation and evidence

- [Office Tycoon production start-here](docs/game-design/README.md): for **tycoon / idle game UX / เอา sidebar ออก / GLB building / Lobby + Projects / game dev workflow**, read this package before changing the shell or producing models. The owner selected a two-floor vertical slice; the approved v0.2 design uses one isometric camera, modular GLBs, contextual object actions and Zuri-owned business data. Follow design → greybox → interaction prototype → assets/rig → assembly → connected read/command → playtest/acceptance. Asset counts, dimensions, animation clips and verification gates are specified there; do not call the new design implemented from the older scene tests. Production design review and owner approval are recorded. The first GLB prototype is implemented; see the plan status table for incomplete parity, final-art and connected gates. Runtime modules are `web/tycoon-{state,models,scene,view,data,studio,activity,blueprint}.js`; original GLBs and hashes are built by `scripts/build-tycoon-assets.mjs`. Never author roster actors in floor JSON. The existing Studio edits and saved-floor snapshots must survive the shell change. For **GLB แปลน / walk path / seat / door editing**, read the GLB Studio adapter section of `docs/OFFICE-BLUEPRINTS.md`: `tycoon-blueprint.js` adapts the shared structural/navigation editors and metric collision, `tycoon-activity.js` owns transient probes, and `tycoon-studio.js` owns local draft/save. Never replace the fixed coordinate translation with ad-hoc screen offsets or save probe actors into the inventory.

- [Measured Office blueprints](docs/OFFICE-BLUEPRINTS.md): for **แปลน / blueprint / template / ขนาดห้อง / มิติ / small medium large**, start with `web/office-blueprints.js`. Metres drive Three.js geometry and navigation; design px are 100/m, distinct from viewport pixels. `office-blueprint-panel.js` owns preview/apply/download and `scripts/build-office-blueprints.mjs` emits SVG/JSON. Apply explicitly, preserve avatar IDs/count, retain Lobby and never silently migrate saved floors.
  For **ลากผนัง / resize room / ย้ายประตูหน้าต่าง / save structural template**, read its Direct structural authoring section, then `web/office-blueprint-state.js` and `web/office-blueprint-editor.js`. Optional `room.blueprintPlan` drives mesh, SVG and collision spans. Preview is transient; pointer-up is one Undo; cancellation restores. Named plans use a separate bounded local library. Geometry-only template loading must retain all props, including legacy printers/lifts; never invoke historical inventory migration for a validated custom plan. Floor Save remains explicit and isolated.
  For **ผนังกั้นภายใน / แบ่งห้อง / ห้องประชุม / ประตูเชื่อมห้อง**, read its Interior rooms section and `web/office-interior-editor.js`. Optional `blueprintPlan.partitions` and `areas` persist with the plan. Wall spans split around doors feed both meshes and navigation; area labels alone do not enclose rooms. Preserve saved authored route points and props; obstructed edges replan through the current collision map, never through sealed walls. Connection probes are transient and have an explicit Stop.
  For **เปิดปิดประตู / door state / closed-door path**, read its Interactive door state section and `web/office-door-save.js`. Optional doorway `open` defaults true for legacy data. Studio owns draft/Undo/explicit Save; saved-floor clicks use fresh revision checks. Closed panels and collision segments must agree; reject occupied closure, revalidate active movement, and keep blueprint fallback motion static when 3D is unavailable. Read-only previews cannot persist toggles.

- [Office wireframes, wireflow and user flows](docs/OFFICE-UX-FLOWS.md): screen responsibilities and navigation for the building, Lobby, elevator directory, domain floor and Design Studio. Separates current local behavior from the future Zuri platform contract.
- [Hybrid Studio](docs/HYBRID-STUDIO.md): current default room editor, local floor application and validated human/AI JSON handoff. Start here for editor changes; `web/hybrid-{state,scene,studio}.js` and `web/hybrid-studio.css` own the feature.
  For **Office Idle camera / isometric cutaway / walking / sitting / thought bubbles / character activity**, read its 23 October refinement section and `web/office-activity.js`. The selected work-floor camera is elevated isometric (about 35 degrees); desk/chair meshes share the calibrated camera. For actual 3D characters, collision, depth masks and interaction stations, start with `web/hybrid-office-3d.js`, `web/office-navigation.js`, `web/office-projection.js` and `web/office-characters.js`. For **walk path editing, forbidden zones, interaction approaches or seat anchors**, read the latest navigation authoring section in HYBRID-STUDIO.md, then `web/office-nav-editor.js`, `web/office-nav-state.js` and `web/office-navigation.js`. Optional `room.navigation` is saved/exported with each floor; testing is transient. Actual room shell geometry lives in `web/office-architecture.js`. Floor-scoped task boards use `web/floor-tasks.js`; unavailable or unscoped feeds must never become fake department tasks. Activities are local simulation only; editing stops motion, reduced motion stays static and ambient playback never writes Agent or scene records.
  Floor/Edition selection, `office-floor/v1` file exchange, popup/navigation actions and sprite effects also live here. Load the selected floor snapshot; never substitute the last library design. Preserve old `office-room/v1` files and local-preview isolation. The proposed Tycoon design §9.1–9.2 adds a separate `tycoon3d` edition/store and `office-floor/v2` exchange, including Lobby, with explicit legacy selection and context-isolated local presentation alongside live data. It does not change the legacy formats or make local scene saves Zuri writes.
- [Native 3D floor editor](docs/NATIVE-STUDIO.md): original Office geometry is now editable through `web/native-{state,studio}.js` and the existing `web/office.js`. It is not a sprite conversion. Stable original seat IDs plus an extensible 48-item prop catalog, per-floor transforms and declarative interactions are shared with the actual floor renderer. Original decor uses an optional explicit `decor` inventory (omitted means defaults, empty means deleted); copies use new prop IDs. Preserve legacy finish inheritance, private material ownership and source pivots. Room finish IDs/presets live in `web/room-surfaces.js`; GLTF surface tags originate in `web/models.js`, and instance-owned overrides/cleanup in `web/surface-finish.js`. Preserve original material restoration and tower isolation. Copies must strip slot bindings; deleting furniture never deletes or remaps agents. Lobby remains 2D. Do not reintroduce fixed DESKS positions into animation or discard dormant Hybrid layouts when selecting the native edition.
  For **resize, perspective, dimension px, marquee/multi-selection, saved groups, layer ordering, snap or textures**, start with `web/native-transform.js` (group/layer state, atomic transforms, 100 design px/metre), `web/native-texture.js` (local raster normalization), `web/office.js` (projected object bounds and pointer handling), and the transform/texture/group section of NATIVE-STUDIO.md. Object `scale`/`tilt`/`groupId`, room `projection`/`layers`, and `finish.texture` are optional backward-compatible fields. Distinguish fixed design pixels from projected CSS pixels. Keep grouped edits atomic, locked pieces unchanged, image data embedded and bounded, and stale asynchronous image loads unable to mutate disposed materials.

- [Studio styles](docs/STUDIO-STYLES.md): actual sprite editor scope, asset paths and verified behavior.
- [Design Studio](docs/DESIGN-STUDIO.md): original procedural model and room prototype.
- [Art production plan](docs/ART-PRODUCTION-PLAN.md): the hybrid-scene component checklist, verified asset inventory and 12 generic avatar sprites. Treat those avatars as artwork only, never as Zuri agent records or role assignments.
- [Zuri platform integration boundary](docs/ZURI-PLATFORM-INTEGRATION-BOUNDARY.md): read before changing domain/floor mapping, agent display, CRUD, event bus, persistence or conflict handling. Distinguishes the current local prototype from the future platform contract.
- [3D art brief](docs/3D-ART-BRIEF-V0.1.md): earlier model brief; current application profile takes precedence for hybrid art direction.
- [Game design](docs/GAME-DESIGN-V0.1.md): proposed simulation/economy; do not confuse proposals with working business features.
- `web/studio-art.js`, `web/studio-art-state.js`, `web/studio-art.css`: current art editor.
- `web/assets/studio-styles/`: rendered sprite components; `web/assets/models/studio/`: original model assets.
- `reports/`: local delivery evidence. Read the associated documentation before claiming an earlier test covers a new change.

## Scope and delivery

Preserve existing changes made by other sessions. Distinguish sprite art, real 3D geometry, documented direction, and runtime-verified behavior. Follow the existing package scripts for checks relevant to changed behavior; documentation-only edits need source/link checks, not an invented runtime pass.

The 23 October Tycoon request resumes investigation and client integration planning for real Zuri reads and commands in Lobby/Projects. This does not publish missing platform contracts: see the Tycoon integration/dependency matrix before implementing a new adapter. Canonical domain/module/agent roles, auth/API ownership and shared persistence remain Zuri-owned; real economy integration is still outside this slice. Art refinements do not assign tenant/business IDs, create domains or agents, grant permissions, or imply increased agent capability from furniture upgrades.

Keep design rules in the application profile and implementation evidence in this repository. If the external design folder is unavailable, use DESIGN-SOURCES.md to identify the missing source and report that limitation; do not substitute a historical kit or claim a new design matches a source you could not inspect.


For **Tycoon GLB multi-select / Group / Ungroup / layer / texture**, read the GLB selection
section in `docs/OFFICE-BLUEPRINTS.md`. Start with `web/tycoon-transform.js`,
`web/tycoon-selection.js`, `web/tycoon-edit-tools.js`, `web/tycoon-state.js` and
`web/tycoon-scene.js`. Reuse `web/native-texture.js` and `web/surface-finish.js`.
Keep optional `groupId`/`finish`, room `layers`/`finishes` backward compatible; reject agent
metadata. Group transforms and custom stations are atomic, one gesture/Undo; layer order
must retain physical depth. Latest texture import wins; selection/floor changes invalidate it.

For **GLB ชุดสำเร็จรูป / furniture prefab / Asset Library ชุดของฉัน**, read the reusable
furniture sets section of `docs/OFFICE-BLUEPRINTS.md`; start with `web/tycoon-prefabs.js`
and `web/tycoon-prefab-library.js`. Sets capture relative visual geometry and seat anchors,
never room routes, agents or platform bindings. Fresh IDs on placement; one draft Undo;
explicit per-floor Save. Thumbnail capture must await texture decoding and reject stale edits.

For **export/import furniture sets / portable Asset Library / ชุดข้ามเครื่อง**, use
`web/tycoon-prefab-files.js` and the Portable furniture-set files section in OFFICE-BLUEPRINTS.
The bounded bundle embeds GLBs, textures, preview and anchors. Verify the installed kit
revision, canonical catalog/geometry fingerprint and GLB hashes before adding a fresh entry.
Bump the codec's geometry contract when coordinate/anchor interpretation changes. Never
silently substitute models, import Agent bindings, or apply a set to a floor during import.

For **own GLB / custom model / นำเข้าโมเดลของเรา / จุดนั่งของโมเดล**, read the Custom GLB
library section in OFFICE-BLUEPRINTS and `docs/superpowers/specs/historical/2026-10-24-custom-glb-design.md`.
Start with `web/custom-assets.js` and `web/custom-asset-panel.js`. Model bytes live in IndexedDB;
custom objects carry immutable descriptors and actual metric dimensions. Never substitute a
built-in footprint or trust imported descriptor bounds without measuring the GLB. V2 bundles
embed all custom dependencies; v1 remains supported. Floor files reference custom blobs and
require corresponding asset bundles on another machine. Categories never assign Agent roles.
