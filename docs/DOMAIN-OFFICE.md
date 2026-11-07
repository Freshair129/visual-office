# Office domain map and connection boundaries

Reviewed against Visual Office source at `949736446824d4803f9109a20830202494abd7b7` (2026-10-26).

## Default Office directory

The default [`BuildingView`](../web/building-view.js) uses the shared canonical Office art. Its
local directory comes from [`web/domain-office.js`](../web/domain-office.js), which records a
pinned input snapshot from `Freshair129/zuri.ai` `apps/server/src/config/domains.js` at revision
`30911f98e12d535133e77dbe3c3bd42ed6ee9864` (2026-10-20). That map currently contains 14 display
entries and four role-card designs per entry. This historical display mapping is not a current
universal Zuri domain model, an authorized Business domain list, or an Agent roster.

Business Home is presented as the shared lobby. SCM and CRM are navigation groups, not extra
floors. Warehouse and Operations carry the pinned snapshot's reserved labels. These labels and
floor visibility do not grant access or physical-stock capability. Reconcile the static map
against Zuri's current domain source before treating its labels or count as current.

The role cards are presentation designs. `sourceAgentId` links only the existing compatibility
profiles where a mapping exists; other cards are unbound. Opening a floor or card does not create
an Agent, assign a role, change a permission, or submit work. Zuri owns the authoritative Business
scope, domain list, Agents, roles, and permissions.

The app selects its Office surface in [`web/app.js`](../web/app.js). The initial surface is
`BuildingView`; saved Tycoon3D editions remain available on supported surfaces. The synthetic
dynamic candidate uses [`TycoonDomainView`](../web/tycoon-domain-view.js) with
[`OfficeArtScene`](../web/office-art-scene.js), which reuses the current authored Office art. Its
campus viewport keeps the 1.25 (25%) overscan setting. The retained `--legacy-art` hook only
enables local art-snapshot preview behavior; it does not replace the current app shell.

## Local Zuri connection

The optional local connector can be started against an explicitly selected loopback Zuri server:

```powershell
$env:PORT = '4181'
$env:ZURI_PORT = '3100' # or 3000 for the existing UAT instance
node scripts/serve.mjs --preview --zuri
```

`--zuri` enables the local adapter in [`scripts/zuri-connector.mjs`](../scripts/zuri-connector.mjs).
It accepts only the configured loopback targets, checks same-origin requests, and forwards the
existing `zuri_session` cookie to its route allowlist; it does not persist that credential or
create memberships and grants. Sign in to the selected Zuri server in the same browser. Zuri
decides whether the current session may select a Business and read its data. `--preview` does not
load T3/Sites credentials; its `/api/` proxy returns `Not configured` instead of forwarding to a
hosted Site.

The connector has read routes and bounded Marketing and Knowledge operations. Those operations
return data from their owning service; they are not LLM Agent turns. The Agent routes explicitly
return `AGENT_DISPATCH_UNAVAILABLE`, so the Office does not fabricate a queued or completed task.
Implementation and local fixture tests do not establish that a Zuri endpoint, session, or live
read succeeded. The routes owned by the existing Worker and T3 bridge are inventoried in
[`shared/office-api-routes.js`](../shared/office-api-routes.js).

## Synthetic domain candidate and workspace

[`scripts/serve-marketing-app.mjs`](../scripts/serve-marketing-app.mjs) runs a local synthetic
domain-context candidate with `--dynamic`. It loads
`tests/fixtures/marketing-office/domain-context-v1.json` and makes no upstream calls. The
candidate validates and displays the fixture's exact domain rows for its selected Business
instead of filling from the pinned 14-entry map. Its domain context is in-memory, expires, and is
not persisted as authorization. The only current candidate reader is the Growth Marketing read
path when its fixture says `ACTIVE` and grants the specific read operation; the context schema
permits no actions. This is contract-candidate evidence, not Zuri authorization, a live
connection, or a production integration.

`--workspace` starts a separate synthetic T3 workspace profile with in-memory storage and the
actual Worker API handlers. It is not a live T3 Agent or Zuri workspace and cannot be combined
with `--dynamic`. To exercise the built Worker, build first and add `--worker`; the adapter
remains synthetic.

The harness's `--legacy-art` flag adds the local art-snapshot preview marker read by `BuildingView`.
It is an art compatibility hook, not the retired application-shell override. The current Office
uses the full-screen scene with its dock and **เพิ่มเติม** menu; Work, Chat, Results and Files,
Team Knowledge, Team, and Inbox are separate workspace routes. There is no permanent sidebar or
hidden inline composer.

Workspace access is gated by source readiness in
[`web/workspace-context.js`](../web/workspace-context.js). Demo mode is read-only. A selected Zuri
connector does not stand in for missing Zuri Work, Chat, or document APIs; those pages report
unavailable data rather than an empty feed. The existing T3/Worker path remains separate.
`#chat/<thread-id>` is resolved against current profiles, sessions, jobs, and assignments before
opening a conversation. Team Knowledge context uses the existing workspace path and is not Zuri
Business data.

## Platform service dependency

The intended Zuri relationship is an optional registered web-client target, not a second
authority for business data or Agent state. Registration, caller authentication, tenant and
Business scope, domain and module definitions, Agent identities and roles, permissions, and
supported APIs belong to Zuri. This repository's local connector and synthetic candidate do not
prove production registration or a live end-to-end integration.

The platform integration boundary and current requirement status are documented in
[the Zuri platform boundary](ZURI-PLATFORM-INTEGRATION-BOUNDARY.md) and
[the Visual Office SRS](VISUAL-OFFICE-SRS.md). Do not infer a missing endpoint, role, permission,
completed action, or cross-Business guarantee from art, a local floor map, or fixture results.

## Historical evidence

The dated lobby and elevator observations remain in [Design QA](../design-qa.md). Their test
counts, build results, and browser observations are evidence for their recorded dates and
revisions only; they are not current-main validation or hosted/live acceptance.
