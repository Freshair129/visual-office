# Interior partitions implementation plan

> Execute inline with superpowers:executing-plans; independent review follows implementation.

**Goal:** Draw interior walls and connecting doors, label meeting/work/rest areas, and use the same geometry for 3D, navigation, templates and each floor save.

**Architecture:** Extend optional blueprintPlan v1 with bounded metric axis-aligned partitions and rectangular area labels. Split partition spans around doors before passing them to the existing mesh/collision builders. Preserve objects and authored route points; reroute blocked authored edges through the current collision map when interior partitions exist.

**Tech stack:** Existing JavaScript, SVG authoring, Three.js, Node tests/JSDOM.

**Spec:** Owner request in this session; refinement of OFFICE-BLUEPRINTS.md direct structural authoring.

## Constraints and decisions
- Local presentation only, no Zuri or Agent mutations; Lobby unchanged.
- Up to 16 partitions, one optional 1.2–3 m doorway per partition; up to 12 room labels.
- Orthogonal walls snap to 0.1 m; T/cross junctions allowed, overlapping parallel walls and doors blocked by junctions rejected.
- Labels classify areas; they do not create business departments or imply enclosure.
- Existing templates without these optional arrays remain valid. Saving stays explicit and floor isolated.
- Draw/drag preview is transient; pointer-up creates one Undo; cancellation creates none.
- Retain current dirty tree in place. No Git delivery in this task.

## Review focus
Door clearances at junctions; resize preserving world anchors; blocked route endpoints; cancelled drawing; malformed imports and legacy plans.

## Tasks
1. [x] Add failing schema, mesh/path and persistence tests; run red. Extend validation and layout spans/area metadata; run green.
2. [x] Add failing editor tests. Implement drawing modes, selectable/draggable walls, doorway editing, room area types/deletion and automatic connection test. Wire to existing 3D probe.
3. [x] Run full tests/build, verify drawing and navigation in browser, independent review; fix findings and update source documentation/evidence.

## Execution record

- All changes executed inline, preserving the pre-existing dirty tree. No commit/push/deploy.
- Red/green cycles covered schema, sealed rooms, route detours, floor/template persistence, atomic drawing/cancel, boundary snap, minimum door, occupied room centres, second-room fields, duplicate anchors and long generated probes.
- Review fixes: strict falsey optional fields, 512-point generated probe bound, minimum 1.2 m doors on short walls, coincident-anchor explanation. Independent Luna Max final focused44/44, no important remaining finding.
- Final full328/328 tests, build327 embedded assets. Browser saved/reloaded two partitions, two interior doorways and three typed areas on Projects; walking completed, Stop restored actors. Export strict parsing retained20 objects/four avatar IDs.
- Corrected a pre-existing local SRS draft ID collision: accessibility keeps VO-FR-021; structural authoring and its source annotations use previously unused VO-FR-022. No Zuri canonical IDs changed.
- Acceptance and screenshots: reports/office-interior-20261023/ACCEPTANCE.md.
