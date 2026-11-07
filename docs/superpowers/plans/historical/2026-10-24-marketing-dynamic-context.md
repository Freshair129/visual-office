# P1-B dynamic domain context — Office implementation plan

Disposition (7 November 2026, lead under the owner's delegation): Completed: delivered by the synthetic Business-scoped dynamic context PRs (archived repo #4, #5); CI runs the pinned producer compatibility check on every change.

> **For agentic workers:** Use superpowers:executing-plans task by task.

**Goal:** Qualified synthetic Business-scoped dynamic floors without widening Zuri authority.
**Architecture:** Strict bounded context parser, in-memory generation-fenced read controller, namespaced view projection and separate loopback synthetic transport.
**Tech Stack:** Existing ES modules, Three.js, Node test runner, jsdom and local built Worker.
**Spec:** Reviewed producer candidate path below; source revision recorded at closure.

Status: executing after candidate/Task4 closure at Zuri c13acf55405326df14c1b8f18390ae1e7bb58356; independent review found no remaining findings, governance/corpus passed.
User selected synthetic-only implementation after contract/plan closure on 24 October 2026.
Base: 1d804189d768e9e920e68bf4aa03bb67e43653b6 (PR3 scene recovery dependency, not yet merged).
Authority: Office implementation plan, not public API/auth/grant adoption.
Producer candidate: Zuri docs/change-requests/integration/visual-office-dynamic-domain-context-20261024.md and Task4 of docs/plans/MARKETING-VISUAL-OFFICE-FIRST-20261024.md, held by Marketing integrator.

## Reconciled consumer rulings
- Separate candidate synthetic mode; static P1 default and frozen read-v1 bytes unchanged. No production route/auth enablement.
- Logical route `domain:<key>` encoded by existing workspace navigation. Shell Lobby/Studio/building remain separate.
- Building presents at most eight domain facades per page, complete accessible directory through 64 rows, stable domain picks. Empty context displays Lobby only; unsupported leaves get textual floor panel.
- Context lives only in memory. Body reading bounded to 64KiB UTF8 before parse. Strict schema plus wall-clock timestamp check; monotonic receipt expiry. Refresh/hidden/expiry purge context, pending reads and private sheets before awaiting.
- Studio persistence stays local/static; dynamic unknown leaves cannot invoke storage or arbitrary assets. Scene retry only rebuilds presentation and never refreshes expired context.

## Ordered work and acceptance
1. Pin reviewed contract and candidate fixtures; strict parser tests RED then GREEN for scope/version/extra fields/groups/duplicates/operation hints/actions/byte and clock limits. Preserve existing57-vector profile.
2. Lifecycle tests RED then GREEN: BusinessA/B, sameBusiness refresh/revocation, hidden/focus/expiry, rejected/late context+Campaign+Ask. Gates intersect ACTIVE + exacthint + support. Dynamic Projects never reads.
3. App routing and view/scene tests: namespace/deeplinks/history, truthful empty/unsupported/reserved/unavailable, 0/1/64 floors with paging/keyed picks, safe focus and no private sheets afterpurge. Staticpilot regression.
4. Synthetic-only injected binding in source launcher and builtWorker; same contract vectors, defaultdisabled, no credentials/livefallback. Browser controls for context cases and held responses.
5. Fulltests/build; actual app and builtWorker browser scenarios, source/fixture/buildhash evidence, independent review, fix findings, PR/exactheadCI. No live/deployment or merged-main claim without those checks.

## Ownership
Office: this plan, Office implementation/tests/fixture copy and local evidence. Marketing: producer candidate/Task4, source-side fixtures/review/governance. No concurrent Zuri generators here.

## Ledger
- Read-only audit confirms app router hardcodes Tycoon floors, data controller defaults all nongrowth routes to Projects, building facade IDs are pinned, and Studio validFloor accepts only Lobby/Projects/growth. All must remain separate from candidate dynamic authority.


## File responsibilities and checks
- New `web/office-domain-context.js`: strict parser, streamed UTF8 reader, operation-hint predicate. New `tests/office-domain-context.test.mjs`: boundary, exact byte limits and deterministic timestamps. Does not fetch arbitrary URLs.
- `web/office-context-data.js`: independent dynamic context lifecycle beside unchanged static pilot. `tests/office-context-data.test.mjs`: fake-wall/monotonic clocks and abort-ignoring promises; data calls require generation, exact scope and operation hint.
- New `web/tycoon-domain-view.js`: dynamic navigation, messages, paging and unsupported floor projection; integrated through `web/tycoon-view.js`. Existing tests plus new dynamic-view tests use Scene fake without WebGL and assert literal labels.
- `web/tycoon-scene.js`: optional authorized building rows/page data, tagged pick IDs and camera fit for up to8 visible facades. Existing scene tests prove 0/1/64 full directory projection and stable selections afterreorder without changing persistent roomstate.
- `web/app.js`: boot synthetic candidate selection, namespace routes, no legacy fallback in dynamic mode; `tests/workspace-app.test.mjs` exercises composed app/history/Studio separation. Existing `web/workspace-navigation.js` encoding remains unless tests expose a required change.
- `web/zuri-connector.js`: fixed synthetic context path plus bounded response decode; `worker/zuri-read.js`: loopback-only injectedservice allowlist/defaultdisabled. Extend connector/Worker tests, never introduce network producer calls.
- `scripts/serve-marketing-app.mjs`, new fixture helper and `web/tools/marketing-controls.html`: explicit --dynamic, sharedcandidatefixture, contextcases/hold/release/purge controls, exact audits and no upstreams. Existing sanitized Campaign/Ask fixtures remain frozen.
- Marketing owns source fixtures; Office copies exactcandidateJSON with SHA and provenance. Compatibility fixture remains byte-identical.

## Review focus
- Mode/Business/context generation must change before asynchronous work or UI retains private content.
- Unknown valid leaf must not hit Projects, legacy routes, Studio store or arbitrary URL.
- SameBusiness refresh/hidden purge must fence old successful replies even with identical opaque contextRevision.
- Injectedservice identity does not become auth: public origins, missing binding and production defaults remain disabled.
- Changed renderer recovery must not restoreexpired reads or discard unsaved static Studio drafts.

## Execution checklist
- [x] B0 closure recorded and plan reconciled.
- [x] Boundary tests observed RED then GREEN; candidatefixture hash pinned.
- [x] Lifecycle/scope tests observed RED then GREEN.
- [x] View/scene/app routing tests observed RED then GREEN.
- [x] Synthetic source/Worker adapter tests and browser acceptance complete.
- [ ] Full suite/build, independent review, PR/exactheadCI with evidence and limitations.

- Reconciled helper split: `web/office-context-route.js` + `tests/office-context-route.test.mjs` own `resolveOfficeContextRoute(hash, context)` tagged shell/domain results. Existing workspace encoding carries `domain:<key>` safely.
- Clocks: parser `{wallNow}` is a function returning epoch milliseconds, sampled once; lifecycle receives `monotonicNow()`. UTC strings must exactly round-trip calendar-valid millisecond `YYYY-MM-DDTHH:mm:ss.sssZ`.
- Candidate launcher boot metadata selects dynamic presentation before status arrives, avoiding a transient legacy floor. Context requires exact synthetic status profile and binding; mismatch stays unavailable. Mode change requires reload and does not persist selection.

- B0 closed at c13acf55 (read-only verified commit/review). Direct Office user selects B1–B3 synthetic implementation. Marketing separately owns source-side B1; no production adoption required for labelled candidate tests.

## Execution evidence (24 October)
- Ruling: isolate the candidate lifecycle/controller and route helper instead of adding authority semantics to static TycoonData. This preserves static P1 behavior and makes absence of the harness profile fail closed.
- B1: exact final producer fixture SHA256 `68aae4bddcb5fd737945974a40cdf815e739426603e0d5b8a0ce3b4c1c4d6a7b`; 96 vectors plus byte pin = 97 tests passed. Accepted wire inputs independently decode and deep-equal both decoder and parser outputs. Producer independently replayed this consumer; source-rule revision and generator hashes remain distinct.
- Frozen read-v1: unchanged SHA256 `7cd8b312704a75822c0495faa5c216f8536dc125aca0d9ee588ce5647fc8e101`; 57 replay cases passed. Command: `node scripts/marketing-compatibility.mjs tests/fixtures/marketing-office/read-v1.json <sha>`.
- RED/GREEN logs for parser, lifecycle, routes, composed app, view and transport are local under `reports/dynamic-context/`. Full interim suite: 542 passed, zero skipped; final rerun below is required after subsequent fixes.
- Browser found an actual native timer receiver error that Node did not expose. Default timers now use wrappers; a regression checks host functions never receive the controller as receiver. Context status text now refreshes even when no context identity changed.
- App :4184 and actual built Worker :4185: Business A directory, Campaign board and blank Ask passed. Worker Business B purges Marketing and shows only Projects as unsupported, without implicit Projects calls. 64-row directory and 8-facade paging passed, including selecting key synthetic-leaf-64. Same-Business empty-context refresh returns Lobby; browser Back cannot revive removed key. Actual 60-second expiry closes directory; presentation retry leaves it expired until explicit context reload.
- Browser evidence so far used initial fixture hash `5018d4d93d8695c040fa2c84d5261c7c3dc14dc709088a327b4f611ca144ee4a`; final fixture changes only the calendar-overflow mutation/generator hash. Final harness restart and browser smoke are still required; do not substitute initial evidence for final runtime identity.
- Independent whole-patch review requested against runtime commit `db15ee01d1873851fa62bfb2b563cef4e36c4441`. Review resolution, final test/build and hosted CI remain pending.
- Live/public API, auth, grants, complete catalogue and dynamic Studio/shared scene ownership remain owner-contract gates. No live upstream was enabled.
### Final local verification
- Final fixture harnesses restarted on :4184 and :4185; browser Campaign board and blank Ask replay passed on both with hash `68aae4bddcb5fd737945974a40cdf815e739426603e0d5b8a0ce3b4c1c4d6a7b`. Audit `reports/dynamic-context/final-browser-audit.json`: zero real upstream calls and no fixture violations.
- Built Worker final fixture: hold A context, switch to B, release A; directory stays B-only. Keyboard Enter activates floor and blank Ask. Mobile 390x844 directory and 360x800 Ask render without horizontal document overflow. Screenshots: app-final.png, worker-final.png, mobile-390.png, mobile-360.png.
- `npm test`: 543 passed, zero failures/skips. `npm run build`: passed, 24 Tycoon GLBs and Worker with377 embedded assets. These are local synthetic results, not hosted CI/live/deployment acceptance. Browser branch coverage is composed with deterministic lifecycle/router tests; no claim that every96 transport mutation was clicked in browser.
- Existing legacy renderer logs a data-URI GLTF load error under the harness CSP; candidate Tycoon GLBs and tested routes remain operational. No relaxing of network isolation was made for this inactive legacy renderer.
- Independent review found two P2s: suspended-view late context and focus losing an authorized route. Both reproduced RED, then fixed: suspension purges/fences the directory; same-Business refresh restores only a previously requested key present in a newly validated context. Different Business, hidden view, expired or absent key cannot restore it. Focused composed/lifecycle/view suite17PASS. Final full suite/build rerun follows.

### Review closure and delivery
- Follow-up regression fixes: hide the Office surface before suspend emits (prevents nested navigation), cancel pending restore on explicit user navigation, and use replace semantics for internal refresh transitions (no extra browser history entries). Each was observed RED then GREEN. Reviewer re-inspected the composed fixes and reported no remaining actionable issues.
- Final runtime `ad2a20e4`: full suite544PASS, zero skipped; buildPASS. After rebuilding/restarting the actual Worker, browser refresh retains Marketing, navigation to Work stays on Work, returning to Office reloads authorized context and Campaign/blank Ask works again. Source app refresh/Campaign/blank Ask also rerun. Evidence: tests-final-reviewed.log, build-final-reviewed.log, worker-reviewed.png, app-reviewed.png under reports/dynamic-context.
- PR4 is a draft stacked on PR3; neither was merged by this task. Hosted CI must be checked against the final pushed head. Production/live gates remain closed.
## Follow-up: pending-response regression matrix (owner requested)

Scope: deterministic synthetic tests on merged baseline45696f28; no new API or live integration.
1. Hold Campaign/Ask replies across Business/domain changes, hidden, suspend, dispose, same-Business refresh/focus, expiry and denial. Assert abort + generation change and immediate data/source purge before settling late successes or errors.
2. Hold context across same-Business refresh/focus. Resolve the replacement first, then stale reply; retain replacement authority even when opaque revision is identical.
3. Hold scene recovery callbacks across expiry/revocation. Assert stale status/error cannot restore UI, sheets or controls; scene retry never fetches authority.
4. Run focused/full tests and build; independent review; PR and exact-head CI. Existing passing behavior needs no artificial RED or runtime change. Record any discovered defect separately.
- Independent review found private dialog content remained in hidden DOM after purge. Four new DOM assertions reproduced the defect (RED); clearing content on the dynamic view's purge transition fixes it (focused34GREEN). This follow-up therefore includes one scoped runtime fix, not only tests. Scene adapters prove callback fencing; they do not replace GPU/browser acceptance.
- Review closure: added four natural Campaign AUTH_REQUIRED/FORBIDDEN and Ask401/403 rejection cases to prove peer abort and stale-success suppression through real controller entry paths. Reviewer reran focused38PASS and found no further material findings. Final full suite574PASS0skip and buildPASS (24GLBs/377assets). Runtime fix b543a0cb; final test commit recorded in PR5. No live, new API or automatic merge.
