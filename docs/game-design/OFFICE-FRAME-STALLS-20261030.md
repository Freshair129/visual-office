# Desk start and scale1.25 departure — 30 October 2026

**Historical frozen-source result.** See the [latest deadline/Studio report](OFFICE-FRAME-DEADLINES-20261030.md) for changed-source tests, later failed timing cases and remaining limits. The measurements below and the sealed earlier archive remain unchanged.

This is local implementation and measurement evidence, not owner acceptance,
asset admission, Agent activation, registration or deployment authority. Work
remains in the existing dirty tree based on
`a6fdc7e7edbf902e3f56a5b55dcb8e38cabe21c4`; unrelated changes are preserved.

**Final bounded result:** the frozen source passes672/672 Node tests, the
isolated build,96/96 GPU lifecycles, GPU Stop/restart and all seven unchanged
120s timing targets. Those profiles complete35 desk lifecycles with no page/
motion errors or intervals>100ms. Every p99 is33.5ms. Maximum intervals still
reach66.8ms; this is not a guarantee of33.3ms on every frame. Earlier failed
profiles remain separate evidence and have not been replaced or relabeled.

## What changed

Arm capsule extraction now transforms each deformed vertex with one current
mesh matrix per extraction and computes shaft distance once per unique vertex.
The real-GLB regression retains exact ordered capsules/radii against the old
helper under changed parent, bone and mesh transforms, including vertex coverage.
Bind-pose distance calls fall3302→1416; each measured mesh now has one world
matrix update and no per-vertex `localToWorld` calls. These are work counts.

Foot fitting scopes the long rig/anchor key once per root search and uses
compact numeric shape/distance keys inside the ordered search. The baseline
key test records2800 long-string lookups versus one. Existing1301 ordered
collision diagnostics and six real-GLB fit/root-trial references remain equal.

The remaining first-use fit is consumed in cooperative initialization slices.
Synchronous callers drain the same generator and retain the same results and
counters. The actual1.25 fixture still selects an80mm root advance after the
same four root trials, with1647 exact geometry queries and5971 certified
prunes. The scheduler targets2ms slices and checks time after groups of eight
iterator advances; this is a scheduling budget, not a hard worst-case deadline.

The ordinary scene keeps `ready=false` until current-generation preparation
finishes. Load time includes this work. Disposal, a different world/activity or
a replacement generation cancel stale work before publication. Initialization
does not start a lifecycle or change saved room inventory. The first interactive
station action then reads its checked fit cache. Studio selection/move scenes
skip this eager preparation, so edit/undo/redo refreshes remain responsive;
three repeated Studio refreshes are covered by regression.

Within one failed-pose repair, exact capsule query results can be reused for
identical geometry and support options. The opaque batch belongs to one world
and one update, uses bounded storage and returns detached hit diagnostics.
Every requested sweep sample and candidate still receives a current geometric
result; an accepted previous pose is never a collision permission. Mesh and
bounds counts report executed checks; `cacheHits` reports exact-query reuse.
The inherited full-query `testedTriangles` counter excludes allowed seat-support
contacts after their closest-point calculation. New witness checks are counted
including allowed contacts; work counts are diagnostic, not GPU timing.
The full-scene cache regression matches every accepted-frame pose, feet and
clearance against the uncached reference.

Leg-only candidates refresh their changed bone branches instead of the whole
actor subtree. A full-scene comparison retains exactly equal frame hashes;
the first scoped candidate reduced peak full-actor updates2084→178. The final
solver also reads already-current matrices directly inside controlled solve/
collection calls instead of recursively updating ancestors for each getter.
On the actual1.25 route→desk lifecycle, the frozen-source regression verifies
more than25% fewer world-matrix requests, more than30% fewer total ancestor
refreshes and more than75% fewer worst-step ancestor refreshes against the
measured baseline. Its accepted root/feet/capsule/clearance hash remains exactly
`a106ee7051e2d510dc256d868a3c64769dc676db7eaafedd41d423ec726e67ae`.
The full-actor reference comparison is2084vs174 at the worst step.

An earlier instrumentation run measured37%/40% reductions and94,378→6,628
worst-step ancestor calls before the final public-default compatibility fix.
Exact counters were not re-emitted after that fix, so the frozen-source claim
uses the passing conservative bounds above rather than those earlier numbers.

Public matrix-helper defaults still refresh ancestors; only internal callers
opt into current matrices after actor/body and changed-leg refresh. A scaled
actor regression moves its parent before both capsule and hint calls.
Rejected-pose/error restoration still refreshes the actor. Bone lengths,
20.001mm absolute hip guard, foot/palm/seat tolerances, candidate order and
full sweeps remain unchanged. These reductions are work counts, not FPS.

