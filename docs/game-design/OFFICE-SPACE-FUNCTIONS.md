# Office Tycoon space functions

**Status:** local presentation proposal  
**Scope:** read-only purpose guide for the 15 local Tycoon floors

The guide explains what each saved blueprint area is for, which proposed Office
role designs are relevant, and which draft workflow steps the area supports. The
floor factory supplies the actual areas; the guide does not create a room or
place an object. `web/office-space-guide.js` is the runtime source for the
purpose and activity text.

## Local floor-area guide

`areaId` is the stable local `blueprintPlan.areas[].id`. The displayed name and
area type come from the current room plan. Role and workflow values below are
the existing semantic keys in `web/office-departments.js`; they are design
references, not staff or Agent assignments.

| Floor | Area ID | Local purpose | Role keys | Workflow step keys |
|---|---|---|---|---|
| Lobby | `lobby-public-arrival` | Welcome visitors and point them toward an Office destination. | `host` | `capture-request` |
| Lobby | `lobby-intake` | Clarify the outcome and constraints in a request. | `intake` | `clarify-intent` |
| Lobby | `lobby-private-meeting` | Review context and confirm a destination before preparing a handoff. | `evidence`, `router` | `check-context`, `confirm-route`, `prepare-handoff` |
| Lobby | `lobby-waiting` | Provide a waiting place while a visitor contacts the Lobby Host. | `host` | `capture-request` |
| Projects | `projects-delivery-hub` | Prepare scoped work and collect delivery evidence. | `lead`, `delivery` | `frame-objective`, `prepare-work-item` |
| Projects | `projects-focus-room` | Break objectives into workstreams, dependencies, milestones, and gates. | `planner` | `draft-plan` |
| Projects | `projects-dependency-wall` | Review objective scope, work relationships, and decision points. | `lead`, `planner` | `frame-objective`, `draft-plan` |
| Projects | `projects-review-room` | Inspect acceptance evidence, gaps, and delivery risks. | `review` | `review-plan` |
| Customer | `customer-public-wait` | Give visitors a place to wait without displaying case details in the open. | `care` | `summarize-request` |
| Customer | `customer-intake` | Summarize a request and check authorized customer context. | `care`, `crm` | `summarize-request`, `check-customer-context` |
| Customer | `customer-relations` | Plan lifecycle support and a customer follow-up. | `crm`, `lifecycle`, `sales` | `check-customer-context`, `draft-lifecycle-response`, `propose-follow-up` |
| Customer | `customer-private-case` | Discuss case details and review the response boundary. | `care`, `crm` | `summarize-request`, `check-customer-context`, `review-response` |
| Customer | `customer-private-consult-1` | Hold a customer case consultation and review the response boundary. | `care`, `crm` | `summarize-request`, `check-customer-context`, `review-response` |
| Customer | `customer-private-consult-2` | Hold a customer case consultation and review the response boundary. | `care`, `crm` | `summarize-request`, `check-customer-context`, `review-response` |
| Market | `market-signal-wall` | Compare dated market observations and outline their implications. | `analyst`, `insight` | `compare-observations`, `synthesize-implication` |
| Market | `market-research-pods` | Organize permitted source references and research observations. | `research`, `analyst` | `organize-sources`, `compare-observations` |
| Market | `market-source-library` | Organize market sources and flag freshness or provenance gaps. | `research`, `review` | `organize-sources`, `review-evidence` |
| Market | `market-evidence-review` | Check evidence provenance, freshness, and contradictions. | `review` | `review-evidence` |
| Marketing | `growth-content-studio` | Draft campaign content and creative direction for review. | `content`, `creative` | `draft-content`, `prepare-creative` |
| Marketing | `growth-campaign-bay` | Frame a campaign brief and its decision points. | `lead` | `frame-campaign`, `collect-decision` |
| Marketing | `growth-performance` | Draft experiment, budget, and measurement assumptions. | `performance` | `draft-measurement` |
| Marketing | `growth-campaign-review` | Review the campaign package and collect pending human decisions. | `lead`, `performance` | `draft-measurement`, `collect-decision` |
| Marketing | `growth-edit-booth-a` | Draft and refine campaign copy. | `content` | `draft-content` |
| Marketing | `growth-edit-booth-b` | Prepare creative direction and a reviewable work sample. | `creative` | `prepare-creative` |
| LINE OA | `line-oa-flow-lab` | Bound a conversation journey and draft its messages and fallbacks. | `lead`, `design` | `bound-journey`, `draft-messages` |
| LINE OA | `line-oa-channel-ops` | Prepare a channel-readiness checklist for owner review. | `ops` | `check-readiness` |
| LINE OA | `line-oa-preview-bay` | Preview a drafted flow and record cases for QA. | `design`, `review` | `draft-messages`, `review-flow` |
| LINE OA | `line-oa-qa-room` | Review flow behavior, handoffs, and failure cases. | `review` | `review-flow` |
| Commerce | `commerce-order-coordination` | Assemble authorized order context and identify exceptions. | `lead` | `assemble-order` |
| Commerce | `commerce-pricing` | Prepare a price calculation and show its assumptions. | `pricing` | `check-pricing` |
| Commerce | `commerce-fulfilment` | Plan fulfilment using available Inventory evidence. | `fulfilment` | `check-fulfilment` |
| Commerce | `commerce-exception-room` | Review order exceptions and financial completeness. | `review` | `review-exception` |
| Commerce | `commerce-exception-triage` | Gather exception evidence and prepare issues for owner review. | `review` | `review-exception` |
| Inventory | `inventory-stock-position` | Review an authorized stock position and its evidence. | `lead` | `verify-stock-view` |
| Inventory | `inventory-reservation` | Draft reservation or replenishment options. | `reserve` | `draft-options` |
| Inventory | `inventory-count-bench` | Compare submitted count evidence with ledger state. | `count` | `compare-count` |
| Inventory | `inventory-variance-room` | Review count variances and catalog-quality gaps. | `count`, `quality` | `compare-count`, `review-catalog` |
| Inventory | `inventory-count-loop` | Provide a circulation route around the central count point. | — | — |
| Inventory | `inventory-replenishment` | Draft replenishment options and review reservation release proposals. | `reserve` | `draft-options` |
| Warehouse | `warehouse-inbound-plan` | Draft an office-based inbound and put-away process proposal. | `lead`, `inbound` | `frame-process`, `draft-inbound-outbound` |
| Warehouse | `warehouse-pick-pack-plan` | Sketch a pick-and-pack process for review; this is not a warehouse floor. | `outbound` | `draft-inbound-outbound`, `review-outbound-flow` |
| Warehouse | `warehouse-capacity-board` | Organize capacity and location assumptions for the warehouse owner. | `lead` | `frame-process` |
| Warehouse | `warehouse-process-review` | Review process assumptions, exceptions, and site questions. | `review` | `review-process` |
| Warehouse | `warehouse-outbound-plan` | Draft outbound wave and pick-pack assumptions for warehouse-owner review. | `outbound` | `review-outbound-flow` |
| Warehouse | `warehouse-inbound-staging` | Organize an office-based inbound sequence and assumptions. | `inbound` | `draft-inbound-outbound` |
| Procurement | `procurement-supplier-comparison` | Compare available supplier evidence and conditions. | `supplier` | `compare-suppliers` |
| Procurement | `procurement-purchase-plan` | Frame an approved replenishment need. | `lead` | `frame-purchase-need` |
| Procurement | `procurement-po-coordination` | Prepare draft purchase-order lines for approval. | `po` | `draft-order` |
| Procurement | `procurement-receipt-review` | Compare submitted receipt evidence with the purchase order. | `receipt` | `review-receipt-plan` |
| Procurement | `procurement-staff-zone` | Prepare a purchase need and draft purchase-order lines for owner review. | `lead`, `po` | `frame-purchase-need`, `draft-order` |
| Procurement | `procurement-award-board` | Compare supplier scorecard evidence for a human decision. | `supplier` | `compare-suppliers` |
| Assets | `assets-intake-inspection` | Organize intake evidence and inspection questions. | `receive` | `inspect-intake` |
| Assets | `assets-register-wall` | Assemble identity and custody evidence for a register review. | `lead` | `assemble-review` |
| Assets | `assets-lifecycle` | Prepare maintenance, allocation, or lifecycle advice. | `lifecycle` | `prepare-lifecycle` |
| Assets | `assets-audit-room` | Compare count evidence with the asset register. | `audit` | `compare-count` |
| Assets | `assets-intake-bench` | Review condition and prepare tagging details before registration. | `receive` | `inspect-intake` |
| People | `people-private-service` | Triage a People service request in a room designed for private discussion. | `lead` | `triage-request` |
| People | `people-directory` | Review only authorized directory fields and proposed corrections. | `directory` | `check-directory` |
| People | `people-onboarding` | Format a checklist from details a human owner has approved. | `onboard` | `format-checklist` |
| People | `people-privacy-room` | Review purpose, information scope, and intended recipient. | `review` | `review-privacy` |
| People | `people-consult-room-1` | Discuss an individual service request and review information scope. | `lead`, `review` | `triage-request`, `review-privacy` |
| People | `people-consult-room-2` | Discuss an individual service request and review information scope. | `lead`, `review` | `triage-request`, `review-privacy` |
| Operations | `operations-dispatch` | Frame a service issue and a possible improvement brief. | `lead` | `frame-service` |
| Operations | `operations-schedule` | Draft service timing and resource assumptions. | `schedule` | `draft-schedule` |
| Operations | `operations-triage` | Map a process bottleneck and improvement option. | `process` | `map-process` |
| Operations | `operations-quality-room` | Review evidence and exceptions in an improvement proposal. | `quality` | `review-quality` |
| Operations | `operations-control-island` | Coordinate service planning and shift-huddle discussion. | `lead`, `schedule` | `frame-service`, `draft-schedule` |
| Operations | `operations-incident-room` | Review incident context and process-improvement options. | `process`, `quality` | `map-process`, `review-quality` |
| Knowledge | `knowledge-ingest-prep` | Select eligible sources and prepare a pipeline evidence review. | `lead`, `pipeline` | `select-sources`, `summarize-pipeline-evidence` |
| Knowledge | `knowledge-pipeline` | Review source-admission and pipeline-run evidence. | `pipeline` | `summarize-pipeline-evidence` |
| Knowledge | `knowledge-quiet-research` | Draft a cited answer from approved sources while keeping unsupported questions open. | `research` | `draft-answer` |
| Knowledge | `knowledge-citation-review` | Check claim support, freshness, and source limits. | `review` | `review-citations` |
| Knowledge | `knowledge-library-aisle` | Find and retrieve reference sources for source-selection work. | `lead` | `select-sources` |
| Platform | `platform-integration-workbench` | Review authorized connection evidence and diagnose an issue. | `integrate` | `diagnose-integration` |
| Platform | `platform-readiness-wall` | Frame a readiness issue and identify its owner. | `lead` | `frame-issue` |
| Platform | `platform-access-review` | Prepare a least-scope access request and review its evidence. | `access`, `audit` | `prepare-access-request`, `review-audit-evidence` |
| Platform | `platform-audit-room` | Review evidence lineage and unresolved risk. | `audit` | `review-audit-evidence` |

