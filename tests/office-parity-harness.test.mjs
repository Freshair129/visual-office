import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OFFICE_PARITY_VERSION,
  createOfficeParityHarness,
  validateOfficeParityPlan,
} from '../scripts/office-parity-harness.mjs';

const NOW = Date.parse('2026-10-11T03:00:00.000Z');
const iso = (value) => new Date(value).toISOString();
const ids = {
  run: '00000000-0000-4000-8000-000000000001',
  command: '00000000-0000-4000-8000-000000000002',
  session: '00000000-0000-4000-8000-000000000003',
  turn: '00000000-0000-4000-8000-000000000004',
  command2: '00000000-0000-4000-8000-000000000005',
  session2: '00000000-0000-4000-8000-000000000006',
  turn2: '00000000-0000-4000-8000-000000000007',
};
const revisions = {
  visualOffice: 'a'.repeat(40),
  zuri: 'b'.repeat(40),
};
const adapterId = 'fake-primary';

function makeCommand(overrides = {}) {
  return {
    scenarioId: 'GEP-01',
    commandId: ids.command,
    sessionId: ids.session,
    turnId: ids.turn,
    idempotencyKey: 'idem-key-00000001',
    adapterId,
    ...overrides,
  };
}

function makePlan(overrides = {}) {
  const base = {
    contractVersion: OFFICE_PARITY_VERSION,
    runId: ids.run,
    mode: 'T3_BASELINE',
    scenarioIds: ['GEP-01'],
    revisions: { ...revisions },
    issuedAt: iso(NOW),
    deadlineAt: iso(NOW + 60_000),
    budget: {
      maxCommands: 10,
      maxDispatchAttempts: 3,
      maxReconciliations: 1,
    },
    evidence: {
      classification: 'contract-simulation',
      evidenceId: 'evidence-01',
      environmentId: 'unit-test-sandbox',
      preparedAt: iso(NOW),
      simulationId: 'simulation-01',
    },
    commands: [makeCommand()],
  };
  return {
    ...base,
    ...overrides,
    revisions: { ...base.revisions, ...overrides.revisions },
    budget: { ...base.budget, ...overrides.budget },
    evidence: { ...base.evidence, ...overrides.evidence },
    commands: overrides.commands ?? base.commands,
  };
}

function makeSimulationReceipt(plan, command, adapter, status = 'completed', extras = {}) {
  return {
    classification: 'contract-simulation',
    evidenceId: plan.evidence.evidenceId,
    environmentId: plan.evidence.environmentId,
    preparedAt: plan.evidence.preparedAt,
    capturedAt: iso(NOW),
    runId: plan.runId,
    mode: plan.mode,
    scenarioId: command.scenarioId,
    revisions: { ...plan.revisions },
    adapterId: adapter.id,
    adapterVersion: adapter.version,
    commandId: command.commandId,
    sessionId: command.sessionId,
    turnId: command.turnId,
    idempotencyKey: command.idempotencyKey,
    status,
    simulationId: plan.evidence.simulationId,
    ...extras,
  };
}

function makeFakeAdapter({ id = adapterId, modes = ['T3_BASELINE'], dispatch, reconcile } = {}) {
  const adapter = {
    id,
    kind: 'fake',
    version: '0.1.0-test',
    modes,
    dispatch: dispatch ?? (async () => ({ status: 'unsupported' })),
  };
  if (reconcile) adapter.reconcile = reconcile;
  return adapter;
}

function makeProviderPlan(overrides = {}) {
  const { evidence: evidenceOverrides, ...planOverrides } = overrides;
  const plan = makePlan(planOverrides);
  plan.evidence = {
    classification: 'provider-e2e',
    evidenceId: 'provider-evidence-01',
    environmentId: 'sandbox-zuri-office',
    preparedAt: iso(NOW),
    sandboxId: 'sandbox-zuri-office',
    ...evidenceOverrides,
  };
  return plan;
}

