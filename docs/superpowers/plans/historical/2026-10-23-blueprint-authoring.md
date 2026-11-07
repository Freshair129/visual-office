# Blueprint authoring implementation plan

Owner asks to edit measured blueprints directly: drag walls, resize rooms, move doors/windows, see real Three.js changes, save named templates and persist independently by floor. This continues the authorized S/M/L Studio work. Preserve the dirty tree, Agent/role authority and Lobby boundary.

Design: keep orthogonal rectangular shells. Optional validated `room.blueprintPlan` stores version, base preset, clear width/depth, world origin, one doorway and up to eight wall-bound windows. Metres drive plan, mesh, navigation and exports. Initial authoring bounds 8–16 m wide and 6–10 m deep match the supported fixed camera; frame-bound checks reject moving the shell outside its design area. Walls move independently with the opposite edge anchored. Door/window openings remain on a selected wall and cannot overlap. Foreground window-bearing walls become tall enough for their real openings.

Geometry edits preserve all scene objects, IDs, transforms, interactions and navigation data; surface a warning for contents outside a resized room. No auto-reflow, identity changes or unannounced furniture reset. Drag previews are transient; pointer-up creates one history entry, cancellation restores the draft. Numeric controls/keyboard work without dragging. Save floor uses existing RoomStore and optimistic revision check. Named structural templates use a separate bounded local browser library; loading one changes only geometry in the selected draft, never autosaves a floor. Existing JSONs/presets remain compatible.

- [x] Write failing metric-plan/schema tests; implement validation/default plans and reusable local template storage.
- [x] Generate editable openings and mesh/nav geometry from the same plan; rebuild/dispose architecture on plan changes.
- [x] Implement drag/keyboard/numeric authoring, live Three.js preview, template save/load and floor-history integration.
- [x] Verify persistence, isolation, malformed JSON, drag cancel/Undo and actual geometry parity.
- [x] Independent bounded review, full tests/build, real browser checks, screenshots and handoff documentation.

Delivery: `reports/office-blueprint-authoring-20261023/ACCEPTANCE.md`. Full local suite317/317, final build326embedded assets. Review fixes cover scaled/oriented boundary warnings and legacy inventory preservation during geometry-only template load. Real pointer drags, named save, cross-floor draft reuse, fresh-page reload and JSON download verified. No shared platform acceptance or Git delivery claimed.
