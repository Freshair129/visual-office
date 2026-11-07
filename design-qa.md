## Scale, multi-selection, perspective and texture — 20 October 2026

Implemented per-object XYZ scale/tilt, projected corner resize handle, per-floor perspective selection, group move/copy/delete, origin/grid snapping and pixel dimension inputs. Texture upload embeds normalized local PNG and exposes repetition, offset, rotation and opacity; independent material ownership and stale-load cancellation are tested. Inspector split into shape and finish tabs.

Verification: npm test **219 passed**, zero skipped; npm run build **242 assets**. Group spacing, atomic cap failures, locks/Play, old schema compatibility, bad transform/image rejection, image disposal, perspective geometry, input-before-blur capture and floor-file persistence covered. Browser: real corner drag 115→142.52% then Undo; snapped table/chair pair move, two-piece duplicate and Undo; same controls at 390px without horizontal overflow; texture upload and repeat/rotation changes; save/reload, Customer isolation, downloaded JSON and imported preview. Actual floor still has four role labels. Console error list empty.

Evidence: `reports/transform-texture-20261020/{studio-desktop,texture-inspector,mobile,applied-projects}.png`, final test/build logs and deterministic test texture. This is local browser persistence, not platform synchronization. Perspective transforms are true 3D scale/tilt, not four-corner image warps; custom texture uses existing mesh UVs.

## Movable original decor and per-object finishes — 20 October 2026

Original sofa/table/storage/coffee kit/pinboard/three plants can move, rotate, duplicate, delete and restore. Shared inspector applies independent finishes to furniture; desk/chair primary finish masks preserve electronics/hardware. Explicit original-decor inventory prevents deletion resurrection; old files inherit original geometry/finishes. No roster changes.

Checks: npm test 212 passing; npm run build 240 assets. Regression coverage: old-file colors, floor isolation, persistence of deletions, copy independence, reset/Undo, locks/Play, reserved IDs/source validation, pivot geometry equivalence, GLTF ownership and finish cleanup. Browser evidence: reports/movable-decor-20261020/.

Browser verification: dragged original sofa, made an independently colored fabric copy, saved a wood desk and blue fabric chair, deleted an original plant and verified it stayed deleted after reload, then restored it. Projects retains 26 pieces and four unchanged role labels; Customer retains its default original decor. At 390px, cabinet position editing and Undo worked without horizontal overflow. No browser console errors. Captures: studio-desktop.png, applied-projects.png and mobile-cabinet.png in that report folder. Persistence remains local to the browser, with floor-file export/import; platform synchronization is paused.

## Original room surface finishes — 20 October 2026

Implemented 17 original room targets with click/list selection, colors and seven material options including original. Finishes persist with furniture in per-floor snapshots; old files remain compatible. Reset restores original multicolor materials; Undo/Redo, Play protection and conflict checks covered. Geometry remains fixed; agents/roles unchanged. Procedural texture contrast softened and mipmaps enabled after browser visual review.

Validation: npm test 207 passing; npm run build 240 assets. Tests include actual source model target enumeration, surface isolation/restoration, owned resource cleanup, and overview template isolation. Browser: Projects saved Sage left wall, wood floor, frosted middle pane and rest-blue fabric sofa; Customer retains original floor material; direct mesh wall picking, reset/Undo, reload and actual-floor rendering checked. Evidence: reports/room-finishes-20261020/.

## Native 3D furniture catalog — 20 October 2026

Added five allowlisted furniture kinds, duplicate/delete/undo, 0–48 objects per floor, backward-compatible original files, shared runtime/editor reconciliation and empty-room handling. Original agent seat IDs remain reserved; duplicates have no slot; missing original chairs leave agents standing at default positions. Mesh removal disposes generated geometry without disposing shared GLTF assets.

Browser proof: `reports/native-catalog-20261020/studio-desktop.png`, `mobile-390.png`, `applied-popup.png`. Projects saved with 15 objects; Customer still 12; Projects four original role labels retained. New plant dragged; popup works after actual-floor reload. Native controls 44px at 390px viewport; no horizontal overflow. Mobile add/copy/delete/Undo/Redo exercised. Delete clears selection to prevent an accidental second deletion.

