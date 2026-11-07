# Office Tycoon Implementation Plan

Disposition (7 November 2026, lead under the owner's delegation): Delivered through later merged work (Tycoon scene/state/studio/activity modules and tests; OFFICE-MVP-ACCEPTANCE-20261031.md owns accepted scope). The checkboxes were never maintained. Connected work/roster/command scope (ZD3–ZD6) stays open under G5 in SYSTEM-GAP-ANALYSIS.md.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a playable GLB building, Lobby and Projects scene with object interactions, preserve Studio layouts, and admit live Zuri actions only through accepted contracts.

**Architecture:** Add focused Tycoon modules beside the legacy renderers. A versioned local scene describes instances and geometry; runtime GLBs, picking, collision and Studio consume the same scene. Existing Zuri read adapters remain the only current source of business information; work/roster/command integrations require the contracts in ZD1–ZD6.

**Tech Stack:** Existing JavaScript ES modules, Three.js 0.180.0, GLTFExporter/GLTFLoader, node:test, JSDOM and browser validation.

**Spec:** [Approved design v0.2](../../specs/historical/2026-10-23-office-tycoon-design.md), [production workflow](../../../game-design/TYCOON-PRODUCTION-WORKFLOW.md), [asset list](../../../game-design/TYCOON-ASSET-LIST.md).

## Global Constraints

- One complete 3D model per asset; one primary orthographic camera, azimuth45°, elevation asin(.52), metres/Y-up.
- No sidebar on Office routes. Dock: อาคาร / ชั้น / งาน / แต่งห้อง. Keyboard controls must reach the same object actions as picking.
- Tycoon is additive: edition `tycoon3d`, file `office-floor/v2`, room `office-tycoon/v1`, store `zuri-office:tycoon-studio:v1`. Retain all v1 files and legacy snapshots.
- Scene exports contain no business payload, IDs, credentials, API URLs or executable actions. Live actor identities and operations are not authored props.
- No invented Zuri auth, domain, roster or command endpoint; no T3 substitution. Missing contracts remain visible and block connected acceptance only.
- Do not commit unrelated existing work. This approved workflow authorizes local implementation, not remote publishing.

## Execution and delivery boundaries

The owner approved design v0.2 and explicitly authorized plan→prototype. The integrator executes the local work in the current feature branch, preserving its dirty baseline; a fresh reviewer checks the resulting patch. No second scope or execution-choice approval is required for this same authorized work.

Tasks1–5 deliver the local GLB prototype. Task6 completes Studio parity. Task7 adds actor production and path/seat behavior. Task8 is conditional on accepted Zuri contracts. Task9 records evidence and does not label the whole slice complete while Task8 is blocked.

## Review Focus

### Progress at 24 October 2026

This is the first prototype milestone, not completion of this implementation plan.
The unchecked steps below remain the full task completion contracts; a partial row does not waive them.

| Task | Current state | Evidence / remaining work |
| --- | --- | --- |
| 1 Scene/store | Implemented, targeted tests pass | Per-floor revision/conflict/quota, validation, actor/binding rejection and legacy preservation |
| 2 GLB kit | Prototype implemented | 24 original GLBs, deterministic manifest, bounds/pivots/hash/clip tests; final art, anchors/cards and multi-angle QA remain |
| 3 Runtime | Prototype implemented | Actual GLBLoader/AnimationMixer, generation guards, own materials, fallback; device/context-loss/performance QA remains |
| 4 Shell | Prototype implemented | Building/G/Projects, four-button dock, object sheets, visible focus, legacy choice; complete a11y matrix remains |
| 5 Zuri read | Adapter implemented, live verification pending | Existing scope/projects path only, origin/scope/error/stale tests; no fresh authorized Zuri read this turn |
| 6 Studio parity | Partial | Per-floor transforms, inventory, Undo/Redo/save/import/export, shared GLB blueprint/path/seat/door tools; groups/layers/textures parity remains |
| 7 Actors/nav | Partial | One generic master/seven clips, authored routes, seats, reservations and doors now work locally; appearances, live roster and final art remain |
| 8 Connected loop | Contract-blocked | ZD1–6 unresolved; no guessed dispatch API and no live command acceptance |
| 9 Evidence | Local milestone reviewed | See integration §7 and local reports; full slice/production acceptance remains open |

Review corrections include visible focus, global-route draft guard, actual discard on mode change,
authored actor rejection, storage failure on Studio entry, verified Zuri target, both-floor
preview isolation, obsolete asset errors and retry eviction. The final whole-suite result is
recorded in the evidence document, separately from the earlier failed and targeted reruns.

1. Late GLB/fetch callbacks after floor switch must not mutate the next floor (T3/T5).
2. Legacy saved Lobby must survive switching editions and storage failures (T1/T6).
3. A failed renderer still permits text navigation and work access (T3/T4).
4. Zero/unknown roster must not turn four furniture instances into four real Agents (T5/T7/T8).
5. Import, hidden rail focus and Business switching must not expose stale data or execute scene text (T1/T4/T5/T6).

## Task 1: Versioned scene and store

**Files:** Create `web/tycoon-state.js`, `tests/tycoon-state.test.mjs`.

**Interfaces:** `createTycoonRoom(floor): Room`; `validateTycoonRoom(value): Room`; `tycoonFloorFile(floor,room): Envelope`; `parseTycoonFloorJSON(text): Envelope`; `TycoonStore(storage)` with `get(floor)`, `save(floor,room,expectedRevision)`, `select(floor,edition)`. Scene dimensions are12×8m, not inferred from sprite bounds.

- [ ] Write tests: distinctLobby/Projects snapshots; malformed/unknown fields and nonfinite transforms rejected; foreignfloor rejected; storagequota retains previous value; stale revision returns conflict; v1 store byte-for-byte unchanged.
- [ ] Run `node --test tests/tycoon-state.test.mjs`, observe failure before module exists.
- [ ] Implement bounded declarative model: instance ID/catalogkind, transform, intent; separate local revision and explicit edition selector. No business fields. Export validated clone.
- [ ] Rerun the test and record actual counts. Review diff before including files in any later commit.

## Task 2: Modular original GLB kit

**Files:** Create `web/tycoon-models.js`, `scripts/build-tycoon-assets.mjs`, `web/assets/models/tycoon/manifest.json`, `tests/tycoon-assets.test.mjs`; modify `package.json` assets chain and asset bundler where required.

**Interfaces:** `createTycoonModel(kind): THREE.Group`; catalog metadata providesdimensions/groundpivot/footprint/intent. Build emits `<kind>.glb` with SHA256 and measured bounds. No image-only replacement.

- [ ] Test expectedcatalog keys and dimensions, groundpivot, repeatable bytes, validGLB2, manifest hashes, desk separatefromchair.
- [ ] Run failing targeted tests.
- [ ] Build original meshes/materials from existing art direction; export through current GLTFExporter polyfill. Geometry may be greybox quality initially; mark asset quality accordingly.
- [ ] Run builder then tests; inspect hero/top/side in runtime. Budgets follow asset list; no new package/provider.

## Task 3: Runtime GLB scene

**Files:** Create `web/tycoon-scene.js`, `tests/tycoon-scene.test.mjs`.

**Interfaces:** `TycoonScene(root,{onPick,onError,loadAsset})`; `setScene(kind,room)`, `zoom(delta)`, `reset()`, `dispose()`. `kind` is building/lobby/projects. Loader caches immutable source scenes and clones instance materials; each visible object exposes aninstanceID.

- [ ] Test that a disposed/obsolete load cannot attach, differentinstances own transforms/materials, pickreturnsinstanceID and cleanup releases ownedresources.
- [ ] Run targeted RED test.
- [ ] Load GLB bytes, fit fixedcamera to measured bounds, use raycast plus dragthreshold/pan/zoom, resize observer, contextloss fallback and disposal. Build scene from sharedmetriccoordinates; no bakedbackground pretendingtobe3D.
- [ ] Run tests and browserinspect12×8m bounds, contact, empty/failurestate andfloor switches.

## Task 4: Scene-first shell and object sheets

**Files:** Create `web/tycoon-view.js`, `web/tycoon-view.css`, `tests/tycoon-view.test.mjs`; modify `web/building-view.js`, `web/app.js`, `web/index.html`.

**Interfaces:** `TycoonView(root,{onNavigate,onStudio,Scene,storage,connector})`; `show(floor)`, `hide()`, `dispose()`; sheet actions dispatch allowlisted intents, not scene-supplied URLs.

- [ ] Test buildingentrance→Lobby, directory→Projects, board/desk/presentationactor→correctsheet, closesheetfocus, nohiddenrailfocus, legacyroutefallback, pendingloadcancel.
- [ ] Run targeted RED test.
- [ ] Replace persistent Office rail with fourdockbuttons, Business/freshnessHUD andonecontextsheet. Keep T3 and legacyStudio routes intact. Never call T3 jobs “Zuri work”.
- [ ] Wire new scenes only for building/Lobby/Projects; showexplicit legacyselection for savedfloors. Existingcustomsnapshot opens itsrenderer until userselectsnewedition.
- [ ] Run tests and mouse/keyboard/mobileviewport checks. Building and directory expose onlyavailablepilot scenes; otherauthorizeddomains show unavailable-scene reason.

## Task 5: Existing Zuri read path and truthful unavailable states

**Files:** Create `web/tycoon-data.js`, `tests/tycoon-data.test.mjs`; integrate TycoonView with existing `web/zuri-connector.js`.

**Interfaces:** `TycoonData(connector,{onChange})`; `connect()`, `selectBusiness(id)`, `refreshProjects()`, `dispose()`; state distinguishes checking/authrequired/denied/error/empty/ready and records source/time.

- [ ] Test realshapedscoperesponse andprojectrows, unauthorizedBusiness selection, stale callbackafterBusinesschange, countprojectsvswork, noDispatchroute, errornotempty.
- [ ] Run RED test.
- [ ] Reuse only getStatus/getScope/getDomain('projects',businessId); no new backendroute. Showprojectcollection; workdetail/roster/commands remainexplicitlyunavailable pendingZD3–6.
- [ ] Run tests with fixtures clearlylabelled; only claimfreshread afterauthorizedruntimecheck. DisablemutationCTA withreason; do notsimulate success.

## Task 6: Complete Tycoon Studio parity

**Files:** Create `web/tycoon-studio.js`, `tests/tycoon-studio.test.mjs`; modify `web/design-studio.js`, sharedblueprint/nav/materialhelpers only where needed.

**Interfaces:** `TycoonStudio(root,{floor,store,onVisitFloor})` with `requestLeave(callback)` and `dispose()`; `TycoonStore` remains saveowner. Import/export fromTask1; render viaTask3.

- [ ] Test explicitedition switching, imports asdraft, floorisolation, quota/conflict, Undo, groups/layers/finishes/textures, forbiddenzones/seatanchors, doorstate, dirtynavigationguard.
- [ ] Implement editor adapters using existing authoringcontrollers; add missingparity controls rather than silently stripping fields. Rigidprop/material boundsusecatalog data.
- [ ] For connectedlocaldrafts require verifiedcontext and separateviewer/tenant/Business/floor namespace; absentcontract leavespreviewonly. Exportstripsruntimebindings.
- [ ] Test legacyHybrid/native imports and savedrooms unchanged. Browser Save→visit→reload→export→import roundtrip onLobbyandProjects; do notmarkTask6doneforonlybasicdragging.

## Task 7: Actors, interaction stations and navigation

**Files:** Extend `web/tycoon-models.js`, `web/tycoon-scene.js`; create `web/tycoon-activity.js`, `tests/tycoon-activity.test.mjs`; reuse `web/office-navigation.js` andblueprintgeometry.

**Interfaces:** activity consumespositions/collision/stations andreturnsactorpose; animation clipsidle/walk/sit_down/seated_work/stand_up/talk/gesture_point; navigationownsroottranslation.

- [ ] Test reachableapproach, seatreservation/release, movingdoorblock, nopath, .3mclearance, no authoredstatewritesperframe.
- [ ] Exportoneadultmaster rigwithsevenclips andthreeappearancepresets; do8directionQA, contactseatingandreducedmotion.
- [ ] RuntimeusesAnimationMixer andsamecollision source aswalls/props; Nrealactors derivesonlyfromauthorizedroster. Fixtureactors arelabelledandremovedbeforelive mode.
- [ ] Run actor/nav/door tests and recordbrowserwalkingclip; no image-only proof ofwalking.

## Task 8: Contract-gated live work and command loop

**Files:** Extend `web/tycoon-data.js`, existing connector and `tests/tycoon-data.test.mjs` onlyafterownerspublish ZD1–6.

- [ ] Pinapprovedproducer/consumer contract/source revisionandtestenvironment; document exactaction/payload/result, scope/version/idempotencyandstatusmapping. Do not guessfunctionsorendpointnamesbeforecontractexists.
- [ ] Addconsumer testsfromproducerfixtures forworkreads/roster/actioncapabilities/command/result/unknown/conflict/denied.
- [ ] Implementadaptersagainstthosecontracts; contextual UI usesauthoritativebinding andpreservesuserdraft onfailure.
- [ ] RunactualtestBusiness read→allowedcommand→operation→terminalresult→readback/audit. Recordredactedreferences; do notmarkcompleteonmockortop-levelPOST200alone.

## Task 9: Review, evidence and handoff

- [ ] Run `npm test` and `npm run build`, inspecttestcountandfailures; runfocusedchecksagainonlyafterrelevantfixes.
- [ ] Browsercheckbuilding/Lobby/Projects, GLBrequests, floorSave/legacyisolation, desktop1440×900, mobile390×844, keyboardandWebGLfallback. Physicaldeviceperformance remainsseparate.
- [ ] Freshreviewagainsttheexactpatch; resolvecritical/importantissues andrerunaffectedchecks.
- [ ] Recordactualcompletionpertaskinthisplan plus `reports/office-tycoon-<date>/`; updatestart-here/SRSimplementation status onlyforevidence-backedbehavior.
- [ ] StopatconditionalTask8 ifcontractsremainmissing; deliverlocalprototype/readcapabilitywiththatlimitation, neverlabelConnectedsliceaccepted. No push/deploywithoutrequest.

## Self-review

## Authorized continuation — GLB structure and navigation, 24 October

The owner explicitly requested completion of the local blueprint, path, seat and door workflow.
No additional Zuri contract or design approval is needed for these presentation features.

1. Extend the existing Tycoon room with optional validated `blueprintPlan` and `navigation`.
   Keep old rooms readable; materialize a default plan only on an explicit editor change.
   Use the existing structural-plan schema and projected navigation schema; metric adapters
   connect them to GLB transforms, with no Agent records or business bindings.
2. Reuse `OfficeBlueprintEditor` / `OfficeInteriorEditor` and `OfficeNavigationEditor` through
   injected geometry/navigation adapters. Provide S/M/L structural templates, walls, partitions,
   openings, forbidden zones, approaches, seat points, template save and floor save.
3. Generate GLB wall spans, real window openings and door panels from `blueprintLayout`.
   Use the same spans plus rotated/scaled GLB footprints in the shared pathfinder. Closed doors
   block paths; no-path and invalid seating fail visibly instead of teleporting through geometry.
4. Add transient walk/station probes with Stop, seated-work/stand-up clips and reservations.
   Revalidate every traversed segment. Editing stops probes; occupied thresholds reject closure.
5. Save door changes only to the selected local floor with revision checking. Connected/read-only
   presentation never writes a local shared identity namespace. Export/import preserves authored
   structure/navigation/door state, not transient actors, routes in progress or reservations.
6. RED/GREEN tests cover schema roundtrip, exact GLB/door geometry, collision and detours, seats,
   reservations, door closure, editor preview/Undo/cancel, floor isolation/conflict and import.
   Then browser-test actual editing/save/reload, run full tests/build and independent review.

Remaining unrelated production gates (final artwork, device profiling, Zuri commands and advanced
group/layer/texture parity) stay explicit; this continuation closes the four named local tools.

Design§§1–7 maptoTasks4/5/8; §8to2/3/7; §9to1/3/6; §10to5/8; §11to9. AllfiveReviewFocusconditionshaveassignedtests. Current interfaces arefrontend-only anddonotassignplatformownership. ThelocalprototypeandfullStudioparityhave distinctgates sofirstdeliverycannotclaimallfeaturesdone.


## Authorized continuation — GLB selection/groups/layers/textures, 24 October

Owner requested the remaining local editing tools. Execute in the existing feature checkout.
1. Add optional object groupId/finish and room layers/finishes to the validated Tycoon schema.
   Keep old JSON valid, reject dangling layers/singleton groups and cap total scene bytes.
2. Implement atomic multi-selection/group transforms, duplicate/delete/ungroup and ordered
   layer blocks. Transform authored station points with their furniture; copied groups get new
   object/group IDs and copied local stations, never agents or bindings. One gesture = one Undo.
3. Add scene click/Shift-click, marquee and move modes plus keyboard-accessible selection list.
   Move/scale/rotate selected sets around a common pivot; snapping applies one shared delta.
   Layer ordering preserves physical depth testing; it is not permission to draw through walls.
4. Reuse local raster normalization and instance-owned SurfaceFinish for props and floor/walls.
   PNG/JPEG/WebP input is normalized to bounded embedded PNG; repeat/offset/rotation/opacity,
   clear and material presets apply to the selected set. Late imports cannot change another
   floor/selection/draft. Textures and materials are disposed without mutating source GLBs.
5. Verify pure state/math/security, renderer ownership, editor Undo/save/reload and floor
   isolation; browser-test selection/group movement/scale/copy/layers/texture and saved runtime.
   Update routing/evidence, run full tests/build and one independent review. No Zuri calls.

Acceptance is limited to these named local tools; final art, device profiling and platform
contracts remain separate. Existing Web Lock/revision guards remain the sole Tycoon writers.


GLB selection continuation completed locally on 24 October: marquee/Shift selection,
Group/Ungroup, atomic move/rotate/uniform scale/copy/delete, layer ordering with depth,
embedded raster finishes on selected props/floor/walls, and per-floor save/export.
Verification: 389/389 tests, no skipped tests; build PASS (365 assets, 24 Tycoon GLBs).
Document validation: 11 documents, 79 relative links, 18 Mermaid diagrams PASS.
Browser exercised group drag/scale/copy/Ungroup/Undo, texture upload and Save/reload/runtime;
mobile 390x844 showed no horizontal overflow. Source textures now dispose on final cache
release, latest import wins, UTF-8 byte caps enforced. Stable CanvasTexture allocation fixes
uploaded texture white rendering, with failing regression before the fix and visual proof.
Evidence: reports/office-tycoon-design/verification-glb-parity.json and glb-parity-*.png.
Named local scope complete; connected namespaces/contracts, full legacy parity matrix,
production art/device profiling and live Zuri remain separate gates. No commit or push.

## Authorized continuation — reusable GLB furniture sets (24 October)

User requests saving selected furniture groups as Asset Library cards with previews, then
placing them across floors while retaining finishes/textures/seat anchors and no agent changes.
Design: local `office-furniture-set/v1` records in a separate bounded library; selected props
are normalized about a shared X/Z pivot. Capture explicit or resolved default seat/approach
anchors, preserve relative layers and visual transforms. Each insertion remaps every object
and station to fresh IDs and creates a new group; it edits the selected floor draft with one Undo.
No room shell, route, Agent, role, business binding or platform action is copied.
Preview: render just the selected GLBs with the same camera/materials, after texture decode,
into a small PNG. Stale capture cannot save a changed selection/floor. Library write failure
keeps existing records and floor drafts unchanged. Floor Save remains explicit.
Implementation order: pure schema/capture/place/store tests; library card controls + isolated
thumbnail renderer; integration tests and cross-floor browser save/reload; docs and independent review.

## Authorized continuation — portable furniture-set files (24 October)

Add per-card Export and library Import. `office-furniture-bundle/v1` JSON contains validated
furniture set, preview/texture PNGs and deduplicated GLB bytes for every referenced kind.
Bound file to 8 MB; validate strict shape, complete/unique models, GLB header and SHA-256.
Only the installed kit's exact content hashes are admitted: renderer dimensions and seat
semantics are defined by that kit, so unknown model revisions fail clearly rather than silently
substituting geometry. Accepted models are byte-identical to the local kit; the imported library
stores the set and uses those identical bundled app assets. Export again reproduces the same
GLB content. This is portable across machines with compatible Visual Office kits, not arbitrary
custom-GLB ingestion. No browser keys, Agent/business metadata or floor identity is exported.
Import appends a fresh library entry after complete validation; it never changes floor drafts.
Order: codec round-trip/hostile-input tests → file controls and lifecycle guards → fresh-storage
round-trip + browser download/upload → docs, full checks and independent review.

Completed: codec and file controls, strict kit revision/catalog/geometry fingerprint checks,
and lifecycle-safe append-only import. Full tests 399/399, build 368 assets, documentation
check 11 documents / 80 links / 18 Mermaid diagrams. Browser downloaded the bundle, imported
into an empty separate-origin library, placed it in Lobby, saved and reloaded successfully.
Independent review's kit-identity finding was fixed and re-reviewed with no remaining finding.
Evidence: `reports/office-tycoon-design/verification-prefab-files.json`. A second physical
machine was not tested; custom GLB installation and live Zuri integration are outside this slice.
