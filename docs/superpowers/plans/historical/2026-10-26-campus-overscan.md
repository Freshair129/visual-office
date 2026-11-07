# Campus background overscan

Scope: fix the white gutters around the building overview without replacing art,
branding, floor scenes, authority, or Agent records. The current overview reuses
the floor viewport's contain-style Fit, which leaves gutters on wide screens.

1. Reproduce Fit in Codex IAB and record the image/viewport bounds.
2. Add a campus-only cover framing mode with 25% extra image area in each
   dimension. Clamp zoom-out and Fit to that minimum, keeping pan/zoom and HUD.
3. Hide campus scrollbars while retaining scrolling. Give the static building
   artwork the same overscan; preserve Lobby and floor contain-style Fit.
4. Test Full HD, portrait, resize, zoom-out, and unchanged floor behavior. Inspect
   source and built Worker in Codex IAB. Record actual checks below.

Before: at 1280×720, Fit produces a 1080×720 map at x=100, leaving 100 px gutters.

Verification:

- Regression reproduced RED before implementation; focused 10 tests PASS after.
- Full `npm test`: 747 PASS, zero failures/skips. Log:
  `reports/campus-overscan/tests.log` (local evidence).
- `node scripts/build-worker.mjs`: PASS, 412 embedded assets. Asset generators
  were not needed; no art/model bytes changed.
- Codex IAB source and built Worker: Full HD 1920×1080 produces a 2400×1600
  canvas at x=-240/y=-260 after Fit. Portrait 390×844 produces 1582.5×1055
  at x=-597/y=-106. Both cover all four screen edges after zoom-out/Fit.
- Browser viewport overrides reset; source :4200 retained. Worker :4201 stopped
  after testing. Worker browser console: zero errors/warnings in the tested tab.
- Static BuildingView uses matching CSS overscan; its standalone runtime was
  not separately exercised. Lobby/floor Fit behavior retains its regression.
- Synthetic only. No commit, push, merge, new live API calls or Agent changes.
