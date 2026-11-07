# Office world: identity and registration handoff

This package is a **design registration proposal**. It contains all fifteen local floor designs (Lobby plus fourteen department keys), proposed role-based agent teams and main workflows, referenced geometry and stable external design UUIDs. A package alone does not claim any record has been registered or stored in Zuri's database.

## What the receiver gets

`manifest.json` contains a typed entity graph and `contentHash`. `schema.json` describes the envelope and permitted entity fields. `assets/<sha256>.glb` contains the exact referenced models, shared across floors rather than embedded in every snapshot. `id-map.json` lists external IDs with initially null `zuriId` mappings. The ZIP is a transport archive, not executable installation code. The JavaScript semantic validator is `web/office-handoff.js`; the independent package verification command checks both the graph and binary hashes.

| Entity | Identity and relationship |
|---|---|
| Building | One design identity and metric units |
| Floor | Floor UUID, immutable local key, level, department and building references |
| Scene | Stable scene UUID, full validated visual snapshot, content hash and floor reference |
| Room / partition / opening | UUID for each authored room area, partition and door/window |
| Asset / asset revision | Logical reusable asset UUID; revision UUID contains content SHA-256 and immutable binary URI |
| Placement | Distinct UUID for each furniture or rendered structure instance, linked to scene/floor and asset revision |
| Station | Interaction UUID, approach/seat/heading and referenced furniture/seat placements |
| Navigation route / exclusion zone | UUID for each authored route and forbidden polygon, with original points and derived metre XYZ points |
| Department / team / role | Design identity, responsibilities, inputs, outputs and proposed capabilities; not Membership grants |
| Agent design | Agent-slot UUID linked to role/team/floor/avatar and a desk station where one exists; actual Agent IDs are null |
| Workflow / step / handoff | Stable workflow and step UUIDs, assigned roles, next edges, failures, human review and department handoffs |

Transforms, colours, literal measurements, finish specifications and individual waypoint coordinates are attributes of their owning entity, not independent business records. Existing room-local object IDs remain compatibility keys, including valid mixed-case legacy IDs. New editor-created objects, authored paths and geometry receive fresh local identities; deletion does not free their old design IDs for reuse. Role-to-desk bindings are design allocations; they never create runtime agent occupants.

The default department designs explicitly map each role key to a stable desk object key; furniture ordering or added desks never silently reassign a role. A removed or unsupported designated station leaves that slot unallocated. Arbitrary saved layouts need explicit allocation editing in a future iteration. The Lobby has reception and visitor furniture, with no typed desk station. Its four role designs therefore have no station reference. These are unallocated resources, not occupied seats or remote workers inferred by the exporter.

## Coordinate and storage contract

Rendered placements use metres in a Y-up Three.js world: `x/y/z` are positions, `rotation` is yaw in radians, and `scale` is a uniform multiplier. Structural placements use `size` as the three scale multipliers applied to their bundled GLB. Bundled GLBs already contain their model normalization. Custom placements retain the measured `sourceSize`, `origin`, intended `size` and interaction descriptor; reconstruct them with the same subtract-origin and uniform height ratio defined by `normalizeCustomModel` in `web/custom-assets.js`.

Station `data.world` provides canonical metre XYZ points, `headingRad` and `seatHeightM` for database consumers. The unchanged `interaction` object preserves the older projected 2D authoring coordinates; those `{x,y}` pairs are not metre XYZ positions. The producer recomputes `world` with `tycoonWorld` and checks both representations. Blueprint areas and partitions use local metre offsets from the plan origin; `tycoon-blueprint.js` owns the fixed `(+2,+2)` translation between the older plan world and the rendered world. Store the full versioned snapshot to preserve that contract rather than inferring coordinate meanings from field names.

Station anchors are design/navigation inputs, not a recorded skeletal pose or contact certificate. The transient probe remeasures furniture and searches feasible feet, entry and hand targets for its rig at runtime; it may refuse an authored station. Those temporary adjustments and animation state are not exported as Agent records.

