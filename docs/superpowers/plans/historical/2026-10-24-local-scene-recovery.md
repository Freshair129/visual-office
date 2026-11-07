# Local scene recovery and remaining gates

Authority: implementation/verification plan under the approved Tycoon workflow, not a Zuri contract.
Base: main 2b09302cfab80ce688a9919cd54857f53bc8da56. Synthetic only.

## Current gap audit
- T14: GLB rejection/cache eviction and stale assemblies have unit tests; runtime has only error text. Add explicit scene retry in Office and Studio, preserving draft/selection/Undo and Business scope. Stop probes on context loss; prevent readiness while lost.
- T06/T11: blueprint, navigation, doors, multi-select, groups, layers, textures, prefab and custom GLB authoring already exist and have tests. Do not recreate them based on historical gap tables.
- T13: 360/390 viewport and keyboard sheet checks exist. Complete accessibility/device acceptance remains open.
- T15: ten-switch lifecycle and 60-second/device performance evidence remain open; no physical-device claim from desktop emulation.
- Final art/contact/material approval remains an owner visual acceptance gate.
- Dynamic domain/grants, real roster/dispatch/shared persistence and connected release remain Zuri-contract gated. P1-B is owned by the Marketing session; no contract edits here.

## Work and acceptance
1. Add failing retry tests: Office error fallback still opens objects; retry retains current room and Business without reconnect; obsolete errors cannot overwrite current scene. Studio retry retains unsaved room, selection, Undo and floor; does not save.
2. Implement accessible retry controls and context-loss movement fence; rebuild renderer explicitly. No automatic reload or storage mutation.
3. Add synthetic-only GLB 404/bad-hash controls before source/Worker dispatch. Exercise failure, retry and recovery through browser on source app and actual local built Worker. Keep real-upstream audit zero.
4. Run full suite/build, browser Marketing board/blank overview after recovery, and independent review. Record actual evidence and retain open gates.

## Ledger
- Planning: current gap inventory established; historical section 7 is not current implementation inventory.

- Implemented: explicit retry controls; runtime generation fencing; context-loss navigation fence; synthetic GLB404/BADHASH and context-loss controls.
- Regression RED: both new retry tests failed because controls were absent. GREEN: 430/430 full suite; build 373 embedded assets.
- Browser source :4184 and local built Worker :4185: GLB404, hash mismatch, WebGL context loss and recovery; Studio unsaved chair plus Undo retained; Campaign board and blank Ask READY after recovery. Evidence: `reports/scene-recovery/{browser,evidence,source-audit,worker-audit}.json` and `worker-ask.png` (local ignored artifacts).
- Ten Worker Lobby/Marketing switches: one scene canvas after each. This does not measure GPU retention or FPS.
- Remaining: physical-device/screenreader/full reduced-motion matrix; 60-second device rendering profile; visual art approval; Zuri contract gates. This batch closes the observed retry dead end, not all T13–T15 acceptance.

- Independent Luna Max review of f29ca625: no Critical/Important; minor mobile retry/camera overlap fixed by placing retry below camera controls at <=600px.
