# Chair lifecycle and frame pacing — 30 October 2026

Historical measured revision. The later [desk/departure frame-stall report](OFFICE-FRAME-STALLS-20261030.md)
records the new frozen source and all seven timing targets passing. The failures
and raw measurements below remain unchanged as earlier evidence.

This records local implementation and measured verification. It does not grant
owner acceptance, asset production admission, Agent activation, DB registration
or deployment permission. The [previous report](OFFICE-WORLD-VERIFICATION-20261030.md)
is the baseline: 86/96 lifecycles completed and the 30 FPS mode averaged 28.26
FPS with a 1.55 s longest interval. This revision remains in the existing dirty
working tree based on `a6fdc7e7edbf902e3f56a5b55dcb8e38cabe21c4`.

**Final scoped result:** the ten previously refused chair cases now complete
the 96-case GPU matrix. All six fresh-browser 30 FPS fixtures also complete five
desk lifecycles each, and the separate GPU Stop/restart case passes. The steady
30 FPS qualification remains **open**: all six miss the unchanged percentile
gates, and the large chair still records five intervals over 100 ms, up to
228.4 ms. Node tests pass 642/642 and the isolated build passes. No approval,
registration or business status is implied by these local tests.

## Retained earlier failures

An earlier controlled-time matrix passed, but a fresh-browser scale1.25 timed run
refused departure after route→station. Its measured coverage is incomplete and
is not a performance/lifecycle pass. The retained
[failed run](C:/Users/suanr/workspace/visual-office/handoff/office-chair-performance-20261030/failed-large-realtime-before-fix.json)
records the right-thigh collision and 401.7 ms entering stall. A new full-scene
regression reproduced the exact triangle, clearance and sweep sample in Node.
The regression reproduced the failure before the departure correction. An
intermediate timing series was then stopped after three complete profiles to
reduce repeated leg-repair cost. Those are pre-optimization results, separate
from the final source and timing table below.
The fresh-browser default30 run also records one 122.5 ms interval at its first
desk start (118.2 ms synchronous start call). Its mean 29.977 FPS does not close
the timing gate. Both prior results remain evidence of issues to correct.

On the subsequent 638-test source, large-chair real-time motion completed five
desk lifecycles with zero motion failures, but its maximum interval was still
248.5 ms with twelve intervals over 100 ms. The default and small variants
recorded 88.9 and 37.3 ms maximum respectively. These completed runs are retained
as `*-before-leg-warm-start.json`; the interrupted fourth profile is not a pass.

## Measured causes and corrections

The three external chairs at scale 1.1 reached `sit` and then collided with the
actual chair triangles. The solver previously repaired only approach/entry/exit
poses. The new paired hip/knee search keeps both ankle anchors fixed and each
hip offset within the existing 20 mm budget. Accepted poses are retained through
standing/leaving and remain subject to a fresh full limb sweep every step. Safe
pose rollback, Stop, new activity and world rebinding include the added state.

The small bundled chair exposed a forearm/desk collision during actual desktop
IK. A bounded elbow-pole search changes the elbow bend while preserving the
measured wrist targets and arm lengths. Palms still need measured desktop
support, and the outer collision test still checks all arm and leg proxies.
In two extra actual-skinned working-pose samples, its chosen left elbow change
was 1.5 degrees and no forearm/palm penetration into shirt/pelvis was measured.
Those samples are not a continuous anatomical self-collision proof.

The large bundled chair had a reachable approach missed by the old finite
candidate set. A bounded annulus is used only after authored, preferred and
previous generated approaches fail. Seat/foot fitting can then try a generated
agent-root advance of 20–100 mm after the original fit fails, with an actual
pelvis-band seat ray and existing corridor checks. Furniture transforms and
authored seat anchors are unchanged. These adjustments live in transient
activity stations, not the saved floor inventory.

The old fixed 425 mm standing desk margin could stop a rise inside an otherwise
clear navigation corridor. Standing now retains the existing navigation desk
obstacle and actual limb sweeps. Pelvis/seat support now rejects gaps or
penetration beyond 3 mm in runtime, matching the declared acceptance threshold;
actual GLB tests accept 2 mm and reject both signs of 4 mm.

At 30 Hz, one large exit step still collided while the 60 Hz trajectory passed.
The scene now advances activity, mixer and pose checks at fixed 60 Hz, separately
from rendering. A 30 FPS interval normally runs two checked physics steps;
fractional time is carried, input gaps are capped at 100 ms and at most six steps
run per call. Activity, snapshot and world changes reset that clock. Scene change
and disposal release it, including transitions to scenes without a probe.

