# Zuri Office Execution Contract v1

**Status:** proposed source contract; not an existing Zuri API and not connected to the current Visual Office path. It must be reviewed by the Zuri execution/API owners before adoption.

Schema: [`contracts/zuri-office-execution-v1.schema.json`](../contracts/zuri-office-execution-v1.schema.json). JavaScript reference guards: [`scripts/office-execution-contract.mjs`](../scripts/office-execution-contract.mjs). Contract tests: [`tests/execution-contract.test.mjs`](../tests/execution-contract.test.mjs).

## Boundary and authority

The contract separates four messages:

1. `office-command`: authenticated Office client → Zuri API.
2. `execution-assignment`: Zuri Core → authenticated Worker.
3. `execution-event`: Worker → Zuri Core.
4. `capability-declaration`: an active adapter's bounded report to Zuri.

Every message is strict and uses `contractVersion: "zuri.office-execution.v1"`. Unknown fields fail closed. The browser command must not carry tenant/business scope, credentials, provider secrets, local paths, or provider runtime configuration. Zuri resolves identity, scope, role policy, execution profile and adapter from authenticated authority. The Worker obtains any scoped context or model credential through a claim-bound Core operation; secrets are not copied into assignments, events, logs or receipts.

An assignment includes `claimId`, `fencingToken`, `leaseExpiresAt` and immutable `deadlineAt`. The Worker can act only for the active claim and fencing token. Events repeat the assignment's opaque identity tuple and fencing token; Core validates that binding instead of trusting scope fields returned by the Worker.

## Message rules

| Message | Required invariants |
|---|---|
| `office-command` | Stable UUID `commandId`, stable `idempotencyKey`, action, expected revision and action-specific payload. Start/cancel/respond bind to exact session and turn. Session creation requests an Office role and optional authorized execution profile; it does not select credentials. |
| `execution-assignment` | Core-issued assignment/claim/job/session/turn/command IDs, selected adapter/version, action, expected revision, positive fencing token, lease expiry no later than the job deadline. No client-supplied scope or secret is copied through. |
| `execution-event` | Stable event ID, monotonic sequence and revision, required cursor, event type/state, strict RFC 3339 timestamp, bounded sanitized payload and terminal receipt. Conflicting duplicates or sequence gaps stop projection and require reconciliation. |
| `capability-declaration` | Every capability is explicitly `supported`, `unsupported`, or `unknown`; includes observation/expiry time and concurrency/file limits. Missing evidence must never default to supported. |

Attachment commands carry references only: opaque object ID, name, MIME type, byte count and SHA-256. The API validates scope and file receipt before binding references to a turn. This contract does not assume the existing T3 upload store is a Zuri storage service.

The reference guard also checks rules that plain JSON Schema cannot compare: actual calendar dates, a live lease and deadline at receipt time, lease expiry no later than the job deadline, capability expiry after observation and current time, and the aggregate attachment-byte limit.

## State and cancellation semantics

Normalized states are `accepted`, `running`, `waiting`, `cancel_requested`, `cancel_acknowledged`, `completed`, `failed`, `cancelled`, and `unknown`.

- `cancel_requested` means the control plane recorded the request.
- `cancel_acknowledged` means the adapter accepted the interruption request; the process may still be running.
- `cancelled` is allowed only with a `cancel.confirmed` event and a termination receipt with confirmation time. A reconciliation that reports cancellation needs the same evidence.
- `unknown` means the external effect cannot yet be proven. Reconcile before any retry; never present it as success or cancellation.
- A completed provider result after a cancel request is `completed` with a too-late cancellation outcome, not `cancelled`.
- Terminal states never return to a running state. A reconciliation reporting `running` or `completed` needs a provider receipt; `failed` and `unknown` need a typed error code. A reconciliation can resolve `unknown` to an observed state but cannot start the turn again.

The existing T3 runner does not yet provide all these receipts. Its current `cancelled` projection must be corrected or wrapped with an authoritative stop receipt before it can pass this contract.

## Idempotency and bounded autonomous work

- Reuse the same `commandId`, idempotency key, session and turn IDs for every retry of one logical action. Same key plus a different payload is a conflict, never a new operation.
- Admission requires an immutable `deadlineAt`; no deadline means reject. Initial proposed defaults are at most three total dispatch attempts for one idempotent command and one read-only reconciliation after an ambiguous external outcome. The reference guard returns `dispatch-same-command` with the next bounded attempt number only for known no-effect outcomes.
- Retry only when no external effect occurred. After an ambiguous effect, reconcile once; if still unknown, stop as `unknown`/blocked. Never issue a fresh command ID to escape the limit.
- Lease renewal cannot extend the job deadline. Fencing makes an expired worker unable to report or perform new work.
- Deadline/attempt exhaustion, repeated same-state evidence, invalid transitions, scope mismatch, stale fencing token, conflicting duplicate, or event gap stops the workflow with a typed outcome. No automatic successor job, gate self-approval, or deadline extension is permitted.

## Compatibility and adoption gate

This is an Office-side proposal/reference implementation only. It does not change `scripts/bridge.mjs`, dispatch to a new endpoint, or establish that Zuri implements these messages. Before adoption, the Zuri owner must map each field to an existing canonical owner/requirement, confirm the private route and authorization model, and add producer/consumer contract tests. A later adapter branch must preserve the current T3 behavior and pass the golden suite in [`tests/golden-e2e-parity.md`](../tests/golden-e2e-parity.md). No T3 retirement follows from schema validity alone.
