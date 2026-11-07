# Marketing P1 — blank overview and browser floor acceptance

Owner requested execution 24 October 2026; no live connection. This extends the
approved Marketing read pilot. P0 fixture and server connector remain unchanged;
P1 intentionally changes the previously frozen browser connector and UI/test files.

## Design

An empty or whitespace-only question requests the deterministic overview. State
this beside the field and label the empty submit action "ดูภาพรวม Marketing".
Validate a string after trim, maximum 400; do not use a raw maxlength that rejects
padded valid input. Disable submit while loading or without selected Business.
Show null metrics as unknown, preserving zero. Render only bounded provenance.
Marketing continues as the existing labeled GLB pilot: board shows Campaigns,
kiosk opens Ask, floor switches fence pending results, furniture never creates agents.

Browser acceptance uses a separate /tools/marketing-preview.html with the actual
TycoonView, TycoonScene and browser ZuriConnector. The isolated server
`scripts/serve-marketing-preview.mjs` on :4183 injects pinned P0 upstream payloads
into the actual Node connector/sanitizer, with no network fallback. Browser calls
are same-origin; incoming cookies are discarded and replaced with a synthetic value. Persistent banner labels all data as simulation. Explicit
scenario selection exercises READY, EMPTY, PARTIAL, UNKNOWN, unavailable and denial.
This test surface is not a live connector mode or a dynamically authorized floor.

## Implementation

1. RED tests in tycoon-data/view and zuri-panel: blank/whitespace overview,
   padded400 accepted,401 rejected, noBusiness disabled, loading duplicate guard,
   null not zero; preserve existing stale/scope regressions.
2. Change web/zuri-connector.js and web/tycoon-data.js input guards; update Ask
   form/result presentation in web/tycoon-view.js and scoped CSS as needed.
3. Add isolated browser test page and fixture adapter under web/tools. Verify
   navigation Building/Lobby/Marketing, real canvas board and kiosk picks, blank
   submit, text question, twoBusiness, errors, and mobile layout through browser UI.
4. Run targeted tests, full npm test, npm run build, P0 pinned57 vectors unchanged,
   document link checks and independent review. Record screenshots/results locally.

## Review focus

Blank input versus invalid types;400 trimmed boundary; duplicate submissions;
null/zero semantics; stale data on scope/floor/denial; fixture UI never impersonates
live and never falls back to network; Projects/local saved scenes remain intact.

## Ledger

Ruling: continue in current dirty tree to preserve dependent uncommitted Studio
work. No commit/stage/deploy or platform changes. Cost: evidence needs source hashes.


## Verification and handoff

Existing Marketing GLB floor qualified; this is not a newly built floor. Production
changes are blank overview, trimmed counter/validation, displayed Campaign ID/count,
null metric/date-window labels, generatedAt versus checkedAt wording and recovery.

Browser evidence is under `reports/office-tycoon-design/marketing-p1-*`. The evidence
JSON maps B01–B11 to observed actions. Actual canvas board and kiosk picks, Enter/Escape,
blank/whitespace, padded400/401, partial/unknown/empty/error, denial/recovery, held A→B,
held Ask→Lobby and both actual401 read failure and explicit simulated logout were
exercised. Browser viewport was set to390×844 for one screenshot then restored; this
is browser responsive evidence, not physical-device acceptance. Business B/HOLD and
question substitutions are labeled source-derived mutations; other-domain Projects
returns a labeled503 transport fixture, not a claimed PM read. Safe projections pass
through the actual server sanitizer. The earlier temporary DTO-only adapter was removed.

Review fixes (independent GPT-6 Luna Max): stale truncation after Business switch/error
and keyboard focus lost during recovery. Both regressions observed RED then GREEN.
Browser additionally exposed missing recovery CTA after an in-place denial; test RED
then GREEN and actual browser recovery retested. Final full-suite/build and current
hashes are recorded in `marketing-p1-evidence.json`; P0 evidence remains unchanged.

Live auth/upstream, hosted CI/deployment, Agent dispatch, dynamic floor grants and
shared save remain outside this acceptance. No commit/stage or producer edits.

Final checks: `npm test`423/423 (0 failures/skips); build passed372 embedded assets;
P0 compatibility57/57 on original hash; changed-document relative links and diff
whitespace passed. Browser/runtime inputs frozen in marketing-p1-evidence.json.
Final fixture-specific fix: only map Business-B campaign rows when the fixture
collection is an array; malformed B payload now reaches the real sanitizer and
produces ERROR. Restarted final fixture server and retested; violations=[].
Final review findings fixed; no deferred review minors. Live remains unselected.
