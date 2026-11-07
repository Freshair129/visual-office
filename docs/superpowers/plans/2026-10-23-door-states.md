# Interactive door states implementation plan

> Execute inline using superpowers:executing-plans; independent review at completion.

**Goal:** Click real Office doors to open/close them, constrain movement by their current state, and persist each floor independently.

**Architecture:** Optional boolean `door.open` on exterior/interior doorway definitions, omitted means open for legacy compatibility. Shared layout emits door geometry and closed-door collision segments. Scene buttons call the owning Studio draft/history or floor save callback; read-only previews never save. Actors recheck every next movement segment, and closing an occupied threshold is rejected.

**Tech stack:** Existing JS, Three.js, SVG, Node/JSDOM. Refines OFFICE-BLUEPRINTS.md/VO-FR-022.

## Constraints / decisions
- Preserve all props, agent IDs/count/roles, local-only data and Lobby. No Zuri API changes.
- Studio changes are undoable drafts, explicit Save floor; Visual Office clicks save the selected local floor with revision conflict/storage-failure handling.
- Door mesh panels retract when open; opening/closing is an immediate state change, not an authority/permission mechanism.
- Never resume a stale path through a newly closed door or teleport an actor out of a closing threshold.
- Keep the existing dirty working tree. No commit/push/deploy.

## Review focus
Legacy omitted state; invalid boolean imports; closing while actor crosses; stale floor tabs/failed storage; read-only file previews.

## Tasks
1. [x] Red tests for schema, shared mesh/collision state, persistence and runtime movement. Implement shared door model and safety.
2. [x] Red tests for click interactions and scoped save. Add accessible door controls to shared scenes and blueprint editor, wire draft/floor owners.
3. [x] Full tests/build, browser open/close/blocked walk/save/reload checks, independent review, docs and evidence.

## Execution evidence

- Final341/341 full tests and build328 embedded assets. Logs: reports/office-doors-full-tests-final.log and office-doors-build-final.log.
- Independent Luna Max bounded final review41/41; no findings after fixing fallback occupied-threshold closure. Earlier ray-capture integration gap covered with real ray, HUD input and scene callback test.
- Browser: Studio button and direct mesh click toggles; closed connection rejected, opened probe completed; Undo, Save and reload verified. Actual-floor toggle saved across refresh. Saved export strictly parsed; closed path0 versus opened path6,20objects/four avatar IDs retained.
- Refined normal adult door-frame height to2.25m; static fallback uses the same occupancy geometry. Save rerender clears stale draft notices.
- No commit/push/deploy; local presentation only. Details: reports/office-doors-20261023/ACCEPTANCE.md.
