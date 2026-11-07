# Frame deadlines and Studio first-start implementation plan

> **For agentic workers:** Use systematic debugging, test-driven development and independent verification. The user explicitly requests execution; this plan records integrator choices, not owner approval. Preserve the existing dirty tree and every earlier evidence bundle.

**Goal:** Reduce residual50–66.8ms intervals toward33.3ms, remove monolithic Studio first-use fitting and remeasure the actual GPU scene without weaker physical gates.

**Architecture:** Preserve original ordered candidates, positive full sweeps,60Hz physics and synchronous prepared-scene APIs. Introduce a selected-station cooperative Studio start with cancellation across Stop/edit/world/disposal. Evaluate exact per-repair sweep sample reuse before more intrusive transactional planning; retain it only with semantic parity and meaningful measured work reduction. Do not expose partially solved limb poses between frames.

**Tech stack:** Three.js, actual GLBs, Node tests, Chrome hardware WebGL D3D11 on RTX3060.

**Spec:** User continuation and [previous measured report](../../game-design/OFFICE-FRAME-STALLS-20261030.md).

## Constraints and review focus

- No substituted assets, collider shrink, omitted positive checks, threshold relaxation, fake completion/approval, DB writes or saved-floor changes.
- Preserve exact support inputs, sample grid, candidate ordering,20.001mm absolute hip guard and existing foot/palm/seat tolerances.
- Reuse must validate mutable endpoints/radius, world, topology, sample count and support options; public diagnostic mutation must not poison cached data.
- Studio refreshes still skip all-seat eager fitting. Only explicit selected-station start may prepare; stale work must not start motion or replace a newer UI status.
- Keep original timing gates for comparability, and additionally report intervals>35ms and>40ms plus slow-step costs. A new33.3ms deadline is a measured objective, never an inferred pass from averages.
- Preserve wall-clock load/start/pending latency and completed lifecycle counts. Do not introduce time dropping, change the pre-existing100ms long-pause clamp/six-step catch-up limit to hide work, or suppress rendering. That inherited clamp still drops elapsed time after a>100ms pause and must remain an explicit limitation.

## Evidence before implementation

Frozen baseline contact SHA256 `b86c79a0bb11feac1f584646c3be5181267217f5898c057a6895d0a907cc503a`.
Earlier source passed672 tests/96 GPU cases/7 old timing gates, with50–66.8ms intervals.
New90s instrumented hardware trace (`.local/chair-deadlines-baseline-20261030`) completes4 sequences with unchanged source and full phase coverage. Single contact updates reach54.5ms approach/50.9ms departure; a catch-up outer update reaches100.4ms. Swing calls reach20.5ms; cold `findLocalPath`46.3ms. Sampling adds overhead, so these are diagnosis, not unchanged timing acceptance. Raw CPU/heap data and rare render stalls remain preserved.

## Tasks

- [x] Read instructions, latest session note, current Git/source and earlier evidence. Preserve baseline source under `.local/chair-deadlines-before-20261030/web`.
- [x] Capture current instrumented CPU/GPU diagnosis and independently trace Studio and contact call boundaries.
- [x] Add RED regressions for cooperative selected-station start, UI awaiting, Stop/new-start/edit/Undo/Redo/floor/world/disposal cancellation and unchanged inventory.
- [x] Implement `TycoonScene.startStationAsync` and await it from Studio; adapt navigation test callback handling without changing synchronous callers. Measure pathfinding separately; yielding the fit does not certify route-search latency.
- [x] Actual Studio-button baseline:178.3ms synchronous return,378.2ms first visible actor,200ms maximum render interval. Evaluate guarded program precompilation while scene readiness is false, include all preparation in load time, and cancel before polling disposed programs. Unsupported parallel compilation stays explicit; it is not a completed-GPU claim.
- [x] Make the same ordered local-path grid/A* search consumable as `findLocalPathSteps`; drain it for synchronous callers and cooperatively precompute the exact selected Studio route before committing start. Preserve cached path copying, tie order and query counters. Test literal pre-edit detour/ignore/refusal outputs and cancellation before cache publication.
- [x] Add RED exact-sweep reuse tests covering mutable inputs/topology/support/world and detached diagnostics; prototype batch-local interpolation/key reuse against current ordered results and actual1.25 trajectory. Reject if parity/work/timing evidence does not justify it.
- [x] Bound live render-frame catch-up work after complete60Hz steps with an8ms soft budget. Retain the full pending remainder, candidate checks and step order; do not pause inside a pose solve. Expose backlog/step/yield measurements and compare exact accepted pose sequence per logical step against the synchronous reference. The existing100ms input clamp and six-step safety limit remain unchanged and explicit. A single expensive step can still exceed the soft budget.
- [x] Obtain independent review of composed changes; resolve substantive findings before freezing source.
- [x] Run relevant focused checks, full Node suite and isolated build. Keep generated dependency bytes separate from authored-source parity.
- [x] Run actual Studio-button cold-start/cancellation and edit refresh checks, and the full production GPU lifecycle matrix on frozen source.
- [x] Run fresh120s profiles with repeated1.25 and external chairs while other task-owned tests/builds are closed. Preserve old assessments and add stricter cadence counts without relabeling an old gate as a33.3ms guarantee. First frozen source: 7/7 unchanged numeric gates, but RAF max66.5ms, wall-submission max57ms and full-app max83.4ms remain.
- [x] Report actual improvements, pending latency and every remaining limitation with hashed raw evidence. No automatic commit/push/deployment or new platform authority.

