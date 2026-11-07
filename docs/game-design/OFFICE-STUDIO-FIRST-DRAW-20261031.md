# Studio first-draw trace — 31 October 2026

The actual default-framebuffer draw is now prepared behind the hidden scene-load
gate, cleared before yielding, and followed by a nonblocking GPU completion fence.
Final fresh Studio captures peak at **33.5 / 33.6 / 34.0 ms**
(p99 33.5 / 33.5 / 33.5 ms), compared with the prior100.0ms
result. These captures reduce the reproduced startup spike.
**Every-frame33.3ms remains unqualified.** CPU render submission and physical
presentation are separate measurements; a good RAF result does not establish both.

This is local engineering evidence under the user's continuation request, not a
business status, approval, DB registration, Agent activation or visual acceptance.
No commit, push, deployment or hosted CI result is claimed. Work remains on
test/zuri-office-parity-harness at a6fdc7e7edbf902e3f56a5b55dcb8e38cabe21c4,
preserving the existing dirty tree. [The preceding report](OFFICE-RESUMABLE-POSE-20261031.md)
and its sealed ZIP remain unchanged.

Evidence index: .local/studio-trace-20261031/summary.json and its source-bound
summarize.mjs; raw traces/profiles use baseline-traced, candidate-traced and
reviewed-traced prefixes. Actual command outcomes are in check-commands.json,
world-commands.json and final-timing-retry-commands.json in that same directory.

## Trace diagnosis and controls

A fresh pre-fix Chrome trace reproduces a133.3ms RAF interval. Near first visible
actor, Chrome's CrGpuMain processes a WebGL GPUTask for83.694ms
at +627.064ms after click. It overlaps the
123.7ms render-issued gap. The largest measured pose call is
15.5ms and render CPU call24.1ms;
the Long Tasks observer reports none. CPU profile and trace are retained.
The larger terminal trace tasks from returning/serializing diagnostic data are
outside the measured render window and are excluded from the derived comparison.

This identifies a first-use GPU-process command-processing problem. It does not
identify which native driver compile/allocation/scheduling operation consumes
each millisecond. GPUTask duration is CPU-side wall time in Chrome's GPU process,
not a hardware timestamp-query duration or proof of exclusive GPU occupancy.

Separate controls retain the original source and real HTTP failures:

| Control | Max RAF ms | p99 ms | >35ms | Button ms | First actor ms | Extra draw prep ms | HTTP503 |
|---|---:|---:|---:|---:|---:|---:|---:|
|baseline-traced|133.3|33.5|2|1.6|588.0|0.0|23|
|prescroll-control|100.0|33.5|1|1.3|360.1|0.0|17|
|warm-control|66.7|33.5|3|1.4|510.2|582.2|17|
|default-draw-control|33.6|33.5|0|0.8|245.2|109.2|17|

Pre-scrolling the canvas still produces100ms, rejecting a scroll-only explanation.
An offscreen render reduces that one capture to66.7ms. The pinned Three source
uses LinearSRGB output for ordinary render targets, while the default framebuffer
uses renderer.outputColorSpace. The offscreen control therefore does not rehearse
the exact default-buffer program/draw path. The exact default-buffer draw/clear
control completes at33.6ms with109.2ms extra preparation in that capture.
These are sequential shared-host observations, not an isolated causal benchmark;
the trace, source distinction and control results together motivate this narrow fix.

## Implementation and verification

New tycoon-draw-preparation.js draws the actual scene and transient actor only
while the stage is hidden for loading. It restores actor/stage visibility and
submits a full clear synchronously before any event-loop yield, restores default
scissor state before rebinding the old target/face/mip, then polls clientWaitSync
with zero timeout. No gl.finish or blocking GPU wait is introduced. The fence
covers the rehearsal and clear; its completion is not physical-screen evidence.

Timeout, missing/failed fence APIs, context loss and supersession remain explicit
incomplete/cancelled results. The existing legacy fallback may still reveal a
scene when preparation support is unavailable, and its diagnostics do not claim
completion. Generation checks prevent stale loads from publishing ready or
replacing current diagnostics. Context loss keeps the current scene unready.
No collision geometry, tolerance, pose algorithm, frame pacing, asset or business
contract changed in this continuation.

The initial seven regressions failed before implementation. Independent static
review found a non-default-target scissor restoration edge; an additional RED
test reproduces it, and the fix restores the global flag before target binding.
Clear-exception restoration and pending-fence/replacement tests were also added.
The first composed focused run retains35/37: the existing shader-only fixture
needed real draw/fence interfaces, and an overwritten primary fallback reason
was corrected. Neither failed log was deleted or relabeled.
Focused verification passes41/41. Final current tree passes **749/749 tests,
zero failures/skips**, and isolated npm run build exits0 with **509 embedded assets**.
The manifests bind 174 test/fixture files and 214 JS inputs;
all98 authored root modules match isolated build bytes. This is not a
claim that regenerated dependency bundles are all byte-identical to their inputs.
Independent final static review found no remaining scoped blocker and did not
run the GPU/CPU suites itself. Source/test hashes and review notes are retained.

## Final current-source hardware runs

Hardware WebGL is Chrome ANGLE/D3D11 on RTX3060,1440×1000 Studio viewport.
Each final capture uses a fresh browser context, actual full preview shell/CSS,
Projects draft chair1.25 configured through controls, 30FPS mode and12ms soft
pose allowance. Each completes the full desk lifecycle with no motion failure,
no room/saved/Undo mutation and no mutating API request. These are complete
single-lifecycle windows, not120-second profiles.

