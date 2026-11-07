# Projects object skins implementation plan

> Execute inline using superpowers:executing-plans; independent review at closure.

**Goal:** illustrated per-object skins over the same Projects physical sheet.
**Architecture:** object-local camera projection onto existing depth geometry;
three transient visibility controls; existing floor store and navigation retained.
**Tech stack:** Three.js, ES modules, node:test, synthetic Worker browser preview.
**Spec:** ../specs/2026-10-25-projects-object-skins-design.md

## Constraints

Keep logo, warm palette, camera, IDs, Agent count/roles and other floors unchanged.
No live connection, silent migration, external persistence or destructive cleanup.

## Tasks

- [x] Generate tight geometry references and illustrated skins; save assets and
  exact prompts/projection metadata in the repository.
- [x] Add failing tests for object-local projection, toggle identity, cleanup,
  texture failure and stale callbacks; implement the skin owner module.
- [x] Integrate skin/model/wireframe controls in Projects and Studio, keeping
  old compatibility modes and explicit floor Save.
- [x] Verify moved/scaled objects, per-floor Save, collision and closed-door
  routing, then run tests/build, browser checks and independent review.

## Review focus

Transparent artwork must not create physical holes; imported/saved transforms
must not drift; asynchronous loads must not affect a departed floor; diagnostic
overlays must not alter picking/nav; image failures must remain visible to users.

## Delivery evidence — 25 October 2026

- `npm test`: **641 passed / 0 failed / 0 skipped**. Log:
  `reports/dynamic-context/object-skins-tests.log`.
- `npm run build`: passed, **397 embedded Worker assets**. Log:
  `reports/dynamic-context/object-skins-build.log`.
- `git diff --check`: passed. Existing line-ending normalization notices are
  not runtime failures; unrelated dirty work remains preserved.
- Read-only independent review `/root/projects_skin_review` (GPT-6 Luna Max)
  closed with no remaining actionable findings. Fixed paused surface-load error
  redraw and preservation of the Studio emissive effect; added regression tests.
- Built Worker at `http://127.0.0.1:4185/#office/projects`: skin/model/wireframe
  buttons exercised in the same page/canvas; all 16 projected object bounds stayed
  identical while toggling. Four original actor IDs retained.
- Studio: moved role-1 desk, resized 62%→65%, explicitly saved Projects,
  refreshed, selected Projects again and verified identical saved object bounds
  and 65% inspector value. Actual floor loaded that saved snapshot with skins
  ready. Other floors remain protected by existing per-floor regression tests.
- Runtime character walking action accepted; activity/wayfinding overlay shown.
  A water request while another actor occupied that station correctly stayed
  unavailable. Deterministic tests complete desk→water→sofa→desk tours and check
  every motion segment against actual blockers, plus wall/desk/closed-door
  rejection across skin/model/wire/all-off views.
- Fixture audit: **0 real upstream calls**, no fixture violations. No live Zuri,
  hosted CI, physical mobile or production acceptance claim.
- Screenshots: `projects-object-skins.png`, `projects-object-wireframe.png`,
  `projects-object-skins-paths.png` under `reports/dynamic-context/`.

Ruling: use original geometry as the image mask, including where generated
artwork slightly differs at its outline. Never use image alpha as collision or
depth. The atlas is illustrated raster art, not a second model beauty bake.
Architecture images are split into independent texture tiles before wrapping,
so no plaster/oak atlas bleed reaches room surfaces.
