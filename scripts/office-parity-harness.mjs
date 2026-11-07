import { createHash } from 'node:crypto';
import {
  MAX_DISPATCH_ATTEMPTS,
  MAX_RECONCILIATION_ATTEMPTS,
  OFFICE_EXECUTION_VERSION,
  retryDisposition,
} from './office-execution-contract.mjs';

export const OFFICE_PARITY_VERSION = 'zuri.office-parity.v1';
export const OFFICE_PARITY_RUN_MODES = Object.freeze([
  'T3_BASELINE',
  'ZURI_T3_ADAPTER',
  'NATIVE_CANDIDATE',
  'NATIVE_ONLY',
]);
export const OFFICE_PARITY_OUTCOMES = Object.freeze([
  'PASS',
  'FAIL',
  'NOT_RUN',
  'BLOCKED',
  'UNSUPPORTED',
]);
export const MAX_PARITY_COMMANDS = 100;
export const MAX_PARITY_RUN_DURATION_MS = 30 * 60 * 1000;

const RUN_MODE_SET = new Set(OFFICE_PARITY_RUN_MODES);
const SCENARIO_SET = new Set(Array.from({ length: 14 }, (_, index) => `GEP-${String(index + 1).padStart(2, '0')}`));
const EVIDENCE_CLASSES = new Set(['contract-simulation', 'provider-e2e']);
const ADAPTER_KINDS = new Set(['fake', 'provider']);
const PLAN_FIELDS = ['contractVersion', 'runId', 'mode', 'scenarioIds', 'revisions', 'issuedAt', 'deadlineAt', 'budget', 'evidence', 'commands'];
const REVISION_FIELDS = ['visualOffice', 'zuri'];
const BUDGET_FIELDS = ['maxCommands', 'maxDispatchAttempts', 'maxReconciliations'];
const COMMON_EVIDENCE_FIELDS = ['classification', 'evidenceId', 'environmentId', 'preparedAt'];
const COMMAND_FIELDS = ['scenarioId', 'commandId', 'sessionId', 'turnId', 'idempotencyKey', 'adapterId'];
const ADAPTER_REQUIRED_FIELDS = ['id', 'kind', 'version', 'modes', 'dispatch'];
const ADAPTER_OPTIONAL_FIELDS = ['reconcile'];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVISION_PATTERN = /^[0-9a-f]{40}$/;
const ADAPTER_ID_PATTERN = /^[a-z][a-z0-9._/-]{0,63}$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TIMESTAMP_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

const isRecord = (value) => value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function timestampMillis(value) {
  if (typeof value !== 'string') return NaN;
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return NaN;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return NaN;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1] ? millis : NaN;
}

function clockMillis(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  return timestampMillis(value);
}

function addUnknownFields(value, path, allowed, errors) {
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push({ code: 'UNKNOWN_FIELD', path: `${path}.${key}` });
  }
}

function checkObject(value, path, allowed, required, errors) {
  if (!isRecord(value)) {
    errors.push({ code: 'OBJECT_REQUIRED', path });
    return false;
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) errors.push({ code: 'FIELD_REQUIRED', path: `${path}.${key}` });
  }
  addUnknownFields(value, path, allowed, errors);
  return true;
}

function checkText(value, path, errors, { min = 1, max = 128, pattern = SAFE_ID_PATTERN, code = 'INVALID_TEXT' } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > max || !pattern.test(value)) {
    errors.push({ code, path });
  }
}

function checkTimestamp(value, path, errors) {
  if (!Number.isFinite(timestampMillis(value))) errors.push({ code: 'INVALID_TIMESTAMP', path });
}

function addUnique(map, key, value, path, duplicateCode, conflictCode, errors) {
  if (map.has(key)) {
    errors.push({ code: map.get(key) === value ? duplicateCode : conflictCode, path });
  } else {
    map.set(key, value);
  }
}

function enforceOwner(map, key, owner, path, conflictCode, errors) {
  if (map.has(key) && map.get(key) !== owner) {
    errors.push({ code: conflictCode, path });
  } else if (!map.has(key)) {
    map.set(key, owner);
  }
}

