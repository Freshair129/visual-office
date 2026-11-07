# Chair lifecycle and frame pacing implementation plan

> **For agentic workers:** Use systematic debugging and test-driven development for the assigned scope. Implementation and independent review are separate. Preserve the existing dirty tree.

**Goal:** Complete the ten currently refused scaled-chair lifecycles and remove the measured long-frame problem in the 30 FPS mode, then verify the composed production scene.

**Architecture:** Keep actual GLBs, authored placement/scale, rig lengths and collision thresholds as the physical inputs. Derive admissible seat/foot/entry poses and check them with the existing swept limb geometry. Optimize repeated static-world queries and frame scheduling without omitting checks or advancing completion before measured contact readiness.

**Tech stack:** Three.js, browser WebGL on RTX 3060/D3D11, Node test runner and production-scene Playwright harnesses.

**Spec:** The owner's continuation request in this conversation; [contact constraints](../../game-design/TYCOON-UPPER-CONTACT.md), [SRS](../../VISUAL-OFFICE-SRS.md), and the [recorded baseline](../../game-design/OFFICE-WORLD-VERIFICATION-20261030.md).

## Constraints and acceptance

- No collider exemptions, smaller proxies, raised collision tolerances, substituted assets, fixture-only desk moves or manufactured success/approval/DB registration.
- Actual shoes: floor penetration/rest gap ≤3 mm; planted movement ≤4 mm. Actual palms: supported gap ≤5 mm; seat support gap ≤3 mm; arm length error ≤0.1 mm. Preserve terminal refusal and Stop/restart behavior.
- Ten target cases: Kenney four-leg/rounded-back/swivel at scale1.1 and bundled chair at .75/1.25, each at30/60Hz, with unchanged original geometry/placement and meaningful full lifecycle assertions.
- Integrator-selected performance target for this bounded one-probe scene: ≥29.5 observed FPS, p95≤34.5ms, p99≤35ms, longest interval≤66.8ms and zero intervals>100ms, across at least120s of 30FPS route→desk lifecycle coverage. Record misses honestly; this is not an owner approval or a guarantee for arbitrary hosts/scenes.
- Preserve fifteen functional floor plans, IDs, saved room snapshots, existing export contracts and Zuri authority. This is local simulation work.

## Review focus

- Quantized RAF timestamps, irregular refresh rates and long pauses must not introduce 50/16ms catch-up oscillation or large simulation steps.
- Broadphase acceleration must preserve original narrowphase hit ordering, thresholds, triangle coverage and diagnostics, including seat-support exceptions and sweep-range refusal.
- Chairs differ in real seat top, arms, legs and back. A passing scale must not hide a collision by treating its whole chair as support.
- Pose/target/cache state must reset on world changes, Stop, station changes and repeated lifecycles; cache keys must include physical geometry/scale/anchors.
- Profile and lifecycle evidence must use frozen source and actual hardware rendering; phase coverage does not itself certify steady FPS.

## Tasks