A custom asset's model-local `interaction.approach` is its default placement
hint. When that chair is paired with a desk, generated navigation may select
another connected approach if the default is obstructed. An explicit placed
instance override in `room.navigation.stations` is binding: an unreachable
override is rejected instead of silently replaced. The exported station
contains the selected placed-scene approach, while the asset descriptor and
snapshot preserve their respective inputs. See the custom GLB design's
[model contract](../superpowers/specs/2026-10-24-custom-glb-design.md).

Derived geometry and projected interaction coordinates use eight decimal places to avoid browser/Node math rounding differences during verification. Original authored scene snapshots are preserved. The content digest still hashes the exact canonical JSON values in the package; it is not a tolerant hash.

Local export reads and validates one multi-floor storage snapshot, using the shared writer lock when available. A missing floor gets a default; a corrupt or unsupported saved floor stops the export. The 2 MB per-room limit is an input bound, not a guarantee that fifteen textured floors fit the browser's aggregate localStorage quota. A quota failure leaves the previous saved value intact; moving room persistence to a larger store remains separate work. Custom GLB bytes already use IndexedDB.

## ID lifecycle

IDs are UUIDv5 under the fixed external-design namespace `a5008f6e-4554-49c4-b2bc-7f8084857493`, using JSON-encoded entity type and immutable semantic key. Re-export, label changes, coordinate changes and reordered output do not mint new entity IDs. For bundled catalog assets, a changed binary produces a new revision ID and hash while retaining its logical asset ID. Custom imports currently use their content SHA-256 as the catalog key: re-importing identical bytes preserves identity, while changed bytes create a distinct custom asset and revision. They do not yet have a durable user-managed catalog identity across binary revisions. A future catalog contract must explicitly map that relationship rather than guessing it from a filename. Placement IDs are scoped to a floor: moving a reusable model to a different floor creates a separate placement. Removing a design does not authorize deletion of registered data; a future receiver must compare revisions and handle removals explicitly.

Changing a semantic key is an identity migration, not a rename. Do not reuse a removed key for a different subject. The package-level content hash excludes timestamps because it represents content, not a run receipt. No `registered`, `approved`, `running` or success status is authored for the proposed agents.

## Verified current Zuri boundary

Source inspected: `Freshair129/zuri.ai`, local revision `848e422e32439edae63d9657fcfa2b976c9f8ea4`, 29 October 2026. These are source findings, not deployment observations.

- `apps/server/src/config/domains.js` defines the fourteen domain keys. `business-home` is a shell slot; `scm` and `crm` are navigation groups. Warehouse and Operations remain reserved keys. Rendering a design floor grants no domain access.
- `BusinessAgentConfig` in `apps/server/prisma/schema.prisma:376` is one standard-template configuration per Business. Its static roles are `EXECUTIVE`, `OPERATIONS`, `FINANCE_ANALYST`, `RESEARCH`, `MARKETING` in `apps/server/src/modules/agent/business-agent-template.js`. They are not five live agents. Delegation is denied by that contract.
- `GET/POST /api/businesses/[id]/agent-template` previews/applies the standard template. POST accepts a strict empty body. It cannot receive this custom roster or scene package.
- There are no current Prisma registration models/APIs for `AgentInstance`, `AgentDefinition`, `AgentVersion` or `AgentWorkRole`. Candidate PM architecture documents describe proposed concepts only.
- `Team`, `TeamMembership` and `ProjectTeam` are human group relationships. `TeamMembership` has no role column. Do not map these proposed agent teams to those tables by inference.
- `FileAsset` is a generic file reference, while `RegisteredAsset` and `/api/assets/register` concern physical assets received through an intake. A GLB is not a physical asset to register through that route.
- At the time of the original producer handoff, no Office floor/scene/model catalog receiver was found. The subsequent FR-294 receiver stores visual-design custody; generic file storage does not establish agent-roster authority.

Authority pointers: `docs/domains/agent/CHARTER.md`, `docs/domains/identity/CHARTER.md`, `docs/domains/asset-management/CHARTER.md`, `docs/domains/file-management/CHARTER.md`, `docs/requirements/FR-285.md`. All remain in the Zuri repository; this document does not duplicate their canonical requirement statements.

