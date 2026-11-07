# Grid placement implementation plan

Execute inline with superpowers:executing-plans, followed by independent review.

**Goal:** click/drag grid placement in Projects and Studio using real occupancy.
**Architecture:** shared metric grid/candidate validator; optional room setting;
navigation consults same occupied cells; HybridScene owns transient preview;
floor build controller owns revision-checked local Save/Cancel/Undo.
**Spec:** ../specs/2026-10-25-grid-placement-design.md

- [x] Test and implement metric snap, raster occupancy, whole-footprint placement
  checks, anchor translation and strict file roundtrip.
- [x] Apply occupied cells to navigation while retaining walls and seat exceptions.
- [x] Add shared scene grid overlay, click-cell/drag/key movement and cancellation.
- [x] Expose Projects build mode and Studio toggle; test floor revision/isolation.
- [x] Full tests/build, independent review and built Worker UI verification.

Review: doorway obstruction, off-grid imported furniture, stale saves, pointer
capture/selection changes, actor/seat handling and live-authority storage isolation.

## Verification — 25 October 2026

- Full `npm test`: **654 passed, 0 failed, 0 skipped**. Log:
  `reports/dynamic-context/grid-tests.log`.
- `npm run build`: passed, **401 embedded Worker assets**. Log:
  `reports/dynamic-context/grid-build.log`.
- Independent read-only GPT-6 Luna Max review `/root/projects_grid_review` closed
  its remaining findings after re-reading fixed half-metre validation and new
  seat/door coverage. The reviewer did not run the suite or browser.
- Built Worker browser, Projects: entered **จัดห้อง**, dragged the water cooler
  onto a valid cell, then dropped it onto a desk. The latter was rejected,
  preserved selection, showed the invalid-placement message and restored exactly
  the prior inline object bounds. No drag-generated second commit occurred.
- Selected cooler then clicked a free floor cell: moved successfully. Saved,
  refreshed and verified identical saved bounds, 16 objects and ready skin art.
  Save exited build mode and actually hid the SVG grid.
- Studio loaded the same saved floor, enabled grid, moved a desk one metric step
  with ArrowRight, then Undo restored a clean saved state and disabled grid.
- Returned to actual Projects and triggered **เดินในสำนักงาน**; four actors
  walked on the saved grid-enabled layout. Deterministic tour tests additionally
  inspect every segment during desk/water/sofa travel and reject corner cutting,
  occupied desk/wall cells and doorway obstruction.
- Explicit tests cover captured-drag cancellation, stale Save retaining draft,
  per-floor isolation, fixed signage, other actors, seat-owner exception and
  rejecting translated anchors before normalization can erase navigation.
- Still synthetic/local presentation only; no hosted CI, physical mobile or
  live Zuri acceptance claimed. No commit, push or merge performed.
- Browser screenshot: `reports/dynamic-context/projects-grid-placement.png`.

Rulings: fixed wayfinding floor signage stays walkable and is not draggable in
this furniture mode. Doors cannot be toggled during floor build; structural
editing remains in Studio. Authored irregular forbidden areas use conservative
bounding rectangles for grid occupancy; exact existing forbidden polygons also
remain in the navigation checks. No paths or Agent roles are invented.