Repair batches can use a privately sourced triangle witness only as a current
negative collision proof. Witness misses fall through to the full ordered
query. Full-query metadata and witness results remain separate; a witness
cannot certify acceptance. The shoe planner filters ordered meshes once within
a conservative trajectory envelope; every actual capsule AABB is guarded and
an escaped query uses the whole world. Every original sample/lift/route remains.

A uniform mesh-grid candidate was rejected. It reduced departure bounds work
by85.5%, but paired worst-step Node means were62.4ms indexed versus56.0ms flat.
Its source and test are retained as diagnostics; the grid is absent from the
production code. Work reduction alone did not qualify it.

## Verification and measurement boundary

- Final `node --test --test-reporter=tap --test-concurrency=4 tests/*.test.mjs`:
  672 passed, zero failed, skipped or cancelled;282754ms. Functional GPU work
  ran concurrently; this suite duration is not a performance benchmark.
- Isolated `npm run build`: passed;506 embedded assets. All95 authored browser
  modules match both current source and the isolated built copy. All163 test/
  support/fixture files match the suite snapshot;27 existing model/catalog/
  external-fixture files and the original1301-query numeric reference remain
  byte-identical. A companion file pins test input root order only; production
  asset completion order and numeric expectations were not changed.
- The211-file JavaScript input tree remains unchanged. Generated Mermaid chunk
  references differ after isolated dependency rebundling, so generated-vendor
  byte parity is explicitly false in the integrity report. The95-module parity
  claim applies to authored sources; no generated dependency parity is implied.
- Independent read-only review found no P1/P2 in the frozen five-module patch.
  Earlier concerns about public cache access, Studio prewarming and public
  changed-parent matrix freshness were corrected with regressions. The reviewer
  ran no tests/build/GPU checks and granted no approval.
- One pre-guard GPU matrix was interrupted to fix the Studio issue. Its partial
  log and interruption record are retained and are not a completed test.

The hardware harness uses Chrome156, WebGL on RTX3060 / ANGLE D3D11,
1280×800DPR1 for timings, one local probe and fixed60Hz physics. It follows an
initial real scene route with repeated complete desk lifecycles. Each timing
run uses a fresh browser process, the same one-second warmup and at least120s
of measurement. No other task-owned tests/builds run during timing profiles.

Intervals observe changes in `renderer.info.render.frame` from RAF callbacks.
They are observations of issued renders, not GPU-completion timestamps or
physical display presentation. All source hashes are checked before/after.
The unchanged target is >=29.5FPS, p95<=34.5ms, p99<=35ms, maximum<=66.8ms,
zero intervals>100ms, full lifecycle coverage and no page/motion errors.

## Retained timing results before final verification

| Run | Mean FPS | p95 ms | p99 ms | Maximum ms | >100ms | First desk call ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Diagnostic original source,1.25 |29.3977|33.4|34.7|416.7|15|417.1|
| First optimization candidate,1.25 |29.8394|33.5|33.8|250.1|4|247.0|
| Cooperative preparation + scoped matrices, before Studio guard |29.9978|33.4|33.5|66.7|0|49.3|

The diagnostic baseline overlapped read-only Node investigation work and is
not a clean causal comparison. The last row passes its timing target but has
the earlier source hash before the Studio-only guard. It completed five desks;
scene load was3221.6ms, including1353.2ms of wall time preparing four seats.
All three raw runs remain separate; no failure was replaced with a success.

## Frozen-source GPU lifecycle results

Chrome156.0.8078.48 reports RTX3060 / ANGLE D3D11. All96 cases complete:
every department desk at30Hz, the first desk per floor also at60Hz, three
routes and the scaled/custom chair matrix. All15 floor render/navigation
checks pass, with no page errors, no failed cases/floors and unchanged source.
This runs production `TycoonScene` methods and renders every simulated frame;
it is controlled-time automation, not a manual UI playtest or FPS result.

The measured maximum resting foot gap is0.000274mm and maximum planted-foot
shift0.000100mm in sampled mesh vertices. Palm gaps range approximately2.068–3.065mm;
maximum absolute pelvis/seat-support gap is2.070mm. All remain within the
unchanged report thresholds. No work clip is accepted without stable contact.
The raw report retains per-case values, tolerances and capsule clearances.

The separate1.25 route→station Stop/restart test also passes on the same GPU
and source. It stops during leaving with both departure targets and a hint
present, verifies they are cleared, then completes a new full lifecycle with
stable feet, palms and seat support. Its own script hash is included correctly.

## Final frozen-source timing results

Each row is a new browser process on the hardware/configuration above and at
least120s of measurement. All seven meet every original gate, retain complete
phase coverage and finish five desks. Source hashes remain equal before/after
and across the matrix, Stop/restart and timing runs for126 common files.

