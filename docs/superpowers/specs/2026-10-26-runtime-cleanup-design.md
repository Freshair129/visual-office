# Office runtime cleanup and endpoint audit

Authority: implements the owner's 26 October cleanup request and existing
preserve-art / optional-client decisions. This is an implementation design, not
a new Zuri API or authorization contract.

## Outcome

One authored Office appearance: the supplied Zuri SVG, painted campus/Lobby and
hybrid office artwork. Dynamic context must not select an unrelated green UI.
Keep working Studio renderers, saved editions, navigation and scene files;
an old filename or schema is not proof that code is unused.

Every Office endpoint needs an explicit method, consumer, handler, access
boundary, transport and verification classification. Correct local proxy gaps
without exposing runner routes or inventing Zuri grants. Real Zuri integration
remains contract-gated; synthetic qualification is not live acceptance.

## Approach

Use the existing browser modules, Worker and local connector. A shared route
catalog controls Worker method dispatch and browser-to-Site proxy forwarding.
Keep endpoint payload validation in the owning handlers. Use the existing
painted/hybrid renderer for the dynamic client presentation, retaining its
context purge and permission checks. Remove the unused direct browser T3 client,
fabricated runtime demo records, unused symbols and alternative presentation
switches after checking all consumers. Keep synthetic fixtures in test tooling.

A rewrite or blanket removal of older scene formats would destroy active editor
features. Merely hiding old UI would leave the routing defect. Neither satisfies
the request.

## Constraints and acceptance

- No logo/art bytes, models, Agent count/role definitions or existing saved
  layouts changed. Preserve the dirty character checkout and preview on 4195.
- No provider calls, credentials, database operations or live activation.
- Unknown routes return 404; known wrong methods return 405 with Allow before
  storage access. Browser proxy never forwards runner routes.
- Proxy preserves query, status, response content type and download headers;
  JSON, attachment and result-file routes all retain their existing boundaries.
- Browser login/navigation requires a reported valid target; no guessed 3100.
- List all routes and compare actual frontend/bridge callers. Identify unsupported
  contracts explicitly instead of replacing them with successful mock responses.
- Run focused regressions, full tests/build, an independent patch review and
  browser source/Worker checks. Record remaining live and native-lifecycle gaps.
