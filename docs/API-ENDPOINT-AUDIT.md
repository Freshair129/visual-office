# Office endpoint and runtime audit — 26 October 2026

27 October working-tree follow-up: [system gap analysis](SYSTEM-GAP-ANALYSIS.md)
adds current-client `baseUpdatedAt` checks for Work review writes. A mismatched
edit base returns typed `REVIEW_CONFLICT` before changing review/outbox/queue;
identical retries remain idempotent. Legacy callers without that optional field
retain their existing behavior and are not claimed to have form-edit protection.
ETag conditional writes still cover the handler's read/write race separately.
Browser entry discovery now includes nested HTML/base URLs and separately traces
package asset-builder inputs; static reachability is not runtime qualification.

Delivery reconciliation: this cleanup and the campus-framing follow-up merged in
[PR #10](https://github.com/Freshair129/zuri-visual-office/pull/10) at main
`949736446824d4803f9109a20830202494abd7b7`. Its
[CI](https://github.com/Freshair129/zuri-visual-office/actions/runs/40326980103)
passed 747 tests, build and pinned compatibility. The base/source snapshots below
retain their original audit scope; source existence and synthetic tests are not
live Zuri/backend qualification.

Scope: Visual Office frontend, local Node proxy/connector and Worker backend.
Base: `7ffb8b172f1c04450e3f36a853dcb88f1a0e364a`. Zuri upstream route
existence/methods were inspected read-only at `0f8ce05d3a54bd1c58d26b8b759ca50a650c3aa6`.
This does not qualify the whole Zuri backend, its authorization or live behavior.

## Office route inventory

`shared/office-api-routes.js` is the transport policy. `scripts/audit-runtime.mjs`
emits each route's concrete example, handler and consumer into the ignored
`reports/runtime-cleanup/runtime-audit.json`. Parameter IDs remain validated in
the owning handlers. Unknown routes are 404; known wrong methods are 405 + Allow
before accessing storage. Private Sites sign-in remains the existing deployment
boundary; this patch does not grant it to arbitrary hosts.

| Endpoint family | Methods | Consumer | Owner / access |
|---|---|---|---|
| `/api/office` | GET | CloudClient, cloud-probe script | Worker; private snapshot, stale → offline |
| `/api/team` | GET, PUT | CloudClient, KnowledgeView | Worker; same-origin write |
| `/api/jobs` | GET, POST | CloudClient, TaskUI | Worker; same-origin create, validated configured profiles, idempotent ID |
| `/api/jobs/:id/cancel` | POST | WorkView | Worker; same-origin cancel intent |
| `/api/preferences` | GET, PUT | app, bind-team script | Worker; same-origin write, configured profile count |
| `/api/work-reviews` | GET, PUT | app; collection PUT is supported handler compatibility | work-review; same-origin write, known job and version |
| `/api/work-reviews/:id` | GET, PUT | WorkView PUT; GET supported by handler | work-review; known job, version checks |
| `/api/result-files` | GET | ResultsView | result-files; known thread, bounded metadata |
| `/api/result-files/:thread/:file/download` | GET | ResultsView download link | result-files; known thread + file, safe attachment headers, binary |
| `/api/chats/:thread` | GET | ChatUI, TeamPage | chat; known thread |
| `/api/chats/:thread/history` | GET | ChatUI | chat; bounded opaque cursor |
| `/api/chats/:thread/messages` | POST | ChatUI | chat; same origin, known thread, bounded/idempotent queue |
| `/api/chats/:thread/watch` | POST | ChatUI | chat; same origin, known thread |
| `/api/chats/:thread/attachments/:file` | POST | ChatUI | chat; same origin, known thread, bounded verified bytes |
| `/api/knowledge` | GET | KnowledgeView, TaskUI | knowledge; bounded library projection |
| `/api/knowledge/files/:file` | POST | KnowledgeView | knowledge; same origin, bounded verified bytes |
| `/api/knowledge/versions/:id/approve` | POST | KnowledgeView | knowledge; same origin, lifecycle validation |
| `/api/knowledge/versions/:id/revoke` | POST | KnowledgeView | knowledge; same origin, lifecycle validation |
| `/api/knowledge/versions/:id/purge` | POST | KnowledgeView | knowledge; same origin, lifecycle/pinned-reference validation |
| `/api/runner/jobs` | GET | bridge | Worker; sync-key bearer, never browser proxy |
| `/api/runner/jobs/:id` | PUT | bridge | Worker; sync-key bearer, immutable bindings |
| `/api/sync` | POST | bridge | Worker; sync-key bearer, sanitized receipt |
| `/api/runner/chats` | GET | bridge | chat; sync-key bearer |
| `/api/runner/chats/snapshot` | POST | bridge | chat; sync-key bearer, private projection |
| `/api/runner/chats/messages/:thread/:message` | PUT | bridge | chat; sync-key bearer, queue identity |
| `/api/runner/chats/attachments/:thread/:file` | GET, PUT | chat-attachments | chat; sync-key bearer, scoped file/cache |
| `/api/runner/knowledge/:version` | GET, PUT | knowledge-attachments | knowledge; sync-key bearer, job/thread pins |

All 27 families are active handler contracts, including compatibility operations
without a current UI button. These are not evidence of provider-neutral Zuri
Chat/Work APIs. No runner endpoint is forwarded by the browser dev proxy.

## Zuri connector inventory and gates

| Office endpoint | Method | Local connector | Worker |
|---|---|---|---|
| `/api/zuri/status` | GET | Explicit `--zuri` opt-in; disabled by default | Disabled by default; loopback synthetic seam only |
| `/api/zuri/scope` | GET | `/api/entry`, selected session scope | Synthetic seam only |
| `/api/zuri/synthetic/domain-context` | GET | Not a live route | Versioned synthetic context only |
| `/api/zuri/domains/projects` | GET | `/api/projects` | Synthetic seam only |
| `/api/zuri/domains/growth` | GET | `/api/growth/campaigns` | Synthetic seam only |
| `/api/zuri/domains/growth/ask` | POST | `/api/growth/ask-marketing`, read-only deterministic response | Synthetic seam only |
| `/api/zuri/domains/knowledge/query` | POST | `/api/knowledge/queries`, scoped `topK:5` | Unsupported (404) |
| `/api/zuri/domains/{customer,market,line-oa,commerce,inventory,procurement,assets,people,knowledge,platform}` | GET | Explicit bounded readers below | Unsupported (404) |
| `/api/zuri/domains/{warehouse,operations}` | GET | RESERVED; no upstream | Unsupported (404) |
| `/api/zuri/agent`, `/api/zuri/domains/:domain/agent` | unavailable | 501 gate, never dispatch | Unsupported (404) |

Additional local reader upstreams: `/api/crm/conversations`,
`/api/market/observations`, `/api/line-oa/accounts`, `/api/commerce/orders`,
`/api/inventory/products`, `/api/procurement/purchase-orders`,
`/api/assets/register`, `/api/people`, `/api/knowledge/sources`,
`/api/platform/integrations`. All 15 upstream paths including entry/Projects/
Campaigns/Ask/query exist with the expected GET or POST export at the inspected
Zuri revision. Existence is not a client grant, payload-parity or live check.
Domain/role/operation authorization remains Zuri-owned. Dynamic Office reads
only supported ACTIVE + ALLOW operations; RESERVED/unknown domains never gain a
reader, Agent or Studio write through artwork.

The server's restricted loopback 3000/3100 target policy remains intentional dev
configuration. Browser navigation now requires the connector-reported valid
target; it no longer guesses a login or Business URL at 3100.

The retained bridge uses T3's shell/thread reads, orchestration dispatch,
attachment-upload and websocket-ticket protocols. These are server-side adapter
dependencies, not Zuri domain endpoints or a direct browser T3 connection.

## Removed, retained, and corrected

- Removed unused `web/t3-client.js` and its retired-only tests (13 tests). The
  actual bridge, queue, current CloudClient and associated tests remain.
- Moved the build-only rich vendor entry into `scripts/`; it is not shipped as
  an unused browser module. Production browser graph has no unclassified root
  JS modules; shared server route metadata lives outside `web/`.
- Removed fabricated demo work paths/logs/statuses. Preview uses neutral offline
  role cards from the existing configured profiles. Those profiles are prototype
  workspace identities, not canonical Business-domain Agent definitions.
- Removed guessed target exports, unused CloudClient method and duplicated
  literal profile counts. Failed/malformed workspace polling clears old data.
- Fixed missing proxy routes for reviews, chat history and result files. Binary
  bytes, status, query and safe download headers survive forwarding.
- Removed runtime alternate-theme switches and the app-level test-meta routing override.
  Default routes use BuildingView; dynamic routes use the same existing
  campus/Lobby/hybrid artwork, SVG logo and Office palette. GLB/Native Studio and
  explicitly saved editions are active features and remain supported.
  The loopback harness still accepts its explicitly selected local-art snapshot
  preview flag for Studio/character tests. BuildingView honors it only for local
  presentation snapshots; it does not select a different UI shell. It cannot
  bypass dynamic context routing, which has a regression test.
- The dynamic art adapter is read-only and transient. It does not migrate a
  saved GLB scene, create an Agent or claim shared scene persistence. Furniture
  defaults are art templates; layout, size, limit and protocol constants are
  intentional, not synthetic business results.

## Verification and remaining limits

Route-policy tests cover all 27 families' method rejection before storage and
all six supported synthetic Zuri methods. Proxy regressions cover the previously
missing routes, binary download, cross-origin denial, runner exclusion and body
limits. Existing owning-handler suites cover payload, queue, storage and auth
behavior. `runtime-cleanup.test.mjs` covers malformed workspace responses,
neutral runtime data, retired-client absence and no guessed navigation.

Browser qualification uses isolated loopback source/Worker harnesses and frozen
synthetic fixtures, never live Zuri/provider calls. Exact logs, counts and browser
observations are recorded in the implementation plan after verification.
Existing B3 actual native document-hidden/focus acceptance remains unverified;
this refactor does not relabel it PASS. Live API contracts, production sign-in,
real Agent commands and cross-device/shared saves remain owner-dependent gates.
