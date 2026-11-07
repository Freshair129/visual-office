# Frame deadlines and Studio first use — 30 October 2026

**The frame-time objective remains open.** Final source passes 721/721 Node tests,
96/96 hardware GPU lifecycle cases and build, but only 6/7 unchanged 120 s timing
assessments. Rounded-back still reaches 83.4 ms; the full styled Studio capture
reaches 100.1 ms. This is not a guarantee of 33.3 ms on every frame.

Selected Studio startup is responsive and becomes visible sooner in the observed
runs: 0.7 ms handler / 182.2 ms first actor in the component harness, and 0.9 ms /
194.4 ms in the full preview app. These are shared-host observations, not an
isolated causal comparison or owner acceptance. The user explicitly chose to
continue measuring with shared-host limitations. No business status, approval,
Agent activation, Zuri DB registration, commit, push or deployment was created.

The existing dirty branch is `test/zuri-office-parity-harness`, based on
`a6fdc7e7edbf902e3f56a5b55dcb8e38cabe21c4`. Unrelated changes are preserved.
The earlier [frame-stall report](OFFICE-FRAME-STALLS-20261030.md) is historical
frozen-source evidence, not qualification for this changed source.

## Changes and why

- Selected Studio starts cooperatively complete the same seat-fit and ordered
  local A* path generators before committing motion. Explicit injected scheduling
  stays supported; the default uses feature-detected browser `scheduler.yield()`
  with the original timer fallback. Stop, newer starts, walking, edits/Undo/Redo,
  floor/world/nav changes and disposal cancel stale work and UI completion.
- Navigation keeps neighbor/tie order, simplification, detached paths and cache
  counters. Inputs are captured before yielding; missing endpoints still refuse.
- Batch-local collision repair reuses exactly repeated interpolation samples and
  keys. Mutable endpoints/radii, topology, sample count, world/support and cached
  sample snapshots remain guarded; tracks/samples/query maps each cap at4096.
  Ordered candidates and positive full sweeps are retained.
- A constructed310-candidate empty-world fixture directly measures old/new
  modules: clone/lerp14880→3756, JSON stringify7750→2498, with identical ordered
  diagnostics and5886 query hits. This is operation-count evidence, not GPU FPS.
  A separate real-asset1.25 unbudgeted logical-step comparison keeps pose hash
  `a106ee7051e2d510dc256d868a3c64769dc676db7eaafedd41d423ec726e67ae`.
- An8ms soft work budget yields only after complete60Hz pose steps and retains
  the same activity's owed remainder. It does not expose a partially solved pose
  or omit collision checks. One indivisible step can still exceed the budget.
- Color and directional-PCF shadow programs prepare while scene reveal is gated.
  The late full-app diagnostic exposed deferred first-use shader work. Pinned
  Three keeps several variants in `materialProperties.programs` while overwriting
  `currentProgram`; every compiled variant is now polled. Once each stage is ready,
  `getUniforms()` initializes its shader diagnostics and uniform/attribute caches,
  with context/currentness guards and yields between programs. Checks are not
  disabled. Reflection counts, total duration and maximum native-call time are
  included in load data. Legacy readiness-only preparation remains compatible.
- Temporary compile bindings/targets restore before yields. Only helper-owned
  depth materials are released. Context loss stays unready with recovery guidance;
  unsupported KHR/reflection/shared custom-depth cases stay explicitly incomplete
  and may use legacy rendering. Low first-use latency is not promised there.

## Verification on final source

| Check | Observed result |
| --- | --- |
| Full Node command | `node --test --test-reporter=tap --test-concurrency=4 tests/*.test.mjs` —721/721, no skips/cancellations |
| Isolated `npm run build` | Exit0;507 embedded assets |
| Controlled-time GPU matrix | 96/96 cases,15 floor checks, unchanged thresholds, no console/page/motion errors |
| GPU Stop/restart | Passed; departure targets, leg hints and probe clock reset |
| Actual Studio selected-button lifecycle | Done;91 working frames; no motion/console/page errors |
| Studio pending cancellation | Stop/edit/floor/dispose4/4; no stale motion/status/data publication |
| Seven wall-clock120s profiles |35 completed desk lifecycles;6/7 numeric targets met |
| Additional120s submission diagnostic |5 desk lifecycles; source/coverage checks pass; timing objective remains open |
| Full styled preview app | Lifecycle done,90 working frames, no motion failure; overall harness exit1 because of16 console503 errors |
| Independent source review | No remaining P1/P2 in reviewed scope; static review, not approval or independent test execution |

