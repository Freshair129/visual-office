# Studio submission cadence and hidden draw — 31 October 2026

SSOT: Accepted scope and retained limits are in [OFFICE-MVP-ACCEPTANCE-20261031.md](OFFICE-MVP-ACCEPTANCE-20261031.md).

The 30 FPS loop now submits its last committed, validated pose before solving the next pose. Hidden draw preparation uses a scissor rectangle of 1 × 1 logical pixels on the default framebuffer while keeping the actual camera, geometry, output-color programs and full shadow targets. These captures use devicePixelRatio 1; physical pixels scale with the renderer's ratio. This removes variable solve work from the start of the draw and reduces rehearsal raster work. **It adds one rendered interval of visual latency at 30 FPS.** Native-display ordering, fixed-step physics, solver allowances, collision thresholds and assets remain unchanged.

This is local engineering evidence under the continuing user request, not product acceptance, business status, approval, Agent activation or DB registration. No commit, push, deployment or hosted CI is claimed. Work remains in the existing dirty Visual Office checkout, HEAD a6fdc7e7; unrelated work is preserved. The [previous report](OFFICE-STUDIO-FIRST-DRAW-20261031.md) and sealed archives are retained.

## Evidence and diagnosis

[Source-bound summary](C:/Users/suanr/workspace/visual-office/.local/studio-submission-20261031/summary.json), [implementation plan](../superpowers/plans/historical/2026-10-31-studio-submission-jitter.md), [review](C:/Users/suanr/workspace/visual-office/.local/studio-submission-20261031/review.md) and [current GPU draw-state check](C:/Users/suanr/workspace/visual-office/.local/studio-submission-20261031/final-draw-gpu.json) retain commands, byte hashes and raw measurements. This task's evidence has a fresh prefix and does not replace previous sealed results.

The previous 45.3 ms CPU draw-entry interval consists of 33.6 ms between callbacks plus 11.7 ms of pose work before the next draw; the previous frame had no pose work. Other 43/41.8/41.4 ms intervals similarly follow increases in solve cost. A fresh baseline records 44.7 ms. The isolated ordering change records 36.4 ms; the browser-only scissor control keeps the old order and still records 44.1 ms. That separation supports the scheduling diagnosis. The control's transformed JS response is labeled and hashed; it is not represented as unmodified production source.

The old loop updated then rendered. The 30 FPS path now draws the previous complete pose then updates. Existing pose transactions continue to roll back partial work before returning. Reduced motion applies stop/update before any draw. Elapsed time still advances if a capped draw throws, with the original error propagated when update succeeds. The order decision is captured once so a synchronous rate change cannot omit or duplicate a draw. Simultaneous render and solve exceptions still prioritize the solve error, as recorded by review.

The hidden draw still uses the actual default framebuffer. The scissor reduces its fragment area, not the viewport, camera, shader variants or geometry. It restores visibility, clears the entire framebuffer before yielding, restores the default scissor rectangle and flag before rebinding the old target/face/mip, and polls the existing zero-timeout GPU fence. Unsupported rectangle access retains full rehearsal and does not claim the optimization. No blocking GPU wait or gl.finish is added. Real WebGL state observation confirms the rehearsal default buffer is 1×1 scissored, shadow draws have scissor disabled, and the visible default draw has the original full state restored. This is GPU command/state evidence, not physical-screen evidence.

## Current actual-GPU timing

Fresh final full-app Studio captures use Chrome ANGLE/D3D11 on RTX 3060,1440 × 1000, Projects chair 1.25,30 FPS and 12 ms soft pose allowance. Each completes the ten-phase desk lifecycle through actual local Studio controls, without room/saved/Undo mutation or mutating API calls. Timing follows this task's final CPU/build/matrix and heavy trace analysis; unrelated host work remains uncontrolled. Each window is one complete lifecycle, not120 seconds.

|Capture|Max RAF ms|p99 RAF ms|Max draw-entry ms|p99 draw-entry ms|Load draw submit ms|Draw+fence ms|HTTP503|
|---|---:|---:|---:|---:|---:|---:|---:|
|final-studio-1|33.7|33.5|36.2|34.0|23.8|38.2|17|
|final-studio-2|33.6|33.5|35.1|34.3|20.6|31.6|17|
|final-studio-3|33.9|33.5|36.6|34.1|21.8|32.5|16|

RAF intervals observe browser callback/render counts. Draw-entry intervals use performance.now at the actual renderer.render boundary. Neither measures physical presentation or scanout. Probe-state visibility after a callback is kept separate from actual first visible draw-entry time in the raw final reports; the latter includes the new one-frame delay. Native initialization is moved/reduced, not eliminated. The previous final draw submission was25.3–27.0 ms and completion 36.0–38.2 ms; current submission is 20.6–23.8 ms and completion 31.6–38.2 ms. **Worst observed draw+fence completion remains 38.2 ms.** These are sequential shared-host comparisons, not an exclusive-GPU causal benchmark or power-on cold-start test.