| Fixture | FPS | p95 ms | p99 ms | Maximum ms | >100ms | Desks | First desk call ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Bundled1.25 |29.998|33.4|33.5|66.7|0|5|24.3|
| Bundled1.0 |29.998|33.4|33.5|50.0|0|5|46.7|
| Bundled0.75 |29.998|33.4|33.5|34.5|0|5|23.2|
| Kenney four-leg1.1 |29.998|33.4|33.5|66.8|0|5|25.8|
| Kenney rounded-back1.1 |29.998|33.4|33.5|50.1|0|5|19.3|
| Kenney swivel1.1 |29.998|33.4|33.5|50.0|0|5|26.6|
| Bundled1.25 repeat |29.998|33.4|33.5|50.1|0|5|21.0|

The first1.25 run still has a66.7ms leaving interval at phase elapsed0.1667s;
the repeat has50.1ms at0.15s. Four-leg reaches66.8ms during approach at0.9333s,
very near the limit. These are retained slow frames, not a claim of perfect
cadence. Warm station calls peak at1.6ms. Scene loading, including cooperative
fitting, ranges2.13–4.14s and is reported outside the steady-state window.

The frozen contact SHA256 is
`b86c79a0bb11feac1f584646c3be5181267217f5898c057a6895d0a907cc503a`.
Full source/input/test hashes, actual command outcomes, raw timing reports,
threshold assessments, selected captures and the static review are supplied
in the evidence bundle. Its manifest and external archive record verify bytes;
they do not confer approval or registration authority.

## Retained stage2 and stage3 results

Stage2 matrix and Stop/restart passed with unchanged source. Seven120s profiles
completed35 desk lifecycles without page/motion errors. Four met all targets:
default,0.75, swivel and the first1.25 run. Four-leg reached83.3ms during
approach, rounded-back reached100ms during approach, and the1.25 repeat reached
100ms during leaving. All percentile gates passed, but the stage2 maximum-
interval gate remained open. All seven results are retained separately.

Instrumented Node diagnosis of the two custom chairs attributes72.5–114.4ms
worst-step work to shoe-swing planning, with only0.1–0.2ms in limb sweeps at
those steps. The third candidate filters meshes once within a conservative
shoe-trajectory envelope. Each actual query must fit the envelope; otherwise
it falls back to the complete world. Original sample, lift and route order are
retained. Exact point memo/witness and endpoint-first variants were measured
and rejected; neither remains in the production planner.

The third candidate completed all seven fresh120s timing runs: five met every
target, including four-leg at50.1ms maximum and the1.25 repeat at66.7ms. The
first1.25 run reached116.8ms with two intervals>100ms; rounded-back reached
83.4ms during approach. Its source was unchanged and all35 desk lifecycles
completed without page or motion errors. Every raw run remains separate.
These results are historical inputs to the final solver change, not its acceptance.

A further triangle-envelope worklist prototype retained exact full-trajectory
queries/plans/poses but saved only6% of AABB checks with mixed Node timing.
It was rejected for production. Source edits occurred concurrently during that
diagnosis; its timings do not establish FPS impact. A prior-hint trace also
shows the first expensive leaving pose was absent from accepted history:310
candidate sweeps were needed before its20mm hip offset became available. No
historical-pose approval, heuristic candidate priority or skipped sweep was added.

## Remaining limits

- There are still50–66.8ms intervals. The finite-run targets pass, while strict
 33.3ms deadlines for every frame remain unproved; four-leg has little measured
  margin to the maximum gate. Issued-render intervals are not GPU completion
  or physical presentation times.
- Qualification is bounded to the measured fixtures, one probe and this GPU/
  browser configuration. Sixty concurrent Agents, other hardware, arbitrary
  external chairs and moving furniture are unproved.
- Loading now includes cooperative static fitting. Loading/compilation itself
  is outside the steady-state timing window and is not claimed to run at30FPS.
  Studio skips eager fitting; its explicit first simulation start can still
  pay synchronous fitting cost. Its editor uses the existing display cadence.
- Bind-pose elbow mesh overlap of14.20/16.13mm and chair UV/seam warnings remain.
  External chair fixtures are compatibility evidence, not production admission.
  Continuous torso/head/self-collision, balance, ergonomics and finger/keyboard
  contact are not established; some working poses lean forward visibly.
- Floor/ID handoff remains equal to v6:15 floors,1655 entities and content hash
  `97599a01b51a93dd88be3a3dd6445ec5be9114bbc9d34e7ee5ce9a7192f343e9`.
  No canonical IDs/mappings, Zuri DB/API receiver, Agent activation, hosted CI,
  commit, push or deployment were added by this work.
