# Office department teams and workflow designs

**Status:** design proposal for the Visual Office Zuri registration handoff. It
defines semantic team, role, workflow, and step keys for fourteen operational
department floors plus the `lobby` service floor. It does not register or run
Zuri agents.

## Authority and scope

The floor keys follow the current Zuri domain registry in
`apps/server/src/config/domains.js` at source checkout
`C:\\Users\\suanr\\workspace\\zuri.ai`, revision
`848e422e32439edae63d9657fcfa2b976c9f8ea4`. The registry contains the fourteen
operational keys already projected by Visual Office's `web/domain-office.js`:

`projects`, `customer`, `market`, `growth`, `line-oa`, `commerce`, `inventory`,
`warehouse`, `procurement`, `assets`, `people`, `operations`, `knowledge`, and
`platform`.

The Lobby uses the Office-local semantic key `lobby`; `business-home` appears in
its `sourceRefs` only as the Zuri shell-level source. Lobby is not a new domain.
`SCM` and `CRM` are navigation groups in Zuri's `DOMAIN_GROUPS`, not additional
floors. The complete 15-key handoff therefore contains fourteen domain floors
and one Lobby.

Zuri is the authority for domain definitions and Business data. The reviewed
source does not provide AgentInstance, AgentDefinition, AgentVersion, or
WorkRole Prisma models or a department-role registration API. The implemented
Business Agent Factory instead applies one standard five-role
`BusinessAgentConfig`; its `/api/businesses/[id]/agent-template` POST accepts a
strict empty body and does not accept a custom roster. The candidate Project
Manager architecture's AgentDefinition/AgentVersion records are proposals, not
an active contract. Existing `Team` and `TeamMembership` records represent
human groups and do not supply this agent-role roster. This document and
`web/office-departments.js` therefore describe proposed team roles and draft
workflows for presentation and future registration planning. They do not
establish an API contract, roster, granted capability, or live workflow.
`sourceCatalogCode` carries only a seed/catalog reference copied from the
earlier `sourceAgentId` field in `web/domain-office.js`; it is not an
AgentInstance ID and must not be used as one. There are no assigned human names,
live statuses, permission codes, or minted UUIDs in this design. Semantic keys
are the inputs for the parent registration handoff's deterministic design-ID
mapping.

The registry marks `warehouse` as `soon` and gates it on the `physicalStock`
Business capability. Some location and transfer behavior belongs to Inventory;
the dedicated Warehouse slot remains reserved for bins, put-away, picking, and
stocktake campaigns. The registry also marks `operations` as `soon`. Their
teams and workflows below are process-design proposals only. Neither floor
claims live operational coverage.

The `platform` key is a Business-shell presentation entry for settings,
integrations, users, and audit. It is not the installation-operator-only
`platform-control` domain. The Lobby is a service-intake and routing design,
not an owner of Business data or a new Zuri domain.

## Source basis

`sourceRefs` in the data module use repository-relative paths and, where
available, exact Zuri IDs. The source checkout above pins this review snapshot.
The role boundaries follow the Zuri domain charters and registry; the workflows
are Visual Office proposals shaped around those boundaries. The current Agent
Factory boundary is documented in `docs/change-requests/agent-factory/AGENT-FACTORY-V1.md`
and `docs/appendices/A-api-spec.md#/api/businesses/[id]/agent-template`; the
candidate PM AgentDefinition/AgentVersion schema is explicitly marked proposed
in `docs/architecture/project-manager-system/18-DATABASE-TABLES-AND-ERD.md`.
`apps/server/prisma/schema.prisma` models `Team` and `TeamMembership` as human
groups, without a department agent role roster.