function validateEvidence(evidence, issuedAtMs, deadlineAtMs, nowMs, errors) {
  if (!isRecord(evidence)) {
    errors.push({ code: 'OBJECT_REQUIRED', path: '$.evidence' });
    return;
  }
  const classification = evidence.classification;
  const classField = classification === 'contract-simulation' ? 'simulationId' : 'sandboxId';
  const allowed = [...COMMON_EVIDENCE_FIELDS, classField];
  const required = [...COMMON_EVIDENCE_FIELDS, classField];
  checkObject(evidence, '$.evidence', allowed, required, errors);
  if (!EVIDENCE_CLASSES.has(classification)) errors.push({ code: 'INVALID_EVIDENCE_CLASS', path: '$.evidence.classification' });
  for (const field of ['evidenceId', 'environmentId']) checkText(evidence[field], `$.evidence.${field}`, errors);
  if (classification === 'contract-simulation' || classification === 'provider-e2e') {
    checkText(evidence[classField], `$.evidence.${classField}`, errors);
  }
  checkTimestamp(evidence.preparedAt, '$.evidence.preparedAt', errors);
  const preparedAtMs = timestampMillis(evidence.preparedAt);
  if (Number.isFinite(preparedAtMs) && Number.isFinite(issuedAtMs) && preparedAtMs < issuedAtMs) {
    errors.push({ code: 'EVIDENCE_PRECEDES_RUN', path: '$.evidence.preparedAt' });
  }
  if (Number.isFinite(preparedAtMs) && Number.isFinite(nowMs) && preparedAtMs > nowMs) {
    errors.push({ code: 'EVIDENCE_FROM_FUTURE', path: '$.evidence.preparedAt' });
  }
  if (Number.isFinite(preparedAtMs) && Number.isFinite(deadlineAtMs) && preparedAtMs >= deadlineAtMs) {
    errors.push({ code: 'EVIDENCE_AFTER_DEADLINE', path: '$.evidence.preparedAt' });
  }
}

