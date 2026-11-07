# Resumable pose solve — 31 October 2026

Pose solving now resumes across render frames and publishes completed poses only.
Rounded-back's two new 120-second captures peak at 34.0/34.1 ms, compared with
83.4 ms in the previous report. The full styled Studio still peaks at 100.0 ms
(previously 100.1 ms). **Constant 33.3 ms on every frame remains unqualified.**
These are shared-host observations, not an isolated causal benchmark or owner
acceptance. The implementation and bounded tests are complete; the Studio
frame-delivery problem remains open.

This is a local engineering report for the user's continuation request. It does
not create business status, approval, Agent activation or DB registration. No
commit, push, deployment or hosted CI result is claimed. The existing dirty tree
was preserved on `test/zuri-office-parity-harness`, HEAD
`a6fdc7e7edbf902e3f56a5b55dcb8e38cabe21c4`.

## Implementation and failure fixes

Shoe clearance samples, ordered repair candidates, nested capsule sweeps,
working-hand support, torso lean and elbow candidates now share resumable
generators. Synchronous public callers drain those same generators, preserving
candidate order and collision checks. Explicit public method overrides retain
their previous synchronous semantics.

`tycoon-pose-transaction.js` checkpoints actor transforms/visibility, activity
state/reservations, contact internals and public diagnostics. A suspended job
restores the last published state; resumption restores its private work and
continues the same generator without repeating the activity tick. Simulation
debt remains owed. Stop, replacement activity, world/generation/actor changes,
readiness loss and disposal cancel obsolete work. Status callbacks are buffered
until commit, preserve their receiver and stop publishing after a reentrant Stop.

Forced real-chair suspension exposed an equivalent-Euler issue after restoring
a root quaternion. Each new pose now sets root rotation to `(0, heading, 0)`;
setting only Y could reverse the next trajectory past pi/2. Retained red/green
regressions also cover reentrant Stop, stale buffered status, callback receivers,
exception cleanup and frame-rate budget changes.

The automatic cooperative budget is 12 ms in 30 FPS mode and 8 ms at display
rate, adapting when frame-rate mode changes. Explicit overrides remain explicit.
An 8 ms candidate accumulated 3.1175 s maximum debt and 0.2505 s end debt in one
rounded-back run; an explicit 12 ms trial on that same source recorded 0.3836 s
and 0.0006 s. Those separate shared-host runs motivated the default, without
establishing a controlled causal comparison. The budget is a soft checkpoint
allowance, not a hard frame deadline.

Studio's selected-start preparation now yields through
`scheduler.postTask(..., {priority: 'background'})`, retaining the scheduler
receiver, with a zero-delay timer fallback. A diagnostic of the previous
`scheduler.yield()` continuation chain found a 173.8 ms render-issued gap during
preparation despite no measured pose/render call exceeding 25 ms. The change is
limited to Studio's supplied yield callback; general Scene scheduling is intact.
It improves render opportunities during preparation but does not solve every
later frame-delivery gap.

## Verification and source binding

The final current tree passes **738/738 Node tests, zero failures/skips**, and an
isolated `npm run build` exits 0 with **508 embedded assets**. The final command
record is `.local/pose3-check-commands-20261031.json`; the suite and build ended
at 03:44:18 and 03:44:30 +07:00. Complete manifests bind 173 test/fixture files
and 213 JavaScript inputs, including 97 authored root modules. Those authored
modules match the isolated build. Generated Mermaid output differs from its
input, explicitly recorded rather than described as universal byte parity.

Two actual-asset lifecycle tests compare synchronous versus forced suspension
every seven checkpoints: bundled chair scale 1.25 and external rounded-back
scale 1.1. Pose, activity, collision, contact internal state and public/fallback
diagnostics match exactly. Thirteen transaction regressions and two additional
Studio scheduler regressions are included in the full suite.

Independent static reviews cover generators/transaction, adaptive scheduling,
harness visibility/source binding and Studio scheduling. Review notes live in
`.local/pose-*-review-20261031.md` (the core note is
`.local/pose-review-20261031.md`). Reviewers did not run the GPU workloads.

The final 96-case world matrix, Stop/restart and three timing captures execute
the unchanged current 3D graph. Each of those graphs loads 33 root JS modules
and does not load Studio. Their global disk inventories include the older,
unused Studio hash `4e25fd34…`; this is recorded as an unused-input difference,
not rewritten. Fresh final Studio/cancellation captures separately load current
Studio `0e072549…`. The summary checks every observed browser response against
current disk bytes, including model/catalog inputs, and binds the old unused
hash to its preserved source snapshot. This is composed scoped evidence, not a
claim that every capture ran the final entire application tree.

