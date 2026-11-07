# Studio first-draw trace implementation plan

**Goal:** Diagnose the remaining Studio100ms interval with a Chrome trace, reduce it without weakening pose/contact validation, and rerun actual-GPU lifecycles. Constant33.3ms is a measurement target, not a presumed result or business approval.

**Spec:** User continuation request and [prior result/limits](../../../game-design/OFFICE-RESUMABLE-POSE-20261031.md). Existing local Studio draft/save and Zuri platform boundaries remain in force.

**Design:** Preserve current source and sealed evidence. Trace CPU tasks, renderer/compositor/GPU tasks and scroll timing. Initial trace reproduces a133.3ms interval with an83.7ms WebGL GPU task near first visible actor, not a JavaScript long task. A pre-scroll control still records100ms. A representative offscreen draw records66.7ms but uses a different output-color shader path in pinned Three. Test a default-framebuffer draw/clear plus nonblocking GPU fence before any production change.

If the default-draw control supports this diagnosis, prepare one representative draw of the actual scene and transient actor while load readiness is gated. Restore visibility and clear the default buffer synchronously before yielding, then poll a WebGL2 fence with timeout/context/generation cancellation. Do not call gl.finish or publish a temporary actor pose. Report unsupported fence paths as incomplete rather than claiming warmup. This shifts initialization into explicit load preparation; it does not eliminate cold-start work or guarantee driver latency.

**Ownership/allowlist:** New `web/tycoon-draw-preparation.js` owns draw/clear/fence lifecycle; `web/tycoon-scene.js` integrates it before readiness. Focused tests own cancellation, restoration and honest incomplete outcomes. No asset, collision threshold, pose algorithm, auth, DB, runtime/backend or canonical business status changes. Existing dirty work is retained. Maximum two production candidate iterations within this scope; broader redesign requires a new source-backed plan.

## Execution

- [x] Snapshot source/old ZIP hashes; reproduce with trace and CPU profile; retain real503 errors.
- [x] Reject scroll-only explanation; retain offscreen and exact-default-path controls.
- [x] Confirm default-path control outcome and add failing ordering/cancellation regressions.
- [x] Implement the smallest justified draw-preparation barrier and integrate with load generation/context lifecycle.
- [x] Run focused regressions41/41, independent static review, current full tests749/749 and isolated build509.
- [x] Capture current source on actual RTX3060: final Studio RAF33.5/33.6/34.0ms, diagnostic trace, pending cancellation4/4 and full96/96case/15floor contact matrix; retain failures and actual503s.
- [x] Report RAF and CPU submission observations separately, cold preparation cost, source binding, open limits and no fake approval/status. Prepare a new evidence bundle payload. Actual ZIP stream verification is asserted only by its external archive JSON after sealing, not by this pre-seal plan snapshot. Prior bundles remain immutable.

## Measured outcome

[Final report](../../../game-design/OFFICE-STUDIO-FIRST-DRAW-20261031.md): first-use default-buffer draw was missing from shader-only preparation. ChromeGPU-process task83.694ms near first actor becomes16.006ms in the current diagnostic trace. This is CPU-side command-processing walltime, not a GPU hardware timestamp. Final actual-GPU complete Studio lifecycles have p99all33.5ms; physical every-frame33.3ms remains unqualified because submission jitter, native calls, cold initialization and shared-host behavior remain. Current full-page runs retain17real503s each and commandexit1, so backend health is not passed. A lost4197listener caused3connection-refused attempts with no FPS data; attached preview recovery and new retry files preserve those failures. No business approval/status, Zuri DB write, commit, push or deployment was created.

## Review focus

No temporary pose survives an event-loop yield; restore target/scissor/visibility even on exception, context loss or supersession. No stale generation sets ready. Fence completion is actual GPU command completion for warmup only, not physical presentation evidence. Unsupported/failed/timed-out synchronization is not completion. No diagnostics become authority to register Agents or persist business state.