The pre-review instrumented trace retains a 50.0 ms RAF/50.1 ms issued interval during sit. Its preceding CrRendererMain animation task lasts 32.413 ms, including measured render 5.4 ms and pose 13.3 ms; the remainder is not conclusively assigned to our code, profiling overhead or host scheduling. The maximum GPU-process task is 38.713 ms near first actor. These are CPU-side GPU-process wall durations, not hardware timestamp-query results. Terminal extraction/serialization/screenshots are excluded. This trace is explicitly pre-review source (the later changes address reduced motion/error/rate edges); its raw data is never substituted for the final timing rows.

A separate final-source instrumented lifecycle, captured after the three timing runs, records RAF maximum 33.6 ms/p99 33.5 ms, maximum draw-entry gap 38.8 ms and largest GPU-process task 32.6 ms. Current source hashes and the full trace are retained. Instrumentation and shared-host limitations apply to this result too.

All final full-app runs retain real 503 GET responses. Their commands exit 1, so they are **not clean full-app/backend passes**. No fake 200 or API write masks the missing backend. Dota2 and Ollama are present on the shared host; presence is not proof of a particular inference workload or cause for an individual long frame. No unrelated process was stopped.

## Lifecycle and verification

Current full suite: **757/757**, zero failures, cancelled or skipped tests. Isolated npm run build exits 0 with **509 embedded assets**; 214 JS inputs and 175 test/fixture files are source-bound, with 98 authored root modules matching isolated build bytes. The build uses the existing dependency tree through a junction; no clean npm ci or dependency-install qualification is claimed. The repo has no package-lock.json. This is not universal regenerated dependency-byte parity. Focused 60/60 passes; the new ordering/scissor/review regressions were observed failing first. Initial interrupted full-suite and matrix logs are retained as partial, not completed passes. Only verified owned task process trees were stopped before the review fixes; final checks use fresh paths. Independent Luna Max source review found no remaining blocker and ran no GPU or suite itself.

Actual-GPU functional matrix: **96/96 cases**, **15 floors**, including turns/endpoints, scaled and compatible external chairs at nominal 30/60 Hz. Studio cancellation **4/4** passes with three supported restarted lifecycles. Matrix time is controlled and every simulated frame rendered; it is functional evidence, not wall-FPS evidence. It ran alongside CPU checks.

The separate full-app draw-entry observer checks the pose actually handed to the renderer: **699 visible frames**, all ten phases, zero missing collision coverage/refusals, 90 work frames with valid seat support and zero seated-work clips without contact. Maximum measured matrix plant shift 0.000111269 mm, foot rest gap 0.000273416 mm, absolute seat gap 2.070 mm, palm gap 2.068–3.064 mm. This observer adds work and is not used for final FPS qualification.

## Remaining limits

- **Physical every-frame33.3 ms remains unqualified.** The measured results above, retained trace spike, native atomic work and shared host prevent that claim. No physical display/compositor, GPU timestamp, exclusive-GPU/fixed-clock or power-on/first-install acceptance is claimed.
- Scissored rehearsal retains geometry/program work and full shadow maps. Driver specialization or first full-size raster work can still occur; the later visible draw is tested, not guaranteed for arbitrary hardware or assets. Clear-before-yield and fence completion do not independently prove what a physical compositor displayed.
- The 30 FPS order trades up to one rendered interval of visual latency for steadier submission. A long native draw or solve can still delay a future callback. Existing solver budgets remain soft. Final runs draw with a suspended pose solve pending on 18/22/17 render calls; those use the last committed pose. Render cadence does not prove a new animation pose every frame.
- Real backend 503s remain open; no Zuri receiver/DB receipt, canonical Agent assignment or business approval was added. Existing local IDs/export do not constitute registration.
- Previous bounded geometry/contact limits remain: the extra 50 mm chair layout can safely refuse thigh/desk interference; inherited elbow bind overlaps, UV/seams, forward lean, incomplete torso/head/self/finger/balance checks, arbitrary meshes, moving furniture,60 Agents and other hardware are not newly qualified. This task changes no GLB or physical acceptance threshold.

The new handoff ZIP has an external archive JSON with actual stream/hash verification after sealing. That engineering archive is not an approval record. Prior sealed ZIP hashes are checked unchanged.

Evidence links with a Windows drive prefix are machine-local locators in the original
qualification checkout. Raw traces and archive payloads are not portable Git files;
their measurements retain their original source binding.
