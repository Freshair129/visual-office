# Golden E2E Parity Suite: T3 Baseline and Zuri Native Runtime

**Suite status:** acceptance specification; not yet an executable live-provider suite. The current package uses Node's test runner and injected ports. No T3 or Native end-to-end scenario was run while writing this catalog.

The source inventory and migration DAG are in [`docs/T3-CAPABILITY-INVENTORY.md`](../docs/T3-CAPABILITY-INVENTORY.md). This file is the shared behavioral contract for (1) recording a T3 0.0.45 baseline, (2) qualifying a Zuri-fronted T3 adapter, and (3) proving a Native adapter without T3.

## Run modes

| Mode | Runtime | Purpose | Required isolation |
|---|---|---|---|
| `T3_BASELINE` | T3 0.0.45 + current local bridge | Record behavior and durable receipts | Dedicated T3 project/workspace and test identities |
| `ZURI_T3_ADAPTER` | Zuri control plane forwarding to T3 | Prove Zuri front-door identity, mapping, authorization and retry behavior | Same test-only project; Zuri is the only command entry point |
| `NATIVE_CANDIDATE` | Zuri Native Worker/provider adapter | Compare supported capabilities against the baseline | Dedicated sandbox provider/workspace; T3 not assigned ownership |
| `NATIVE_ONLY` | Native adapter with T3 and bridge disabled | Retirement proof | T3 process and local bridge unavailable; no fallback to T3 |

No mode may execute the same job/turn through two adapters. Recorded events and read-only projections are permitted for comparison; provider side effects are not shadowed.

## Golden scenarios

| ID | Scenario | Action | Required assertions |
|---|---|---|---|
| GEP-01 | Single-role task lifecycle | Submit a role task, dispatch thread and first turn, then collect terminal result | One durable job/session/turn mapping; exact command and message IDs survive retry; result and terminal status point to the same turn |
| GEP-02 | Team fan-out and synthesis gate | Start multiple specialists; allow synthesis only after all succeed; inject one specialist failure in a separate run | No early synthesis; one synthesis turn after full success; any specialist failure prevents synthesis and records the blocking reason |
| GEP-03 | Continue an existing chat | Send a follow-up on the selected thread while another job is queued | Correct thread identity, per-thread ordering, no cross-role message, and no turn start while an approval/question or active turn blocks it |
| GEP-04 | Status, events and reconnect | Observe queued/running/waiting/terminal states; disconnect and reconnect during activity | Cursor/sequence has no gaps or regression; snapshots reconcile to event state; stale/offline is explicit and latest evidence is retained without claiming live |
| GEP-05 | Approval and structured question | Cause a real pending interaction, approve/reject or answer through the authorized surface, then resume | Decision binds to exact interaction, turn, action and authorized responder; rejection/expiry cannot resume; approval is audited; the correct turn alone resumes |
| GEP-06 | Cancellation truthfulness | Cancel while queued and while a provider turn is running | Distinct requested/acknowledged/confirmed outcomes; `cancelled` is shown only after stop confirmation; `TOO_LATE`, `UNSUPPORTED` and `UNKNOWN` remain distinct and do not fabricate completion |
| GEP-07 | Chat attachment lifecycle | Upload an allowed file, attach it to a turn, retry after a simulated timeout | Bytes/hash, MIME, size and turn binding are exact; private storage only; duplicate retry creates neither a second effect nor an untracked upload; invalid/cross-thread references fail closed |
| GEP-08 | Knowledge snapshot integrity | Dispatch a job with pinned knowledge version(s), then change or corrupt a source before dispatch | The runner verifies pinned digest/size/MIME; mismatch aborts before the provider turn; the result records the knowledge version actually used |
| GEP-09 | Crash and uncertain-effect recovery | Restart after session create, after provider accepted a turn but before Office receipt, and after upload but before cached ID persistence | Stable identities recover the original operation; no duplicate turn/upload; uncertain external side effects become `UNKNOWN` and reconcile before retry |
| GEP-10 | Capacity and offline queue | Fill the advertised budget (currently documented as six active turns and ten unfinished jobs) and enqueue work while the local runtime is offline | Limits are enforced; excess work stays queued; recovery drains once; rejected/expired work has explicit outcome and does not exceed capacity |
| GEP-11 | Authorization and secret isolation | Attempt browser-to-worker forgery, cross-scope reads/writes, wrong worker identity and provider capability disclosure | Server derives tenant/business/principal scope; unauthorized actions fail closed; browser never receives worker/provider credentials; logs/events redact secrets and hidden reasoning |
| GEP-12 | Capability discovery and unsupported path | Query active adapter capabilities and request an unsupported operation/model/tool | Capabilities reflect the selected runtime; unsupported operations return explicit `UNSUPPORTED`; no silent fallback or false “working” status |
| GEP-13 | Native-only independence | Run the advertised Office flows with T3 and its local bridge stopped | Session/turn/results/recovery work through Native for every capability claimed as supported; no T3 request, hidden fallback or T3-owned receipt appears |
| GEP-14 | Autonomous loop bound | Inject an unchanged failure/timeout repeatedly and let the controller retry | One immutable deadline; at most three attempts per idempotent command plus one read-only reconciliation; same IDs are reused; no recursive successor job; exhausted budget becomes `BLOCKED`/`UNKNOWN` and stops dispatch |

