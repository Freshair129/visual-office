import assert from 'node:assert/strict';
import test from 'node:test';
import { domainFloors } from '../web/domain-office.js';

const expectedDepartmentKeys = [
  'lobby',
  'projects',
  'customer',
  'market',
  'growth',
  'line-oa',
  'commerce',
  'inventory',
  'warehouse',
  'procurement',
  'assets',
  'people',
  'operations',
  'knowledge',
  'platform',
];

const domainKeys = expectedDepartmentKeys.slice(1);
const sourceRevision = '848e422e32439edae63d9657fcfa2b976c9f8ea4';
const roleArrayFields = [
  'responsibilities',
  'inputs',
  'outputs',
  'proposedCapabilities',
  'requiresHumanReview',
];

async function loadDepartments() {
  const module = await import('../web/office-departments.js');
  assert.ok(Array.isArray(module.OFFICE_DEPARTMENTS), 'the browser module exports OFFICE_DEPARTMENTS');
  return module.OFFICE_DEPARTMENTS;
}

function assertNonEmptyStrings(values, label) {
  assert.ok(Array.isArray(values), `${label} is an array`);
  assert.ok(values.length > 0, `${label} is not empty`);
  for (const value of values) {
    assert.equal(typeof value, 'string', `${label} entries are strings`);
    assert.ok(value.trim(), `${label} entries are not blank`);
  }
}

test('department design includes one Office Lobby and the fourteen existing floor keys', async () => {
  const departments = await loadDepartments();
  assert.deepEqual(departments.map(department => department.key), expectedDepartmentKeys);

  const domainFloorKeys = domainFloors.map(floor => floor.key);
  assert.deepEqual(domainFloorKeys, domainKeys);
  assert.equal(departments[0].key, 'lobby');
  assert.ok(!domainFloorKeys.includes('lobby'));
});

test('role designs preserve seed catalog hints without turning them into roster identity', async () => {
  const departments = await loadDepartments();

  for (const department of departments) {
    const floor = domainFloors.find(candidate => candidate.key === department.key);
    if (!floor) {
      assert.equal(department.key, 'lobby');
      assert.ok(department.roles.every(role => role.sourceCatalogCode === null));
      continue;
    }

    for (const role of department.roles) {
      const sourceRole = floor.roles.find(candidate => candidate.key === role.key);
      assert.ok(sourceRole, `${department.key}.${role.key} retains its projected role key`);
      assert.equal(role.sourceCatalogCode, sourceRole.sourceAgentId ?? null);
      assert.ok(!Object.hasOwn(role, 'sourceAgentId'));
    }
  }

  const forbiddenIdentityFields = new Set([
    'agentId',
    'agentInstanceId',
    'assignedHumanName',
    'assignedTo',
    'grant',
    'grants',
    'name',
    'permissions',
    'sessionId',
    'status',
  ]);
  const inspect = (value, path = 'departments') => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => inspect(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [field, nested] of Object.entries(value)) {
      assert.ok(!forbiddenIdentityFields.has(field), `${path} has no live identity/state field ${field}`);
      inspect(nested, `${path}.${field}`);
    }
  };
  inspect(departments);

  for (const department of departments) {
    for (const role of department.roles) {
      assert.ok(role.sourceCatalogCode === null || typeof role.sourceCatalogCode === 'string');
    }
  }
});

test('each role has proposed work fields and explicit human-review boundaries', async () => {
  const departments = await loadDepartments();

  for (const department of departments) {
    assert.ok(department.label.trim());
    assert.ok(department.purpose.trim());
    assertNonEmptyStrings(department.sourceRefs, `${department.key}.sourceRefs`);
    assert.ok(department.roles.length > 0, `${department.key} has proposed roles`);
    assert.equal(new Set(department.roles.map(role => role.key)).size, department.roles.length);

    for (const role of department.roles) {
      assert.ok(role.key.trim());
      assert.ok(role.title.trim());
      for (const field of roleArrayFields) {
        assertNonEmptyStrings(role[field], `${department.key}.${role.key}.${field}`);
      }
    }
  }
});