| Final capture | Max RAF ms | p99 ms | >35ms | Button ms | First actor ms | Draw prep ms | HTTP503 |
|---|---:|---:|---:|---:|---:|---:|---:|
|studio-final-retry-1|33.5|33.5|0|3.6|369.8|36.0|17|
|studio-final-retry-2|33.6|33.5|0|1.2|439.2|38.2|17|
|studio-final-retry-3|34.0|33.5|0|1.3|415.5|37.4|17|

Every HTTP failure above is retained as a real503 response; commands exit1,
so these are not clean full-app/backend passes. Per-path counts are in summary.json.
The preview has no live backend configured. No fake200 response or business
mutation substitutes for that missing integration.

The reviewed-source diagnostic trace separately records max RAF35.1ms,
p9933.5ms, maximum CPU render-issued interval45.3ms,
maximum pose call15.1ms and render call10.1ms.
Largest first-second GPU-process GPUTask is16.006ms
instead of83.694ms in the pre-fix trace. This is additional instrumentation;
its intervals are not physical presentation times and are not silently substituted
for the uninstrumented final RAF table. The residual issued interval already
prevents a claim of every-frame33.3ms delivery.

All intermediate runs remain retained. The first candidate, before scissor review,
records33.6/50.1/33.6ms. Reviewed-source preliminary runs and trace are separate;
one preliminary run overlapped this task's trace parsing around06:48Bangkok.
That known overlap is recorded in timing-scope.json. Final timing runs were
captured only after this task's full tests/build, functional matrix and heavy
trace processing ended. Shared external host use remains uncontrolled.
The first final-window attempt has three retained connection-refused logs and
no FPS data because the4197preview listener disappeared. A detached background
restart was rejected by automatic tool review (only 'blocked by policy' was
supplied); a safer attached exec preview with the same bridge-disabled flags
restored the listener. Fresh retries use new filenames; no failed run was
overwritten or represented as a measurement.

## Contact and cancellation in the real scene

Fresh current-source actual-GPU matrix passes **96/96 cases and15floor checks**:
department desks, turns/routes, scaled and compatible external chairs at nominal
30/60Hz. Every simulated frame is rendered with controlled logical time; this
matrix is functional GPU evidence, not a wall-FPS benchmark. It ran alongside
CPU verification; its timings are not used for performance acceptance.

Existing contact/collision thresholds remain unchanged. Every visible frame has
positive collision/capsule coverage. Max planted-foot shift0.000117295mm,
foot gap0.000273416mm, absolute seat gap
2.070mm, palm gap
2.068–3.064mm,
and0 work-clip frames without contact.
The observer compares consecutive visible poses and retains the prior nominal
visibility guard; it does not turn hidden frames into contact evidence.

Current actual-GPU cancellation passes4/4: Stop, material edit, floor change,
dispose. The three supported restarted lifecycles complete. Saved state/Undo
are preserved as applicable and no stale work resumes. Unit integration tests
additionally hold a GPU fence pending and prove hidden/unready state and safe
replacement publication; physical compositor presentation is not proved by mocks.

## Remaining limits and delivery

The new barrier moves first-draw initialization into explicit scene loading;
it does not remove that work or guarantee33.3ms during cold loading. Native draw/
clear submission can itself exceed one frame. Driver caches are not cleared,
power-on/first-install cold start is not qualified, clocks/power are not forced
and desktop/Ollama processes were observed. No unrelated process/model was
stopped. Hardware timings are shared-host observations, not universal acceptance.

Strict per-frame delivery, physical presentation, exclusive hardware, API health,
arbitrary external models/edited layouts and moving furniture remain open.
The prior extra50mm chair edit still safely blocks a thigh against the desk;
it was not changed or relabeled by this rendering fix. Elbow bind overlaps,
UV/seam warnings, incomplete torso/head/self/balance/finger coverage and sixty
concurrent Agents remain outside this bounded verification. No new visual or
AAA acceptance is claimed. The existing ID/floor handoff remains a local design
export without a Zuri receiver/DB receipt.

Current source hashes:

| File | SHA-256 |
|---|---|
|web/tycoon-draw-preparation.js|5082650f24408a343ac8d5a50a399300a3813452a2272e7f5f366b13338c1f94|
|web/tycoon-scene.js|d2f57c06c82e594c95b277c112bd7869636ac266c1a1129830e5c3004bb74612|
|web/tycoon-studio.js|0e0725490fc446dc8799fa2df2a2af2112d83098826aec0c79ba95a5ad4a7bec|
|web/tycoon-render-preparation.js|112f7625d66c863f90be1bdbd5e1fc2ba8c2ed97f724b1febd17e79f8f97fb6c|
|tests/tycoon-draw-preparation.test.mjs|ce02c620875f3ad305cbad3f4bfa7dabc6286d720ccde9b641a96b9406e54d89|
|tests/tycoon-scene-render-preparation.test.mjs|a62bb0feb2a0e94cba4249de66a767ef01333d525512a59add8f49948893f74b|

The new evidence archive is handoff/office-studio-first-draw-20261031-evidence.zip,
with an external archive JSON recording ZIP hash and verified payload hashes.
It contains original traces/profiles, failed and corrected runs, source snapshots,
current source/tests, reports and selected screenshots. A complete raw capture
hash inventory identifies the selected captures; all raw world PNGs remain on
disk. Byte-integrity evidence grants no approval. The three prior sealed archives
remain unchanged. Preview remains http://127.0.0.1:4197/ with bridge disabled.