Validation: `npm test` 204 passed; `npm run build` 238 embedded assets. Logs in the same report folder. Existing walls and built-in room decor remain fixed; no collision/pathfinding, arbitrary GLTF import, platform sync or agent role changes.

# Original 3D floor editor review — 20 October 2026

final result: passed for local preview floors

- Reuses the actual Office renderer, original room/desk GLTFs and original chair geometry. New native tab, floor selector and object inspector do not substitute a sprite scene.
- Real pointer drag moved desk 1 independently (-3.25/-2.5 to about -3.319/-3.8, undone) and chair 5 independently (.65/2.3 to about 1.126/3.8). Final saved Projects desk 1: X -3, Z -2.8; chair 5: X 1.2, Z 3.1, rotation 30.
- Found and repaired numeric-input loss when selection preceded change/blur. Regression verifies input capture and incomplete-field save rejection. Values verified after save, floor switch, actual-floor return and real download/file-chooser import.
- Popup worked in actual Projects after reload and by directly clicking the desk mesh in Studio Play. Customer retained its Hybrid edition; no save was made to Customer.
- Final full suite: 202 passed, zero failed/skipped. Build: 238 embedded assets. Scoped tracked diff whitespace check passed. Fixture-only multiple-Three warning is emitted by the existing test harness; live browser warning/error query was empty.
- Desktop 1440×1060; mobile 390×844 and 320×780. Body client/scroll matched 375/375 and 305/305 respectively. Native scene and popup visually inspected. Final viewport reset.
- Evidence: `reports/native-studio-20261020/` (studio-final.png, applied-popup.png, mobile-390.png, mobile-popup.png, tests.log, build.log).
- Boundaries: 14 original domain floors; Lobby remains 2D. Local browser state only. Fixed twelve furniture identities, no mesh creation, collision solver, room resizing or new role assignment. No commit, release or external deployment.

# Floor workspace and interaction review — 20 October 2026

final result: passed for local preview scope

- Floor selector loads its own saved room; Edition compares draft with the current assignment. Original Projects renders the existing Office route in a read-only embedded viewport, not a fabricated hybrid reconstruction.
- Real browser: downloaded `visual-office-lobby-current.json`, opened it through the file chooser, reviewed the preview, accepted and saved it. Customer retained its seven-object city layout; Lobby retained its eight-object garden layout.
- Desk popup works in Studio and actual Lobby after reload. Configured opacity 95%, shadow 2 px, warm glow and hover lift persisted and were read back from rendered DOM. Popup content remains plain text.
- Unsaved floor switch prompted; cancel retained the typed popup title. Original-edition restore rendering now explicitly bypasses the hybrid assignment through a read-only query flag, without changing storage.
- Desktop 1440×1060; mobile 390×844 and 320×780. At 320 body client/scroll widths were both 305. Removed inherited label margins from the floor toolbar. Mobile popup fits the viewport. Reduced-motion uses outline in place of hover displacement.
- Final tests: 193 pass, zero failures/skips. Build: 235 embedded assets. Browser error/warning logs: empty. Self-review and browser checks, not an independent review or production acceptance.
- Evidence: `reports/floor-studio-20261020/{studio-final,mobile-320,mobile-popup,applied-popup}.png`, tests.log and build.log.
- Limits: local browser persistence and file handoff; original WebGL objects cannot be edited in this sprite editor. No arbitrary script, live Zuri business actions, collaborative server or version-history system.

# Hybrid room editor review — 20 October 2026

final result: passed

Scope: the user selected a mixed implementation from the existing three references: Painted environment, Soft 3D props, unchanged 2D Anime cast. This is an extension of the existing Studio UI, not a pixel-for-pixel clone of the concept-board page. Source board, generated individual props/background and rendered room were opened together for comparison. Review covers the delivered editor/floor/manual-AI workflow, not animated or rigged agents.

