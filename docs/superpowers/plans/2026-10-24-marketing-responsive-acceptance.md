# Marketing responsive acceptance implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this bounded verification follow-up.

**Goal:** Reconcile the merged P1 status and qualify the existing Marketing read UI at small browser viewports under T13.

**Architecture:** Retain the actual app and local built-Worker synthetic harness. No new API, dispatch, auth, grants or shared persistence. Existing full matrix remains frozen evidence; new observations are separately dated and pinned.

**Tech stack:** Existing Three.js GLB scene, HTML/CSS dialog, browser keyboard controls.

## Design and acceptance

Keep the approved fullscreen Tycoon scene, dock and contextual sheets. At 360x800 and 390x844, floor navigation, Campaign board and blank Ask overview must remain reachable; sheets may scroll vertically but controls and text must not require horizontal scrolling. Primary actionable controls target at least 44 CSS px. Desktop keyboard evidence from the merged P1 is retained separately. Viewport simulation is not physical-device, screen-reader or performance acceptance.

## Task 1 — inspect, fix only demonstrated defects, record

- [x] Inspect actual merged Worker at both viewports: Business selection, board, Ask submit/results, close and dock navigation; record DOM dimensions and screenshots.
- [x] For any reproduced defect, add a focused regression where meaningful, change the smallest relevant stylesheet/component, then retest the affected behavior. No speculative redesign.
- [x] Update game-design README and acceptance document with merged P1 source/CI and new bounded T13 observations; preserve the historical first-prototype report.
- [x] Run document link/whitespace checks; if runtime changes occur run relevant tests/build and repeat affected browser cases. Obtain independent review of the final patch; commit verified changes without modifying the original dirty checkout.

Pre-flight: README and acceptance report consume the same merged revision and browser evidence; use one evidence record. Existing historical report is not a current gate ledger.

## Limits

No new upstream/live tests, no browser performance or physical phone claims. Do not silently call all of T13 or the connected slice accepted from these two viewport checks.

## Completion evidence

Browser measurements and screenshots: reports/responsive/. Local tests427/427, build373assets,19 relative links and whitespace checks passed. Independent GPT-6 Luna Max review found no Critical/Important issues. Documentation checkboxes and observation-versus-retained-evidence wording were reconciled after review. This does not close all T13 gates.