async function resolveDeadline(operation) {
  try {
    return { kind: 'resolved', value: await operation() };
  } catch {
    return { kind: 'rejected' };
  }
}

function makeHarness(adapters, { now = () => NOW, raceDeadline = resolveDeadline } = {}) {
  return createOfficeParityHarness({ adapters, now, raceDeadline });
}

function errorCodes(validation) {
  return new Set(validation.errors.map((error) => error.code));
}

test('plan validation accepts only explicit modes, GEP IDs, pinned revisions, finite budgets, and complete evidence', () => {
  assert.equal(validateOfficeParityPlan(makePlan(), NOW).valid, true);

  const unknownMode = validateOfficeParityPlan(makePlan({ mode: 'latest' }), NOW);
  assert.ok(errorCodes(unknownMode).has('INVALID_RUN_MODE'));

  const unknownScenario = validateOfficeParityPlan(makePlan({ scenarioIds: ['GEP-15'], commands: [makeCommand({ scenarioId: 'GEP-15' })] }), NOW);
  assert.ok(errorCodes(unknownScenario).has('INVALID_SCENARIO_ID'));

  const unpinnedRevision = validateOfficeParityPlan(makePlan({ revisions: { visualOffice: 'main' } }), NOW);
  assert.ok(errorCodes(unpinnedRevision).has('PINNED_REVISION_REQUIRED'));

  const oversizedBudgets = validateOfficeParityPlan(makePlan({ budget: { maxDispatchAttempts: 4, maxReconciliations: 2 } }), NOW);
  assert.ok(errorCodes(oversizedBudgets).has('INVALID_DISPATCH_BUDGET'));
  assert.ok(errorCodes(oversizedBudgets).has('INVALID_RECONCILIATION_BUDGET'));

  const noDeadline = validateOfficeParityPlan(makePlan({ deadlineAt: 'infinite' }), NOW);
  assert.ok(errorCodes(noDeadline).has('INVALID_TIMESTAMP'));

  const missingEvidence = makePlan();
  delete missingEvidence.evidence.simulationId;
  const incompleteEvidence = validateOfficeParityPlan(missingEvidence, NOW);
  assert.ok(errorCodes(incompleteEvidence).has('FIELD_REQUIRED'));

  const unknownField = validateOfficeParityPlan(makePlan({ accessToken: 'must-not-be-accepted' }), NOW);
  assert.ok(errorCodes(unknownField).has('UNKNOWN_FIELD'));
});

test('invalid plans are rejected before the injected fake adapter can cause a side effect', async () => {
  let calls = 0;
  const adapter = makeFakeAdapter({ dispatch: async () => { calls += 1; return { status: 'unsupported' }; } });
  const harness = makeHarness(new Map([[adapter.id, adapter]]));
  const result = await harness.run(makePlan({ extra: true }));

  assert.equal(result.outcome, 'NOT_RUN');
  assert.equal(result.code, 'UNKNOWN_FIELD');
  assert.equal(result.commandResults.length, 0);
  assert.equal(calls, 0);
});

test('a logical run, session, or turn cannot be owned by multiple adapters; duplicate command identities are rejected', () => {
  const first = makeCommand();
  const second = makeCommand({
    scenarioId: 'GEP-02',
    commandId: ids.command2,
    sessionId: ids.session,
    turnId: ids.turn,
    idempotencyKey: 'idem-key-00000002',
    adapterId: 'fake-secondary',
  });
  const ownership = validateOfficeParityPlan(makePlan({ scenarioIds: ['GEP-01', 'GEP-02'], commands: [first, second] }), NOW);
  const ownershipCodes = errorCodes(ownership);
  assert.ok(ownershipCodes.has('RUN_MULTIPLE_ADAPTERS'));
  assert.ok(ownershipCodes.has('SESSION_MULTIPLE_ADAPTERS'));
  assert.ok(ownershipCodes.has('TURN_MULTIPLE_ADAPTERS'));

  const duplicate = validateOfficeParityPlan(makePlan({ commands: [
    makeCommand(),
    makeCommand({ scenarioId: 'GEP-02', sessionId: ids.session2, turnId: ids.turn2 }),
  ], scenarioIds: ['GEP-01', 'GEP-02'] }), NOW);
  const duplicateCodes = errorCodes(duplicate);
  assert.ok(duplicateCodes.has('DUPLICATE_COMMAND_ID'));
  assert.ok(duplicateCodes.has('DUPLICATE_IDEMPOTENCY_KEY'));
});

