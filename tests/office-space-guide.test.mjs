import assert from 'node:assert/strict';
import test from 'node:test';
import OFFICE_DEPARTMENTS from '../web/office-departments.js';
import {createTycoonFloorPlan} from '../web/tycoon-floor-plans.js';
import {OFFICE_FLOOR_KEYS} from '../web/office-floor-registry.js';

const api = await import('../web/office-space-guide.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return null;
  throw error;
});

const room = ({areas, objects = []}) => {
  const floorPlan = createTycoonFloorPlan('projects');
  return {
    ...floorPlan,
    objects,
    blueprintPlan: {...floorPlan.blueprintPlan, areas},
  };
};

const placeAtLocal = (room, id, kind, x, z) => ({
  id,
  kind,
  x: room.blueprintPlan.originX + 2 + x,
  z: room.blueprintPlan.originZ + 2 + z,
  rotation: 0,
  scale: 1,
});

const CORE_AREAS = Object.freeze({
  lobby: ['lobby-public-arrival', 'lobby-intake', 'lobby-private-meeting', 'lobby-waiting'],
  projects: ['projects-delivery-hub', 'projects-focus-room', 'projects-dependency-wall', 'projects-review-room'],
  customer: ['customer-public-wait', 'customer-intake', 'customer-relations', 'customer-private-case'],
  market: ['market-signal-wall', 'market-research-pods', 'market-source-library', 'market-evidence-review'],
  growth: ['growth-content-studio', 'growth-campaign-bay', 'growth-performance', 'growth-campaign-review'],
  'line-oa': ['line-oa-flow-lab', 'line-oa-channel-ops', 'line-oa-preview-bay', 'line-oa-qa-room'],
  commerce: ['commerce-order-coordination', 'commerce-pricing', 'commerce-fulfilment', 'commerce-exception-room'],
  inventory: ['inventory-stock-position', 'inventory-reservation', 'inventory-count-bench', 'inventory-variance-room'],
  warehouse: ['warehouse-inbound-plan', 'warehouse-pick-pack-plan', 'warehouse-capacity-board', 'warehouse-process-review'],
  procurement: ['procurement-supplier-comparison', 'procurement-purchase-plan', 'procurement-po-coordination', 'procurement-receipt-review'],
  assets: ['assets-intake-inspection', 'assets-register-wall', 'assets-lifecycle', 'assets-audit-room'],
  people: ['people-private-service', 'people-directory', 'people-onboarding', 'people-privacy-room'],
  operations: ['operations-dispatch', 'operations-schedule', 'operations-triage', 'operations-quality-room'],
  knowledge: ['knowledge-ingest-prep', 'knowledge-pipeline', 'knowledge-quiet-research', 'knowledge-citation-review'],
  platform: ['platform-integration-workbench', 'platform-readiness-wall', 'platform-access-review', 'platform-audit-room'],
});

const EXPANDED_AREA_GUIDES = Object.freeze({
  customer: {
    'customer-private-consult-1': {roleKeys: ['care', 'crm'], workflowStepKeys: ['summarize-request', 'check-customer-context', 'review-response']},
    'customer-private-consult-2': {roleKeys: ['care', 'crm'], workflowStepKeys: ['summarize-request', 'check-customer-context', 'review-response']},
  },
  growth: {
    'growth-edit-booth-a': {roleKeys: ['content'], workflowStepKeys: ['draft-content']},
    'growth-edit-booth-b': {roleKeys: ['creative'], workflowStepKeys: ['prepare-creative']},
  },
  commerce: {
    'commerce-exception-triage': {roleKeys: ['review'], workflowStepKeys: ['review-exception']},
  },
  inventory: {
    'inventory-count-loop': {roleKeys: [], workflowStepKeys: []},
    'inventory-replenishment': {roleKeys: ['reserve'], workflowStepKeys: ['draft-options']},
  },
  warehouse: {
    'warehouse-outbound-plan': {roleKeys: ['outbound'], workflowStepKeys: ['review-outbound-flow']},
    'warehouse-inbound-staging': {roleKeys: ['inbound'], workflowStepKeys: ['draft-inbound-outbound']},
  },
  procurement: {
    'procurement-staff-zone': {roleKeys: ['lead', 'po'], workflowStepKeys: ['frame-purchase-need', 'draft-order']},
    'procurement-award-board': {roleKeys: ['supplier'], workflowStepKeys: ['compare-suppliers']},
  },
  assets: {
    'assets-intake-bench': {roleKeys: ['receive'], workflowStepKeys: ['inspect-intake']},
  },
  people: {
    'people-consult-room-1': {roleKeys: ['lead', 'review'], workflowStepKeys: ['triage-request', 'review-privacy']},
    'people-consult-room-2': {roleKeys: ['lead', 'review'], workflowStepKeys: ['triage-request', 'review-privacy']},
  },
  operations: {
    'operations-control-island': {roleKeys: ['lead', 'schedule'], workflowStepKeys: ['frame-service', 'draft-schedule']},
    'operations-incident-room': {roleKeys: ['process', 'quality'], workflowStepKeys: ['map-process', 'review-quality']},
  },
  knowledge: {
    'knowledge-library-aisle': {roleKeys: ['lead'], workflowStepKeys: ['select-sources']},
  },
});