| Team key | Canonical source basis | Important ownership limit |
|---|---|---|
| `lobby` | `apps/server/src/config/domains.js#business-home`; `ZAI:FR-060`; `docs/decisions/ADR-013-BUSINESS-FIRST-OVERVIEW-AND-HR-DOMAIN.md` | `business-home` is a cross-domain landing projection; it owns no domain workflow data. `lobby` is only the Office design key. |
| `projects` | `apps/server/src/config/domains.js#projects`; `docs/domains/project-manager/CHARTER.md` | Plans and project execution belong to Project Manager; a plan draft is not approval or execution authority. |
| `customer` | `apps/server/src/config/domains.js#customer`; `ZAI:DOMAIN-CRM`; `docs/domains/crm/CHARTER.md` | CRM owns customer/conversation records; it does not decide identity or permissions. |
| `market` | `apps/server/src/config/domains.js#market`; `ZAI:DOM-MARKET-INTELLIGENCE`; `ZAI:ADR-038`; `docs/domains/market-intelligence/CHARTER.md` | Market Intelligence owns translated market observations and derived signals, not provider ingestion, canonical knowledge, stock, procurement, or orders. |
| `growth` | `apps/server/src/config/domains.js#growth`; `ZAI:DOM-MARKETING`; `docs/domains/marketing/CHARTER.md`; `docs/change-requests/CR-018-MARKETING-DOMAIN-DESIGN.md` | Marketing drafts plans and content; a proposal does not authorize spend, publication, or outbound sends. |
| `line-oa` | `apps/server/src/config/domains.js#line-oa`; `ZAI:DOMAIN-LINE-OA-STUDIO`; `ZAI:ADR-100`; `docs/domains/line-oa-studio/CHARTER.md` | LINE OA owns its channel experience and execution boundary; this design does not send or publish messages. |
| `commerce` | `apps/server/src/config/domains.js#commerce`; `ZAI:DOM-COMMERCE`; `ZAI:ADR-065`; `docs/domains/commerce/CHARTER.md` | Commerce owns orders, pricing calculations, payments, and sale documents; proposed steps do not commit financial changes. |
| `inventory` | `apps/server/src/config/domains.js#inventory`; `ZAI:DOM-INVENTORY`; `ZAI:ADR-074`; `ZAI:ADR-083`; `docs/domains/inventory/CHARTER.md` | Inventory owns product/SKU identity and the stock ledger; proposals do not adjust stock or commit reservations. |
| `warehouse` | `apps/server/src/config/domains.js#warehouse`; `ZAI:ADR-069`; `docs/ERP-MODULE-MAP.md#Supply-Chain-Management-SCM` | The dedicated Warehouse slot is reserved. Inventory retains current location and movement ownership. |
| `procurement` | `apps/server/src/config/domains.js#procurement`; `ZAI:DOM-PROCUREMENT`; `ZAI:ADR-066`; `docs/domains/procurement/CHARTER.md` | Procurement owns suppliers, purchase orders, and receipts; no proposal sends a PO or posts a receipt. |
| `assets` | `apps/server/src/config/domains.js#assets`; `ZAI:DOM-ASSET-MANAGEMENT`; `ZAI:ADR-055`; `docs/domains/asset-management/CHARTER.md` | Asset Management owns evidence-backed asset identity, custody, allocation, and lifecycle; a draft does not register, transfer, or dispose an asset. |
| `people` | `apps/server/src/config/domains.js#people`; `ZAI:FR-042`; `ZAI:ADR-013` | The approved slice is the Business-scoped People Directory over Person/Membership; attendance, leave, payroll, and performance are out of scope. |
| `operations` | `apps/server/src/config/domains.js#operations` | The registry marks this entry reserved (`soon: true`); the workflow is only a proposed process-improvement brief. |
| `knowledge` | `apps/server/src/config/domains.js#knowledge`; `ZAI:ADR-072`; `ZAI:ADR-073`; `docs/domains/knowledge/CHARTER.md` | Knowledge owns admission/lineage contracts; GKS, MSP, and GenesisBlockDB remain external systems. |
| `platform` | `apps/server/src/config/domains.js#platform`; `ZAI:DOMAIN-INTEGRATION`; `docs/domains/integration/CHARTER.md`; `docs/domains/identity/CHARTER.md`; `ZAI:ADR-013` | Platform UI is a shell projection; Identity owns access decisions and Integration owns provider/connection records. `platform-control` is a separate operator-only lane. |

## Role design