## Sources and rendered evidence

- Painted reference: C:/Users/suanr/.codex/generated_images/01a15724-ec18-7bb2-a034-ee14ed1a9ff0/exec-dd61b926-9d53-460f-9770-f1956fe7a91a.png (1536x1024 concept sheet).
- Soft furniture source: web/assets/studio-styles/soft3d/desk.png; standalone new desk and chair inspected against it. Existing shared/duo.png retained unchanged.
- Runtime: reports/hybrid-studio-20261020/studio-final.png, studio-desktop.png, ai-proposal-desktop.png, floor-assignment-mobile.png, applied-lobby-mobile.png, studio-mobile-320-viewport.png.
- Desktop 1440x1060; mobile 390x844 and 320x780. At 320, actual usable width305, child bounds10..295. Full-page capture can reflow scrollbar width: use viewport screenshot and DOM measurements for edge-fit judgment. Concept sheet and editor have different layouts by user mandate; art comparison uses the corresponding scene/prop content, not the sheet header as an app requirement.

## Comparison and behavior

- Typography: existing warm Thai/English hierarchy retained; title, room name, editing tools and primary actions remain distinct. Small helper copy is secondary. At320 titles wrap without covering controls.
- Spacing/layout: room is primary, inspector at right on desktop and below on mobile; catalog/background/collaboration drawers group actions. Save and floor application are separate actions. Mobile defaults to the whole room, with zoom/scroll for detail.
- Colors: cream/oak/amber/sage/blue language matches references; new backdrops deliberately retain the same geometry. No recolored brand logo or reinterpreted character identity.
- Imagery: real generated Painted backgrounds and alpha props; no CSS furniture substitutions. Separate chair remains visible behind the desk, and alpha hit testing permits selection through transparent desk pixels. Lift enlarged to align better with cast scale. Standing duo remains one sprite by current scope.
- Copy/content: explicitly says local preview, manual AI handoff, draft preview before acceptance, and independent floor application. Nothing labels a simulated agent as live or a PNG as a rotatable mesh.
- Icons/accessibility: existing icon library retained. Labeled controls, visible focus, keyboard nudge, 44px main controls and alternate object list. Scene sprites can be small at mobile fit-to-room scale; the list and zoom provide usable selection. No new idle motion requiring a reduced-motion animation override.
- Runtime: add/nudge/drag, background preservation, save/reload, library and discard handling, Customer/Lobby application, actual floor navigation, reception retention, play/lift, zoom, clipboard export, JSON download, invalid import rejection, proposal preview/accept/reject and undo verified. Final error/warning logs empty.

## Findings resolved

- P2: transparent desk bounds intercepted the chair. Added alpha hit-map selection and verified real pointer movement of chair x53/y65 -> x46.3929/y48.6605, then Undo.
- P2: mobile default showed only part of the room. Changed default to full-width room; 320/390 viewport checks passed.
- P2: original Lobby service points disappeared under replacement scene and floating Studio button overlapped its heading. Retained services as shortcuts, preserved their dialogs, hid redundant floating entry; reception verified live.
- P2: pasted AI proposals could be accepted after draft edits. Added stale-proposal rejection and locked-object protection.
- P2: text edits could be lost by pointer selection before blur. Capture text input before scene selection; regression test passes.

## Remaining P3 / scoped limitations

- Original PNGs are large; no physical-mobile performance benchmark or compressed image derivative is claimed.
- Minor alpha specks around the generated desk are visible only at large source inspection, not a blocker at working scale. Mirroring does not relight baked shadows.
- No walking/sitting rig, navigation mesh, full animated foreground masks, real prop rotation, multi-user sync or online AI execution. These are future features, not incomplete controls shown as functional.

Validation: npm test188/188 (0 skipped); npm run build passed with235 embedded assets; scoped diff whitespace check passed. No deployment or backend changes.

---
# Current review — three interactive Studio styles (2026-10-20)

final result: passed

