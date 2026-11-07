# Resumable pose solve implementation plan

**Goal:** Split the existing ordered pose solve across render frames and measure real GPU lifecycle behavior, including rounded-back and styled Studio.

**Authority:** The user's instruction to continue this implementation. This document records engineering choices, not a business approval or performance acceptance.

**Design:** Keep one generator implementation per solver and drain it for synchronous callers. Yield between shoe clearance samples, ordered repair candidates and sweep samples. A render-owned transaction keeps the previous completed pose and activity visible while a generator is suspended. Resume the same work without repeating a tick or dropping its simulation debt. Discard obsolete work after Stop, replacement start, world change, scene reload or disposal. The budget remains cooperative: individual geometry queries, native rendering and host scheduling can exceed it.

**Alternatives:** A Worker would require serializing the rig, collision geometry and solver state, with additional consistency boundaries. Merely reducing catch-up steps leaves the atomic-pose stall intact. The chosen generator approach follows the existing navigation/seat-fit scheduling pattern and preserves the same collision algorithm.

**Files:** `web/tycoon-contact.js` owns ordered pose generators; `web/tycoon-limb-collision.js` owns resumable sweep samples; `web/tycoon-scene.js` owns fixed-step scheduling; a focused transaction helper owns suspended visual/activity state. Relevant tests pin parity and cancellation. Arm preparation is split if measurements identify it inside the same atomic step.

## Execution

- [x] Preserve starting source, test and asset hashes and prior sealed artifacts.
- [x] Write failing tests for multiple frame resumes, atomic publication, cancellation and synchronous/generator equality.
- [x] Implement the same ordered solver with cooperative checkpoints and transactional publication.
- [x] Run focused regressions, then full Node tests and isolated build.
- [x] Obtain independent review of the changed source; resolve substantive findings.
- [x] Freeze source; run real RTX 3060 lifecycle matrix, Stop/restart and Studio cancellation, rounded-back and large 120-second timing, and full styled Studio lifecycle. Keep thresholds and failed captures. Final current UI is separately retested after its UI-only scheduler change; unchanged executed 3D graphs remain source-bound.
- [x] Record actual measurements, source hashes, errors and remaining limits in a new report and evidence bundle payload. Preserve previous sealed bundles. No Zuri DB writes, approval/status records, commit, push or deployment. ZIP stream verification is asserted only by the separate archive JSON created after sealing, not by this pre-seal source snapshot.

## Review focus

No half-solved meshes or activity/status publication; no duplicated ticks; pending work cancellation without stale resurrection; exact ordered positive sweeps; retained owed time; no unsupported real-time guarantee; actual shader/render/network stalls remain visible in evidence.

## Implementation findings

The transaction also checkpoints contact internals and both diagnostic views. Copying a root quaternion can change its equivalent Euler representation; the next solve now explicitly sets all root Euler axes to `(0, heading, 0)`. A real scaled-chair forced-suspension replay exposed and verified this fix. Final tests add external rounded-back replay and compare the public diagnostics fallback as requested by independent review.

Working-hand support, torso lean, elbow candidates and arm sweeps now share the generator chain. Explicit public solver overrides keep their synchronous behavior. An observed reentrant Stop bug and callback receiver regression have dedicated retained red/green tests. Successful cancellation during status publication suppresses remaining buffered statuses without resetting the committed contact; exceptional work resets safely.

The first8ms candidate passes734/734 tests and build508. Its GPU matrix completes95/96 numeric checks: the route-lobby failure is a13.51m false plant shift from the hidden origin to first visible spawn. A real-GPU forced-initial-suspension trace reproduces this at30/60 nominalHz. The corrected targeted replay passes both rates; the full corrected matrix remains a separate fresh run. All failed captures remain retained. Visibility counters are nominal simulation frames, not wall-clock cold-start latency.

The8ms120s rounded profile records max40ms/p9933.8ms but max pose debt3.1175s and end debt.2505s. An explicit12ms trial on that same frozen source records max50ms/p9933.6ms, max debt.3836s and end debt.0006s. These are shared-host observations, one run each, not a controlled causal comparison. The implementer selected an automatic12ms budget at30FPS and8ms at display rate, retaining explicit overrides. This is an engineering choice, not a new owner approval. The allowance stays soft.

The new candidate passes17/17 focused checks and736/736 full tests with zero skips; isolated build508 passes. Both real-chair forced-suspension parity cases pass. Independent review found no correctness blocker in the adaptive change. Fresh current-source GPU measurements are running under prefix`pose2`; old candidate results are not current qualification. The corrected full matrix selects and records actual30-mode12ms/native-mode8ms while using controlled logical time. Dota2 and other GPU memory use remain in host samples; no other process was stopped.

Final outcome (supersedes the in-progress paragraph above): current tree passes738/738 tests with zero skips and isolated build508. Fresh corrected matrix96/96 plus15floors and Stop/restart pass on RTX3060. Rounded-back/large/repeated-rounded120s RAF maxima are34.0/35.0/34.1ms, p99all33.5ms. Actual current-Studio cancellation passes4/4; three supported restarts complete. The UI-only background postTask yield has timer fallback and current-browser source binding. Component/full styled lifecycle maxima are66.7/100.0ms; the latter retains16real503errors and commandexit1. Strict33.3ms every frame remains open. A50mm chair-layout edit safely blocks in both sync/resumed replay; final positive material-edit testing does not erase that limitation. See [the final report](../../game-design/OFFICE-RESUMABLE-POSE-20261031.md) for composed source scope, raw timing, submission diagnostic, shared-host limits and retained failures. No business approval/status or Zuri write was created.

Independent harness review added explicit checks of the last published pose/contact, expected cancellation status, positive restart collision and lifecycle phases. Fresh harness copies bind fetched JavaScript, catalog/model bytes and full-app CSS responses to current disk hashes. The summary requires complete source/test manifests and command names and recomputes the unchanged timing thresholds from raw intervals; HTTP errors retain both status and path. Original harnesses and prior sealed evidence remain unchanged.