test('the selected adapter is injected explicitly and the runner never falls back to another adapter', async () => {
  let fallbackCalls = 0;
  const fallback = makeFakeAdapter({ id: 'fallback-adapter', dispatch: async () => { fallbackCalls += 1; return { status: 'unsupported' }; } });
  const harness = makeHarness(new Map([[fallback.id, fallback]]));
  const result = await harness.run(makePlan({ commands: [makeCommand({ adapterId: 'requested-adapter' })] }));

  assert.equal(result.simulationOutcome, 'BLOCKED');
  assert.equal(result.commandResults[0].code, 'ADAPTER_NOT_REGISTERED');
  assert.equal(fallbackCalls, 0);
});

test('an injected fake adapter runs only as contract simulation and its side effects are limited to the fake', async () => {
  let dispatches = 0;
  let reconciliations = 0;
  const adapter = makeFakeAdapter({
    dispatch: async ({ command }) => {
      dispatches += 1;
      return { status: 'completed', receipt: makeSimulationReceipt(makePlan(), command, adapter) };
    },
    reconcile: async () => { reconciliations += 1; return { status: 'not-found' }; },
  });
  const result = await makeHarness(new Map([[adapter.id, adapter]])).run(makePlan());

  assert.equal(dispatches, 1);
  assert.equal(reconciliations, 0);
  assert.equal(result.evidenceClass, 'contract-simulation');
  assert.equal(result.simulationOutcome, 'PASS');
  assert.equal(result.liveParityOutcome, 'NOT_RUN');
  assert.equal(result.outcome, 'NOT_RUN');
});

test('dispatch retries preserve the exact command and idempotency identity and stop at the plan budget', async () => {
  const seen = [];
  let plan;
  let adapter;
  adapter = makeFakeAdapter({ dispatch: async ({ command, attemptNumber }) => {
    seen.push({ command, attemptNumber });
    if (attemptNumber < 3) return { status: 'rejected-no-effect' };
    return { status: 'completed', receipt: makeSimulationReceipt(plan, command, adapter) };
  } });
  plan = makePlan();
  const result = await makeHarness(new Map([[adapter.id, adapter]])).run(plan);

  assert.deepEqual(seen.map((item) => item.attemptNumber), [1, 2, 3]);
  assert.strictEqual(seen[0].command, seen[1].command);
  assert.strictEqual(seen[1].command, seen[2].command);
  assert.equal(seen[2].command.idempotencyKey, plan.commands[0].idempotencyKey);
  assert.equal(result.simulationOutcome, 'PASS');

  const exhaustedCalls = [];
  const exhaustedAdapter = makeFakeAdapter({ dispatch: async ({ command, attemptNumber }) => {
    exhaustedCalls.push({ command, attemptNumber });
    return { status: 'rejected-no-effect' };
  } });
  const exhaustedPlan = makePlan({ budget: { maxDispatchAttempts: 2 } });
  const exhausted = await makeHarness(new Map([[exhaustedAdapter.id, exhaustedAdapter]])).run(exhaustedPlan);
  assert.equal(exhausted.commandResults[0].dispatchAttempts, 2);
  assert.equal(exhausted.commandResults[0].code, 'ATTEMPT_BUDGET_EXHAUSTED');
  assert.equal(exhausted.simulationOutcome, 'BLOCKED');
  assert.strictEqual(exhaustedCalls[0].command, exhaustedCalls[1].command);
});