The route→desk failure occurred on the first departure-route step while feet
were still transferring from seat anchors to walking targets. It was not a
missed endpoint check: all 330 attempted knee/hip corrections already had full
sweeps and were rejected. Departure now holds the root until both actual feet
and the standing body reach their checked transfer targets, then latches that
readiness for the route. A bounded alternate shoe target selected by the
existing planner persists through this preparation, preventing repeated
selection of the same alternate followed by comparison to an unreachable
nominal goal. Targets are deep-cloned for rollback and cleared on release,
Stop and world rebind; the latch resets before movement in a replacement world.
An unsuccessful transfer still refuses or times out after eight seconds.

CPU profiling of the exact failing full-scene replay found repeated skinned
arm-capsule extraction dominating leg candidate repair. The current update
extracts the ordered arm capsules after arm posing once and reuses them only
within that leg-only candidate pass. Every candidate still receives its full
sweep, and the next update extracts fresh arm geometry. Actual GLB regressions
compare the reused ordered capsules and full collision diagnostics with the
uncached reference across changed leg poses.

The latest leg solver also retains accepted hip-offset/pole parameters as a
candidate hint. It solves the current ankle targets and requires a new full
sweep before reuse; rejection restores the leg pose, clears the hint and keeps
the existing fallback search. The real-GLB reference disables the hint before
every physics substep. Candidate sweeps measured 1,580 versus 2,715 (41.8%
fewer), while the worst burst remains 310 versus 309: a rejected hint adds one
mandatory validation before fallback. That work-count improvement alone is
not a worst-frame timing pass. Actual sampled hip displacement peaked at
20.0000004 mm, with none beyond the existing 20.001 mm numerical guard.

Closest-segment/triangle work now uses per-world scratch vectors, ray and
result objects with the original arithmetic and comparison order. It retains
the same queries and exact narrowphase tests. A portable baseline checks all
1,301 saved first-fit capsule diagnostics and the selected fit; boundary tests
cover face, edge, vertex, crossing and detached hit results. The warmed Node
fixture measured first-station median 92.0 → 54.0 ms; actual hardware timing
must establish the final frame-time result.

CPU profiling identified 223–711 ms synchronous station starts, including a
364.6 ms path search, and up to 121 ms shoe-swing planning calls. Corrections:

- static triangle AABB indexing preserves original triangle order and exact
  narrowphase diagnostics; the fullscan reference remains available;
- bounded, per-navigation point/segment/path memoization preserves exact
  coordinates, effective ignored IDs and detached path returns. A* rejects
  closed or non-improving neighbor states before expensive geometry checks;
  movement costs, insertion ordering and the admitted path remain unchanged;
- a per-navigation immutable blocker AABB cell index reduces the narrowphase
  candidate list while retaining original blocker order and exact point/segment
  predicates. Full-room reference paths and effective ignore rules stay equal;
- foot fitting preserves candidate order, reuses identical geometry/reach
  queries, and caches successful fits by measured rig, collision world and full
  inputs. Its measured directions/roots survive coordinate round trips without
  rounding geometry; edited anchors/new worlds invalidate them. A negative
  triangle-clearance witness can certify that nearby translated shoe candidates
  still collide: signed clearance plus the maximum translation remains below
  -1 mm with an additional numerical margin. Only those proven failures skip
  geometry queries; candidate order, reach checks and the chosen target remain
  unchanged. The reference mode has a separate cache key;
- the frame pacer tolerates 0.5 ms timestamp quantization. Actual rounded 60/120 Hz
  callback regressions reproduced the previous 50/16.7 and 41.7/25 ms oscillation.

Work-count fixtures measured 78.55% fewer triangle-bounds tests with unchanged
hits/narrowphase counts. On the cache-disabled detour, early A* rejection reduces
point/segment checks from 7,895 to 2,527 (68%), retaining the exact four-point path.
Default cold shoe queries fall from 7,308 originally to 2,559 after memoization,
then 1,296 with collision certificates. Six actual GLB fixtures retain
byte-identical chosen targets and complete root-trial records against the
unpruned reference. An unchanged restart performs zero new fit queries or
candidate pruning; its counters now explicitly report zero warm work.
These are work counts, not hardware FPS results. The isolated 479.5 ms render
stall in the profiler warm-up has no confirmed cause; no speculative renderer
change was made.