test('known area guide describes its local customer workflow and only colocated objects', () => {
  assert.ok(api, 'office-space-guide.js should expose the functional area guide');
  const selectedRoom = room({
    areas: [{
      id: 'customer-private-case',
      type: 'meeting',
      name: 'Consultation room',
      x: 1,
      z: 1,
      width: 3,
      depth: 3,
    }],
  });
  selectedRoom.objects = [
    placeAtLocal(selectedRoom, 'case-table', 'meeting', 2, 2),
    placeAtLocal(selectedRoom, 'demo-agent', 'actor', 2, 2),
    placeAtLocal(selectedRoom, 'moved-outside', 'desk', selectedRoom.blueprintPlan.width + 1, 2),
  ];
  const originalRoom = structuredClone(selectedRoom);
  const guides = api.buildFloorSpaceGuide({key: 'customer'}, selectedRoom);

  assert.equal(guides.length, 1);
  const [guide] = guides;
  assert.deepEqual(Object.keys(guide).sort(), [
    'activities', 'areaId', 'name', 'objectIds', 'purpose', 'roleKeys', 'type', 'workflowStepKeys',
  ]);
  assert.equal(guide.areaId, 'customer-private-case');
  assert.equal(guide.name, 'Consultation room');
  assert.equal(guide.type, 'meeting');
  assert.match(guide.purpose, /เคสลูกค้า/);
  assert.ok(guide.activities.some(activity => /คำขอ|ตอบกลับ/.test(activity)));
  assert.deepEqual(guide.roleKeys, ['care', 'crm']);
  assert.deepEqual(guide.workflowStepKeys, ['summarize-request', 'check-customer-context', 'review-response']);
  assert.deepEqual(guide.objectIds, ['case-table']);
  assert.deepEqual(selectedRoom, originalRoom);
});

test('Customer consultation rooms point to case-context and response-review proposals', () => {
  assert.ok(api, 'office-space-guide.js should expose the functional area guide');
  const selectedRoom = room({areas: [
    {id: 'customer-private-consult-1', type: 'meeting', name: 'Consultation 1', x: 1, z: 1, width: 3, depth: 3},
    {id: 'customer-private-consult-2', type: 'meeting', name: 'Consultation 2', x: 5, z: 1, width: 3, depth: 3},
  ]});
  const guides = api.buildFloorSpaceGuide('customer', selectedRoom);
  assert.deepEqual(guides.map(guide => guide.roleKeys), [['care', 'crm'], ['care', 'crm']]);
  assert.deepEqual(guides.map(guide => guide.workflowStepKeys), [
    ['summarize-request', 'check-customer-context', 'review-response'],
    ['summarize-request', 'check-customer-context', 'review-response'],
  ]);
});

test('unrecognized custom area uses its real placed objects without inventing role or workflow assignments', () => {
  assert.ok(api, 'office-space-guide.js should expose the functional area guide');
  const selectedRoom = room({
    areas: [{id: '__proto__', type: 'work', name: 'Blue room', x: 1, z: 1, width: 2, depth: 2}],
  });
  selectedRoom.objects = [
    placeAtLocal(selectedRoom, 'new-desk', 'desk', 2, 2),
    placeAtLocal(selectedRoom, 'outside-chair', 'chair', selectedRoom.blueprintPlan.width - 1, selectedRoom.blueprintPlan.depth - 1),
  ];
  const [guide] = api.buildFloorSpaceGuide('customer', selectedRoom);

  assert.equal(guide.areaId, '__proto__');
  assert.equal(guide.name, 'Blue room');
  assert.equal(guide.type, 'work');
  assert.match(guide.purpose, /พื้นที่ทำงานทั่วไป.*โต๊ะทำงาน/);
  assert.ok(guide.activities.some(activity => /โต๊ะทำงาน/.test(activity)));
  assert.deepEqual(guide.roleKeys, []);
  assert.deepEqual(guide.workflowStepKeys, []);
  assert.deepEqual(guide.objectIds, ['new-desk']);
});

test('Growth edit booths support content and creative production steps', () => {
  assert.ok(api, 'office-space-guide.js should expose the functional area guide');
  const guides = api.buildFloorSpaceGuide('growth', createTycoonFloorPlan('growth'));
  const byId = new Map(guides.map(guide => [guide.areaId, guide]));

  const expectations = {
    'growth-edit-booth-a': {roleKeys: ['content'], workflowStepKeys: ['draft-content'], purpose: /ข้อความ/},
    'growth-edit-booth-b': {roleKeys: ['creative'], workflowStepKeys: ['prepare-creative'], purpose: /สร้างสรรค์/},
  };
  for (const [areaId, expected] of Object.entries(expectations)) {
    const guide = byId.get(areaId);
    assert.ok(guide, `${areaId} should be included from the actual floor plan`);
    assert.deepEqual(guide.roleKeys, expected.roleKeys);
    assert.deepEqual(guide.workflowStepKeys, expected.workflowStepKeys);
    assert.match(guide.purpose, expected.purpose);
  }
});

