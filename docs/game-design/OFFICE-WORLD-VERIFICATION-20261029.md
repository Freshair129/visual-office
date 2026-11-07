# Department world verification — 29 October 2026

Historical 16 × 10 m scope. The revised 24 × 16 m plans, dimensioned drawings
and current package are covered by the [30 October report](OFFICE-WORLD-VERIFICATION-20261030.md).
Evidence and package references below do not qualify that revised geometry.

This report covers the local Visual Office expansion requested on 29 October:
Lobby plus fourteen department plans, proposed role teams and workflows,
linked design identities and an offline registration package, followed by
upper-body furniture contact. It records implementation evidence, not owner
acceptance, Zuri registration, production deployment, or an operational roster.

The working tree is based on `a6fdc7e7edbf902e3f56a5b55dcb8e38cabe21c4`
and includes pre-existing changes. The Zuri contract review used
`848e422e32439edae63d9657fcfa2b976c9f8ea4`. Runtime reports retain hashes of
the source and model files they exercised; a report with changing source is
diagnostic only.

## Delivered design and data structure

- Fifteen distinct local floor programmes use a shared enclosed lift/service
  core, actual room partitions and doors, and connected circulation. See
  [the plans and architectural references](TYCOON-FLOOR-PLANS.md) and the
  [generated drawing](tycoon-floor-plans.svg).
- Sixty proposed roles belong to fifteen teams. Fifteen main workflows contain
  sixty-three steps and seventeen cross-team handoffs. Responsibilities,
  inputs/outputs, review boundaries and failure behavior are defined in
  [the team design](OFFICE-DEPARTMENT-TEAMS.md).
- Stable design UUIDs distinguish logical assets, content revisions,
  placements, floors, structure, stations, teams, roles, agent design slots,
  workflows and steps. Schema and semantic validation check shape, reference
  closure and ownership. The asset collector and package verifier additionally
  measure custom geometry and verify actual binary hashes. See
  [the handoff contract](OFFICE-ZURI-REGISTRATION-HANDOFF.md).
- Role-to-desk allocation uses explicit semantic IDs. Reordering furniture or
  adding another desk cannot silently reassign a role. Removing its designated
  desk leaves the design slot unallocated. Lobby slots remain unallocated.
- Existing saved rooms retain their authored transforms and layout. The bundled
  Tycoon chair uses the corrected catalog geometry described below, including in
  existing rooms; imported custom chairs and the Native Studio chair are unchanged.
  To apply a new plan, open the
  floor's Studio, choose **ลองแปลนแบ่งห้องใหม่**, inspect the undoable draft, then
  choose **บันทึกชั้นนี้**. Export reads saved rooms, not unsaved drafts.

## Verification in progress

The final composed-tree results and evidence paths will be recorded here after
the contact implementation is frozen and the checks have actually run.

Completed intermediate checks include the 14 handoff tests, the 8 custom-asset
tests, and 15 workspace-routing/activity tests. The earlier broad non-physics
run executed 491 tests and found two stale fixture assumptions; those fixtures
were corrected and the focused routing/activity regression run passed. This
does not substitute for the final full test suite.

The current default-design package is
[`handoff/office-world-v4`](C:/Users/suanr/workspace/visual-office/handoff/office-world-v4/README.md), with 1,330
entities, 17 exact GLBs and 21 ZIP entries. Both the JavaScript graph/archive
verifier and a separate Python standard-library check passed. The Python check
independently recomputed UUIDv5 identities, binary SHA-256 values, ZIP CRCs,
reference closure and the initially null Zuri crosswalk. Package content hash:
`07dd104454a97aa233c219674f4e90efa6c7bf3c49f111deb68d42650f5d11f9`.
Archive SHA-256:
`4b8631ab36b628fede1b936993418c5d7028b412162ed2279c4b0482f4a34b79`.
Compared with the preceding package, all shared semantic keys retain their
IDs; only the changed chair asset revision receives a new ID. Package validation
does not certify station animation or register any database record.

## Bundled chair geometry correction