- [x] Capture per-phase CPU timings/profile against the current production scene; distinguish scheduler quantization from synchronous geometry/planning stalls. Diagnostic helpers live in `.local/` and close their own browsers.
- [x] Add rounded60/120Hz timestamp regressions in `tests/tycoon-frame-pacing.test.mjs`, observe RED, then correct `FramePacer.sample(time)` while preserving elapsed-time simulation and existing144Hz/pause tests.
- [x] Reproduce each failed variant using the actual actor/seat/desk GLBs. Add `tests/tycoon-scaled-chair-lifecycle.test.mjs` with unchanged fixture inputs and 30/60Hz working-contact, departure and grounded completion checks; observe the original failures before the pose fix.
- [x] Use the measured failure phase/geometry to implement bounded admissible chair entry/seat/foot posture in the existing navigation/contact/scene modules. Document the selected algorithm from the diagnostic evidence before editing its production path. Explicit authored anchors remain authoritative; infeasible geometry must still refuse visibly.
- [x] Optimize the measured long-task path. Candidate static triangle broadphase/index reuse must retain a fullscan reference and deterministic collision parity regressions; only implement it if the profile confirms the cost. If planning remains above budget, bound and reuse its work while holding the last validated physical pose.
- [x] Run focused RED→GREEN regressions, the full local suite and isolated build; obtain an independent review of the composed patch.
- [x] Freeze source and rerun the full96-case production GPU lifecycle matrix, plus repeated lifecycle/Stop/restart cases affected by new pose/cache state.
- [x] With other task-owned GPU/test processes closed, measure at least120s per display/30FPS mode, including all lifecycle phases. Record cadence, percentiles, worst frames, motion errors and source hashes against the target above.
- [x] Deliver a new evidence report with actual commands/results and remaining limits. Rebuild the offline handoff only if exported scene/station semantics changed; preserve design IDs and null canonical mappings. No automatic commit of unrelated changes.
- [x] Later continuation qualifies bounded steady30 against every unchanged timing gate: [frame-stall report](../../game-design/OFFICE-FRAME-STALLS-20261030.md),672 tests,96 GPU cases and7/7 timing profiles on frozen source. Earlier six-profile failures remain historical evidence. Maximum66.8ms still does not guarantee33.3ms every frame or arbitrary hardware/scenes.

## Additional real-time regression

The final controlled-time matrix passed 96/96, but the fresh-browser 30 FPS
profile at chair scale 1.25 refused a right-thigh sweep during departure after
the initial route. That is a distinct failed lifecycle, not a timing-only miss.
Preserve its raw result, reproduce route→station and repeated/Stop/restart
state using the actual rig and mixer, correct the retained state or pose cause,
and repeat composed verification on the next frozen source. No collision gate
may be relaxed to erase this failure.

The recorded failure occurs on the first leaving-route step (.85/60 m) while
feet are still transferring from seat anchors to walking targets. Candidate
repairs already check full sweeps. Test a one-time departure preparation gate:
hold the root in the current validated position until the existing contact
solver completes both foot transfers and standing readiness, then latch that
readiness for the route. Keep every subsequent motion sweep and existing pose
limits. Reset the gate on phase/activity/world changes and refuse a timed-out
transfer. Also measure scoped reuse of unchanged arm capsules inside leg-only
candidate searches; it must preserve the same ordered capsules and results.

The departure fix passed 638 Node tests and the next 96-case GPU matrix. Its
fresh scale1.25 timing run completed five desk lifecycles without collision,
but still recorded 248.5 ms maximum and twelve intervals over 100 ms. The
incomplete timing series is retained as pre-optimization evidence. The next
bounded optimization may reuse the last accepted leg-pose parameters as a
candidate hint, solving current ankle targets and performing a fresh full
sweep before accepting it. It must fall back to the existing search, preserve
absolute 20 mm hip displacement and all geometry gates, and reset/restore
hint state correctly. No collision result may be cached as approval. Verify
actual geometry and work counts against a mode with the hint disabled before
repeating the frozen suite/build, GPU matrix and fresh-browser timing series.

A measured closest-point scratch prototype reduces warmed fresh-context seat
start from 92.0 to 54.0 ms while retaining 1,296 collision queries, 39,360
segment/triangle tests and byte-identical per-capsule diagnostics and selected
fit. Integrate only per-world reusable vectors/ray/results with the same
arithmetic order and geometric comparisons; preserve detached serialized hits
and protect against scratch aliasing. The separate mesh-AABB tree prototype
was slower despite fewer bounds checks and must remain diagnostic-only.

This document records the requested execution scope and integrator decisions. It is not a product approval or an operational status record.

The measured causes, selected algorithms and completed checks are recorded in
[the implementation report](../../game-design/OFFICE-CHAIR-PERFORMANCE-20261030.md).
Fixed 60Hz physical substeps were selected after the remaining 30Hz path failed
while the same 60Hz lifecycle passed. No collision threshold was relaxed.
