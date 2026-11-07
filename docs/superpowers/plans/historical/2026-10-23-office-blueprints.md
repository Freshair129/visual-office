# Measured Office blueprints

Owner request: correct the skewed room/plan and deliver reusable small, medium and large blueprints. This is an extension of the authorized Three.js Studio work; use the existing editor and local floor saves.

Design decision: model in orthogonal metre coordinates, then project into the existing ground-coordinate editor. Do not measure dimensions from the painted fallback. Small 8×6 m, medium 12×8 m, large 16×10 m; 0.2 m walls, 2.8 m full height, 1.2 m entry and 2 m circulation strip. Dimensions describe clear interior space; display outer wall extent separately. 100 design px/m is fixed, distinct from screen pixels. Cutaway foreground walls are 0.65 m for visibility. These are simulation templates, not construction/code compliance drawings.

Keep legacy rooms readable. Applying a template explicitly replaces furnishings/navigation in the current draft, preserves decorative avatar identities/count, supports Undo and only persists through existing floor Save. Never create Agent/role/business records. Do not silently replace an already-saved floor.

Alternatives considered: re-trace the painted room (retains distortion); unrelated SVG plans (cannot guarantee parity); one metric source generating geometry, navigation and SVG (selected because it enforces parity).

- [x] Add three data templates and tests for metric dimensions, right angles, scale and layout bounds.
- [x] Generate real Three.js shell and navigation from the same template.
- [x] Add measured plan selector, live top view, SVG/JSON downloads and draft application.
- [x] Extend room schema/save/history without changing old files; verify floor isolation and identity preservation.
- [x] Run targeted tests, full tests/build, browser checks and document actual evidence.

Delivery: `reports/office-blueprints-20261023/ACCEPTANCE.md`. Full suite 308/308; build rerun passed after a transient Windows mapped-file lock. Initial actor envelopes reject dense/oversized inventories without altering them. Runtime crowd avoidance is outside this slice; actors may occupy the circulation area. No hosted CI or live Zuri acceptance claimed.
