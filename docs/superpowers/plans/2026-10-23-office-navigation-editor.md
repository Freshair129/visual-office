# Office navigation editor implementation plan

> Agentic workers: execute scoped tasks through the existing subagent-driven or executing-plans workflow; preserve the assigned file ownership and unrelated working changes.

**Goal:** Edit and save per-floor walking routes, forbidden polygons and interaction/seat anchors directly over the real Office scene, with an actual test walk.

**Architecture:** Add an optional validated `room.navigation` presentation record to the existing local room/floor exchange contract. A dedicated SVG editor overlays the same normalized ground coordinates used by the real 3D renderer. Runtime uses the authored graph and blockers; no Business or Agent records change.

**Tech stack:** Existing vanilla JavaScript, SVG, Three.js, Node test runner and jsdom.

**Spec:** User request of 23 October 2026: drag route points, define forbidden areas and desk/sofa seats, save per floor, test walking; remove floating printer/elevator, replace with a floor-directory arrow.

## Constraints

- Preserve unrelated dirty work, existing room JSON and role/count identity.
- Bound imported geometry; reject unsafe or malformed data. No executable actions.
- Forbidden regions and walls remain blocking during interaction transitions.
- Test walks are transient and do not write authored room state.
- Fixed Office backdrop only; honest unavailable states for blocked routes.

## Tasks

- [x] Add strict navigation schema, backward-compatible storage/export/history, forbidden blockers, station overrides and authored route graph. Prove malformed imports, isolation and obstruction failures.
- [x] Add Studio navigation editor: route/area selection, add/remove points, dragging and keyboard nudge, station approach/seat handles, undo/redo, explicit errors and walk-test status. Test real DOM controls and coordinates.
- [x] Integrate actual route test into 3D character controller, preserving reduced motion and normal play/edit lifecycle.
- [x] Remove unwanted rendered fixtures, update backdrop and use an accessible ground-plane arrow opening the existing floor directory; keep old saved elevator kinds compatible.
- [x] Run focused/full tests and build serially, independently review the same patch, verify browser editing/test-walk/persistence, capture evidence, update source routing and limitations.

## Review focus

Dragging under zoom must use scene bounds; invalid polygons must not silently save; routes blocked after moving furniture must fail; seats must not cross walls/forbidden zones; floor switches/import/undo must refresh editor and transient test state.


## Subsequent owner steering

The owner requested the room structure itself as a Three.js model. Add `web/office-architecture.js` with real floor/wall/window meshes, natural depth occlusion and owned resources; integrate in the same scene/camera. Keep fallback artwork and legacy room compatibility. Architecture tests must pin exact frontage segments/doorway and disposal, and browser evidence must show the actual geometry revision.

## Final local verification

Full `npm test`: 298 passed, zero failed/skipped. `npm run build`: passed, 316 embedded assets. Focused independent architecture/navigation review found no actionable blockers. Browser verified real Three.js shell, exact test-walk completion, ground arrow directory, draggable point commits, saved route/forbidden/seat reload and floor isolation. See `reports/office-navigation-threejs-20261023/ACCEPTANCE.md` for scope and evidence.