The subsequent full-room navigation fixture recorded 21,609 versus 41,178 exact
blocker checks (47.5% fewer) with identical routes and station paths. Cold Node
navigation-only station start measured 34.5 ms versus 63.0 ms before the cell
index. Those diagnostic Node times are not GPU FPS acceptance.

## Verification

The full command `node --test --test-concurrency=4 tests/*.test.mjs` passed
**642/642**, with zero failures, skipped or cancelled tests (227,206 ms).
The isolated `npm run build` passed with **506 embedded assets**. Its 95 browser
JavaScript files are fingerprinted for comparison with the runtime source.

The independent reviews identified clock retention, the old 5 mm runtime seat
gate, a stale warm-cache pruning counter and a departure latch retained across
world rebind. Each received a failing regression
and fix. Follow-up source reviews confirmed the corrections and found no other
P1/P2 defect in the reviewed final changes, including hint and scratch reuse.
Review did not execute tests
and does not substitute for the recorded command/browser results.

`PREVIEW_PORT=4197 node scripts/asset-factory/verify-office-world.cjs
.local/chair-warm-final-gpu-20261030` completed **96/96** cases on Chrome
156 / RTX 3060 / ANGLE D3D11. The source hashes stayed unchanged, all fifteen
floors loaded with no navigation issues, page errors were zero, and both failed
case/floor lists are empty. The ten previously refused variants now complete
working contact, standing, departure and a grounded completed pose. No model,
placement or scale was substituted to obtain this result.

| Previously failing chair | 30 Hz outer cadence | 60 Hz outer cadence |
| --- | --- | --- |
| Kenney four-leg, scale 1.1 | Completed | Completed |
| Kenney rounded-back, scale 1.1 | Completed | Completed |
| Kenney swivel, scale 1.1 | Completed | Completed |
| Bundled chair, scale .75 | Completed | Completed |
| Bundled chair, scale 1.25 | Completed | Completed |

Across the matrix, maximum measured palm gap was 3.065 mm and maximum absolute
pelvis/seat gap was 2.070 mm, inside the unchanged 5/3 mm gates. Actual shoe
rest gap and planted shift were each below 0.001 mm on the captured outer frames.

Cases labeled 30/60 Hz specify the outer update/render cadence. Physics now
runs at fixed 60 Hz; a normal 30 Hz interval contains two checked substeps.
Actual vertex measurements are sampled on the rendered outer frames, while
the runtime limb and seat-support gates run on every internal physics step.
This controlled-time matrix is lifecycle evidence, not a real-time FPS result.
Logs and the exact [raw matrix](C:/Users/suanr/workspace/visual-office/handoff/office-chair-performance-20261030/lifecycle.json)
are retained in the [evidence bundle](C:/Users/suanr/workspace/visual-office/handoff/office-chair-performance-20261030/README.md).
The [ZIP archive](C:/Users/suanr/workspace/visual-office/handoff/office-chair-performance-20261030-evidence.zip)
contains 55 verified file entries (54 payloads plus the checksum manifest),
SHA-256 `f0d543b855abb56938822e994e903123c3b637a0fde202ae9586d8e90b864e4b`.

`node .local/verify-warm-stop-gpu.cjs` additionally passed the production-scene
route→large-chair→Stop during departure preparation→restart lifecycle on the
same RTX 3060/D3D11 path. Both departure targets and a pose hint were present
before Stop; targets, hint, latch and fixed-step clock cleared. The restarted
run covered all phases, 91 supported working frames and 61 grounded done
frames at 30 Hz outer cadence. Actual shoe, palm and seat measurements remained
within the existing gates, page errors were zero and source hashes stayed
unchanged. This is controlled-time GPU lifecycle proof, not an FPS measurement.
See [the raw Stop/restart result](C:/Users/suanr/workspace/visual-office/handoff/office-chair-performance-20261030/stop-restart-gpu.json).

The timing harness observes changes to `renderer.info.render.frame` from RAF
callbacks. These are issued-render observations on the admitted hardware WebGL
path; they are not GPU timestamp queries or compositor/display presentation
measurements. Startup is recorded as `loadMs`, followed by the same one-second
warm-up used for all timing runs. Route and cold first-desk transitions remain
inside the measured lifecycle window; unchanged restarts may use runtime caches.

The preselected one-probe
30 FPS target is ≥29.5 average FPS, p95≤34.5 ms, p99≤35 ms, longest interval≤66.8 ms
and zero intervals over 100 ms, for at least 120 seconds with full lifecycle
coverage. It has not been relaxed.