Each operational floor reuses the role keys and proposal themes already in
`web/domain-office.js`. Names in that older presentation source are omitted:
these records describe role designs, not staff assignments. Lobby roles are a
new service-routing design attached to `business-home`, not domain roles.

| Team | Role key → title and proposed responsibility |
|---|---|
| Lobby (`lobby`) | `host` → Lobby Host: capture the request and explain what the Office can route; `intake` → Request Intake: clarify the requested outcome and collect only necessary context; `evidence` → Context Steward: record source and privacy limits; `router` → Handoff Coordinator: prepare a human-confirmed destination and handoff brief. |
| `projects` | `lead` → Project Lead: frame the objective and decision points; `planner` → Work Planner: draft workstreams, dependencies, milestones, and gates; `delivery` → Delivery Specialist: prepare a scoped deliverable and evidence; `review` → Delivery Reviewer: inspect acceptance evidence and unresolved risks. |
| `customer` | `crm` → CRM Specialist: organize authorized customer context; `lifecycle` → Lifecycle Specialist: draft onboarding or retention journey steps; `care` → Customer Care: summarize the request and prepare a response draft; `sales` → Sales Coordinator: propose a follow-up task and next action. |
| `market` | `analyst` → Marketing Analyst: compare authorized observations and quantify uncertainty; `research` → Market Researcher: organize source-backed observations and their dates; `insight` → Insight Strategist: synthesize implications for a requesting domain; `review` → Evidence Reviewer: check provenance, freshness, and contradictions. |
| `growth` | `lead` → Marketing Lead: frame a campaign brief and sequencing; `content` → Content Strategist: draft message themes and a content plan; `performance` → Performance Marketer: propose experiments, budget assumptions, and measures; `creative` → Creative Producer: prepare creative direction for human review. |
| `line-oa` | `lead` → LINE Experience Lead: frame the conversation journey and scope; `design` → Conversation Designer: draft messages, choices, and fallbacks; `ops` → Channel Operator: prepare a channel-readiness checklist; `review` → Conversation QA: inspect test cases, handoffs, and failure behavior. |
| `commerce` | `lead` → Order Coordinator: assemble the order context and exception; `pricing` → Pricing Analyst: calculate a price proposal from approved inputs; `fulfilment` → Fulfilment Planner: prepare the next-step plan using Inventory evidence; `review` → Order Reviewer: inspect completeness and financial exceptions. |
| `inventory` | `lead` → Inventory Controller: summarize an authorized stock position; `reserve` → Reservation Planner: prepare a reservation or replenishment proposal; `count` → Stocktake Analyst: compare submitted count evidence with ledger state; `quality` → SKU Data Steward: identify catalog, unit, or identifier gaps. |
| `warehouse` | `lead` → Warehouse Coordinator: frame a proposed warehouse process; `inbound` → Inbound Planner: sketch a put-away proposal; `outbound` → Outbound Planner: sketch a pick-and-pack proposal; `review` → Warehouse QA: review process assumptions and exceptions. All four roles are design-only while the domain is reserved. |
| `procurement` | `lead` → Procurement Planner: frame an approved replenishment need; `supplier` → Supplier Analyst: compare available supplier evidence; `po` → Purchase Order Coordinator: prepare a purchase-order draft; `receipt` → Receiving Reviewer: compare submitted receipt evidence with the order. |
| `assets` | `lead` → Asset Custodian: assemble the asset/custody review; `receive` → Receiving Inspector: draft an evidence-backed intake inspection; `audit` → Asset Auditor: compare count evidence with the asset register; `lifecycle` → Lifecycle Planner: prepare maintenance, allocation, or retirement advice. |
| `people` | `lead` → People Coordinator: triage a Business-scoped directory service request; `directory` → Directory Steward: identify only authorized directory fields and corrections; `onboard` → Onboarding Coordinator: format a checklist from human-supplied approved details; `review` → Privacy Reviewer: inspect purpose, scope, and recipient. No role creates people records or grants access. |
| `operations` | `lead` → Operations Lead: frame a proposed service process; `schedule` → Schedule Planner: draft a resource/timing view; `process` → Process Analyst: map a bottleneck and improvement option; `quality` → Quality Reviewer: inspect supporting evidence and exceptions. All four roles are design-only while the domain is reserved. |
| `knowledge` | `lead` → Knowledge Curator: select eligible source references; `pipeline` → Pipeline Operator: summarize admitted-source and run evidence; `research` → Knowledge Researcher: prepare a cited answer draft; `review` → Citation Reviewer: check support, freshness, and source limits. |
| `platform` | `lead` → Platform Coordinator: frame a readiness or configuration issue; `integrate` → Integration Specialist: diagnose authorized connection evidence; `access` → Access Administrator: draft an access-change request for the actual owner; `audit` → Audit Reviewer: check the evidence trail and unresolved risks. Identity decisions remain with Zuri. |