The integrity/measurement summary is `.local/pose3-summary-20261031.json`;
its generating script recomputes timing quantiles and the unchanged thresholds.
Primary full-app command exit 1 is retained because of real HTTP errors.

## Actual GPU lifecycle results

Chrome uses hardware WebGL through ANGLE/D3D11 on an NVIDIA GeForce RTX 3060,
1280 × 800 at DPR 1. No SwiftShader result is substituted. The final matrix
renders every simulated frame: **96/96 lifecycle cases and 15 floor checks pass**.
It includes department desks, routes, scaled chair variants, an explicitly
authored compatible external chair, and nominal 30/60 Hz cases. It uses one
transient probe, controlled logical time and declared static fixtures; it is
functional hardware rendering evidence, not wall-clock FPS evidence.

Final visible-pose maxima: planted-foot shift 0.000111269 mm, foot gap
0.000273416 mm, absolute seat gap 2.070 mm, palm gap 2.068–3.064 mm, and zero
work-clip frames without hand contact. Collision checks cover every visible
frame with positive capsule counts. These measurements do not imply arbitrary
meshes or whole-body collision coverage.

The first candidate matrix is retained as **95/96**, with a 13.51 m false planted
shift on route-lobby. Its observer compared the hidden origin with first visible
spawn. A forced-initial-suspension GPU trace reproduces the observer issue at
both rates. The corrected observer compares consecutive visible poses, resets
the pair while hidden, requires positive visible collision coverage, permits at
most one nominal simulation-second initially hidden and rejects hidden frames
after publication/non-walking. Physical tolerances are unchanged. The fresh full
96/96 matrix has zero hidden frames; the nominal visibility allowance is not a
wall-clock cold-start guarantee. Original failed reports/captures remain intact.

Actual-GPU Stop during departure and a restarted lifecycle pass. Final current
Studio cancellation passes **4/4**: Stop, material edit, floor change and dispose;
all three supported restarts complete all ten lifecycle phases with positive
collision coverage. Published state/contact is preserved, obsolete work does
not resume, and saved state/Undo are unchanged as applicable. Disposal correctly
sets Stop through the navigation editor's `onStop` callback.

An additional 50 mm sideways edit to the 1.25 chair is **not qualified**: the
solver safely blocks the right thigh against desk-1 while approaching the seat
(attempted clearance −7.695 mm, 14.17 mm backoff). CPU replay of that same layout
is identical in synchronous/resumed modes over 813 steps and 436 suspensions,
both safely blocked. The final positive edit test changes material only; it
does not replace or erase this unsupported-geometry result.

## 30 FPS observations

Each profile lasts at least 120 seconds and completes five desk lifecycles plus
the route. RAF-derived render intervals are shown below. Every profile passes
the **existing numeric comparison targets**: FPS ≥29.5, p95 ≤34.5 ms, p99 ≤35 ms,
maximum ≤66.8 ms, zero intervals >100 ms, complete coverage and no page/motion
errors. These targets are not a strict 33.3 ms acceptance rule.

| Capture | FPS | p95 ms | p99 ms | Max ms | >35 ms | Completed steps | Max/end debt s | Max probe work ms |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Rounded-back |29.998|33.4|33.5|34.0|0|7200|0.3184 / 0.0005|17.9|
| Bundled 1.25 |29.998|33.4|33.5|35.0|0|7200|0.1841 / 0.0007|18.4|
| Rounded-back repeat |29.998|33.5|33.5|34.1|0|7200|0.2504 / 0.0006|17.3|

Pending-pose frames are 125/130/136, with 419038/253357/419038 checkpoints.
Thus suspension actually occurs; these are not synchronous fallback-only runs.
Capture/assessment pairs are `.local/pose2-fps-{rounded-back,large,rounded-back-repeat}-20261031*.json`.

A separate instrumented 120-second bundled-1.25 run records actual CPU render
submission intervals: p95 **35.6 ms**, p99 **39.7 ms**, maximum **43.6 ms**;
finished-submission maximum **51.3 ms**, 270 intervals >35 ms and 32 >40 ms.
Maximum render CPU call is 19.5 ms and combined probe/render CPU call 24.3 ms.
This is an additional `performance.now()` method with lightweight wrappers,
not GPU completion or physical presentation. It demonstrates why the RAF table
alone cannot establish every-frame real-time delivery.

## Studio and cold-start limits