Seven separate fresh Chrome processes measured the final source for at least
120 seconds each at 1280×800 / DPR 1: six chair fixtures in 30 FPS mode and the
default chair at native cadence. Every run completed five desk lifecycles after
the initial route, with zero motion failures and page errors. Source and model
hashes agree across the matrix, timings and current source.

| Chair | Mode | FPS | p95 ms | p99 ms | Longest ms | >100 ms | Desk cycles |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bundled 1.0 | 30 | 29.984 | 36.0 | 36.3 | 87.7 | 0 | 5 |
| Bundled .75 | 30 | 30.002 | 36.1 | 36.5 | 37.0 | 0 | 5 |
| Bundled 1.25 | 30 | 29.827 | 36.1 | 36.6 | 228.4 | 5 | 5 |
| Kenney four-leg 1.1 | 30 | 30.000 | 36.1 | 36.5 | 53.0 | 0 | 5 |
| Kenney rounded-back 1.1 | 30 | 29.985 | 36.1 | 36.6 | 87.9 | 0 | 5 |
| Kenney swivel 1.1 | 30 | 29.996 | 36.1 | 36.5 | 37.3 | 0 | 5 |
| Bundled 1.0 | Display | 56.803 | 18.2 | 18.6 | 88.5 | 0 | 5 |

All six meet the average-FPS gate, but **none meets the complete steady-frame
target**. All miss p95/p99; default, large and rounded-back also exceed the
66.8 ms longest-frame gate. Only the large chair has intervals over 100 ms:
one at first station start and four during departure. Its cold station call
took 143.7 ms; default took 84.5 ms. Warm restarts across the fixtures took
at most 1.6 ms. Scene loading took 1.08–1.34 seconds, outside the measured
window and explicitly retained as `loadMs`.

The profile command's zero exit code establishes source/coverage/motion gates,
not steady FPS. The separate unchanged timing assessment exits **1** for every
30 FPS fixture, and the aggregate command also exits **1**. These failures
remain in the [timing summary](C:/Users/suanr/workspace/visual-office/handoff/office-chair-performance-20261030/timing-summary.json)
and raw assessment files; lifecycle success does not override them.

Separate blank-page diagnostics found native RAF p50/p95 of 17.7/18.3 ms
headless and 17.7/18.5 ms in a two-second headful hardware sample. That short
sample is diagnostic only. Two such callbacks already span about 35–36 ms;
the existing 30 FPS cap's regular intervals remain quantized to those callbacks.
A browser-only queue-microtask trial did not improve the cadence, so no such
production scheduler change was made. Timer-based render-entry timestamps
would be a different measurement and would not prove smoother presentation.

## Identity and remaining limits

An in-memory rebuild equals the existing v6 manifest exactly: all fifteen default
floors, 1,655 entities, model revisions and station identities are unchanged.
Content hash remains
`97599a01b51a93dd88be3a3dd6445ec5be9114bbc9d34e7ee5ce9a7192f343e9`.
All 27 model/fixture hashes checked against the baseline are unchanged. No new
handoff package or DB mapping was manufactured for runtime-only pose changes.

- Measurements cover the tested static scenes and a single local transient
  probe. Arbitrary models/anchors/scales, moving furniture, other GPUs/devices,
  sixty concurrent Agents and production performance are not proved.
- The strict 30 FPS qualification remains open on this host. Native callback
  quantization explains regular percentile misses, while cold planning and
  large-chair departure still produce genuine long frames. Their causes are
  not closed by the average FPS or the lower Node operation counts.
- The rig retains the known 14.20/16.13 mm bind-pose elbow mesh overlap and is
  not a complete anatomical or balance solver. The accepted limb proxies do
  not establish continuous torso/head collision coverage.
- Some working poses visibly lean forward. Contact and measured bone-length
  acceptance do not establish ergonomic posture, natural final animation,
  keyboard/finger interaction or final character-art approval.
- Bundled chair UV/seam warnings remain. The external Kenney models remain
  regression fixtures with their recorded geometry QA issues; successful
  runtime compatibility does not admit them as production artwork.
- A fixed timestep improves the checked path but does not guarantee smooth
  rendering under arbitrary OS/GPU load. No compositor-presentation or physical
  display-timing acceptance was performed.
- Hosted CI, publishing, Zuri receiver/API/DB ownership and Agent activation
  remain unrun or unimplemented. No status, approval, grant or registration
  record was created.

Evidence links with a Windows drive prefix are machine-local locators in the original
qualification checkout. Raw traces and archive payloads are not portable Git files;
their measurements retain their original source binding.
