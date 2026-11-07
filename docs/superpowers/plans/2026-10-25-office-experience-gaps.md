# Office Experience Gaps Implementation Plan

> Use inline executing-plans for workspace work; owner explicitly assigns Astra
to people/layout. Independent review applies to the composed patch.

**Goal:** truthful, usable workspace flows plus natural, grounded office actors.
**Spec:** ../specs/2026-10-25-office-experience-gaps-design.md
**Stack:** existing ES modules, CSS tokens, Three.js and Worker/R2 interfaces.

## Ownership and constraints

Parent: workspace pages/app, routing/readiness, synthetic harness, HybridScene
state forwarding, BuildingView binding. Astra: actor rig/motion/routines/sofa/nav,
measured layout/defaults and focused tests. Coordinate shared files; preserve
unrelated changes, original art, saved floors and Agent IDs/roles. No live APIs.

- [x] Pin readiness, safe return route, dirty editor and polling gaps with tests.
- [x] Implement source-aware workspace notice/actions and route/draft protection.
- [x] Add opt-in harness memory storage/fixtures using actual Worker API handlers.
- [x] Wire transient verified Agent states into HybridScene; keep local motion separate.
- [x] Integrate Astra's actor/layout work and explicit recommended-template access.
- [x] Run focused/full tests, build and independent review; resolve findings.
- [x] Playtest populated Chat/Work/menu flows through source app and built Worker,
  inspect idle/routine/sofa behavior, and record remaining owner-contract limits.

## Verification and actual acceptance

Final composed local `npm test`: **719 passed, 0 failed, 0 skipped**;
`npm run build`: **411 embedded Worker assets**; pinned Marketing producer
compatibility passed. Logs are local under `reports/dynamic-context/gap-final-*`
and `gap-compatibility.json`. Generated Tycoon `actor.glb` and manifest changed
with the shared rig; admitted furniture skin geometry and all artwork stayed fixed.

Source app :4184 and actual built Worker :4185 used `--legacy-art --workspace`:

- Browser loaded history and sent messages into the actual local queue; captions
  identify the fixture model and pending queue, never claim real Agent execution.
- HTTP uploaded >16 KiB files (42,000 bytes source / 40,800 bytes Worker) through
  actual chat/Knowledge handlers; browser verified the queued attachment, approved
  the Knowledge file, then created a queued task with one approved-file snapshot.
  Native file-picker interaction itself was not part of this browser run.
- Browser accepted a completed fixture task, refreshed its persisted review, and
  followed its result link. Team/Inbox/Knowledge menus and Chat draft preservation
  across menu navigation passed.
- Ordinary source preview without the workspace fixture correctly blocked those
  legacy pages with an unavailable-Zuri-API explanation; it offered no legacy task.
- Recommended source floor showed four sourced synthetic idle captions and two
  actors walked to separate sofa cushions. Doorway occlusion was corrected in the
  recommended layout; board writing face remains visible. Geometry tests cover
  grounded feet, cushion contact, collisions and state interruption at every seat.
- Worker Studio Apply changed the recommended draft while preserving all 16 item
  IDs/counts; Undo restored the original positions. No floor Save was clicked;
  the owner's saved Projects scene was preserved.

Independent Luna review findings were resolved: fallback walking without nav,
status changes during breaks, interrupted sofa/chair entry, demo switching during
Knowledge mutations, safe return-floor restoration, and Chat polling behind a
closed readiness gate. Additional browser finding fixed Knowledge approval-row
focus across unchanged polls. Final bounded re-review found no actionable blocker.

The harness restarts reset its memory workspace; that is deliberate test storage,
not shared persistence or a Zuri scene/data service. Latest source/Worker audits
report zero real upstream calls and zero fixture violations. Live Zuri Chat/Work/
roster/dispatch contracts remain unavailable and are not invented by this change.
