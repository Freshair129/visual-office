# Desk and large-chair frame stalls implementation plan

> **For agentic workers:** Use systematic-debugging, test-driven-development and verification-before-completion. This is execution authorized by the user's continuation request; local check results do not grant approval.

**Goal:** Remove cold desk and scale1.25 departure stalls while preserving actual geometry, checked motion and the existing steady30 timing gates.

**Architecture:** Retain the synchronous station API, fixed60Hz pose checks and original candidate ordering. Reduce repeated static-key, transformed-vertex and candidate work after exact reference comparisons. Prepare static seat fits cooperatively during the existing asynchronous scene load, keeping `ready=false` until current-generation preparation completes. Include that work in reported load time; do not move it into an unreported ready-state pause. Keep real-time measurement separate from instrumented diagnostic traces.

**Tech stack:** Three.js / GLB, Node tests, Chrome hardware WebGL D3D11 on RTX3060.

**Spec:** User continuation and [prior measured report](../../../game-design/OFFICE-CHAIR-PERFORMANCE-20261030.md).

## Constraints and review focus

- Existing dirty tree and floor/ID handoffs remain intact; no asset substitution, collider shrink, suppressed collision or invented registration/approval.
- Measured feet/palms/seat tolerances and20.001mm absolute hip guard remain unchanged.
- Changed arm pose, parent transforms and deformed skin invalidate assumptions; no cross-pose geometry cache.
- Failed parameter hints still require fallback and current swept validation.
- Stop/restart, rollback, scene replacement and disposal must clear any new transient state.
- Target unchanged: >=29.5FPS, p95<=34.5ms, p99<=35ms, max<=66.8ms, zero intervals>100ms, >=120s full lifecycle coverage.

## Tasks

- [x] Reproduce on current source with instrumented trace and uninstrumented120s large-chair GPU run. Retain both; concurrent diagnostic CPU work means baseline is diagnostic, not a clean comparative acceptance run.
- [x] Reduce arm extraction repeated transforms and per-triangle distance work. Own `web/tycoon-arm-contact.js`; new real-GLB reference test failed before implementation, then matched exact ordered capsules under changed pose/parent transforms.
- [x] Reduce repeated fit-key work. Own `web/tycoon-seat-fit.js`; tests retain chosen fits, root trials, reach and geometry diagnostics against the reference.
- [x] Diagnose remaining departure burst and implement per-update exact capsule-query reuse. New full-scene test matches every accepted-frame pose/feet/clearance hash and reduces actual triangle tests by more than25%. No candidate order or collision acceptance change.
- [x] Evaluate and reject immutable XZ mesh-cell broadphase:85.5% fewer bounds checks but paired worst departure62.4ms vs56.0ms flat. Candidate source/test retained only under `.local/chair-mesh-grid-20261030`; production grid edits removed.
- [x] Scope matrix updates to changed leg branches during repair. Real-frame pose hashes match full-actor reference; peak full-actor rebuild count178vs2084. These counts are not FPS.
- [x] Replace the remaining monolithic first-use fit with the same generator consumed in small load-time slices. Synchronous callers remain exact; disposal/world/generation cancellation and unchanged inventory are tested. Studio is excluded after an independently found P2; three repeated Studio refreshes pass.
- [x] Third bounded candidate: private reject-only triangle witnesses for leg repair. A current measured collision may reject a candidate; a miss still requires the ordered full query. Never accept from a witness. Preserve accepted poses and record witness provenance/counters explicitly.
- [x] In the same candidate, address confirmed custom-chair shoe-planning work with a per-call conservative trajectory mesh worklist. Guard containment on every query and fall back to the whole world outside the scope; preserve all selected lifts/routes and sampling. Point-query memo/witness and endpoint-first variants were measured and rejected; the planner uses scope filtering only.
- [x] Independent review of this composed patch against `.local/chair-stalls-before-20261030/web`; resolve substantive findings. Frozen five-module patch has no P1/P2 findings; this is static review, not approval.
- [x] Run appropriate focused regressions, full Node suite and isolated build. Frozen source passes672/672 tests, no skips/failures; isolated build passes.95 authored modules match built/current source; generated Mermaid byte parity is separately false and recorded.
- [x] Run actual GPU lifecycle matrix and Stop/restart:96/96 complete,15 floors pass, no page errors, unchanged source. Separate1.25 Stop/restart clears departure targets/hint and completes again.
- [x] Run seven fresh120s real-time profiles on the frozen source, including repeated large1.25 and three external fixtures:7/7 meet original targets,35 desks complete, no errors/>100ms intervals, unchanged source. Retain earlier failures separately.
- [x] Save raw evidence with hashes and a report distinguishing verified behavior from remaining limits. Every baseline/candidate failure stays separate from the final measured series.
- [x] Qualify bounded steady30 against the unchanged local targets: all functional/timing gates pass. This is not approval or a guarantee of33.3ms per frame; measured maximum66.8ms and other limits remain explicit.