export function validateOfficeParityPlan(plan, now) {
  const errors = [];
  const nowMs = clockMillis(now);
  if (!Number.isFinite(nowMs)) errors.push({ code: 'INVALID_CLOCK', path: '$.now' });
  if (!checkObject(plan, '$', PLAN_FIELDS, PLAN_FIELDS, errors)) return { valid: false, errors };

  if (plan.contractVersion !== OFFICE_PARITY_VERSION) errors.push({ code: 'INVALID_CONTRACT_VERSION', path: '$.contractVersion' });
  if (typeof plan.runId !== 'string' || !UUID_PATTERN.test(plan.runId)) errors.push({ code: 'INVALID_RUN_ID', path: '$.runId' });
  if (!RUN_MODE_SET.has(plan.mode)) errors.push({ code: 'INVALID_RUN_MODE', path: '$.mode' });

  if (!Array.isArray(plan.scenarioIds) || plan.scenarioIds.length < 1 || plan.scenarioIds.length > 14) {
    errors.push({ code: 'INVALID_SCENARIO_LIST', path: '$.scenarioIds' });
  } else {
    const scenarios = new Set();
    for (let index = 0; index < plan.scenarioIds.length; index += 1) {
      const scenarioId = plan.scenarioIds[index];
      if (typeof scenarioId !== 'string' || !SCENARIO_SET.has(scenarioId)) {
        errors.push({ code: 'INVALID_SCENARIO_ID', path: `$.scenarioIds[${index}]` });
      } else if (scenarios.has(scenarioId)) {
        errors.push({ code: 'DUPLICATE_SCENARIO_ID', path: `$.scenarioIds[${index}]` });
      } else {
        scenarios.add(scenarioId);
      }
    }
  }

  if (checkObject(plan.revisions, '$.revisions', REVISION_FIELDS, REVISION_FIELDS, errors)) {
    for (const field of REVISION_FIELDS) {
      if (typeof plan.revisions[field] !== 'string' || !REVISION_PATTERN.test(plan.revisions[field])) {
        errors.push({ code: 'PINNED_REVISION_REQUIRED', path: `$.revisions.${field}` });
      }
    }
  }

  checkTimestamp(plan.issuedAt, '$.issuedAt', errors);
  checkTimestamp(plan.deadlineAt, '$.deadlineAt', errors);
  const issuedAtMs = timestampMillis(plan.issuedAt);
  const deadlineAtMs = timestampMillis(plan.deadlineAt);
  if (Number.isFinite(issuedAtMs) && Number.isFinite(nowMs) && issuedAtMs > nowMs) {
    errors.push({ code: 'RUN_ISSUED_IN_FUTURE', path: '$.issuedAt' });
  }
  if (Number.isFinite(issuedAtMs) && Number.isFinite(deadlineAtMs)) {
    if (deadlineAtMs <= issuedAtMs) errors.push({ code: 'DEADLINE_NOT_AFTER_ISSUED_AT', path: '$.deadlineAt' });
    if (deadlineAtMs - issuedAtMs > MAX_PARITY_RUN_DURATION_MS) errors.push({ code: 'DEADLINE_EXCEEDS_MAX_DURATION', path: '$.deadlineAt' });
    if (Number.isFinite(nowMs) && deadlineAtMs <= nowMs) errors.push({ code: 'DEADLINE_EXPIRED', path: '$.deadlineAt' });
  }

  if (checkObject(plan.budget, '$.budget', BUDGET_FIELDS, BUDGET_FIELDS, errors)) {
    if (!Number.isInteger(plan.budget.maxCommands) || plan.budget.maxCommands < 1 || plan.budget.maxCommands > MAX_PARITY_COMMANDS) {
      errors.push({ code: 'INVALID_COMMAND_BUDGET', path: '$.budget.maxCommands' });
    }
    if (!Number.isInteger(plan.budget.maxDispatchAttempts) || plan.budget.maxDispatchAttempts < 1 || plan.budget.maxDispatchAttempts > MAX_DISPATCH_ATTEMPTS) {
      errors.push({ code: 'INVALID_DISPATCH_BUDGET', path: '$.budget.maxDispatchAttempts' });
    }
    if (!Number.isInteger(plan.budget.maxReconciliations) || plan.budget.maxReconciliations < 0 || plan.budget.maxReconciliations > MAX_RECONCILIATION_ATTEMPTS) {
      errors.push({ code: 'INVALID_RECONCILIATION_BUDGET', path: '$.budget.maxReconciliations' });
    }
  }

  validateEvidence(plan.evidence, issuedAtMs, deadlineAtMs, nowMs, errors);

  if (!Array.isArray(plan.commands) || plan.commands.length < 1) {
    errors.push({ code: 'COMMANDS_REQUIRED', path: '$.commands' });
  } else {
    if (isRecord(plan.budget) && Number.isInteger(plan.budget.maxCommands) && plan.commands.length > plan.budget.maxCommands) {
      errors.push({ code: 'COMMAND_BUDGET_EXCEEDED', path: '$.commands' });
    }
    if (plan.commands.length > MAX_PARITY_COMMANDS) errors.push({ code: 'COMMAND_BUDGET_EXCEEDED', path: '$.commands' });
    const commandIds = new Map();
    const idempotencyKeys = new Map();
    const sessionOwners = new Map();
    const turnOwners = new Map();
    const runOwners = new Set();
    const scenarioCoverage = new Set();
    for (let index = 0; index < plan.commands.length; index += 1) {
      const command = plan.commands[index];
      const path = `$.commands[${index}]`;
      if (!checkObject(command, path, COMMAND_FIELDS, COMMAND_FIELDS, errors)) continue;
      if (typeof command.scenarioId !== 'string' || !SCENARIO_SET.has(command.scenarioId)) {
        errors.push({ code: 'INVALID_SCENARIO_ID', path: `${path}.scenarioId` });
      } else {
        scenarioCoverage.add(command.scenarioId);
      }
      for (const field of ['commandId', 'sessionId', 'turnId']) {
        if (typeof command[field] !== 'string' || !UUID_PATTERN.test(command[field])) errors.push({ code: 'INVALID_IDENTITY', path: `${path}.${field}` });
      }
      checkText(command.idempotencyKey, `${path}.idempotencyKey`, errors, { min: 16, max: 128, pattern: /^[A-Za-z0-9._:-]+$/, code: 'INVALID_IDEMPOTENCY_KEY' });
      checkText(command.adapterId, `${path}.adapterId`, errors, { max: 64, pattern: ADAPTER_ID_PATTERN, code: 'INVALID_ADAPTER_ID' });
      if (typeof command.commandId === 'string' && UUID_PATTERN.test(command.commandId)) {
        addUnique(commandIds, command.commandId, command.adapterId, `${path}.commandId`, 'DUPLICATE_COMMAND_ID', 'COMMAND_ID_MULTIPLE_ADAPTERS', errors);
      }
      if (typeof command.idempotencyKey === 'string' && command.idempotencyKey.length >= 16) {
        addUnique(idempotencyKeys, command.idempotencyKey, command.adapterId, `${path}.idempotencyKey`, 'DUPLICATE_IDEMPOTENCY_KEY', 'IDEMPOTENCY_KEY_MULTIPLE_ADAPTERS', errors);
      }
      if (typeof command.sessionId === 'string' && UUID_PATTERN.test(command.sessionId)) {
        enforceOwner(sessionOwners, command.sessionId, command.adapterId, `${path}.sessionId`, 'SESSION_MULTIPLE_ADAPTERS', errors);
      }
      if (typeof command.turnId === 'string' && UUID_PATTERN.test(command.turnId)) {
        addUnique(turnOwners, command.turnId, command.adapterId, `${path}.turnId`, 'DUPLICATE_TURN_ID', 'TURN_MULTIPLE_ADAPTERS', errors);
      }
      runOwners.add(command.adapterId);
    }
    if (runOwners.size > 1) errors.push({ code: 'RUN_MULTIPLE_ADAPTERS', path: '$.commands' });
    if (Array.isArray(plan.scenarioIds)) {
      for (const scenarioId of plan.scenarioIds) {
        if (typeof scenarioId === 'string' && SCENARIO_SET.has(scenarioId) && !scenarioCoverage.has(scenarioId)) {
          errors.push({ code: 'SCENARIO_COMMAND_REQUIRED', path: '$.commands' });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateAdapterRegistry(adapters) {
  if (!(adapters instanceof Map)) throw new TypeError('adapters must be an explicit Map');
  for (const [key, adapter] of adapters.entries()) {
    if (!isRecord(adapter)) throw new TypeError('adapter descriptor must be a plain object');
    const allowed = [...ADAPTER_REQUIRED_FIELDS, ...ADAPTER_OPTIONAL_FIELDS];
    if (Object.keys(adapter).some((field) => !allowed.includes(field))) throw new TypeError('adapter descriptor contains an unknown field');
    if (ADAPTER_REQUIRED_FIELDS.some((field) => !Object.hasOwn(adapter, field))) throw new TypeError('adapter descriptor is incomplete');
    if (key !== adapter.id || typeof adapter.id !== 'string' || !ADAPTER_ID_PATTERN.test(adapter.id)) throw new TypeError('adapter registry key must match its id');
    if (!ADAPTER_KINDS.has(adapter.kind)) throw new TypeError('adapter kind must be fake or provider');
    if (typeof adapter.version !== 'string' || adapter.version.length < 1 || adapter.version.length > 64) throw new TypeError('adapter version is invalid');
    if (!Array.isArray(adapter.modes) || adapter.modes.length < 1 || adapter.modes.some((mode) => !RUN_MODE_SET.has(mode)) || new Set(adapter.modes).size !== adapter.modes.length) {
      throw new TypeError('adapter modes must be a unique list of explicit run modes');
    }
    if (typeof adapter.dispatch !== 'function') throw new TypeError('adapter dispatch must be injected');
    if (Object.hasOwn(adapter, 'reconcile') && typeof adapter.reconcile !== 'function') throw new TypeError('adapter reconcile must be a function');
    const expectedClass = adapter.kind === 'fake' ? 'contract-simulation' : 'provider-e2e';
    if ((adapter.kind === 'fake' && expectedClass !== 'contract-simulation')
      || (adapter.kind === 'provider' && expectedClass !== 'provider-e2e')) {
      throw new TypeError('adapter kind and evidence class do not match');
    }
  }
}

function freezeDeep(value) {
  if (isRecord(value) || Array.isArray(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function sanitizeReceipt(raw, plan, command, adapter) {
  return Object.freeze({
    kind: 'sanitized-office-parity-receipt',
    contractVersion: OFFICE_PARITY_VERSION,
    evidenceClass: plan.evidence.classification,
    evidenceIdDigest: digest(plan.evidence.evidenceId),
    environmentIdDigest: digest(plan.evidence.environmentId),
    runId: plan.runId,
    scenarioId: command.scenarioId,
    mode: plan.mode,
    revisions: Object.freeze({ visualOffice: plan.revisions.visualOffice, zuri: plan.revisions.zuri }),
    adapter: Object.freeze({ id: adapter.id, version: adapter.version }),
    commandId: command.commandId,
    sessionId: command.sessionId,
    turnId: command.turnId,
    idempotencyKeyDigest: digest(command.idempotencyKey),
    receiptReferenceDigest: digest(raw.providerReceiptId ?? raw.simulationId),
    status: raw.status,
    capturedAt: raw.capturedAt,
    sanitized: true,
  });
}

function validateReceipt(raw, plan, command, adapter, nowMs, expectedStatus) {
  if (!isRecord(raw)) return { valid: false, code: 'RECEIPT_MISSING' };
  const required = [
    'classification', 'evidenceId', 'environmentId', 'capturedAt', 'runId', 'mode',
    'scenarioId', 'revisions', 'adapterId', 'adapterVersion', 'commandId',
    'sessionId', 'turnId', 'idempotencyKey', 'status',
  ];
  const classField = plan.evidence.classification === 'contract-simulation' ? 'simulationId' : 'providerReceiptId';
  required.push(classField);
  if (plan.evidence.classification === 'provider-e2e') required.push('sandboxId');
  if (required.some((field) => !Object.hasOwn(raw, field))) return { valid: false, code: 'RECEIPT_INCOMPLETE' };
  if (raw.classification !== plan.evidence.classification
    || raw.evidenceId !== plan.evidence.evidenceId
    || raw.environmentId !== plan.evidence.environmentId
    || raw.runId !== plan.runId
    || raw.mode !== plan.mode
    || raw.scenarioId !== command.scenarioId
    || raw.adapterId !== adapter.id
    || raw.adapterVersion !== adapter.version
    || raw.commandId !== command.commandId
    || raw.sessionId !== command.sessionId
    || raw.turnId !== command.turnId
    || raw.idempotencyKey !== command.idempotencyKey
    || raw.status !== expectedStatus) {
    return { valid: false, code: 'RECEIPT_IDENTITY_MISMATCH' };
  }
  if (!isRecord(raw.revisions)
    || Object.keys(raw.revisions).some((field) => !REVISION_FIELDS.includes(field))
    || raw.revisions.visualOffice !== plan.revisions.visualOffice
    || raw.revisions.zuri !== plan.revisions.zuri) {
    return { valid: false, code: 'RECEIPT_REVISION_MISMATCH' };
  }
  const capturedAtMs = timestampMillis(raw.capturedAt);
  if (!Number.isFinite(capturedAtMs)
    || capturedAtMs < timestampMillis(plan.issuedAt)
    || capturedAtMs > timestampMillis(plan.deadlineAt)
    || capturedAtMs > nowMs) {
    return { valid: false, code: 'RECEIPT_TIMESTAMP_INVALID' };
  }
  if (plan.evidence.classification === 'contract-simulation') {
    if (raw.simulationId !== plan.evidence.simulationId) return { valid: false, code: 'SIMULATION_EVIDENCE_MISMATCH' };
  } else if (raw.sandboxId !== plan.evidence.sandboxId
    || typeof raw.providerReceiptId !== 'string'
    || !SAFE_ID_PATTERN.test(raw.providerReceiptId)) {
    return { valid: false, code: 'PROVIDER_RECEIPT_INCOMPLETE' };
  }
  return { valid: true };
}

function resultEnvelope(plan, outcome, code, commandResults = []) {
  const validClass = isRecord(plan?.evidence) && EVIDENCE_CLASSES.has(plan.evidence.classification);
  const evidenceClass = validClass ? plan.evidence.classification : 'unknown';
  const simulation = evidenceClass === 'contract-simulation';
  const liveOutcome = simulation ? 'NOT_RUN' : outcome;
  const simulationOutcome = simulation
    ? aggregateOutcomes(commandResults.map((item) => item.simulationOutcome ?? 'NOT_RUN'))
    : null;
  return Object.freeze({
    contractVersion: OFFICE_PARITY_VERSION,
    runId: typeof plan?.runId === 'string' && UUID_PATTERN.test(plan.runId) ? plan.runId : null,
    mode: RUN_MODE_SET.has(plan?.mode) ? plan.mode : null,
    revisions: isRecord(plan?.revisions) && REVISION_PATTERN.test(plan.revisions.visualOffice ?? '') && REVISION_PATTERN.test(plan.revisions.zuri ?? '')
      ? Object.freeze({ visualOffice: plan.revisions.visualOffice, zuri: plan.revisions.zuri })
      : null,
    evidenceClass,
    outcome: liveOutcome,
    liveParityOutcome: liveOutcome,
    simulationOutcome,
    code,
    commandResults: Object.freeze(commandResults),
    receipts: Object.freeze(commandResults.map((item) => item.receipt).filter(Boolean)),
  });
}

function aggregateOutcomes(outcomes) {
  if (outcomes.length === 0) return 'NOT_RUN';
  if (outcomes.includes('FAIL')) return 'FAIL';
  if (outcomes.includes('BLOCKED')) return 'BLOCKED';
  if (outcomes.includes('UNSUPPORTED')) return 'UNSUPPORTED';
  if (outcomes.includes('NOT_RUN')) return 'NOT_RUN';
  return 'PASS';
}

function commandResult(plan, command, outcome, code, attemptCount, reconciliationCount, receipt = null) {
  const simulation = plan.evidence.classification === 'contract-simulation';
  const normalizedOutcome = simulation ? 'NOT_RUN' : outcome;
  return Object.freeze({
    scenarioId: command.scenarioId,
    commandId: command.commandId,
    sessionId: command.sessionId,
    turnId: command.turnId,
    adapterId: command.adapterId,
    evidenceClass: plan.evidence.classification,
    outcome: normalizedOutcome,
    simulationOutcome: simulation ? outcome : null,
    code,
    dispatchAttempts: attemptCount,
    reconciliations: reconciliationCount,
    receipt,
  });
}

function blockedResults(plan, code) {
  return plan.commands.map((command) => commandResult(plan, command, 'BLOCKED', code, 0, 0));
}

function notRunResults(plan, code) {
  return plan.commands.map((command) => commandResult(plan, command, 'NOT_RUN', code, 0, 0));
}

function defaultRaceDeadline(operation, { remainingMs }) {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return Promise.resolve({ kind: 'timeout' });
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ kind: 'timeout' }), Math.max(1, Math.ceil(remainingMs)));
  });
  const call = Promise.resolve()
    .then(operation)
    .then((value) => ({ kind: 'resolved', value }), () => ({ kind: 'rejected' }));
  return Promise.race([call, timeout]).finally(() => clearTimeout(timer));
}

function getNowMillis(now) {
  try {
    return clockMillis(now());
  } catch {
    return NaN;
  }
}

async function callBounded({ operation, deadlineAt, now, raceDeadline }) {
  const startedAt = getNowMillis(now);
  const deadlineAtMs = timestampMillis(deadlineAt);
  if (!Number.isFinite(startedAt)) return { kind: 'clock-error' };
  if (!Number.isFinite(deadlineAtMs) || startedAt >= deadlineAtMs) return { kind: 'timeout' };
  let result;
  try {
    result = await raceDeadline(operation, { deadlineAt, remainingMs: deadlineAtMs - startedAt });
  } catch {
    return { kind: 'rejected' };
  }
  if (!isRecord(result) || !['resolved', 'rejected', 'timeout'].includes(result.kind)) return { kind: 'rejected' };
  if (result.kind === 'resolved' && !Object.hasOwn(result, 'value')) return { kind: 'rejected' };
  const finishedAt = getNowMillis(now);
  if (!Number.isFinite(finishedAt)) return { kind: 'clock-error' };
  if (finishedAt >= deadlineAtMs) return { kind: 'timeout' };
  return result;
}

function makeCommand(plan, command) {
  return freezeDeep({
    contractVersion: OFFICE_EXECUTION_VERSION,
    runId: plan.runId,
    mode: plan.mode,
    scenarioId: command.scenarioId,
    revisions: { visualOffice: plan.revisions.visualOffice, zuri: plan.revisions.zuri },
    commandId: command.commandId,
    sessionId: command.sessionId,
    turnId: command.turnId,
    idempotencyKey: command.idempotencyKey,
  });
}

function makeFinalCommandResult({ plan, command, adapter, status, rawReceipt, code, attemptCount, reconciliationCount, now }) {
  const nowMs = getNowMillis(now);
  const checked = validateReceipt(rawReceipt, plan, command, adapter, nowMs, status);
  if (!checked.valid) {
    const outcome = status === 'failed' ? 'FAIL' : 'BLOCKED';
    return commandResult(plan, command, outcome, checked.code, attemptCount, reconciliationCount);
  }
  const receipt = sanitizeReceipt(rawReceipt, plan, command, adapter);
  return commandResult(plan, command, status === 'completed' ? 'PASS' : 'FAIL', code, attemptCount, reconciliationCount, receipt);
}

async function runCommand({ plan, command, adapter, now, raceDeadline }) {
  const stableCommand = makeCommand(plan, command);
  let attemptCount = 0;
  let reconciliationCount = 0;
  let retryState = 'not-dispatched';

  while (true) {
    const nowMs = getNowMillis(now);
    if (!Number.isFinite(nowMs)) return commandResult(plan, command, 'BLOCKED', 'INVALID_CLOCK', attemptCount, reconciliationCount);
    const decision = retryDisposition({
      attemptCount,
      reconciliationCount,
      deadlineAt: plan.deadlineAt,
      outcome: retryState,
      now: new Date(nowMs).toISOString(),
    });

    if (decision.action === 'stop') return commandResult(plan, command, 'BLOCKED', decision.code, attemptCount, reconciliationCount);

    if (decision.action === 'dispatch-same-command') {
      if (attemptCount >= plan.budget.maxDispatchAttempts) {
        return commandResult(plan, command, 'BLOCKED', 'ATTEMPT_BUDGET_EXHAUSTED', attemptCount, reconciliationCount);
      }
      attemptCount += 1;
      const context = Object.freeze({
        command: stableCommand,
        attemptNumber: attemptCount,
        deadlineAt: plan.deadlineAt,
      });
      const called = await callBounded({
        operation: () => adapter.dispatch(context),
        deadlineAt: plan.deadlineAt,
        now,
        raceDeadline,
      });
      if (called.kind === 'clock-error') return commandResult(plan, command, 'BLOCKED', 'INVALID_CLOCK', attemptCount, reconciliationCount);
      if (called.kind === 'timeout') return commandResult(plan, command, 'BLOCKED', 'DEADLINE_EXPIRED', attemptCount, reconciliationCount);
      if (called.kind === 'rejected') {
        retryState = 'unknown';
        continue;
      }
      const response = called.value;
      if (!isRecord(response) || typeof response.status !== 'string') {
        retryState = 'unknown';
        continue;
      }
      if (response.status === 'unsupported') return commandResult(plan, command, 'UNSUPPORTED', 'ADAPTER_UNSUPPORTED', attemptCount, reconciliationCount);
      if (response.status === 'rejected-no-effect') {
        retryState = 'rejected-no-effect';
        continue;
      }
      if (response.status === 'unknown' || response.status === 'timeout') {
        retryState = 'unknown';
        continue;
      }
      if (response.status === 'completed' || response.status === 'failed') {
        return makeFinalCommandResult({
          plan,
          command,
          adapter,
          status: response.status,
          rawReceipt: response.receipt,
          code: response.status === 'completed' ? 'COMPLETED' : 'ADAPTER_REPORTED_FAILURE',
          attemptCount,
          reconciliationCount,
          now,
        });
      }
      retryState = 'unknown';
      continue;
    }

    if (decision.action === 'reconcile_once') {
      if (reconciliationCount >= plan.budget.maxReconciliations) {
        return commandResult(plan, command, 'BLOCKED', 'RECONCILIATION_BUDGET_EXHAUSTED', attemptCount, reconciliationCount);
      }
      if (typeof adapter.reconcile !== 'function') {
        return commandResult(plan, command, 'BLOCKED', 'RECONCILIATION_UNAVAILABLE', attemptCount, reconciliationCount);
      }
      reconciliationCount += 1;
      const context = Object.freeze({
        command: stableCommand,
        reconciliationNumber: reconciliationCount,
        deadlineAt: plan.deadlineAt,
        readOnly: true,
      });
      const called = await callBounded({
        operation: () => adapter.reconcile(context),
        deadlineAt: plan.deadlineAt,
        now,
        raceDeadline,
      });
      if (called.kind === 'clock-error') return commandResult(plan, command, 'BLOCKED', 'INVALID_CLOCK', attemptCount, reconciliationCount);
      if (called.kind === 'timeout') return commandResult(plan, command, 'BLOCKED', 'RECONCILIATION_TIMEOUT', attemptCount, reconciliationCount);
      if (called.kind === 'rejected') return commandResult(plan, command, 'BLOCKED', 'RECONCILIATION_FAILED', attemptCount, reconciliationCount);
      const response = called.value;
      if (!isRecord(response) || typeof response.status !== 'string') {
        return commandResult(plan, command, 'BLOCKED', 'RECONCILIATION_UNKNOWN', attemptCount, reconciliationCount);
      }
      if (response.status === 'not-found') {
        retryState = 'rejected-no-effect';
        continue;
      }
      if (response.status === 'completed' || response.status === 'failed') {
        return makeFinalCommandResult({
          plan,
          command,
          adapter,
          status: response.status,
          rawReceipt: response.receipt,
          code: response.status === 'completed' ? 'RECONCILED_COMPLETION' : 'RECONCILED_FAILURE',
          attemptCount,
          reconciliationCount,
          now,
        });
      }
      return commandResult(
        plan,
        command,
        response.status === 'unsupported' ? 'BLOCKED' : 'BLOCKED',
        response.status === 'unsupported' ? 'UNKNOWN_EFFECT_RECONCILIATION_UNSUPPORTED' : 'OUTCOME_STILL_UNKNOWN',
        attemptCount,
        reconciliationCount,
      );
    }

    return commandResult(plan, command, 'BLOCKED', 'UNSAFE_RETRY_DECISION', attemptCount, reconciliationCount);
  }
}

function safeCodeFromValidation(validation) {
  return validation.errors[0]?.code ?? 'INVALID_PLAN';
}

export function createOfficeParityHarness({ adapters, now, raceDeadline = defaultRaceDeadline } = {}) {
  if (!(adapters instanceof Map)) throw new TypeError('an explicit adapter Map is required');
  if (typeof now !== 'function') throw new TypeError('an injected clock is required');
  if (typeof raceDeadline !== 'function') throw new TypeError('raceDeadline must be a function');
  validateAdapterRegistry(adapters);

  return Object.freeze({
    async run(plan) {
      const nowMs = getNowMillis(now);
      const validation = validateOfficeParityPlan(plan, nowMs);
      if (!validation.valid) {
        return resultEnvelope(plan, 'BLOCKED', safeCodeFromValidation(validation));
      }

      const adapterId = plan.commands[0].adapterId;
      const adapter = adapters.get(adapterId);
      if (!adapter) {
        return resultEnvelope(plan, 'BLOCKED', 'ADAPTER_NOT_REGISTERED', blockedResults(plan, 'ADAPTER_NOT_REGISTERED'));
      }
      if (!adapter.modes.includes(plan.mode)) {
        return resultEnvelope(plan, 'UNSUPPORTED', 'MODE_UNSUPPORTED', plan.commands.map((command) => commandResult(plan, command, 'UNSUPPORTED', 'MODE_UNSUPPORTED', 0, 0)));
      }
      const expectedEvidenceClass = adapter.kind === 'fake' ? 'contract-simulation' : 'provider-e2e';
      if (plan.evidence.classification !== expectedEvidenceClass) {
        return resultEnvelope(plan, 'BLOCKED', 'EVIDENCE_CLASS_ADAPTER_MISMATCH', blockedResults(plan, 'EVIDENCE_CLASS_ADAPTER_MISMATCH'));
      }

      const results = [];
      for (let index = 0; index < plan.commands.length; index += 1) {
        const command = plan.commands[index];
        const currentMs = getNowMillis(now);
        if (!Number.isFinite(currentMs)) {
          results.push(commandResult(plan, command, 'BLOCKED', 'INVALID_CLOCK', 0, 0));
          results.push(...plan.commands.slice(index + 1).map((later) => commandResult(plan, later, 'NOT_RUN', 'RUN_HALTED', 0, 0)));
          break;
        }
        if (currentMs >= timestampMillis(plan.deadlineAt)) {
          results.push(commandResult(plan, command, 'BLOCKED', 'DEADLINE_EXPIRED', 0, 0));
          results.push(...plan.commands.slice(index + 1).map((later) => commandResult(plan, later, 'NOT_RUN', 'RUN_HALTED', 0, 0)));
          break;
        }
        const result = await runCommand({ plan, command, adapter, now, raceDeadline });
        results.push(result);
        const successful = plan.evidence.classification === 'contract-simulation'
          ? result.simulationOutcome === 'PASS'
          : result.outcome === 'PASS';
        if (!successful) {
          results.push(...plan.commands.slice(index + 1).map((later) => commandResult(plan, later, 'NOT_RUN', 'RUN_HALTED', 0, 0)));
          break;
        }
      }
      const outcome = plan.evidence.classification === 'contract-simulation'
        ? 'NOT_RUN'
        : aggregateOutcomes(results.map((item) => item.outcome));
      const code = plan.evidence.classification === 'contract-simulation'
        ? 'CONTRACT_SIMULATION_ONLY'
        : outcome;
      return resultEnvelope(plan, outcome, code, results);
    },
  });
}