## Frozen implementation and verification pause

The final authored source is frozen, independently reviewed and passes709/709 Node tests plus the isolated build. The controlled GPU matrix was interrupted after58 logged cases for a verified user-authorized shared-host measurement hold; its partial log remains separate and is not acceptance. GPU work resumes after22:33 Asia/Bangkok or an earlier release. No preview, service or unrelated process was stopped.

## Late full-app shader variant finding

The first frozen source completed all96 GPU cases, seven120s profiles and an
additional120s wall-submission diagnostic. The full styled preview also completed
its lifecycle, but observed83.4ms RAF maximum; a separate CPU diagnostic sampled
41.655ms in `getProgramInfoLog` despite preparation completed=true.

Pinned Three stores multiple shader variants in `materialProperties.programs`
while overwriting `currentProgram`. The helper polled only the latter. Independent
read-only review confirms the missed-variant readiness gap. This is a correction
to the existing readiness promise, not a new acceptance or approval workflow.

- [x] Add RED coverage for a ready current program and an unready earlier variant.
- [x] Poll every compiled Map value plus current fallback; guard context/currentness
  between readiness calls and before returning completed. Retain unsupported fallback.
- [x] Independent review of this narrow helper/test delta, then freeze fresh source.
- [x] Prepare pinned Three's deferred uniform/attribute reflection after readiness,
  before reveal, with per-program yielding and measured native-call costs. Keep
  diagnostic checks enabled; an indivisible reflection can still delay loading.
- [x] Test a feature-detected browser cooperative scheduler for selected-start
  turns, retaining injected scheduling and timer fallback. Measure first-use
  latency again rather than assuming that replacing nested timers is faster.
- [x] Fresh full Node tests/build,96 GPU matrix/Stop, Studio button/cancellation,
  seven120s profiles and wall-submission check under new `chair-deadlines-v2` paths.
- [x] Repeat the styled full-app lifecycle. Preserve preview503 console errors as
  an unqualified overall result; do not fabricate live service readiness.
- [x] Compose the final report and archive input selection from the latest source,
  keeping failed/interrupted/superseded measurements separate. Archive byte checks
  are recorded externally after sealing; this pre-seal plan is not an approval.

The v2 build passes. Its first full721-test run had720pass/1fail: the scene
fixture lacked getUniforms. The strengthened fixture now checks exactly one
current-generation reflection (focused2/2 GREEN, independent review clean).
Failed log and original test manifest are retained; a fresh full run subsequently passes721/721.
Production helper/scene hashes remain112F7625/D1A3D5B7, so the running GPU
matrix uses unchanged production bytes.

## Latest qualification result

Final source112F7625/D1A3D5B7 passes721/721 tests, build,96/96 GPU cases and Stop.
All seven120s profiles completed35 desks;6/7 old numeric targets met. Rounded-back
fails maximum83.4ms with observed83.2ms work. Component first actor182.2ms;
full-app first actor194.4ms, but maximum100.1ms and16 real preview503 errors remain.
The additional120s submission diagnostic completes5 desks, p99 issued39.8ms,
maximum66.7ms and CPU probe+render47ms. All source/inventory parity checks pass.
The user selected measurement with shared-host limitations. No constant33.3ms,
exclusive-hardware, clean full-app/live-service, owner or release acceptance is claimed.
Remaining hard-deadline qualification stays open in the final report.