The original chair's wide arm pads intersected the measured rig thighs during
descent by 3.94 mm. Its 0.551 m seat also left too large a vertical drop from
the rig's shoulders to the desktop. The Tycoon variant now uses narrower pads
and a measured seat height of 0.4792452948 m. The original Studio chair's default
geometry is retained. The exported Tycoon chair is now 0.90 × 1.00 × 0.95 m,
with 3,984 triangles in seven meshes and 126,396 bytes.
Its SHA-256 is
`f00aacb451781f78e4236f25cea2baafe01a4005b806c623b18a3e55463721ff`.

Blender 5.2.2 game-profile [QA](../../assets-source/blender/chair-clearance-qa.json)
reported zero errors and fourteen warnings. Material and wire review sheets
were inspected. Seven UV-overlap warnings are retained because this procedural
chair uses repeated primitive UVs and solid materials; unique texture baking
is not supported by these UVs. Seven coincident-vertex warnings are retained
as export seams: a separate [attribute audit](../../assets-source/blender/chair-clearance-attributes.json)
found 926 extra coincident-position vertices at 1e-5 precision, each with different normal or UV
attributes, and zero identical-attribute duplicates. Welding those seams would
change shading or texture coordinates. The wire-sheet modifier exaggerates
some split-edge joins; it is an inspection overlay, not exported geometry.

The actual previously failing thigh pose now clears the exported chair. Its
regression and existing asset/hash/dimension tests passed 5/5. This static-pose
result is separate from complete animated lifecycle verification.

An independent proxy review also found the old shoe capsules missed heel/toe
vertices by up to 1.892 mm. The refitted capsules now enclose every vertex and
triangle of both shoes, with a measured minimum margin of 2.017 mm. Each shoe
contains 168 vertices and 252 triangles. Thigh and shin proxies retain minimum
margins of 5.034 mm and 5.137 mm respectively. These are enclosure measurements
of the current exported rig, separate from the animated sweep tests.

## Invalidated diagnostic results

The first full GPU diagnostic rendered all fifteen floors and completed
78 of 94 attempted lifecycles. It is **not acceptance evidence**: source files
changed during that run, and an independent geometry review subsequently found
the lowest pelvis point 105 mm beyond the bundled chair's seat edge. A completed
animation state alone therefore did not establish a supported seated pose.
The original reports remain in `.local/department-world-full-diagnostic-1` and
`.local/department-world-smoke-diagnostic-1` for diagnosis.

The verification harness now independently measures actual skinned palm and
pelvis vertices, checks an upward seat triangle under the lowest pelvis point,
and requires contact before the work clip. It also retains foot height,
planted-foot drift, articulated collision and unchanged bone-length checks.
Every simulated frame is rendered on admitted hardware WebGL. Deterministic
30/60 Hz lifecycle runs are separate from wall-clock FPS measurement.

## Boundaries that remain open

- Zuri has no current receiver contract for this floor/scene/agent-design graph.
  Tenant, Business, workspace and canonical agent mappings are null. A future
  receiver must resolve authority and persistence ownership, validate the graph,
  perform an idempotent/versioned transaction, and return committed mappings.
  No database registration has occurred.
- Desktop palm support is the upper-body target. Keyboard/finger typing,
  arbitrary body proportions, arbitrary furniture geometry and multi-agent
  crowd interaction are outside the demonstrated contact scope.
- The three Kenney chair files are external regression fixtures with source
  topology retained. Their recorded QA still reports 10, 6 and 3 degenerate
  faces respectively (four-leg, rounded-back, swivel), plus seam warnings.
  They are not admitted production art assets or default catalog additions.
- The service reserve is a simulation placeholder. These diagrams do not
  certify building code, egress, accessibility, toilets, stairs, lift travel,
  physical warehouse operations or room-based data permissions.
- Custom assets are content addressed; changed bytes create a new custom asset
  identity. A durable editable custom catalog and manual role allocation editor
  remain future work.
- Floor snapshots use bounded browser storage, while custom GLBs use IndexedDB.
  Per-floor validation does not guarantee browser quota for fifteen richly
  textured saved floors. Failed export/storage operations must remain visible.
- GPU evidence uses one transient simulation probe and fixture data. It cannot
  establish sixty concurrent agents, live provider behavior or deployed Zuri
  acceptance.

Evidence links with a Windows drive prefix are machine-local locators in the original
qualification checkout. Raw traces and archive payloads are not portable Git files;
their measurements retain their original source binding.
