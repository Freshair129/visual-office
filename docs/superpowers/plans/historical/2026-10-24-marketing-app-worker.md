# P1 integration into main app and built Worker — 24 October 2026

Owner authorizes one integration delivery, synthetic only, plus exact-revision CI.
Prior P0/P1 evidence remains immutable history. P1 modules already exist; integrate
and qualify their real app entry path instead of calling TycoonView from a test page.

## Design and boundaries

Source app at :4184 and built Worker at :4185 serve the actual index/app/GLB assets.
An isolated fixture server uses the same pinned producer payloads and actual Node
sanitizer. Worker routes existing /api/zuri reads through an explicitly injected
local-only synthetic service. Without both local loopback URL and explicit test
binding, status is disabled and all reads unavailable; no live proxy, auth protocol,
BUCKET writes, roles, dynamic grants or dispatch are added. Strip incoming credentials
at the Worker seam and use a fixed synthetic context only in the local harness.
App displays a persistent synthetic banner only when status explicitly declares it.
Harness controls remain on a separate test-only page; production app contains no
fixture control routes. The built Worker is exercised by importing its actual fetch
handler in a loopback HTTP adapter, not a deployed Cloudflare runtime.

## Work

1. RED tests: Worker unavailable default, local-only synthetic binding, route/method
   allowlist, credential stripping; main app banner integration.
2. Implement Worker route seam and synthetic banner; use actual app entry and build
   artifact in a new fixture launcher, preserving :4183/P1 files and evidence.
3. Create isolated integration branch containing the required uncommitted runtime,
   assets, tests and documentation dependencies; retain original dirty checkout.
   Record dependency scope explicitly instead of claiming the entire foundation is P1.
4. npm ci/test/build, pinned57 compatibility, main-app and Worker browser matrix,
   independent review/fixes, immutable commit/tree/build pins. Add test/build-only CI
   because no workflow exists. Push integration branch/PR, check exact-head Actions.
5. No deployment/live. Record local built-Worker evidence separately from hosted CI,
   deployed Worker, and live acceptance. Report any unrun gate honestly.

Ruling: npm clean-install audit identified a critical DOMPurify3.4.16 advisory.
Update only DOMPurify to3.4.17 (patch), regenerate lock/vendor via normal build and
rerun tests. Source: https://github.com/cure53/DOMPurify/releases/tag/3.4.17 .
Two low advisories in Mermaid/KaTeX are recorded separately, not silently fixed.
Cost: bounded sanitizer dependency change is included in review and exact-head CI.