`proposedCapabilities` in the data module are plain-language work intents such
as “draft a comparison” or “prepare a checklist.” They are not permission codes,
tool grants, endpoint names, or evidence that a role may execute an action.
`requiresHumanReview` lists decisions that must stay with an authorized person;
each workflow step also declares its review policy.

## Department workflow designs

Every workflow is a draft-and-review process. Each step names one role, an
output, a review policy, the allowed next step keys, and a failure/escalation
rule. Failure stops progression and preserves the missing evidence or question
for a human. A handoff carries a named artifact to another department only when
its stated condition is met. Handoffs in this design are routing proposals; the
Zuri owner contract decides whether any downstream action is available.

| Team | Trigger → output and step sequence | Human review boundary | Handoff |
|---|---|---|---|
| Lobby (`lobby`) | A person asks for help from the Office. `host` captures intent → `intake` clarifies outcome → `evidence` checks source/privacy limits → `router` prepares the route brief. | The person confirms the destination; ambiguous or sensitive requests stop for a human. | To `customer` for a customer case, `projects` for cross-team planned work, or `platform` for an access/integration issue, only after the requester confirms. |
| `projects` | A Business owner submits an objective or work request. `lead` frames scope → `planner` drafts workstreams/dependencies → `delivery` prepares one bounded work item and evidence → `review` checks acceptance and gaps. | Human owner approves scope, budget, gates, and acceptance before project state changes. | To `market` when an approved plan needs external market evidence. |
| `customer` | An authorized customer conversation or follow-up needs attention. `care` summarizes the case → `crm` checks authorized customer context → `sales` drafts a next action → `care` reviews the response boundary. | Human approval is required before an external reply, promise, or customer-data change. | To `commerce` only when an owner-confirmed order, price, payment, or refund question requires that domain. |
| `market` | A domain requests evidence about competitors, demand, price, supply, or category movement. `research` gathers permitted source references → `analyst` compares dated observations → `insight` drafts implications/confidence → `review` checks provenance and contradictions. | A human decides whether the evidence is sufficient for a business decision; missing or stale evidence stays marked unknown. | To `growth` when a human confirms the brief is for campaign planning. |
| `growth` | An approved objective or campaign request is ready for planning. `lead` drafts the campaign brief → `content` and `creative` prepare copy/theme concepts → `performance` drafts test/budget/measurement assumptions → `lead` collects human decision. | Human approval is required for spend, public claims, channel, schedule, and publication. | To `line-oa` only when the person selects an approved LINE channel and confirms the campaign handoff. |
| `line-oa` | A human-approved conversation or campaign brief needs a LINE flow. `lead` bounds the journey → `design` drafts messages/fallbacks → `ops` prepares a readiness checklist → `review` tests edge cases and packages findings. | An authorized channel owner approves configuration and publication; this workflow never sends or publishes. | To `customer` for a reviewed support-case or handover pattern. |
| `commerce` | An authorized order exception or pricing/payment question needs review. `lead` assembles the order snapshot → `pricing` calculates a draft → `fulfilment` checks the next-step evidence → `review` records discrepancy and proposed disposition. | Human approval is required before confirmation, price change, refund, payment action, or sale document issue. | To `inventory` when an owner confirms an order needs a stock/availability check. |
| `inventory` | A low-stock, reservation, count, or SKU-quality question arrives. `lead` verifies the available ledger view → `reserve` drafts reservation/replenishment options → `count` compares count evidence → `quality` identifies catalog gaps. | Human approval is required before stock, reservation, catalog, or ledger mutation. | To `procurement` when the owner approves a replenishment request. |
| `warehouse` | Inventory or an owner asks for a put-away/picking process design. `inbound` or `outbound` drafts the flow → `lead` records assumed locations/bins → `review` flags missing warehouse rules. | A human warehouse owner must review safety/site assumptions; no physical action, bin assignment, or stocktake is represented as available. | To `inventory` only as a proposed process handoff; Inventory remains the current owner for stock and location records. |
| `procurement` | An approved replenishment need or submitted receipt evidence requires preparation. `lead` frames the need → `supplier` compares authorized supplier facts → `po` drafts order lines → `receipt` reviews submitted receipt evidence and variances. | A human approves supplier choice and order commitment; a human also resolves receipt variances before any ledger post. | To `inventory` when a human approves the receipt evidence for the Inventory-owned ledger path. |
| `assets` | A physical asset arrives, needs a stocktake, or needs allocation/lifecycle review. `receive` organizes intake evidence → `lead` drafts identity/custody review → `audit` compares count evidence → `lifecycle` drafts maintenance/allocation advice. | A human approves registration, custody transfer, project allocation, financial facts, or disposal. | To `projects` when a project owner confirms the asset allocation request and supplies the work context. |
| `people` | A directory or workforce-service request arrives. `directory` checks the authorized directory facts → `onboard` formats only human-supplied approved checklist details → `lead` prepares a service response → `review` checks purpose, scope, and recipient. | Human HR/Business owner review is required before any record correction or disclosure; access changes go to Identity and are never granted here. | To `platform` only for a human-confirmed access/configuration request; Identity remains the decision owner. |
| `operations` | A Business describes a recurring service exception and asks for a process improvement brief. `lead` frames the service → `schedule` drafts a resource/timing view → `process` maps the bottleneck → `quality` reviews evidence and assumptions. | A human service owner approves the process change; the reserved workflow does not dispatch staff, change a schedule, or claim live service status. | To `projects` when the service owner accepts the brief as planned improvement work. |
| `knowledge` | A user asks a Business question requiring governed source evidence. `lead` selects eligible source references → `pipeline` summarizes admission/run evidence → `research` drafts an answer with citations → `review` checks each claim against source scope and freshness. | A human reviews low-confidence, conflicting, private, or customer-facing answers; unsupported claims remain unanswered. | To `customer` when an owner confirms a cited answer should inform a customer-service response. |
| `platform` | An authorized operator/owner reports integration readiness, access, or audit evidence needing review. `integrate` diagnoses connection evidence → `lead` frames impact → `access` drafts a request to the actual Identity owner → `audit` checks supporting evidence and risk. | Identity owner approval is required for grants; Integration owner approval for connection changes; no credentials or direct data-store writes are exposed. | To `projects` when the owner accepts a non-urgent remediation as planned work. |

## Registration handoff rules

- The data export contains the fourteen existing operational keys plus the
  Office-local `lobby` design key. `business-home` stays only as a source
  reference; no new Zuri domain key is introduced.
- Department, role, workflow, and step keys are stable semantic keys. The
  registration handoff assigns deterministic UUIDv5 design IDs outside this
  file. No canonical UUID is guessed or embedded here.
- A design role is not an AgentDefinition, AgentVersion, AgentInstance, staff
  assignment, executor binding, status, or grant. A `sourceCatalogCode` is only
  a seed/catalog lookup hint.
- `proposedCapabilities` are readable work intents. They are not machine
  permission identifiers. Actual actions must come from Zuri's authorized
  contracts and current Business scope.
- A workflow handoff is a proposal artifact. It never directly mutates another
  department's records, sends external communication, grants access, commits
  spend, or reports success without owner confirmation and platform evidence.
- Unknown, stale, conflicting, or unauthorized source data stops the workflow;
  it must not be converted to zero, a successful state, or an inferred roster.
