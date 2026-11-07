# Skeleton alignment implementation plan

Goal: calibrate the physical skeleton against untouched original images in Studio and persist separately per floor.
Spec: ../specs/2026-10-24-skeleton-alignment-design.md

- [x] Add strict optional alignment state codec, local coordinate helpers and tests for legacy/file/floor isolation.
- [x] Add physical transform group and calibrated nav display without moving the art layer; verify projection and depth-mask transforms.
- [x] Add Studio Dev panel/reference/drag lifecycle, one gesture Undo and explicit existing floor Save.
- [x] Run tests/build, independent review and built Worker Studio Save/reload acceptance; record actual evidence and limitations.

## Verification evidence

- npm test: 605 passed, zero failed/skipped. npm run build: passed, Worker embeds 382 assets. git diff --check: passed. No source image/model/brand asset changes.
- Focused tests exercise strict optional-field validation, legacy/floor-file roundtrips, per-floor isolation, Undo/Redo, revision-checked stale save, transient drag preview/cancel, physical renderer parenting/projected transforms, wall masks inheriting calibration exactly once, mode/play lifecycle, and inverse coordinates in navigation authoring.
- Built synthetic Worker Studio at :4185: Projects numeric editing committed x=13, y=-8, scale=102%; drag preview moved to x=74.44/y=22.72, one Undo restored prior values; explicit floor Save succeeded. Browser reload then loading Projects restored 13/-8/102 and 16 objects. Test offsets were reset to 0/0/100 and explicitly saved afterwards. Other floors were not written by browser testing; floor-isolation tests cover separate saved data.
- Independent review found legacy DOM art showing in structure-only; corrected to hide non-model DOM artwork there and avoid duplicate artwork in overlay. No live Zuri calls or production acceptance.
- Evidence: reports/dynamic-context/skeleton-alignment-{tests,focused,nav,build}.log and skeleton-alignment-studio.png. Device touch and exact per-wall artistic calibration are outside this global alignment feature.

Studio authoring is available to baseline Office rooms on each preview floor; runtime painted presentation remains scoped to Projects. Other floors retain their renderer/edition. Custom blueprints use their existing structural editor; dormant alignment data remains roundtrippable. Numeric X/Y are original-image px, not current viewport px. Reference images never receive calibration. Planner/editing coordinates remain physical-group local with inverse pointer conversion.
