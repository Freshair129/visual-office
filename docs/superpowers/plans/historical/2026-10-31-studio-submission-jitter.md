# Studio submission cadence and load draw plan

**Goal:** Reduce the observed45.3ms draw-issued gap and cold hidden-draw cost; verify complete actual-GPU lifecycles without inventing acceptance or approval.

**Spec:** Current owner continuation and [previous measured limitations](../../../game-design/OFFICE-STUDIO-FIRST-DRAW-20261031.md). The owner has repeatedly requested execution; this plan records engineering decisions, not new owner approval.

**Architecture:** Retain the existing Three.js renderer and resumable transactional solver. Trace work boundaries before choosing changes. Prior trace's45.3ms gap is33.6ms between callback pose starts plus11.7ms added pose work; later gaps similarly track pose-cost differences. For30FPS, test drawing the last committed validated pose before advancing the next pose; acknowledge one render of additional visual latency. Native-display mode retains current ordering. Keep lifecycle clock, elapsed time, solver allowance and physical validation unchanged. Observe the actual pose at render entry, not only state after callback.

**Load experiment:** Test a1x1default-buffer scissor while preserving exact output-color programs, camera/geometry and full shadow-map targets. Clear the whole default framebuffer and restore global scissor rectangle/flag before rebinding any target. Adopt only if actual GPU evidence supports lower cost without reintroducing first-visible stalls. Unsupported rectangle access retains full rehearsal and honest diagnostics. Do not hide preparation time or substitute loading results for lifecycle timing.

**Scope:** web/tycoon-scene.js, web/tycoon-draw-preparation.js and focused tests. Diagnostics/new report live under a new studio-submission evidence prefix. Preserve pre-existing dirty work and every sealed ZIP. No GLB, collision thresholds, business contracts, backend, DB, Agent state or approval changes. No commit/push/deployment requested.

## Execution

- [x] Snapshot original source and archive hashes; inspect prior raw work samples and capture current baseline including GL-load diagnostics.
- [x] Run browser-only scissor control and compare draw submission/completion/startup costs.
- [x] Add failing behavior tests for committed-pose rendering, frame skips/disposal, state restoration and exceptions; implement supported minimal changes.
- [x] Focused tests, independent fresh-context review, full repository tests and isolated build; retain failed checks.
- [x] Actual RTX3060 full lifecycle matrix, cancellation and full Studio fresh runs. Separate RAF cadence, real draw-entry CPU cadence, load cost, rendered-pose contact and GPU-process walltime from physical presentation.
- [x] Source-bind evidence/report all remaining gaps, real preview503responses and measured regressions. Seal a new bundle only after validation.

## Review focus

Drawing previous committed poses must never draw partial/invalid solves or lose elapsed simulation. Reduced motion, disposed scenes and frame skips preserve behavior. Scissor rectangle/target-specific state restores even on draw/clear errors. First visible draw, shadow maps and actual contact still need hardware checks. No trace/RAF/fence metric is a physical scanout guarantee.

## Decisions and results

Native inline execution follows the continuing request; independent review is a separate delegated read-only check. Final results will link the evidence report here. This plan is not a task admission or product status registry.

Final observations: [source-bound report](../../../game-design/OFFICE-STUDIO-SUBMISSION-20261031.md). 757/757tests and isolated build509pass; GPU96/96,15floors,cancellation4/4. Final RAF33.7/33.6/33.9ms; submission36.2/35.1/36.6ms. Physical every-frame33.3ms and real503backend health remain unqualified. Archive stream validation is asserted only by the post-seal external archive JSON.
