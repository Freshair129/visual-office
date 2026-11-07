---
status: implementation-design
date: 2026-10-29
---

# Tycoon upper-limb desk contact

The subsequent [30 October chair/performance report](OFFICE-CHAIR-PERFORMANCE-20261030.md)
documents the current bounded elbow-pole and paired hip/knee corrections,
fixed-step integration and their measured scope. Earlier case counts/timings
in this note describe their recorded baseline, not the later matrix.

## Measured geometry

Measurements use the runtime actor, desk and chair GLBs assembled with their current room transforms. The actor's shoulder-to-elbow length is 0.30852 m, elbow-to-wrist length is 0.26880 m, and torso-pivot-to-shoulder length is 0.4038 m. The palm mesh extends about 0.055–0.060 m below the wrist origin.

The production `desk-v3.glb` is 1.60 × 0.80 m. Its broad upward-facing desktop is `Mesh_0` at y=0.72542655 m and has 1.275637 m² of horizontal top surface. Keyboard keycaps are separate higher geometry, up to about y=0.754 m. The measured contact target is the broad desktop top; keyboard and finger typing are not demonstrated.

The current Tycoon chair GLB is 0.90 × 1.00 × 0.95 m, with a measured seat surface at 0.4792452948 m. Default paired desks use a 1.20 m center spacing. For Projects desk 1, the chair center is (3.80, 0, 2.50), yaw π, and the desk center is (3.80, 0, 3.70), yaw π. Seat, root and foot targets are measured from the assembled models at admission; the actor keeps its pelvis over the actual seat surface during work.

The compatible external-chair regression uses the Kenney four-leg GLB at scale 0.90, chair center (3.80, 0, 2.50), yaw π, and desk center (3.80, 0, 3.65), yaw π. Its asset-local approach `[-0.9349881851, -0.2925788864]` resolves to world `[4.6414893666, 0, 2.7633209978]`. This is a regression fixture; the external source manifest does not mark the model as production-admitted artwork.

## Solver and collision rules

- `TycoonArmContact` solves shoulder–elbow–wrist chains at measured bone lengths. It controls shoulder, elbow and hand rotations, plus bounded torso-pivot flex up to 0.78 rad. It does not move the pelvis or hip origins to gain reach. The controller restores the authored torso and arm pose on Stop and restart.
- The solver chooses support points from upward-facing triangles on the assembled desktop. It positions the measured palm capsule with millimetres of clearance above that surface. Palm, upper-arm, localized forearm/elbow, thigh, shin and shoe proxies sweep against the assembled desk and chair triangles. No complete desk or chair is exempted from collision checks.
- Palm and shoe proxies are fitted from the skinned GLB vertices. The elbow proxy uses a narrow forearm shaft plus a localized bulge; tests require each source joint triangle to fit inside one measured proxy. Shoe tests require each source triangle to fit inside its fitted capsule. These checks guard against under-sized collision volumes.
- Seat entry keeps planted feet until a candidate swing passes reach and swept-clearance checks. A rejected intermediate footfall is reported with `ok: false`, `deferred: true` while the approach is still in progress. The final anchor cannot defer: if it is blocked, the scene restores the last safe pose and stops the probe. Departure tries bounded walkable routes and uses a swept shoe-lift search capped at 0.42 m with a 1 mm minimum planner clearance.
- Only a measured desk contact reports `targetMode: desktop-top-support` and `status: contact`. The scene waits for that contact before starting the seated-work clip and dwell; contact acquisition times out after 8 seconds and rolls back safely. Non-desk seats use lap-clearance behavior and never run desktop IK. The current sofa fixture safely refuses when the lap path hits its front. A standalone external chair fixture completes with lap clearance, without claiming desk work.

For custom seats, model-local `interaction.approach` is a default hint; it can be infeasible after placement. A placed instance may override its approach or seat through `room.navigation.stations`, as specified in [the custom GLB design](../superpowers/specs/2026-10-24-custom-glb-design.md#model-contract-and-lifecycle). A room-navigation approach is the explicit per-floor choice: it is used as-authored and fails visibly if blocked. Facing comes from the seat's authored heading, independently of a rear or side approach. Generated candidates use a 1e-6 score tolerance, then prefer greater measured room-boundary clearance, then a deterministic local-side tie-break so Node and Chrome choose consistently.

## Diagnostics and verification

`actor.userData.limbCollisionDiagnostics` reports the latest accepted or rejected pose, hit geometry, clearance, safe root and step rollback. Its `armContact` detail reports `status`, `targetMode`, `handTargetErrorM`, `armReachRangesM`, `armBoneLengthErrorM`, `torsoLeanRad`, `contacts`, `collisionHit` and support-search attempts. `actor.userData.contact.lastCollision.swingClearancePlan` distinguishes an accepted swing from a failed deferred candidate.

Current Node regressions use assembled runtime GLBs and `TycoonScene.startStation`/`updateProbe` with the actual mixer. `tests/tycoon-contact.test.mjs` covers Projects desks 1–4 at 30/60 Hz, Customer CRM desk at 60 Hz, the authored external four-leg fixture at scale 0.90 at 30/60 Hz, exact pelvis seat support, palm support, Stop/restart restoration, bounded deferral and terminal-anchor refusal, plus shoe-triangle containment. `tests/tycoon-arm-contact.test.mjs` covers desk support at 30/60 Hz, palm/elbow proxy containment, Stop/restart, the standalone external-seat lifecycle and the bundled-sofa safe refusal. The focused real-GPU matrix also passed 8/8 actual-room desk cases on RTX 3060: Projects desks 2–4 and Customer CRM at 30/60 Hz, including structural walls. The external Kenney source remains a regression fixture rather than production-admitted artwork. These results prove desktop-top support and collision clearance; they do not prove keyboard typing or every chair/scale combination.