The first v2 full run had720pass/1fail because the stale-generation scene fixture
lacked the newly required `getUniforms()` API. Its log and original test manifest
remain retained. The fixture now models that API and asserts exactly one current-
generation reflection. Focused2/2 and a fresh complete721/721 run pass; production
bytes did not change for that correction. This was not a retry relabeled as green.

Final review/freeze hashes:

- Scene: `d1a3d5b7d7f7d04146e1be46f2245b4df5084677ab69bce18c5a9f1ea52d4df3`
- Program helper: `112f7625d66c863f90be1bdbd5e1fc2ba8c2ed97f724b1febd17e79f8f97fb6c`

All127 common source/model/fixture records match across matrix, Stop and seven
profiles. All212 input JS files,96 authored browser modules,171 test/support files
and27 model/fixture files remain unchanged in their declared verification scopes.
Authored isolated-build source matches; regenerated Mermaid dependency bytes differ
and are listed explicitly. Generated dependency byte parity is not claimed.

Computed matrix contact residuals remain within old tolerances: palm gap
2.068–3.064mm, seat support gap at most2.070mm,
zero working-clip frames without contact, and foot height/plant residuals below
0.001mm. Those are numerical solver residuals, not physical sensor accuracy,
whole-mesh QA or visual acceptance. The matrix uses controlled logical30/60Hz;
its rendering loops are not wall-clock FPS evidence.

## Seven latest120s profiles

Every p99 is33.5ms. Of25193 RAF-derived render intervals,
4 exceed35ms and4 exceed40ms;99.984% are at most35ms.
There are no intervals over100ms in these seven profiles. This does not erase
the100.1ms result from the separate full-app capture.

Unchanged local targets: FPS>=29.5, p95<=34.5ms, p99<=35ms, maximum<=66.8ms,
no interval>100ms, complete coverage and no errors. They are numeric comparison
targets, not owner acceptance; product device/FPS release criteria remain TBR.
Prior maxima are separate historical captures under different host conditions.

| Fixture | FPS | p99 ms | Prior max ms | Max ms | >35ms | >40ms | Within35ms % | Desks | First call ms | Old target |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| large | 29.998 | 33.500 | 66.700 | 33.800 | 0 | 0 | 100.000 | 5 | 27.900 | met |
| default | 29.998 | 33.500 | 50.000 | 34.500 | 0 | 0 | 100.000 | 5 | 38.400 | met |
| small | 29.998 | 33.500 | 34.500 | 34.300 | 0 | 0 | 100.000 | 5 | 28.500 | met |
| four-leg | 29.998 | 33.500 | 66.800 | 34.500 | 0 | 0 | 100.000 | 5 | 21.500 | met |
| rounded-back | 29.998 | 33.500 | 50.100 | 83.400 | 4 | 4 | 99.889 | 5 | 17.300 | OPEN: longest |
| swivel | 29.998 | 33.500 | 50.000 | 34.700 | 0 | 0 | 100.000 | 5 | 20.900 | met |
| large-repeat | 29.998 | 33.500 | 50.100 | 35.000 | 0 | 0 | 100.000 | 5 | 19.800 | met |

Rounded-back fails `longest`:66.7/83.4ms intervals occur in `approaching-seat`,
with an observed83.2ms work window. These windows include scheduling/GC/host
interference and are not pure CPU instruction cost. No threshold was widened.
The unchanged synchronous first-station API still costs17.3–38.4ms; Studio uses
the cooperative path. Warm call durations remain in raw data.

| Fixture | Logical steps observed | Budget yields | Max pending ms | Max work window ms | Pending at end ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| large | 7200 | 22 | 35.467 | 29.400 | 0.700 |
| default | 7200 | 15 | 34.200 | 26.000 | 0.633 |
| small | 7200 | 22 | 35.167 | 24.300 | 0.267 |
| four-leg | 7201 | 26 | 33.967 | 37.700 | 0.733 |
| rounded-back | 7200 | 12 | 18.567 | 83.200 | 0.667 |
| swivel | 7200 | 11 | 18.533 | 21.600 | 0.700 |
| large-repeat | 7200 | 74 | 68.733 | 25.500 | 0.600 |

