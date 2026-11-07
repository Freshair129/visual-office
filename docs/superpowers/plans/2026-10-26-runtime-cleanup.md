# Office runtime cleanup implementation plan

> Use superpowers:executing-plans task by task with a final independent review.

**Goal:** remove obsolete runtime branches and reconcile frontend/backend routes.
**Architecture:** shared endpoint policy, owning handlers and one Office art direction.
**Tech Stack:** browser ESM, Node HTTP, Worker, Three.js, node:test / JSDOM.
**Spec:** ../specs/2026-10-26-runtime-cleanup-design.md

## Constraints

Synthetic only. Preserve art/assets, scene formats, Agent definitions, dirty
checkout and user preview. No invented live contract or unverified PASS.

## Review focus

Binary downloads through the proxy; wrong methods before storage; runner route
exclusion; delayed context reads after hide/revocation; unbound furniture never
creates an Agent; old saved scenes remain editable.

## Task 1: API route ownership and transport parity

Files: `shared/office-api-routes.js`, `scripts/office-proxy.mjs`, `scripts/serve.mjs`,
`worker/index.js`, `tests/api-routes.test.mjs`, `tests/office-proxy.test.mjs`.
Interface: `resolveOfficeApi(pathname)` returns metadata or null; proxy accepts
injected config/fetch for tests and returns a Web Response.

- [x] Add failing tests for complete methods, unknown paths, runner exclusion,
  chat history, work reviews and binary result download forwarding.
- [x] Implement shared policy and proxy; preserve payload validation/auth.
- [x] Run focused tests and record endpoint inventory.

## Task 2: Remove dead client / fabricated runtime data / guessed targets

Files: `web/app.js`, `web/cloud-client.js`, `web/t3-client.js`,
`web/zuri-connector.js`, `web/zuri-panel.js`, associated tests.

- [x] Pin neutral unconnected role-card behavior and no guessed login target.
- [x] Delete the direct browser T3 client only after proving no app consumer;
  remove its retired-only tests, retain bridge and queue handlers.
- [x] Derive appearance defaults from the existing profile config and remove
  fabricated logs, paths and working statuses; remove unused methods/imports.
- [x] Run focused regressions and a production-module reachability audit.

## Task 3: Remove alternate runtime appearance

Files: `web/app.js`, `web/tycoon-view.js`, `web/tycoon-view.css`,
`web/office-art-scene.js`, dynamic-view tests.

- [x] Add regressions for canonical SVG/art and no runtime edition switch.
- [x] Make ordinary routes use the existing BuildingView; dynamic context uses
  shared campus/Lobby/hybrid art through a presentation adapter. Keep Studio GLB
  authoring and saved editions intact; no synthetic Agent from furniture.
- [x] Preserve context authorization, purge, unsupported floor and keyboard gates.

## Task 4: Verification and endpoint evidence

Files: `docs/API-ENDPOINT-AUDIT.md`, `scripts/audit-runtime.mjs`, `AGENTS.md`.

- [x] Enumerate all route families, methods, consumers, handlers and limitations.
- [x] Run focused and full tests; build in the isolated tree only.
- [x] Exercise source + built Worker in Codex IAB on separate ports; verify
  branding, board/Ask, refresh and unsupported-floor behavior.
- [x] Obtain independent review of the same patch, resolve findings and record
  exact evidence. Do not claim live or native-hidden/focus acceptance.
## Delivery evidence — local qualified patch

- Base `7ffb8b172f1c04450e3f36a853dcb88f1a0e364a`; isolated branch
  `codex/office-runtime-cleanup-20261026`. No main checkout changes or live calls.
- Baseline full suite: 742 PASS. Removed 13 tests for the deleted direct-browser
  T3 client; added 16 regressions. Final full `npm test`: **745 PASS, 0 failures,
  0 skips**, exit 0 (`reports/runtime-cleanup/final5-tests.log`).
- Full `npm run build`: PASS (`composed-build.log`); final Worker re-bundle:
  PASS, 412 embedded assets. Build-generated vendor/art changes were restored
  in this initially clean worktree; they are outside the authored patch. The
  built artifact is not a byte-identical copy of the tracked vendor tree.
- Independent patch review and successive small-delta reviews: no outstanding
  findings. Final code patch SHA256:
  `1244a06157080a7bbd91f5d3114fe72bb65cb997a79d1529c40f815080f31883`.
  The earlier two inventory/documentation nits were resolved. This evidence
  append follows that code review; it changes no runtime behavior.
- `node scripts/audit-runtime.mjs`: 27 Office route families; 212 reachable
  browser modules, zero unclassified root JS modules. Source-only Zuri audit:
  all 15 referenced upstream routes export the expected method at the pinned
  Zuri revision; this is not live payload/authorization proof.
- Codex IAB source :4200 and built Worker :4201: canonical campus/Lobby art and
  SVG logo, scope selection, Marketing board/read, blank Ask with literal zero
  values, refresh/context re-selection and RESERVED/no-reader behavior observed.
  Final source and Worker console error lists are empty. Actual native
  hidden/focus B3 remains unverified, not PASS.
- Retained the first bounding-box-center pointer probes that opened the lift
  in `worker-cold-board-ax.txt`. That center falls in transparent foreground art;
  it is not a passing board-click observation. The final screenshot-grounded
  visible board click opened Campaigns (`worker-visible-board-ax.txt`), then Ask
  (`worker-final-ask-ax.txt`). Unit regressions pin transparent and undecoded
  masks, while Studio keeps its existing geometry picker.
- A RESERVED attempt crossed the real 60-second context expiry and safely
  returned to Lobby (`worker-final-reserved-ax.txt`); it was not counted PASS.
  The fresh-receipt retest shows RESERVED/no-reader
  (`worker-reserved-fresh-ax.txt`). No fake clock or visibility event was used.
- Transport audits record zero real upstream calls / fixture violations in
  their captured scope. Final Worker console dispatch traces also show only
  injected synthetic entry/Campaign/blank-Ask responses. These do not prove a
  browser-wide network audit or production deployment.
- Original dirty character checkout: all 150 pinned file hashes unchanged
  (`original-model-preservation.json`). No asset/model/Agent-role files staged.
- Worker test server :4201 stopped; preview source :4200 intentionally retained
  for the user. No GitHub push, PR, merge or CI claim in this task.