test('every department workflow is a reachable role-assigned path with review and failure handling', async () => {
  const departments = await loadDepartments();

  for (const department of departments) {
    assert.ok(department.workflows.length > 0, `${department.key} has a main workflow`);
    assert.equal(new Set(department.workflows.map(workflow => workflow.key)).size, department.workflows.length);

    for (const workflow of department.workflows) {
      assert.ok(workflow.key.trim());
      assert.ok(workflow.label.trim());
      assert.ok(workflow.trigger.trim());
      assertNonEmptyStrings(workflow.inputs, `${department.key}.${workflow.key}.inputs`);
      assertNonEmptyStrings(workflow.outputs, `${department.key}.${workflow.key}.outputs`);
      assert.ok(workflow.steps.length > 0);

      const roleKeys = new Set(department.roles.map(role => role.key));
      const stepsByKey = new Map(workflow.steps.map(step => [step.key, step]));
      assert.equal(stepsByKey.size, workflow.steps.length, `${workflow.key} step keys are unique`);

      for (const step of workflow.steps) {
        assert.ok(roleKeys.has(step.roleKey), `${workflow.key}.${step.key} names a role in its team`);
        assert.ok(step.label.trim());
        assert.ok(step.action.trim());
        assert.ok(step.output.trim());
        assert.ok(step.reviewPolicy.trim());
        assert.ok(step.onFailure.trim());
        assert.ok(Array.isArray(step.next));
        for (const nextKey of step.next) {
          assert.ok(stepsByKey.has(nextKey), `${workflow.key}.${step.key} points to a known next step`);
        }
      }

      const reachable = new Set();
      const pending = [workflow.steps[0].key];
      while (pending.length) {
        const key = pending.pop();
        if (reachable.has(key)) continue;
        reachable.add(key);
        pending.push(...stepsByKey.get(key).next);
      }
      assert.deepEqual([...reachable].sort(), [...stepsByKey.keys()].sort(), `${workflow.key} has no orphan steps`);
      assert.ok(workflow.steps.some(step => step.next.length === 0), `${workflow.key} has a terminal step`);
      assert.ok(
        workflow.steps.some(step => /human|owner approval|person review/i.test(step.reviewPolicy)),
        `${workflow.key} keeps a human review boundary`,
      );
    }
  }
});

test('every workflow handoff has a unique semantic key and points to another designed department', async () => {
  const departments = await loadDepartments();
  const departmentKeys = new Set(departments.map(department => department.key));

  for (const department of departments) {
    for (const workflow of department.workflows) {
      assert.ok(workflow.handoffs.length > 0, `${department.key}.${workflow.key} has a handoff`);
      assert.equal(new Set(workflow.handoffs.map(handoff => handoff.key)).size, workflow.handoffs.length);

      for (const handoff of workflow.handoffs) {
        assert.ok(handoff.key.trim());
        assert.ok(departmentKeys.has(handoff.toDepartmentKey));
        assert.notEqual(handoff.toDepartmentKey, department.key, 'handoffs cross department boundaries');
        assert.ok(handoff.artifact.trim());
        assert.ok(handoff.condition.trim());
      }
    }
  }
});

test('reserved Warehouse and Operations proposals say they are design-only', async () => {
  const departments = await loadDepartments();
  const byKey = new Map(departments.map(department => [department.key, department]));

  for (const key of ['warehouse', 'operations']) {
    const department = byKey.get(key);
    assert.ok(department.purpose.toLowerCase().includes('reserved'));
    assert.ok(department.purpose.toLowerCase().includes('design-only'));
  }
});

test('source references pin every domain to the reviewed Zuri registry entry', async () => {
  const departments = await loadDepartments();
  const byKey = new Map(departments.map(department => [department.key, department]));

  for (const key of domainKeys) {
    const department = byKey.get(key);
    const reference = `zuri.ai@${sourceRevision}:apps/server/src/config/domains.js#${key}`;
    assert.ok(department.sourceRefs.includes(reference), `${key} cites its exact registry entry`);
  }

  assert.ok(
    byKey.get('lobby').sourceRefs.includes(
      `zuri.ai@${sourceRevision}:apps/server/src/config/domains.js#business-home`,
    ),
    'Lobby points to the shell-level source without using it as the team key',
  );
});

test('the handoff dataset does not pre-mint canonical UUIDs', async () => {
  const departments = await loadDepartments();
  const serialized = JSON.stringify(departments);
  assert.doesNotMatch(serialized, /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
});