## Diagnostic baseline

Current original source: HEAD `a6fdc7e7edbf902e3f56a5b55dcb8e38cabe21c4` plus existing dirty edits. Browser156.0.8078.48, RTX3060,1280x800DPR1. `.local/chair-stalls-baseline-large-20261030.json`: source unchanged, five desks completed, mean29.3977FPS, p9533.4ms, p9934.7ms, maximum416.7ms,15 intervals>100ms, cold station417.1ms. An instrumented separate45s trace includes only one station start and incomplete desk coverage; it is profiling evidence only.

The instrumented CPU samples show repeated `updateWorldMatrix` and `multiplyMatrices` in per-vertex arm extraction. Cold station samples concentrate in `searchSeatFeet`, including repeated key construction and collision witness lookup. Algorithmic improvements must be checked on fresh hardware profiles; work counts alone cannot close the frame gate.

## First candidate, retained failure

`.local/chair-stalls-candidate1-large-20261030.json` completes five real-time desk lifecycles on unchanged source with no page/motion errors. Mean29.8394FPS, p9533.5ms, p9933.8ms pass their existing thresholds; max250.1ms and four intervals>100ms fail. Cold start247ms; a leaving interval233.2ms remains. This is not steady30 qualification. Do not replace the original timing target with averageFPS.

Independent review found the cache composition helper publicly reachable without its caller's ownership guard. It is now class-private; the direct-access regression was observed failing and then passing. Review verified the private guard without rerunning tests or granting approval.

## Second candidate, retained mixed results

Final-source Node657/build and the96-case real GPU matrix pass. Seven fresh120s timing profiles all complete five desk cycles with no page/motion errors and unchanged source. Four meet all timing gates. Four-leg records83.3ms at approach; rounded-back records100ms at approach; the1.25 repeat records100ms during leaving despite the first1.25 run meeting66.7ms. All percentile gates pass, but overall steady30 remains OPEN. Raw reports and `.local/chair-stalls-stage2-summary.json` retain every result; no retry replaces these failures.

The third candidate addresses repeated rejection work in those same leg-search phases. Independent read-only tracing confirms failed repair hits do not steer subsequent candidates: only the original full-sweep failure and accepted results update `lastCollision`. A witness must therefore be a current, support-filtered negative proof, kept separate from full ordered query-cache results. Full positive validation and candidate order remain unchanged.

Further custom-chair Node breakdown confirms a distinct hot path: approach
updates spend72.5–114.4ms in `swingClearanceLift`, versus0.1–0.2ms in limb
sweeps. The proposed worklist encloses every possible planned shoe capsule;
the actual query AABB must be contained before dropping any outside mesh.
Filtering once per planner avoids the per-query index overhead that made the
global grid slower. Full queries outside the scope and every original planner
sample/lift/route remain required.

## Third candidate, retained mixed results

All seven fresh120s profiles completed five desks each, without page/motion
errors or source changes. Five met every unchanged timing target. The first
1.25 run still reached116.8ms during leaving with two intervals>100ms; the
repeat met66.7ms. Rounded-back still reached83.4ms during approach. Four-leg
now met50.1ms. Full raw results and `chair-witness-stage3-summary.json` are
retained. This source is not qualified as steady30.

The remaining bounded investigation separates two costs: repeated ancestor
matrix propagation inside the leg solver, and repeated triangle-index work in
the custom-chair swing planner. A fresh-matrix leg optimization must retain
exact accepted poses against the frozen third-candidate module. A triangle
scope prototype is separate from the implemented mesh scope and remains
diagnostic only. It retained exact queries/plans/poses but reduced AABB checks
only6% with mixed noisy Node timings; it was rejected for production. Neither
investigation permits weaker collision or timing gates.

The fresh-matrix leg change is frozen after2 new and37 targeted tests pass.
The actual1.25 route→desk accepted-pose hash remains exactly
`a106ee7051e2d510dc256d868a3c64769dc676db7eaafedd41d423ec726e67ae`.
The final regression checks total matrix requests<75%, total ancestor requests
<70%, and worst-frame ancestor requests<25% of the measured baseline. Earlier
pre-public-default-fix instrumentation measured94,378→6,628 worst-frame calls;
exact counters were not re-emitted for the final source. Public helpers retain their
refresh behavior; only controlled internal callers opt into current-matrix
reads, with changed-parent/scaled-rig regression. These are CPU work counts;
final-source full suite, build, GPU lifecycle and all seven timing targets pass.