Scope: all three selected component directions implemented as a responsive assembly editor at `#office/studio`. This is a comparison of component art, character identity and usable controls, not pixel parity with the full-room concept boards. The art boards have a furnished room backdrop; the implementation intentionally provides an open workbench to reposition individual assets. New Soft 3D art is raster-rendered, clearly labelled, and has no orbit control.

Sources inspected together with rendered captures in the same comparison inputs:
- Soft 3D: generated `exec-d78b4ba2-b9fe-4622-b608-f6e484657b54.png` versus `reports/studio-styles-20261020/soft3d-desktop.png`.
- Painted: generated `exec-dd61b926-9d53-460f-9770-f1956fe7a91a.png` versus `reports/studio-styles-20261020/painted-desktop.png`.
- Anime: generated `exec-cc90b766-094e-49bf-a9bb-3a0577ae6125.png` versus `reports/studio-styles-20261020/anime-desktop.png`.
Source boards: 1536x1024. Captures: full-page desktop at 1440x1024 CSS viewport; layout heights differ because the editor adds actual controls. Compared component regions, not unrelated full-page dimensions. The separate large component views made contours, material texture and character identity directly visible; no additional crop was necessary.

Iteration 1: P2 — initial assembly obscured Wangjai behind the oversized desk and put the selection label below the canvas. Fixed desk/cast size and initial placement, and bounded selection targets with container-relative clamps. P2 — missing icon names fell back to the office icon. Replaced the selected mark with text and used the existing mouse icon. Captured again after both fixes.

Final comparisons: cream curved desk and wood fluting, sage chair, blue elevator and cream/gold planter remain consistent. Soft3D volume, Painted brush texture and Anime ink contours remain visibly distinct. Original character clothing and identity are retained; no blocky mannequin is inserted in the style canvas. All three selector cards show actual assets and selected state. No unresolved P0/P1/P2 found in the delivered component-editor scope.

P3 polish/limits: accessory details and object silhouettes vary slightly across generated sprites (not interchangeable mesh geometry); the sparse assembly canvas omits architectural room decoration. Furniture PNGs are approximately 1–1.4 MB each; future mobile delivery can optimize encoding after a style is chosen. Physical-device performance and production character rigging not tested. These do not prevent local style selection and arrangement.

Functional QA: real browser style changes, all assets loaded, scale slider, palette, cast visibility, native pointer drag, keyboard arrow movement, Undo, explicit save/reload, model-tab lifecycle and Lobby round trip passed. 390x844 and 320x780 layouts checked; 320px client/scroll widths both305px. Final console error/warning query returned empty. Full tests177/177 and build223 assets passed; evidence logs are in the same report folder. Nothing deployed.

---
# Idle office design QA

final result: passed

## Current review: company elevator directory (2026-10-20)

The user's requested change replaces the elevator's card selector with a company-style floor/department board. The previous rendered elevator is the visual baseline; its light cards are intentionally redesigned, not treated as the target to copy. The supplied idle-game reference remains the surrounding lobby's art direction. No new illustration was needed for this semantic directory UI.

### Evidence and comparison

- Baseline: `reports/lobby-20261020/mobile-elevator.png`, 390 × 844, G lobby with elevator open.
- Implementation: `reports/elevator-board-20261020/desktop-directory.png` (1006 × 884), `mobile-directory.png` (390 × 844), `mobile-320.png` (320 × 640). All are density-1 browser captures; mobile layouts use a real iframe, not a physical device.
- Mobile full captures are retained. The 390px region is cropped from x=438 in the 1265px containing capture (measured x=437.5 rounded); the 320px region uses x=480 in 1280px. `compare.py` records cropping and composition.
- `directory-comparison.png` was inspected as a combined before/after input at the same 390 × 844 viewport, G route, offline data and open-directory state. New intentional differences: full sign frame, persistent masthead/location, thin department rows, Thai primary labels, descending floor order and a separate current-location highlight.
- `mobile-lower.png` shows the lower rows. `mobile-current-04.png` and `mobile-current-04-v2.png` capture the Marketing location state. `current-floor-comparison-v2.png` combines those at 1:1 for the corrective review; the G row and type are readable at this scale, so an additional enlarged crop was unnecessary.