## Original receiver handoff checklist

1. Authenticate the caller and resolve tenant, Business and optional Workspace from authorized server context. The package intentionally leaves these bindings null.
2. Validate the schema, size limits, semantic graph, stable ID derivation, scene/placement consistency and actual model hashes. Remeasure each custom GLB and verify every placement's source bounds/origin against those bytes; do not trust descriptors alone. Store binaries in the approved file/blob store, with explicit content type and compatibility validation.
3. Decide the canonical persistence ownership for a versioned visual design and its asset catalog. Store `externalSource = visual-office-design` and `externalId` in a unique scoped crosswalk; issue internal server UUIDs rather than promoting supplied design IDs into canonical identities automatically.
4. Review role designs and workflows against real supported Agent/capability contracts. Role design, instantiated Agent, human Team and authorization grant are distinct concepts. Creating any future runtime Agent requires that separate contract and authorized operation.
5. Apply accepted changes transactionally with expected-version conflict detection, idempotency keyed to source/package/content, audit attribution and explicit rejection details. Retries must return the same committed mapping; a changed content hash is a new revision requiring conflict handling.
6. Return committed external-to-internal mappings and versions. Only then can Office display registered bindings. An accepted file upload alone is not registration or activation.

The subsequent Zuri FR-294 implementation defines a scoped receiver and separate migration. Their local implementation and validation do not imply a deployed receiver or a registration in a real Business.

The receiver must pin the reviewed producer/verifier revision for this first `v1`
contract. Validation includes the design catalog and scene-derivation rules,
not just the JSON field shape. Future changes to those rules or catalog
completeness need an explicit contract revision or migration. Ordinary authored
coordinate changes remain scene-content revisions with stable design IDs.

## Local reproduction

From the Visual Office repository, use `node scripts/build-office-handoff.mjs <new-output-directory>`. The builder rejects an existing output directory to preserve prior deliveries. It generates the contract schema and its browser copy serially, then verifies every GLB hash and the entity graph before writing the package. `node scripts/verify-office-handoff.mjs <output-directory>` independently reads the ZIP central directory and local entries, checks CRCs, paths and file inventory, and compares archived JSON/models with the validated directory package and current producer schema.

In Office, open **ทีมและ Workflow** on a floor. The ZIP download remains available. The handoff button uses the trusted Zuri origins in `web/office-zuri-config.json`; it defaults to an empty list and is disabled until the deployment configures it. Zuri must configure the exact Office origin in `OFFICE_HANDOFF_ALLOWED_ORIGINS`. For an isolated local preview, `OFFICE_HANDOFF_ZURI_ORIGIN` configures the Office preview process without changing the deployment file; use distinct loopback hostnames for Office and Zuri. Choose the configured Zuri, then select an eligible Business Workspace and explicitly submit in Zuri's own popup. A successful result follows a readback of the committed revision and IDs. Zuri stores a bounded retry key and original version locally, scoped to the current principal, Workspace and SHA-256 of the exact ZIP. Reopening the popup in the same browser profile with the same session principal, Workspace and bytes reuses the original command; the server still rechecks authorization. If that command is conclusively stale, Zuri verifies the current authorized version and replays the original command before offering an explicit new attempt. The same ZIP otherwise replays its existing revision, including after a later revision; it does not intentionally restore old content. Changed ZIP bytes, another user, a cleared browser profile or another browser cannot recover the old command. If secure browser locking or local storage is unavailable, submission is refused. At most 100 retained commands are allowed; reaching the limit refuses a new command. The session and CSRF token remain with Zuri. Office exports saved local rooms (or defaults for unsaved floors), not uncommitted Studio edits or live Business data. Save a Studio draft explicitly first.

While the handoff is pending, the originating Tycoon scene pauses draw
and simulation updates; completing the handoff or closing the popup resumes the same scene
with a reset frame clock. An open, unresponsive popup therefore keeps that scene
paused until it is closed. This does not change saved floors or imply a new FPS
qualification.
