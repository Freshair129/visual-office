# Shared Marketing vectors — consumer preparation

Owner-delegated P0, 24 October 2026. Producer worktree:
`C:/Users/suanr/.codex/worktrees/marketing-gap-20261024/zuri.ai`, reported HEAD
`e509460a246804e6f9af8068c6546db9035f4daf`. No live upstream or credentials.

Runner: `scripts/marketing-compatibility.mjs <vectors.json> <sha256>`.
Accepts the agreed numeric schemaVersion 1 / marketing-office-read-v1 / synthetic:true
profile with vectors, kind, origin, request, upstream and expect. Every vector must
run; unknown kind/origin, unmatched upstream request and file hash mismatch fail.
In-process request streams feed the real createZuriConnector; fetchImpl only returns
the exact synthetic vector. No listener, network fetch or fallback is used.

Bounded reconciliation: Entry and Marketing 403/404 envelopes normalize source.status
to 403 and remove sourceCode; 401 remains distinct. This supersedes the previous
deferred-normalization decision for these read paths only. Regression tests observed
RED before fixes. Producer's empty trimmed question is accepted by the proxy and null
answer counts/values survive sanitization. Floor/UI implementation is outside this task.

Preparation tests: 18 passed, no failures/skips (runner self-test plus connector suite).
Final shared-file run is pending producer file path/hash; no joined compatibility or
live acceptance claimed. UI currently still requires a nonempty question; separately
reconcile the overview affordance when UI scope is authorized.

## Final shared-file qualification

Producer file SHA256 bytes: `7cd8b312704a75822c0495faa5c216f8536dc125aca0d9ee588ce5647fc8e101`.
Actual in-process connector passed **57/57**: Entry 10, Campaign 16, Ask 31.
All 12 producer source LF hashes were verified against the manifest. Result:
`reports/office-tycoon-design/marketing-shared-vectors-final.json`; exact consumer
HEAD, dirty file hashes and command: `marketing-shared-provenance.json` in that folder.
No real network, credentials, listener or fallback. No commit, stage or deployment.

Initial shared runs failed on null date-window bounds and absent typed failure
state in Ask and Entry. Fixes retain null from/to and expose the classified state
on those failure envelopes. Recursive partial matching now applies within arrays
while preserving exact length and ordering. All fixture forbiddenOutputMarkers
are checked against serialized responses. The runner captures fetch assertion
violations outside the connector catch, verified RED then GREEN with an expected
UNAVAILABLE response that previously hid a wrong URL. No producer fixture edits.

`npm test`: 418 passed, zero failures/skips. Build and independent review are
recorded in the final handoff. UI empty overview remains outside this proxy task;
no live, hosted CI or actual Agent dispatch acceptance is implied.

Final review: independent GPT-6 Luna Max found no actionable findings and independently
reran the pinned 57/57 synthetic vectors. Author build passed with 370 embedded assets.
Two changed document links checked (4 targets); diff whitespace check passed. Consumer
files in the provenance manifest are frozen for producer review; unrelated dirty work
was neither staged nor committed. No deferred reviewer findings or scope rulings.