Fresh final current-source Studio runs complete the full lifecycle with no
motion failure and no room, saved-state or Undo mutation:

| Capture | Button return ms | First visible actor ms | p99 RAF ms | Max RAF ms |
|---|---:|---:|---:|---:|
| Studio component |2.1|202.1|33.5|66.7|
| Full styled preview |0.8|170.2|33.5|100.0|

The full styled preview has one interval >40 ms and retains **16 real 503
responses**: `GET /api/knowledge` ×2, `GET /api/preferences` ×2 and
`GET /api/office` ×12. It is not a clean full-app pass. No fake successful API
responses or mutating requests are used; no live backend is configured.
The earlier current-3D/pre-UI-fix component/full-app results (133.3/116.7 ms)
and their errors also remain retained, not substituted into the final table.

A separate final current-source diagnostic repeats the full styled lifecycle:
RAF maximum 99.8 ms, first actor 240.3 ms, maximum measured pose call 18.2 ms
and render call 21.8 ms. Its largest render-issued gap is 112.5 ms at +372.6 ms
after click in `walking`, after first publication; the measured render call at
that sample is 4.1 ms. This does not identify the unmeasured gap's cause. The
diagnostic's 16 real 503 errors are retained. It is additional instrumentation,
not an acceptance or profiler trace; its missing recovered shell-exit receipt
is not represented as PASS. Raw JSON/log/PNG and independently checked browser
response hashes are retained under `.local/pose3-studio-current-work-20261031*`.

These fresh-page tests do not clear driver caches or qualify power-on/first-ever
installation cold start. The cooperative solver cannot preempt one geometry
query or native GL call. Construction, activity/path ticks, final measurements
and snapshot/restore work also have bounded-test coverage rather than a hard
per-frame deadline. The inherited 100 ms input clamp and six-step catch-up cap
remain; universal wall-time conservation is not established.

## Remaining limits and evidence delivery

Dota 2 and other host/GPU-memory workloads were observed during this session;
the user explicitly chose to continue with that limitation. A separate native
GPU window was respected, and this task's final GPU work ended at 03:50:46
+07:00. No unrelated process/model was stopped. Clocks, power and exclusive GPU
access were not controlled; cross-run improvements cannot isolate host effects.

Open product/asset limits remain: arbitrary edited layouts and external chairs,
moving furniture, sixty concurrent Agents, other hardware, strict frame bounds,
full-app API availability, elbow bind-mesh overlaps 14.20/16.13 mm, UV/seam
warnings, some forward lean, and incomplete torso/head/self/balance/finger
coverage. No GLB was changed or newly visually accepted in this task.
The existing v6 15-floor/1655-entity handoff remains unchanged, with no Zuri
receiver receipt or DB registration. No AAA, physical-presentation or live-Agent
acceptance is claimed.

Current source SHA-256:

| Module | SHA-256 |
|---|---|
|tycoon-contact.js|e7a16af973ea1bbe86ef434bc9014833358d1da904d8e3c4495333cdf020fbad|
|tycoon-limb-collision.js|b05527261b76713f47f37e00e7bc8fc8b36a1ba393c2d73ec704046ad8e1945e|
|tycoon-arm-contact.js|b9a7361c1f305118c7213b191054da5a705f12affc53b8276014c216584ee507|
|tycoon-pose-transaction.js|73dadce1a57cda3b89f212598af8b4793c6e90d82034d1d105eaea216a3f27a0|
|tycoon-scene.js|0383fc43775ed01c31f2336544a2d86a9584b8a5e2c6c3183fa8bb5b785869ee|
|tycoon-studio.js|0e0725490fc446dc8799fa2df2a2af2112d83098826aec0c79ba95a5ad4a7bec|

The new delivery is `handoff/office-resumable-pose-20261031-evidence.zip`, with
an external `office-resumable-pose-20261031-archive.json` containing archive hash,
payload count and ZIP-stream verification. The ZIP includes source, tests,
reports, failed/corrected evidence, source snapshots and selected screenshots.
The complete raw PNG hash inventory records which captures are included; all raw
matrix PNGs remain on disk. This is integrity evidence, not approval. Prior
sealed archives remain immutable:

- frame deadlines: `90d0f1ca034305e0a4562f35014625322c212ef44b92292d6adfc29bd2e375af`
- frame stalls: `d3cdbfaf46208d05f41b12be88fadca48172089b26d4edc3b264c0381a3519ec`

The local preview remains at `http://127.0.0.1:4197/` with bridge disabled.
