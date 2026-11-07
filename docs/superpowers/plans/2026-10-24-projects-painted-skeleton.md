# Projects painted skeleton Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore original Projects art while sharing 3D depth and safe navigation.

**Architecture:** A presentation-only adapter creates alpha-tested furniture image
planes and depth-only wall masks in HybridOffice3D. Shared HybridScene selects it
for Projects Office rooms without authored blueprints; room storage is unchanged.

**Tech Stack:** Existing Three.js, JavaScript, node:test and browser preview.

**Spec:** ../specs/2026-10-24-projects-painted-skeleton-design.md

## Global constraints

No logo, palette or original image edits. Projects first. Synthetic only. No room
migrations, role/count changes or Zuri API changes. Respect explicit custom plans.

## Review focus

Texture completion after disposal must not revive resources. Alpha holes must not
hide actors. Walls must not write colour. Context-loss fallback must not free-walk
through walls. Studio and applied floor must select the same presentation.

### Task 1: Art/depth adapter and shared renderer

- [x] Add failing tests in tests/painted-office-skeleton.test.mjs for Projects
  selection, plane anchors/alpha/depth, wall mask policy and late texture disposal.
- [x] Implement web/painted-office-skeleton.js; integrate HybridOffice3D and
  HybridScene, keeping other room modes and custom plans unchanged.
- [x] Run focused tests and inspect Projects in the browser; preserve the PNG.

### Task 2: Route and lifecycle acceptance

- [x] Exercise desk/water/sofa movement and every segment against collision;
  test no wall/desk ignore and stationary WebGL fallback.
- [x] Run full tests/build; restart the local synthetic Worker preview.
- [x] Verify Projects art, actions, route overlay, pause and Lobby/campus retention.
- [x] Record actual evidence and limits; review the patch before committing.

### Task 3: Owner-requested immersive floor shell

- [x] Add DOM tests for contextual Team details, close-on-navigation and retained
  elevator/edit controls; test bounded pan gestures and non-interference with objects.
- [x] Add office-floor-viewport.js and stylesheet; integrate into BuildingView with
  disposal, fullscreen room, fixed HUD/dock and large mobile scrollable canvas.
- [x] Verify Full HD and portrait layouts in browser, then rerun affected/full checks.

## Verification — 24 October 2026

- `npm test`: 588 passed, zero failed/skipped on the final runtime tree.
- `npm run build`: passed; 24 existing Tycoon GLBs and 380 embedded Worker assets.
- Worker preview :4185 uses `--worker --legacy-art`, synthetic only. All eight
  changed runtime source files served by the running Worker match disk byte-for-byte.
- Browser: 1920×1080 viewport with a 1920×1280 proportional floor, no frame/sidebar
  or document overflow; portrait 390×844 retains a 1440×960 floor. The room overflows
  inside its own viewport rather than stretching the 3:2 artwork.
- Portrait drag over transparent board padding changed scroll from (525,58) to
  (425,108); arrow-key pan also moved 80 px. Object touch-action allows native pan.
  Team modal measured 366×675 inside the 390×844 viewport; board opens scoped
  unavailable-data message rather than inventing Projects tasks.
- Character work/water/sofa simulation regression checks every travelled ground
  segment against the same wall/furniture navigation model. Without WebGL the
  Projects presentation stays static. Source artwork and brand files have no diff.
- Independent Luna Max review identified and closed Studio-preview context,
  native map sizing, alpha picking and native canvas pointer-ownership findings.
  Follow-up review of measured depth compositing and transparent-ground pan found
  no remaining material issue. Review and parent checks are separate evidence.
- Audit: zero fixture violations and zero real upstream calls. Dynamic context
  qualification remains a separate profile; no live acceptance or merge is claimed.

Local evidence (ignored): `reports/dynamic-context/projects-final-{tests,build}.log`,
`projects-fullhd-painted-skeleton.png`, `projects-mobile-panning.png`.
The native3d mouse-drag/fixed-camera limitation in the spec remains explicit;
this slice does not claim renderer parity for retained native snapshots.