Pending time is retained for the same activity and finite-run end debt stays
small. An8ms soft budget cannot preempt one pose solve, and these data do not
prove sustainable throughput for arbitrary chairs, long sessions or60 Agents.
The inherited100ms input clamp/six-substep cap is unchanged; a long pause can
still discard elapsed simulation time. Full wall-time conservation is not claimed.

## Studio and submission-time boundaries

| Observation | Component harness | Full styled preview app |
| --- | ---: | ---: |
| Handler return |0.7ms|0.9ms|
| Click to first visible actor |182.2ms|194.4ms|
| RAF p99 |33.5ms|33.5ms|
| Maximum RAF render interval |83.5ms|100.1ms|
| Intervals>40ms |3|3|
| Motion failure |None|None|

Component scene-ready load is838.5ms, including196.8ms program preparation:
5 programs reflected,36.5ms reflection stage duration including yields, maximum
native reflection1.8ms. Full-app load data include tab/floor/draft configuration
and must not be compared as scene-only cold load. Its program preparation is
125.7ms with5 reflected programs and maximum native reflection0.9ms.
Driver shader caches were not cleared; clocks/power state were not forced.

The full app uses the real preview shell/CSS in a fresh browser context, selects
Projects, sets chair1.25 through actual controls, and starts from the real button.
It never saves the draft. Room/saved revision/Undo remain unchanged during each
measured lifecycle. No network mutation is attempted or forwarded. Its console
errors are real preview HTTP503s: `/api/office`(12),
`/api/knowledge`(2) and `/api/preferences`(2).
These services were not connected or replaced with successful mock responses;
there is no clean full-app/live-Zuri acceptance claim.

The additional1.25 run uses light `performance.now()` wrappers around actual
probe/render calls, separately from the seven unchanged RAF-method profiles:

- Render-submission issued interval p9535.1ms, p9939.8ms,
  maximum66.7ms; finished interval maximum68.1ms.
- 187 issued intervals>35ms and33>40ms.
- Maximum render CPU call8.6ms; probe+render work window
  47.0ms; observed probe work42.9ms.

RAF-derived intervals are not wall-clock submission intervals, GPU completion,
or physical presentation. Thus a33.5ms RAF p99 alone cannot qualify constant30FPS.
The headless hardware backend is RTX3060/ANGLE D3D11,1280×800 DPR1 for the seven
profiles; Studio browser viewport is1440×1000. Dota2 remains present in host
snapshots. GPU utilization snapshots can include recently completed test work;
no per-process GPU causal attribution is made. The host was not reserved or
isolated, and the user chose measurement with these limits. No other owner's
game, model, service or process was stopped.

## Retained evidence and open limits

Earlier failures and superseded source remain separate: the178.3ms synchronous
button /378.2ms first actor /200ms interval baseline; the color-only candidate
with2016.7ms visible delay; CPU/heap/shader diagnostics; first frozen709-test/
7-of-7 numeric results; full-app83.4ms and503 failure; the58-case interrupted
matrix; output-directory guard refusal; and the failed721-test fixture run.
An old-source same-host control also observes roughly56Hz RAF and35–36ms
render cadence, preventing causal attribution from earlier cross-run numbers.
No earlier passing run replaces a later failed result.

Open engineering limits are the atomic pose/native-call overrun, submission/
full-app jitter and shared-host uncertainty. Hard per-frame bounds would require
further resumable/worker pose design with preserved validation and dedicated
measurement. Existing elbow bind-mesh overlaps14.20/16.13mm, UV/seam warnings,
forward-lean poses and incomplete torso/head/self/balance/finger coverage remain.
External chairs are compatibility fixtures; arbitrary models/textures, moving
furniture, sixty concurrent Agents and other hardware are unproved.

The default15-floor/1655-entity v6 handoff remains byte/content-equivalent:
`97599a01b51a93dd88be3a3dd6445ec5be9114bbc9d34e7ee5ce9a7192f343e9`.
This task performed no Zuri DB registration or live Agent action. The local
preview remains at `http://127.0.0.1:4197/` (HTTP200 checked after GPU runs).
No commit/push/deployment or hosted CI result is claimed.