## Suite acceptance

1. Each scenario has a deterministic setup, a bounded timeout, a terminal assertion, and a sanitized receipt tied to exact source/runtime revisions.
2. Baseline scenarios pass against the currently supported T3 path before comparing a candidate. A changed T3 baseline is recorded as a new revision, never overwritten.
3. `ZURI_T3_ADAPTER` proves the command front door and stable mapping; it does not transfer ownership of a running T3 provider session to Zuri.
4. Native parity is reported per capability. `UNSUPPORTED`, `UNKNOWN`, `BLOCKED`, skipped, timeout, and missing receipts are not passes.
5. Full retirement requires every advertised capability to pass `NATIVE_ONLY`, including recovery and authorization. Partial parity keeps T3 for the capabilities that remain T3-only.
6. A live-provider test runs only in the dedicated sandbox with harmless inputs, explicit provider limits, and a cleanup receipt. A mock-only test cannot satisfy an E2E row.
7. Loop-control defaults are finite and visible: immutable deadline at admission, no more than three dispatch attempts for the same idempotent command, and at most one read-only reconciliation after an uncertain effect. A budget/deadline failure is terminal until a new, explicit revision is admitted.

## Existing source test coverage (not E2E evidence)

| Existing test file | Useful coverage | Does not establish |
|---|---|---|
| Retired direct browser T3 client (26 October cleanup) | Not shipped; bridge/Worker tests cover the active transport | Historical direct-client assertions do not qualify the active transport |
| `tests/role-runner.test.mjs` | Fan-out, stable IDs, retries, pending approvals, failure gating and queue behavior through injected dispatch | Provider process stopped after interrupt; live provider receipts |
| `tests/chat-runner.test.mjs` | Per-thread turn queue, pending-interaction wait, attachment retry and capability projection | Real upload bytes or provider-side processing |
| `tests/worker.test.mjs` | Durable queue identity, access checks, cancellation intent, snapshot validation and storage behavior with a fake bucket | Hosted R2/Sites auth or cross-tenant Zuri end-to-end isolation |
| `tests/work-review.test.mjs` | Review metadata and idempotent correction handoff | Provider execution of the handoff |
| `tests/result-files.test.mjs` | Private bounded file metadata/download behavior | Native adapter file storage or malware scanning |

## Harness work required before calling this executable

- Introduce a versioned adapter port that exposes the same normalized receipts and capability declarations for T3 and Native; keep credentials and scope resolution server-side.
- Add a sandbox configuration/runner that can start, stop and fault-inject each runtime without reading developer `.local` credentials or using production endpoints.
- Capture event/command receipts with stable IDs and secret-redacted payloads; support deterministic replay for read-only projection tests.
- Implement process-level tests for worker restart, lease/fencing and uncertain external effects. Current unit tests inject `dispatch`, fetch and storage ports.
- Add browser/API flow only after authenticated test identities and isolated Site/Worker endpoints are available; the package currently declares `node --test`, not a browser E2E framework.

Until that harness exists, this catalog is the acceptance source for implementation planning; it must not be reported as a passing test run.