test('unknown effects permit one read-only reconciliation and reuse the same command only after not-found', async () => {
  const dispatchCommands = [];
  const reconciliationContexts = [];
  let plan;
  let adapter;
  adapter = makeFakeAdapter({
    dispatch: async ({ command, attemptNumber }) => {
      dispatchCommands.push(command);
      if (attemptNumber === 1) return { status: 'unknown' };
      return { status: 'completed', receipt: makeSimulationReceipt(plan, command, adapter) };
    },
    reconcile: async (context) => {
      reconciliationContexts.push(context);
      return { status: 'not-found' };
    },
  });
  plan = makePlan();
  const result = await makeHarness(new Map([[adapter.id, adapter]])).run(plan);

  assert.equal(result.simulationOutcome, 'PASS');
  assert.equal(result.commandResults[0].dispatchAttempts, 2);
  assert.equal(result.commandResults[0].reconciliations, 1);
  assert.equal(reconciliationContexts.length, 1);
  assert.equal(reconciliationContexts[0].readOnly, true);
  assert.strictEqual(dispatchCommands[0], reconciliationContexts[0].command);
  assert.strictEqual(dispatchCommands[0], dispatchCommands[1]);

  let reconcileCalls = 0;
  const unknownAdapter = makeFakeAdapter({
    dispatch: async () => ({ status: 'unknown' }),
    reconcile: async () => { reconcileCalls += 1; return { status: 'unknown' }; },
  });
  const stillUnknown = await makeHarness(new Map([[unknownAdapter.id, unknownAdapter]])).run(makePlan());
  assert.equal(reconcileCalls, 1);
  assert.equal(stillUnknown.commandResults[0].reconciliations, 1);
  assert.equal(stillUnknown.commandResults[0].code, 'OUTCOME_STILL_UNKNOWN');
  assert.equal(stillUnknown.simulationOutcome, 'BLOCKED');
});

test('deadline expiry stops dispatch without retry, reconciliation, or a successor identity', async () => {
  let nowValue = NOW;
  const seen = [];
  let reconciliations = 0;
  const adapter = makeFakeAdapter({
    dispatch: async ({ command }) => {
      seen.push(command);
      nowValue = NOW + 60_000;
      return { status: 'rejected-no-effect' };
    },
    reconcile: async () => { reconciliations += 1; return { status: 'not-found' }; },
  });
  const result = await makeHarness(new Map([[adapter.id, adapter]]), { now: () => nowValue }).run(makePlan());

  assert.equal(result.commandResults[0].code, 'DEADLINE_EXPIRED');
  assert.equal(result.commandResults[0].dispatchAttempts, 1);
  assert.equal(seen.length, 1);
  assert.equal(reconciliations, 0);
  assert.equal(seen[0].commandId, ids.command);

  let calls = 0;
  const expiredAdapter = makeFakeAdapter({ dispatch: async () => { calls += 1; return { status: 'unsupported' }; } });
  const expiredPlan = makePlan({ deadlineAt: iso(NOW) });
  const expired = await makeHarness(new Map([[expiredAdapter.id, expiredAdapter]])).run(expiredPlan);
  assert.equal(expired.commandResults.length, 0);
  assert.equal(calls, 0);
});

test('timed out calls and incomplete receipts cannot count as parity passes', async () => {
  let calls = 0;
  const adapter = makeFakeAdapter({ dispatch: async () => { calls += 1; return { status: 'completed' }; } });
  const timedOut = await makeHarness(new Map([[adapter.id, adapter]]), {
    raceDeadline: async () => ({ kind: 'timeout' }),
  }).run(makePlan());
  assert.equal(calls, 0);
  assert.equal(timedOut.commandResults[0].outcome, 'NOT_RUN');
  assert.equal(timedOut.commandResults[0].simulationOutcome, 'BLOCKED');
  assert.equal(timedOut.liveParityOutcome, 'NOT_RUN');

  const incomplete = makeFakeAdapter({ dispatch: async () => ({ status: 'completed' }) });
  const missingReceipt = await makeHarness(new Map([[incomplete.id, incomplete]])).run(makePlan());
  assert.equal(missingReceipt.commandResults[0].code, 'RECEIPT_MISSING');
  assert.equal(missingReceipt.simulationOutcome, 'BLOCKED');
});

