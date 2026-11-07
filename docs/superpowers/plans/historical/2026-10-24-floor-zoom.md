# Floor zoom implementation plan

Goal: add anchored zoom and transient structure inspection to the existing fullscreen floor.
Spec: ../specs/2026-10-24-floor-zoom-design.md

- [x] Extend office-floor-viewport.js with bounded zoom, fit/reset, wheel and pinch lifecycle; test anchors, limits, cleanup and reset.
- [x] Add floor tools and HybridScene structure toggle; preserve room state and existing scene interaction.
- [x] Run focused/full tests and build, then check built Worker UI and capture art/structure views. Record actual limitations.

## Verification

Final synthetic-only checks: npm test 596 passed, zero failures/skips; npm run build passed. Focused zoom/skeleton checks cover pinch, capture before native wheel controls, native touch control restoration, immediate frozen actor/hitbox repaint, fit/reset, bounds and disposal. Independent reviewer findings resolved; no live connection or production acceptance.

Built Worker at :4185: wheel changed map from 100% to 182% while HUD bounds stayed fixed; Fit centered all art, Reset returned 100%. Dev hid background and showed procedural meshes; toggling back restored painted art with the same 16 object IDs. Paused actor state remained intact. Evidence: reports/dynamic-context/floor-zoom-{fit,structure}.png and floor-zoom-{tests,focused,build}.log.

Physical mobile pinch has not been tested on a device; touch-event simulation passes. Zoom/Dev view state is transient. Dev toggle is scoped to eligible Projects painted baseline; native snapshots retain their renderer, with map-owned wheel/touch zoom and restored touch controls when leaving the floor.
