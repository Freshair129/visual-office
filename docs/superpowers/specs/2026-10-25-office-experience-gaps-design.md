# Office experience gap closure

Authority: owner requests continuation from merged main `278353f9`, including
Astra for people/animation/office arrangement. Preserve the approved warm HUD,
logo, illustrated skins, fixed camera, all Agent IDs/roles and per-floor saves.

## Audit and decisions

Main has functional legacy workspace controllers, but the synthetic Zuri harness
has no workspace storage; Chat offers a new task while Knowledge returns 503 and
Work appears empty without verified data. Do not treat unavailable as empty or
invent new Zuri APIs. Add a clear page readiness/source notice and gate unavailable
operations. Exercise existing Worker endpoints with an opt-in local-only memory
bucket and seeded synthetic workspace, shared by source app and built Worker.
No production fixture endpoint, external runner, credentials or live connection.

Chat has one permanent composer; keep drafts/attachments while navigating, pause
unnecessary polling while hidden, retain history/error/retry behavior. Work must
support existing filters, task creation, saved review/acceptance and result/chat
links in the local synthetic test. Remaining menus must be reachable by keyboard,
restore the previous presentation floor on refresh where safe, and protect dirty
Hybrid/Native Studio drafts as well as Tycoon drafts. Never persist authorized
dynamic domain context as a navigation shortcut.

## People and arrangement

Astra owns the detailed people/layout plan. Rendered physical actions are not
business status. Only an explicitly supplied bound state/source may claim idle,
working, thinking or offline; absent/unbound data is unknown. Local routines are
separately labeled, purposeful, collision-safe, and spend time at their station
instead of endless patrol. Two usable sofa cushion anchors have correct yaw,
scale, feet contact and occupancy. Existing saved rooms remain untouched; expose
the improved arrangement as an explicit template/new default, not a migration.

Planning references are inspiration, not CAD/art reuse or a compliance claim:
[Herman Miller Layout Studio](https://www.hermanmiller.com/products/workspaces/individual-workstations/layout-studio.html),
[Steelcase planning ideas](https://www.steelcase.com/resources/space-planning-ideas/),
[OSHA workstation positions](https://www.osha.gov/etools/computer-workstations/positions).

## Acceptance

Design → bounded plan → failing regressions → implementation → independent review
→ tests/build → source-app and built-Worker browser playtest. Record provenance and
explicit synthetic boundaries. Verify actual idle bubbles, purposeful routine,
separate sofa seats, no collision traversal; exercise Chat/Work/Results/Knowledge/
Team/Inbox with nonempty fixtures and error/unavailable paths. Do not claim live
Agent execution or overwrite the owner's saved Projects arrangement during tests.