### Iteration and findings

1. Desktop and 390/320px layouts were inspected. [P2] In the initial Marketing state, legacy lobby-row CSS put an amber box behind amber G text, making G unreadable. Evidence: `mobile-current-04.png`. The current-floor row itself remained correctly marked 04.
2. Removed the obsolete lobby selector styles from `lobby-view.css`. Recaptured the same Marketing state and inspected `current-floor-comparison-v2.png`: G is now gold text on the dark board, while 04 retains the amber current-floor highlight. Clicking G returned to the lobby. No actionable P0/P1/P2 finding remains.

### Fidelity and usability checks

| Surface | Review |
| --- | --- |
| Fonts/type | Existing Plex Thai and Manrope; Thai department names lead, English names support them, tabular floor digits align. Primary names remain readable at 320px. |
| Layout | Brass-bordered panel; 14→G ordering down two columns on desktop, one scrollable column on mobile; 56px rows. Masthead, current location, instruction and close button remain outside the scrolling list. |
| Colors | Dark blue board, warm gold floor numbers/frame, light names and amber current row. Removed legacy gold-on-gold G state. Hover remains distinct from the current location. |
| Imagery/icons | Existing blurred room art remains behind the native dialog. Existing arrow/close icon library is reused. The directory is selectable text UI, with no rasterized labels. |
| Copy | Thai department names pair with the unchanged English domain labels; Warehouse/Operations retain reserved status. Header shows G/lobby or the selected domain, without implying API connectivity. |

### Functional verification

- Lobby elevator → board; all 14 department rows plus G are present. DOM order is descending and matches desktop column reading order.
- Mobile scroll → Marketing → floor 04; reopening updates the header and exactly one `aria-current="location"` row. Escape closes the board while retaining the floor. G row navigates back to lobby.
- Existing floor identity, role actions and navigation regressions pass. Added assertions to the existing behavior tests for directory ordering/current-location changes.
- Desktop console: no errors. Mobile iframe retained an unlocated `MutationObserver.observe` Node-type diagnostic at `2026-10-20T04:49:14.780Z`, consistent with the earlier iframe-only P3 observation. Source remains unestablished; UI interactions succeeded. This is not claimed fixed.
- `node --test tests/*.test.mjs`: **136 passed, zero failed/skipped** (`reports/elevator-board-20261020/tests.log`).
- Production build passed with **191 embedded assets**; rerun after the CSS correction. Temporary fixture removed before building. Diff-check evidence is in the same report folder.
- Local UI change only. The previously recorded absence of Zuri domain API integration is unchanged; no hosted deployment occurred.

final result: passed

## Previous review: ground-floor lobby (2026-10-20)

The user's follow-up requires campus entry to arrive at G, then the elevator to select a domain. This review supersedes the earlier direct-entry interaction described in the historical campus review below.

### Rendered evidence

- Implementation: `http://127.0.0.1:4181/#office/lobby`, static local preview, offline/unknown business data.
- Desktop: `reports/lobby-20261020/desktop-lobby.png`, 1006 × 884, density 1.
- Mobile: `reports/lobby-20261020/mobile-lobby.png`, actual 390 × 844 iframe region, density 1. The containing capture is `mobile-full.png` (1265 × 844); its measured iframe x=437.5 was rounded to 438 for the crop.
- Compact mobile: `mobile-320.png`, actual 320 × 640 iframe region; original `mobile-320-full.png` (1280 × 720), measured iframe x=480.
- Additional 390 × 844 states: `mobile-reception.png`, `mobile-board.png`, `mobile-elevator.png`. Original full browser captures are retained alongside them.
- Combined comparison: `reports/lobby-20261020/lobby-comparison-v1.png`, inspected together as one image: supplied game reference, generated portrait lobby art, and actual rendered lobby. Reference and art are contained with aspect ratios preserved on 390 × 844 canvases. The code in `compare.py` records the evidence cropping/composition, without modifying creative assets.

