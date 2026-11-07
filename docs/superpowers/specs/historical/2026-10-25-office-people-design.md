# Office people and measured layout refinement

Scope: local presentation only, requested by the owner on 25 October 2026.
Retain the warm per-object illustrated skins, isometric camera, logo, Agent IDs,
roles and inventory. Saved/imported rooms are never automatically rebuilt.

## Behavior

- Agent status comes exclusively from a transient, explicitly sourced state input.
  Accepted states are idle, working, thinking, waiting, done, offline and unknown. Missing input
  or provenance displays unknown. A physical pose never manufactures run status.
- A separate caption labels movement, sitting, drinking or resting as simulation.
  Idle actors sit quietly rather than type. Unknown/offline actors do not invent
  an automatic routine. Known idle actors may take a water/rest break after a long
  dwell, then return to their desk. There is no random patrol.
- Walking follows the existing obstacle/door navigation, uses distance-driven
  strides and eased headings, and cannot reserve an occupied seat. Explicit local
  controls remain presentation actions, never Agent commands.
- Each sofa has two measured cushion anchors with independent reservations,
  correct scale/yaw and a front approach. Explicit authored custom seats remain
  authoritative single seats. Chair/sofa surface height drives the hip position;
  fixed-length articulated legs meet the floor without shin scaling.
- Adult proportions use comparable thigh/shin lengths, a longer torso and a
  smaller head. Seated neutral poses keep elbows close and feet supported.

## Default/template layout

The existing 12 by 8 metre sheet, room doors and inventory remain. Workstations
form a coherent pair of rows with usable chair clearance; the lounge has a
scaled two-seat sofa and cooler; the board faces an unobstructed discussion area.
Only fresh defaults or explicit template rebuilds receive these transforms.

The ergonomic references are visual guidance, not a compliance claim:
[OSHA neutral positions](https://www.osha.gov/etools/computer-workstations/positions),
[HSE posture](https://www.hse.gov.uk/msd/dse/good-posture.htm).
Layout references: [Steelcase planning](https://www.steelcase.com/resources/space-planning-ideas/)
and [Herman Miller Layout Studio](https://www.hermanmiller.com/products/workspaces/individual-workstations/layout-studio.html).
Existing furniture mesh/art bytes remain unchanged; no third-party CAD is copied.

## Acceptance

Tests must prove state provenance and idle captions, no unknown-state wandering,
long idle dwell, collision-safe purposeful trips, independent sofa reservations,
rotated/scaled cushion locations, floor-contact soles, adult limb dimensions,
saved-state immutability and stable IDs. Browser appearance and live platform
qualification remain separate from synthetic model/navigation tests.
