# Department world and registration handoff implementation plan

Disposition (7 November 2026, lead under the owner's delegation): Delivered: department floors, team designs, the validated design handoff (office-handoff*) and desk/arm contact landed in later merged work (archived repo #7, #13 and Tycoon contact fixes). Remaining hardware/device limits are tracked under G4/G6 in SYSTEM-GAP-ANALYSIS.md.

> For agentic workers: execute the independently owned tasks below, review the composed patch, and preserve unrelated work.

**Goal:** Complete local floor designs for Lobby and all fourteen department keys, role-based team/workflow designs, and a validated identity-linked handoff that Zuri can inspect for registration; then implement and verify desk/upper-limb contact.

**Architecture:** Existing Three.js room factories, Studio and scene renderer remain in use. Design UUIDs identify building, floors, rooms, structure, asset definitions/revisions/placements, interaction stations, department teams, role designs, agent slots, workflows, steps and handoffs. Actual Zuri tenant/Business/AgentInstance IDs remain server-owned and initially unbound. The export is a design registration proposal, not a new Zuri API or a claim of persistence.

**Tech stack:** Browser ES modules, Three.js, Node test runner, JSON Schema, deterministic UUIDv5 identities, local JSON/files, hardware-backed Chrome scene verification.

**Design/source basis:** User request of 29 October 2026, `TYCOON-FLOOR-PLANS.md`, `ZURI-PLATFORM-INTEGRATION-BOUNDARY.md`, current Zuri domain registry/charters and BusinessAgentConfig standard-template contract. Current source has no AgentInstance registration model/API; candidate Agent architecture is design context only. Existing role proposals are inputs for refinement, not an authoritative deployed roster. User asked to perform this work; implementation choices below are engineering decisions, not fabricated approvals.

## Sequence and ownership

- [ ] Floor worker: document programme and build fifteen local room factories with shared core/circulation and department-specific rooms; retain semantic object IDs and legacy saves. Validate all stations, room doors, bounds and routes, render all-floor diagrams. The upper-contact investigation subsequently requires shorter desk reach in new defaults; existing saved geometry remains unchanged.
- [ ] Team worker: document and encode each department's role responsibilities, inputs, outputs, main workflow, human decision boundaries, failures and cross-team handoffs. No operational Agent status or grants.
- [ ] Integrator: expose all local designs through existing Studio/view without routing unimplemented domains to Projects data; separate local team/workflow panels from connected records.
- [ ] Integrator: issue deterministic design UUIDs, build identity/relation manifest and offline asset package with hashes, add schema/semantic validator and readable handoff matrix. Bind every reference; reject duplicate IDs, invalid ownership, missing assets, orphan steps and unsupported payload fields. No DB mutation.
- [ ] After floor/team/handoff design is implemented: upper-body worker owns desk-contact measurement, arm/hand IK and articulated collision, then full sit/work/stand/exit regressions. Keep earlier leg-contact proof intact and do not weaken collision just to force a pass.
- [ ] Verify: full local tests/build, all fifteen production-scene navigation/station checks on hardware GPU, hand/desk cases at 30/60 Hz, body-contact failure behavior and UI export round-trip. Independent review, source hashes and explicit remaining limits.

## Identity and receiver rules

The handoff uses immutable semantic keys under one fixed design namespace. Display labels and coordinate edits do not change identities. Bundled catalog content changes create asset revision IDs/hashes while retaining logical asset IDs. Custom imports currently have content-addressed catalog identities: changed binary bytes create a new custom asset as well as a revision, pending a future durable custom catalog contract. Furniture placement IDs differ from reusable asset IDs. Original local object keys remain compatibility keys in scene snapshots; no canonical Agent metadata is inserted into room JSON.

Receiver registration must authenticate and resolve a real tenant/Business, validate canonical domains and supported role/capability contracts, map external design UUIDs to its own DB IDs, perform an idempotent expected-version transaction with audit, and return committed mappings. This exporter has no receiver endpoint or database credentials. Missing receiver contracts are identified in the handoff instead of invented.

## Review focus

- A design role or seed catalog code must never appear as a live AgentInstance or an execution grant.
- Re-exporting unchanged designs must preserve IDs; changing geometry must not silently retain stale hashes.
- Every placement, station, workflow step and team/role relation must resolve within the package and the correct floor/department.
- New local floors must not fetch/display Projects or Marketing business records under the wrong department.
- Saved local rooms must survive floor expansion, draft replacement, Undo and failed exports.
- Hand contact must respect rig reach, floor contact and desk geometry throughout transitions; unsupported poses must report failure safely.

## Verification record

Actual results and open receiver/contact limitations will be recorded after execution. An unchecked item is not a PASS.