test('Procurement staff and supplier boards support only their proposed planning steps', () => {
  assert.ok(api, 'office-space-guide.js should expose the functional area guide');
  const guides = api.buildFloorSpaceGuide('procurement', createTycoonFloorPlan('procurement'));
  const byId = new Map(guides.map(guide => [guide.areaId, guide]));

  assert.deepEqual(byId.get('procurement-staff-zone')?.roleKeys, ['lead', 'po']);
  assert.deepEqual(byId.get('procurement-staff-zone')?.workflowStepKeys, ['frame-purchase-need', 'draft-order']);
  assert.deepEqual(byId.get('procurement-award-board')?.roleKeys, ['supplier']);
  assert.deepEqual(byId.get('procurement-award-board')?.workflowStepKeys, ['compare-suppliers']);
});

test('guide returns only actual room blueprint areas and tolerates missing spatial input', () => {
  assert.ok(api, 'office-space-guide.js should expose the functional area guide');
  assert.deepEqual(api.buildFloorSpaceGuide({key: 'customer'}, {objects: []}), []);
  assert.deepEqual(api.buildFloorSpaceGuide({key: 'customer'}, room({areas: []})), []);

  const unknownFloor = room({
    areas: [{id: 'customer-private-case', type: 'meeting', name: 'Custom meeting room', x: 1, z: 1, width: 2, depth: 2}],
  });
  const [guide] = api.buildFloorSpaceGuide({key: 'not-a-department'}, unknownFloor);
  assert.deepEqual(guide.roleKeys, []);
  assert.deepEqual(guide.workflowStepKeys, []);
});

test('all fifteen floor factories expose guides for their actual areas and core semantic zones', () => {
  assert.ok(api, 'office-space-guide.js should expose the functional area guide');
  assert.deepEqual(Object.keys(CORE_AREAS).sort(), [...OFFICE_FLOOR_KEYS].sort());
  const departments = new Map(OFFICE_DEPARTMENTS.map(department => [department.key, department]));

  for (const floorKey of OFFICE_FLOOR_KEYS) {
    const floorRoom = createTycoonFloorPlan(floorKey);
    const coreAreaIds = CORE_AREAS[floorKey];
    const actualAreaIds = floorRoom.blueprintPlan.areas.map(area => area.id);
    const expandedAreaIds = Object.keys(EXPANDED_AREA_GUIDES[floorKey] || {});
    assert.ok(actualAreaIds.length >= 4 && actualAreaIds.length <= 7, `${floorKey} area count`);
    assert.equal(new Set(actualAreaIds).size, actualAreaIds.length, `${floorKey} unique area IDs`);
    for (const areaId of coreAreaIds) assert.ok(actualAreaIds.includes(areaId), `${floorKey} core area ${areaId}`);
    assert.deepEqual(
      actualAreaIds.filter(areaId => !coreAreaIds.includes(areaId)).sort(),
      [...expandedAreaIds].sort(),
      `${floorKey} every extra factory area has an explicit functional guide`,
    );

    const guides = api.buildFloorSpaceGuide({key: floorKey}, floorRoom);
    assert.deepEqual([...guides.map(guide => guide.areaId)].sort(), [...actualAreaIds].sort(), `${floorKey} guide coverage`);
    const guidesById = new Map(guides.map(guide => [guide.areaId, guide]));
    for (const [areaId, expected] of Object.entries(EXPANDED_AREA_GUIDES[floorKey] || {})) {
      const guide = guidesById.get(areaId);
      assert.ok(guide, `${floorKey} expanded area ${areaId}`);
      assert.deepEqual(guide.roleKeys, expected.roleKeys, `${floorKey}/${areaId} proposed roles`);
      assert.deepEqual(guide.workflowStepKeys, expected.workflowStepKeys, `${floorKey}/${areaId} proposed steps`);
    }
    const department = departments.get(floorKey);
    const roleKeys = new Set(department.roles.map(role => role.key));
    const workflowStepKeys = new Set(department.workflows.flatMap(workflow => workflow.steps.map(step => step.key)));
    for (const guide of guides) {
      assert.ok(guide.purpose.length, `${floorKey}/${guide.areaId} purpose`);
      assert.ok(guide.activities.length, `${floorKey}/${guide.areaId} activities`);
      if (coreAreaIds.includes(guide.areaId)) {
        assert.ok(guide.roleKeys.length, `${floorKey}/${guide.areaId} roles`);
        assert.ok(guide.workflowStepKeys.length, `${floorKey}/${guide.areaId} workflow`);
      }
      assert.ok(guide.roleKeys.every(key => roleKeys.has(key)), `${floorKey}/${guide.areaId} role references`);
      assert.ok(guide.workflowStepKeys.every(key => workflowStepKeys.has(key)), `${floorKey}/${guide.areaId} workflow references`);
    }
  }
});