### Findings and implementation decisions

The lobby keeps the reference's game hierarchy: the scene occupies the screen, the elevator is the large amber action, service areas have small raised labels, the existing work HUD floats above, and the blue game dock remains at the bottom. The warm cream/amber room, miniature people, reception desk, sofas, books and plants make G a recognizable arrival space. Five service areas remain readable without overlap at both mobile sizes. Desktop retains the full horizontal room. The room illustration uses contain sizing with cream margins so service furniture is not cropped by changing aspect ratios; hotspot positions follow the displayed image.

Intentional adaptation: this is a newly designed indoor lobby, not a replica of the supplied stadium scene. All five places link to real existing workflows; the art does not claim live avatar movement or runtime activity. G is shared Business Home, while the same 14 domain floors retain their identities. No remaining actionable P0/P1/P2 visual defect was found in the reviewed states.

### Functional evidence

- Exterior **เข้าออฟฟิศ** → G without opening a modal. G elevator → scrollable directory containing G and all 14 domains → Procurement → **ลงชั้น G** → lobby. Deep-link and browser-history regressions also pass.
- Reception opens a native panel with new task, team/elevator and connection actions. The new-task action opened the existing six-profile task form; it was closed without submission. In this intentionally unconfigured preview, that existing form reports its unavailable knowledge API; attachment loading and provider execution were not accepted by this check.
- Work board shows the correct offline connection prompt. Escape closes it and restores focus to its hotspot. Native reception and elevator panels fit the 390px viewport; the elevator list scrolls.
- Automated board checks cover exact job IDs, safe title rendering, live vs stale/demo state, accepted-result exclusion, unchanged polling focus and stale-item rejection. Lobby service callbacks route to existing Work, Chat, Knowledge, connection and task paths. Navigating away closes lobby dialogs.
- The original Three.js renderer is suspended in G, resumes on domain entry and retains its existing floor fallback behavior.
- No task, message, review or permission was submitted during this QA.

Console review: desktop returned no errors. The mobile iframe tab retained one unlocated `MutationObserver.observe` Node-type diagnostic at `2026-10-20T03:32:24.136Z`; the later 320px reload added none. Source is unestablished and retained as P3 harness evidence, not described as fixed. All reviewed controls remained functional. The temporary iframe fixture was removed before building.

### Validation

- `node --test tests/*.test.mjs`: **136 passed, 0 failed, 0 skipped**, `reports/lobby-20261020/tests.log`.
- `npm run build`: **passed, 190 embedded assets**, `reports/lobby-20261020/build.log`.
- `git diff --check`: passed; Git reported line-ending notices only. Source and screenshot hashes are in `reports/lobby-20261020/verification.json`.
- Local screenshots and iframe interactions establish local layout/navigation behavior. They do not certify physical mobile input, new domain executor bindings, live T3 execution or a hosted deployment.

## Historical review: campus and domain floors

Reviewed on 2026-10-20 against the user's attached idle simulation screenshot. This is a business adaptation of its visual language, not a replica of the football game.

## Artifacts and environment

- Reference: `C:/Users/suanr/AppData/Local/Temp/codex-clipboard-572e982c-f2b7-4edc-82ad-91bd5e3800cb.png` (864 × 1920).
- Implementation: `http://127.0.0.1:4181/#office`, local static preview without API forwarding.
- Desktop browser capture: `reports/idle-office-20261020/desktop-overview.png`, 1006 × 884 CSS pixels at capture density 1.
- Mobile layout: an actual browser iframe at 390 × 844 CSS pixels, density 1. `mobile-full.png` retains the containing browser screenshot; `mobile.png` crops only the centered iframe. A separate 320 × 640 check is retained in `mobile-320-full.png`.
- Main combined comparison: `reports/idle-office-20261020/reference-comparison-v2.png`. Both images use a 390 × 844 comparison canvas. The reference is contained with aspect ratio preserved, including its original black margin. The implementation is the actual 390 × 844 browser region.
- Additional states: `desktop-elevator.png`, `mobile-elevator.png`, `projects-floor.png` in the same report directory.
- State: offline/unknown business data, overview; elevator open; Projects/Procurement interiors. The offline HUD intentionally displays dashes.

