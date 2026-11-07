# Unified Scene Sheet implementation plan

Goal: replace the rejected independent-picture/greybox workflow with one measured sheet and a true image-layer toggle.
Spec: ../specs/2026-10-24-unified-scene-sheet-design.md

- [x] Add pure measured room rebuild/sheet compiler and optional validated edition marker. Preserve IDs/count/roles and original assets.
- [x] Add same-scene render-target beauty layer and geometry-bound navigation; toggles never rebuild renderer or change camera/layout/actors.
- [x] Wire Studio rebuild/save/layer controls and existing blueprint/prop authoring to the new edition; retire mismatched active references there.
- [x] Run targeted/full tests/build, independent review and browser built Worker layer/Save/walk acceptance; retain screenshots and explicit limitations.

## Delivery / acceptance

- Shared Projects default and explicit rebuilt saved floor are now office-sheet/v1; other floors/legacy imports keep their existing editions. Automatic rebuild is bounded to 1–4 matched workstations and supported fixture inventory; unsupported input is rejected without mutation.
- Built Worker at :4185 renders the same saved sheet as Studio in the explicit local art preview. Fixed the preview baseline override that previously ignored Studio saves; actual connected non-preview local-storage guard is unchanged.
- Browser Projects: sheet=true, background src=null, 16 original objects. Paused actor motion, captured image-on and image-off: same URL, same canvas markup, exactly equal bounds for all 16 DOM object anchors. Direct unit tests additionally verify renderer/camera/mesh identity and actor mode/path preservation. Restored image and resumed simulation afterwards.
- Evidence: reports/dynamic-context/unified-sheet-art.png and unified-sheet-structure.png, unified-sheet-{unit,focused,runtime,tests,build}.log. Tests cover frustum alignment, model-derived planner/editor bounds, source-edit re-bake, water/lounge path, per-floor save, mode exit/Undo material restoration, transparent depth ordering, owned texture disposal, supported inventory placement/rejection, and marker-present/absent storage behavior.
- Independent review resolved static-line double drawing, unsupported/overlapping rebuild inventory, transparent static depth order, owned texture cleanup and reused material state on exit. Closure pass found no material blocker. Reviewer did not run checks.
- Final visual is the measured warm Soft 3D sheet baseline. It is not a claim that the rejected independently generated painting was reproduced exactly. Remaining decorative art polish can use the same geometry source without breaking registration. No live calls, PR or merge performed.

Final verification: npm test 630 passed (0 failed/skipped); npm run build passed (390 embedded assets); diff whitespace check passed; built Worker fixture audit 0 real upstream calls and no fixture violations.