test('sanitized receipts omit raw secrets, prompts, paths, and unrecognized fields', async () => {
  let plan;
  let adapter;
  adapter = makeFakeAdapter({ dispatch: async ({ command }) => ({
    status: 'completed',
    receipt: makeSimulationReceipt(plan, command, adapter, 'completed', {
      accessToken: 'secret-access-token-value',
      providerKey: 'sk-secret-provider-key',
      prompt: 'private prompt text',
      workspacePath: 'C:\\private\\workspace',
    }),
  }) });
  plan = makePlan();
  const result = await makeHarness(new Map([[adapter.id, adapter]])).run(plan);
  const serialized = JSON.stringify(result);

  assert.equal(result.receipts.length, 1);
  assert.equal(result.receipts[0].sanitized, true);
  assert.match(result.receipts[0].receiptReferenceDigest, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(serialized, /secret-access-token-value|sk-secret-provider-key|private prompt text|C:\\\\private/);
  assert.doesNotMatch(serialized, /accessToken|providerKey|workspacePath/);
});

test('simulation evidence is separate from provider E2E, and a fake adapter cannot claim provider PASS', async () => {
  const fake = makeFakeAdapter({ dispatch: async ({ command }) => ({
    status: 'completed',
    receipt: makeSimulationReceipt(makePlan(), command, fake),
  }) });
  const simulated = await makeHarness(new Map([[fake.id, fake]])).run(makePlan());
  assert.equal(simulated.evidenceClass, 'contract-simulation');
  assert.equal(simulated.simulationOutcome, 'PASS');
  assert.equal(simulated.outcome, 'NOT_RUN');
  assert.equal(simulated.liveParityOutcome, 'NOT_RUN');

  let providerCalls = 0;
  const fakeWithProviderEvidence = makeFakeAdapter({ dispatch: async () => { providerCalls += 1; return { status: 'completed' }; } });
  const mismatched = await makeHarness(new Map([[fakeWithProviderEvidence.id, fakeWithProviderEvidence]])).run(makeProviderPlan());
  assert.equal(providerCalls, 0);
  assert.equal(mismatched.liveParityOutcome, 'BLOCKED');
  assert.equal(mismatched.commandResults[0].code, 'EVIDENCE_CLASS_ADAPTER_MISMATCH');

  const providerStub = {
    id: 'provider-stub',
    kind: 'provider',
    version: '0.1.0-test',
    modes: ['T3_BASELINE'],
    dispatch: async () => ({ status: 'completed' }),
  };
  const incompleteProvider = await makeHarness(new Map([[providerStub.id, providerStub]])).run(makeProviderPlan({ commands: [makeCommand({ adapterId: providerStub.id })] }));
  assert.equal(incompleteProvider.liveParityOutcome, 'BLOCKED');
  assert.equal(incompleteProvider.commandResults[0].code, 'RECEIPT_MISSING');
  assert.notEqual(incompleteProvider.liveParityOutcome, 'PASS');
});

test('unsupported selected modes are reported without dispatch or fallback', async () => {
  let calls = 0;
  const adapter = makeFakeAdapter({ dispatch: async () => { calls += 1; return { status: 'completed' }; } });
  const result = await makeHarness(new Map([[adapter.id, adapter]])).run(makePlan({ mode: 'NATIVE_ONLY' }));

  assert.equal(result.commandResults[0].simulationOutcome, 'UNSUPPORTED');
  assert.equal(result.commandResults[0].code, 'MODE_UNSUPPORTED');
  assert.equal(calls, 0);
});
