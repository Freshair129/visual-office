# Foot contact follow-up — local Tycoon probe

Goal: measure and improve foot grounding and seat contact in the existing scene during turns, stopping and custom seating without modifying business state. The probe remains transient.

1. Add a regression harness using the actual exported skinned GLB, TycoonActivity navigation, animation mixer, actual scene transforms and sampled shoe/pelvis geometry. Reproduce turn/endpoint drift and custom-seat ground error before changing runtime.
2. Correct the animation/locomotion boundary and adapt seating only within a physically tested range; report unsupported heights clearly rather than presenting broken contact as success. Preserve collision checks and saved room data.
3. Verify per-foot world contact and seat contact during route and station lifecycle, plus browser rendering in the existing Projects scene with real WebGL. Include reduced-motion and invalidation behavior. Keep numerical sampling, renderer and coverage limitations explicit.
4. Run focused and full tests and isolated build; independently review the same changes. Record actual results and remaining limitations in the asset handoff. Do not claim live Agent, approval, or platform acceptance.

## Investigation outcome

A temporary CCD contact correction passed narrow static samples but failed the actual walking-to-seat-to-standing lifecycle near full leg extension. It was removed after independent review. The current runtime is unchanged and contact at turns, endpoints and custom-height seats remains unresolved. The repeatable Projects-scene GPU baseline and numeric limitations are recorded in `asset-source/blender/README.md` and `contact-scene-diagnostic-20261029.json`; no acceptance or approval is implied. A redesigned reachable motion system and scaled built-in chair/sofa anchors are required before implementing another candidate.

## Redesigned runtime (owner requested continuation)

Use a world-space alternating step planner, separate from exported lower-body clips. A planted ankle position AND orientation remain fixed; a swing foot moves with a lifted smooth trajectory. Visual heading is rate-limited. A closed-form two-link IK solve uses a forward knee pole, exact bone lengths and a reachable pelvis height; no unconstrained CCD or bone stretching. The existing mixer supplies upper-body motion only. Entering sit/standing waits for foot placement and pelvis convergence before progressing, and done continues through settled idle.

Measure the seat surface by a downward ray at the actual station anchor on the assembled model, using the authored/scaled height as the bounded search interval. Reject missing, sloping, mismatched or anatomically unsupported seats with an explicit local-probe error. Support bounds start at 0.35–0.80 m and are validated against full lifecycle geometry, not advertised as support for arbitrary furniture.

Files: web/tycoon-contact.js (step planning and IK), tycoon-seat-contact.js (surface measurement), scene/activity/blueprint integration; tests/tycoon-contact.test.mjs and GPU scene harness. Preserve GLBs and saved data. Run independent review, full tests and isolated build, then report measured residuals and limits.

## Redesign verification outcome

The new world-space step planner and analytic IK implementation replaces the discarded CCD experiment. Final hardware scene evidence: `asset-source/blender/contact-runtime-v1/report.json` (10 cases, full lifecycle and settled endpoint, exact source hashes). Actual bundled/custom seat surfaces are measured before admission. Full tests 460/460 and isolated build passed. Independent reviewer confirmed no remaining blocker after fail-closed rig, readiness timeout and swing-envelope fixes. See the asset handoff for supported seat bounds and open articulated collision, external-model, hardware and live-platform limits; this is local slice evidence only.