## Runtime derivation and limits

- The guide lists only areas present in the selected room's current
  `blueprintPlan.areas`; it does not fill missing areas from a department template.
- Numeric room and zone dimensions are derived separately from the current
  blueprint bounds. This guide emits no measurements and does not infer a
  clearance from an area's name or proposed purpose.
- A recognized local area ID supplies the proposed purpose, activities, role
  keys, and workflow-step keys. The area's current name and type remain as
  authored in the room.
- Placed `room.objects` are associated by their current center falling inside
  the area's current metric bounds after applying the plan's local origin. An
  object moved outside the area is omitted. Actor or Agent-linked scene objects
  are never treated as room occupants.
- Unknown area IDs get a generic description from the authored type and the
  local prop kinds actually placed in the area. Their `roleKeys` and
  `workflowStepKeys` are empty; a user-entered name cannot invent an assignment.
- A known area's display name can be changed while its ID stays stable. If the
  intended function changes, the local area ID and its guide mapping must be
  revised together.

These are proposed spatial uses for a local simulation. `OFFICE-DEPARTMENT-TEAMS.md`
defines draft role and workflow designs; they are not Agent definitions,
assignments, permissions, statuses, or executable capabilities. The guide does
not create canonical IDs: canonical Zuri IDs remain `null`. No database,
business record, Agent record, or workflow state is read or changed by the guide.

Area labels such as “private” describe a layout intention only and do not enforce
privacy or access control. Warehouse spaces are office planning workspaces, not
physical storage, receiving, or pick locations. All draft steps remain subject
to the human-review and Zuri-owner boundaries in the [department workflow
proposal](OFFICE-DEPARTMENT-TEAMS.md) and [platform integration
boundary](../ZURI-PLATFORM-INTEGRATION-BOUNDARY.md).

Some areas are subzones fully contained in a larger programme area. The local room guide labels that containment; their square-metre values overlap and must not be summed as a floor-area total. Private consultation and editing room rectangles align with their actual wall enclosures, so the dimension guide can report the usable wall-face size.