## Comparison and iteration

1. `reference-comparison-v1.png`: the world occupies the screen, the office building dominates the center, and blue raised navigation / amber entry action reproduce the reference's hierarchy. P2: small mobile status and contextual-card copy needed more size. The first desktop interior also let the fixed dock overlap camera controls.
2. Increased mobile HUD labels and mission-card typography, enlarged the mission card, and constrained desktop interior height to leave camera controls above the dock. The team panel scrolls independently when necessary.
3. `reference-comparison-v2.png` and `projects-floor.png`: checked together with the reference. No remaining actionable P0/P1/P2 differences. The first v2 export used an outdated outer-viewport crop after the app panel resized; it was replaced using the measured screenshot width and centered 390px iframe. This was an evidence-cropping correction, not a product-layout change.

## Visual review

| Area | Result |
| --- | --- |
| World and composition | Full-screen isometric office campus, roads, trees, miniature people and prominent tower; no desktop sidebar on the overview. |
| Controls and hierarchy | Floating dark HUD, compact side actions, amber entry button and five large blue dock buttons. Primary controls remain visible at both mobile sizes. |
| Typography | Existing Manrope and IBM Plex Sans Thai. Thai action copy remains readable; secondary labels are compact. |
| Color and depth | Green city, blue glass/navigation, cream and amber Zuri accents, visible raised button edges. |
| Imagery | Responsive generated desktop and portrait backgrounds. Interior retains actual Three.js geometry and avatars. |
| Copy and semantics | Work, connected sessions and actionable items replace game currencies. No invented money, income or XP. |
| Responsive layout | 390 × 844 and 320 × 640 overview checked; desktop 1006 × 884 checked. Native elevator scrolls on mobile. |

Intentional differences: office business content replaces stadium/sports content; the tower is taller than the reference stadium; the primary action enters a domain floor; no screenshot OS/game overlay is copied. Painted window bands are illustrative. The elevator directory is the authoritative 14-floor selection, and each floor exposes four role designs. Fifty new roles remain visibly unbound, with no dispatch button. Warehouse and Operations remain reserved.

## Functional checks

- Tap building / entry / team dock → native elevator; all 14 domain buttons are present.
- Elevator → Procurement 3D floor; role selection, responsibilities and handoff output remain available.
- Direct route / history / floor selector / Escape return preserve exact domain identity (automated regression and browser navigation).
- Escape dismisses the elevator and visibly returns focus to its opening button on mobile.
- Game Work button opens the existing Work page and restores normal mobile navigation. Game Chat button opens the existing composer/role directory; returning restores the world.
- Automated coverage verifies Work/Chat/Results routing, exact contextual job ID, review vs provider completion, stale/demo/unknown HUD values, focus preservation during polling, original six profile identities, failed-WebGL fallback and renderer suspension outside interiors.
- No task, chat message or approval was submitted during visual QA.

Console review: the desktop tab returned zero errors. Two mobile iframe load captures reported an unlocated `MutationObserver.observe` Node-type diagnostic; the subsequent instrumented reload produced no new diagnostic and no application error event. Its exact source was not established, and it is retained as a P3 test-harness diagnostic rather than described as fixed. Rendered UI and tested controls remained functional. Temporary diagnostic code and the iframe fixture were removed before the production build.

## Verification and limits

- `node --test tests/*.test.mjs`: 134 passed, 0 failed, 0 skipped (`reports/idle-office-20261020/tests.log`).
- `npm run build`: passed, 184 embedded assets (`reports/idle-office-20261020/build.log`).
- `git diff --check`: passed (line-ending notices only; no whitespace errors).
- Local browser/iframe evidence does not certify physical mobile input, live T3 provider execution, new domain runtime bindings or a hosted deployment. No hosted deployment was performed.

final result: passed
