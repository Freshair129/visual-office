import test from 'node:test';
import assert from 'node:assert/strict';
import {domainFloors} from '../web/domain-office.js';
import {createTycoonRoom,TycoonStore,TYCOON_KEY} from '../web/tycoon-state.js';
import {createTycoonNavigation,tycoonGround,tycoonPlan,tycoonWorld} from '../web/tycoon-blueprint.js';
import {createTycoonFloorDimensions,createTycoonFloorPlan} from '../web/tycoon-floor-plans.js';
import {TYCOON_ASSETS} from '../web/tycoon-models.js';
import {createLegacyTycoonRoom} from './fixtures/legacy-tycoon-room.mjs';

const domainKeys=['projects','customer','market','growth','line-oa','commerce','inventory','warehouse','procurement','assets','people','operations','knowledge','platform'];
const floors=['lobby',...domainKeys];
const sharedCoreIds=new Set(['core-west','core-east','core-front','service-west','service-east','service-back']);
const stationIds={
  projects:['desk-1','desk-2','desk-3','desk-4'],
  customer:['customer-crm-desk','customer-lifecycle-desk','customer-care-desk','customer-sales-desk'],
  market:['market-analyst-desk','market-research-desk','market-insight-desk','market-evidence-desk'],
  growth:['desk-1','desk-2','desk-3','desk-4'],
  'line-oa':['line-experience-desk','line-message-design-desk','line-channel-ops-desk','line-conversation-qa-desk'],
  commerce:['commerce-order-desk','commerce-pricing-desk','commerce-fulfilment-desk','commerce-exception-desk'],
  inventory:['inventory-position-desk','inventory-reservation-desk','inventory-stocktake-desk','inventory-data-quality-desk'],
  warehouse:['warehouse-coordination-desk','warehouse-inbound-desk','warehouse-outbound-desk','warehouse-quality-desk'],
  procurement:['procurement-planner-desk','procurement-supplier-desk','procurement-po-desk','procurement-receipt-desk'],
  assets:['assets-register-desk','assets-inspection-desk','assets-audit-desk','assets-lifecycle-desk'],
  people:['people-service-desk','people-directory-desk','people-onboarding-desk','people-privacy-review-desk'],
  operations:['operations-lead-desk','operations-schedule-desk','operations-process-desk','operations-quality-desk'],
  knowledge:['knowledge-curator-desk','knowledge-pipeline-desk','knowledge-research-desk','knowledge-citation-review-desk'],
  platform:['platform-coordination-desk','platform-integration-desk','platform-access-desk','platform-audit-desk'],
};
const expectedAreaIds={
  lobby:['lobby-public-arrival','lobby-intake','lobby-private-meeting','lobby-waiting'],
  projects:['projects-delivery-hub','projects-focus-room','projects-dependency-wall','projects-review-room'],
  customer:['customer-public-wait','customer-intake','customer-relations','customer-private-case','customer-private-consult-1','customer-private-consult-2'],
  market:['market-signal-wall','market-research-pods','market-source-library','market-evidence-review'],
  growth:['growth-content-studio','growth-campaign-bay','growth-performance','growth-campaign-review','growth-edit-booth-a','growth-edit-booth-b'],
  'line-oa':['line-oa-flow-lab','line-oa-channel-ops','line-oa-preview-bay','line-oa-qa-room'],
  commerce:['commerce-order-coordination','commerce-pricing','commerce-fulfilment','commerce-exception-room','commerce-exception-triage'],
  inventory:['inventory-stock-position','inventory-reservation','inventory-count-bench','inventory-variance-room','inventory-count-loop','inventory-replenishment'],
  warehouse:['warehouse-inbound-plan','warehouse-pick-pack-plan','warehouse-capacity-board','warehouse-process-review','warehouse-outbound-plan','warehouse-inbound-staging'],
  procurement:['procurement-supplier-comparison','procurement-purchase-plan','procurement-po-coordination','procurement-receipt-review','procurement-staff-zone','procurement-award-board'],
  assets:['assets-intake-inspection','assets-register-wall','assets-lifecycle','assets-audit-room','assets-intake-bench'],
  people:['people-private-service','people-directory','people-onboarding','people-privacy-room','people-consult-room-1','people-consult-room-2'],
  operations:['operations-dispatch','operations-schedule','operations-triage','operations-quality-room','operations-control-island','operations-incident-room'],
  knowledge:['knowledge-ingest-prep','knowledge-pipeline','knowledge-quiet-research','knowledge-citation-review','knowledge-library-aisle'],
  platform:['platform-integration-workbench','platform-readiness-wall','platform-access-review','platform-audit-room'],
};
const expectedFurnishings={
  lobby:{'lobby-public-arrival':['welcome'],'lobby-intake':['reception'],'lobby-private-meeting':['visitor-meeting-table'],'lobby-waiting':['lounge']},
  projects:{'projects-delivery-hub':['desk-1'],'projects-focus-room':['desk-4'],'projects-dependency-wall':['project-board','artifacts'],'projects-review-room':['meeting']},
  customer:{'customer-public-wait':['customer-waiting-sofa'],'customer-intake':['customer-intake-counter'],'customer-relations':['customer-care-desk'],'customer-private-case':['customer-review-table'],'customer-private-consult-1':['customer-consult-table-a'],'customer-private-consult-2':['customer-consult-table-b']},
  market:{'market-signal-wall':['market-evidence-wall'],'market-research-pods':['market-analyst-desk'],'market-source-library':['market-source-shelves'],'market-evidence-review':['market-review-table']},
  growth:{'growth-content-studio':['desk-1'],'growth-campaign-bay':['marketing-board'],'growth-performance':['desk-3'],'growth-campaign-review':['meeting'],'growth-edit-booth-a':['desk-4'],'growth-edit-booth-b':['growth-edit-b-board']},
  'line-oa':{'line-oa-flow-lab':['line-flow-board'],'line-oa-channel-ops':['line-channel-ops-desk'],'line-oa-preview-bay':['line-channel-coffee'],'line-oa-qa-room':['line-oa-review-table']},
  commerce:{'commerce-order-coordination':['commerce-order-board'],'commerce-pricing':['commerce-pricing-desk'],'commerce-fulfilment':['commerce-fulfilment-desk'],'commerce-exception-room':['commerce-review-table'],'commerce-exception-triage':['commerce-exception-desk']},
  inventory:{'inventory-stock-position':['inventory-stock-wall'],'inventory-reservation':['inventory-ledger-shelf'],'inventory-count-bench':['inventory-count-island'],'inventory-variance-room':['inventory-review-table'],'inventory-count-loop':['inventory-count-island'],'inventory-replenishment':['inventory-replenishment-board']},
  warehouse:{'warehouse-inbound-plan':['warehouse-coordination-desk'],'warehouse-pick-pack-plan':['warehouse-outbound-desk'],'warehouse-capacity-board':['warehouse-capacity-board'],'warehouse-process-review':['warehouse-review-table'],'warehouse-outbound-plan':['warehouse-outbound-board'],'warehouse-inbound-staging':['warehouse-inbound-staging-rack']},
  procurement:{'procurement-supplier-comparison':['procurement-supplier-table'],'procurement-purchase-plan':['procurement-planner-desk'],'procurement-po-coordination':['procurement-po-desk'],'procurement-receipt-review':['procurement-review-table'],'procurement-staff-zone':['procurement-supplier-desk'],'procurement-award-board':['procurement-award-wall']},
  assets:{'assets-intake-inspection':['assets-inspection-desk'],'assets-register-wall':['assets-register-wall-board'],'assets-lifecycle':['assets-lifecycle-desk'],'assets-audit-room':['assets-audit-desk'],'assets-intake-bench':['assets-inspection-table']},
  people:{'people-private-service':['people-service-desk'],'people-directory':['people-directory-desk'],'people-onboarding':['people-onboarding-desk'],'people-privacy-room':['people-privacy-review-desk'],'people-consult-room-1':['people-consult-guidance'],'people-consult-room-2':['people-consult-table-b']},
  operations:{'operations-dispatch':['operations-lead-desk'],'operations-schedule':['operations-schedule-desk'],'operations-triage':['operations-triage-board'],'operations-quality-room':['operations-review-table'],'operations-control-island':['operations-control-table'],'operations-incident-room':['operations-incident-table']},
  knowledge:{'knowledge-ingest-prep':['knowledge-curator-desk'],'knowledge-pipeline':['knowledge-pipeline-desk'],'knowledge-quiet-research':['knowledge-research-desk'],'knowledge-citation-review':['knowledge-citation-review-desk'],'knowledge-library-aisle':['knowledge-source-shelves']},
  platform:{'platform-integration-workbench':['platform-coordination-desk'],'platform-readiness-wall':['platform-readiness-board'],'platform-access-review':['platform-access-desk'],'platform-audit-room':['platform-audit-desk']},
};

function floorPlan(floor){return createTycoonFloorPlan(floor);}
function footprint(object){
  const [width,depth]=TYCOON_ASSETS[object.kind].footprint;
  const c=Math.abs(Math.cos(object.rotation)),s=Math.abs(Math.sin(object.rotation));
  const halfX=(width*c+depth*s)*object.scale/2,halfZ=(width*s+depth*c)*object.scale/2;
  return {x0:object.x-halfX,x1:object.x+halfX,z0:object.z-halfZ,z1:object.z+halfZ};
}
function overlaps(a,b){return a.x0<b.x1&&b.x0<a.x1&&a.z0<b.z1&&b.z0<a.z1;}
function wallBounds(plan){
  const segments=[];
  for(const wall of plan.blueprintPlan.partitions){
    const openings=wall.door?[[wall.start,wall.start+wall.door.offset],[wall.start+wall.door.offset+wall.door.width,wall.end]]:[[wall.start,wall.end]];
    for(const [start,end] of openings){
      if(end-start<.05)continue;
      segments.push(wall.axis==='x'
        ?{x0:start-12,x1:end-12,z0:wall.at-8-.1,z1:wall.at-8+.1}
        :{x0:wall.at-12-.1,x1:wall.at-12+.1,z0:start-8,z1:end-8});
    }
  }
  return segments;
}
function localFootprint(object){
  const bounds=footprint(object);
  return {x0:bounds.x0+12,x1:bounds.x1+12,z0:bounds.z0+8,z1:bounds.z1+8};
}
function isDimensionSurface(plan,point,axis){
  const [x,z]=point,epsilon=.025;
  for(const object of plan.objects){
    const b=localFootprint(object);
    if(axis==='x'&&(Math.abs(x-b.x0)<epsilon||Math.abs(x-b.x1)<epsilon)&&z>=b.z0-epsilon&&z<=b.z1+epsilon)return true;
    if(axis==='z'&&(Math.abs(z-b.z0)<epsilon||Math.abs(z-b.z1)<epsilon)&&x>=b.x0-epsilon&&x<=b.x1+epsilon)return true;
  }
  for(const wall of plan.blueprintPlan.partitions){
    if(wall.axis==='z'&&(Math.abs(x-(wall.at-.1))<epsilon||Math.abs(x-(wall.at+.1))<epsilon)&&z>=wall.start-epsilon&&z<=wall.end+epsilon)return true;
    if(wall.axis==='x'&&(Math.abs(z-(wall.at-.1))<epsilon||Math.abs(z-(wall.at+.1))<epsilon)&&x>=wall.start-epsilon&&x<=wall.end+epsilon)return true;
  }
  return false;
}
function probeIsClear(plan,probe,axis){
  const along=axis==='x'?0:1,fixed=axis==='x'?probe.from[1]:probe.from[0];
  const start=Math.min(probe.from[along],probe.to[along]),end=Math.max(probe.from[along],probe.to[along]),epsilon=.03;
  for(const object of plan.objects){
    const b=localFootprint(object),lo=axis==='x'?b.x0:b.z0,hi=axis==='x'?b.x1:b.z1,otherLo=axis==='x'?b.z0:b.x0,otherHi=axis==='x'?b.z1:b.x1;
    if(fixed>otherLo+epsilon&&fixed<otherHi-epsilon&&lo<end-epsilon&&hi>start+epsilon)return false;
  }
  for(const wall of wallBounds(plan)){
    const b={x0:wall.x0+12,x1:wall.x1+12,z0:wall.z0+8,z1:wall.z1+8};
    const lo=axis==='x'?b.x0:b.z0,hi=axis==='x'?b.x1:b.z1,otherLo=axis==='x'?b.z0:b.x0,otherHi=axis==='x'?b.z1:b.x1;
    if(fixed>otherLo+epsilon&&fixed<otherHi-epsilon&&lo<end-epsilon&&hi>start+epsilon)return false;
  }
  return true;
}
const enclosedRoomIds={
  lobby:['lobby-visitor-room','lobby-waiting-room'],
  projects:['projects-focus','projects-review'],
  customer:['customer-consult-a','customer-consult-b','customer-case-room','customer-wait-room'],
  market:['market-evidence-room'],
  growth:['growth-review-room','growth-performance-room','growth-edit-booth-a','growth-edit-booth-b'],
  'line-oa':['line-qa-room'],
  commerce:['commerce-pricing-room','commerce-exception-room'],
  inventory:['inventory-count-loop','inventory-variance-room'],
  warehouse:['warehouse-review-room'],
  procurement:['procurement-supplier-suite','procurement-receipt-room'],
  assets:['assets-inspection-bay','assets-audit-room'],
  people:['people-consult-room-a','people-consult-room-b','people-privacy-room'],
  operations:['operations-quality-room','operations-incident-room'],
  knowledge:['knowledge-citation-room','knowledge-quiet-research-room'],
  platform:['platform-access-room','platform-audit-room'],
};
function hasSideEntry(desk,objects,walls){
  const bounds=footprint(desk),paired=deskChairId(desk.id),others=objects.filter(object=>object.id!==desk.id&&object.id!==paired);
  return [-1,1].some(side=>{
    const access=side<0
      ?{x0:bounds.x0-1.2,x1:bounds.x0,z0:desk.z-.6,z1:desk.z+.6}
      :{x0:bounds.x1,x1:bounds.x1+1.2,z0:desk.z-.6,z1:desk.z+.6};
    if(access.x0<-12||access.x1>12||access.z0<-8||access.z1>8)return false;
    return !others.some(object=>overlaps(access,footprint(object)))&&!walls.some(wall=>overlaps(access,wall));
  });
}
function rounded(value){return Math.round(value*100)/100;}
function geometrySignature(plan){
  return plan.blueprintPlan.partitions.filter(wall=>!sharedCoreIds.has(wall.id)).map(wall=>({
    axis:wall.axis,at:rounded(wall.at),start:rounded(wall.start),end:rounded(wall.end),
    door:wall.door?{offset:rounded(wall.door.offset),width:rounded(wall.door.width)}:null,
  })).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function areaContainsObject(area,object){
  const x=object.x+12,z=object.z+8;
  return x>=area.x&&x<=area.x+area.width&&z>=area.z&&z<=area.z+area.depth;
}
function objectBlocksOpening(object,opening){
  const bounds=footprint(object),at=opening.at+(opening.axis==='x'?-8:-12),start=opening.start+(opening.axis==='x'?-12:-8)+opening.door.offset,end=start+opening.door.width;
  if(opening.axis==='x')return bounds.z0<at+.11&&bounds.z1>at-.11&&bounds.x0<end&&bounds.x1>start;
  return bounds.x0<at+.11&&bounds.x1>at-.11&&bounds.z0<end&&bounds.z1>start;
}
function doorOpenings(plan){
  const entry={axis:'x',at:16,start:0,door:{offset:plan.blueprintPlan.door.offset,width:plan.blueprintPlan.door.width}};
  return [entry,...plan.blueprintPlan.partitions.filter(wall=>wall.door)];
}
function deskChairId(deskId){
  return deskId.startsWith('desk-')?deskId.replace(/^desk-/,'chair-'):deskId.replace(/-desk$/,'-chair');
}
function memory(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}

test('all fifteen local defaults use the 24 by 16 m large plate and furnish every functional area',()=>{
  assert.deepEqual(domainFloors.map(({key})=>key),domainKeys);
  assert.deepEqual(Object.keys(expectedAreaIds),floors);
  for(const floor of floors){
    const plan=floorPlan(floor),blueprint=plan.blueprintPlan;
    assert.equal(plan.width,24,`${floor} room width`);
    assert.equal(plan.depth,16,`${floor} room depth`);
    assert.equal(blueprint.width,24,`${floor} blueprint width`);
    assert.equal(blueprint.depth,16,`${floor} blueprint depth`);
    assert.equal(blueprint.base,'large');
    assert.equal(blueprint.originX,-14);
    assert.equal(blueprint.originZ,-10);
    assert.equal(blueprint.door.wall,'front');
    assert.equal(blueprint.door.offset,11.2);
    assert.equal(blueprint.door.width,1.6);
    assert.ok(blueprint.partitions.length<=40,`${floor} partition cap`);
    assert.ok(blueprint.areas.length<=20,`${floor} area cap`);
    assert.ok(plan.objects.length<=80,`${floor} furniture cap`);
    assert.equal(blueprint.areas.length,expectedAreaIds[floor].length,`${floor} functional area count`);
    assert.deepEqual(blueprint.areas.map(({id})=>id).sort(),expectedAreaIds[floor].slice().sort(),`${floor} stable functional area IDs`);
    const objectMap=new Map(plan.objects.map(object=>[object.id,object]));
    for(const area of blueprint.areas){
      for(const id of expectedFurnishings[floor][area.id]){
        const object=objectMap.get(id);
        assert.ok(object,`${floor}/${area.id} has required furniture ${id}`);
        assert.ok(areaContainsObject(area,object),`${floor}/${area.id} contains furniture ${id}`);
      }
    }
    for(const opening of doorOpenings(plan)){
      for(const object of plan.objects)assert.equal(objectBlocksOpening(object,opening),false,`${floor}/${object.id} leaves ${opening.axis}:${opening.at} door clear`);
    }
  }
  assert.equal(floorPlan('lobby').objects.some(({kind})=>kind==='desk'),false,'Lobby roles remain unallocated');
});

test('all floor plans share the same enclosed rear lift core and lift datum',()=>{
  const plans=floors.map(floorPlan),lift=plan=>plan.objects.find(({id})=>id==='lift');
  const core=plan=>plan.blueprintPlan.partitions.filter(wall=>sharedCoreIds.has(wall.id));
  assert.equal(plans.length,15);
  for(const plan of plans){
    assert.deepEqual({x:lift(plan).x,z:lift(plan).z,rotation:lift(plan).rotation},{x:0,z:-5.6,rotation:0});
    assert.deepEqual(core(plan),core(plans[0]));
  }
  const shared=core(plans[0]);
  assert.deepEqual(shared.map(({id})=>id).sort(),[...sharedCoreIds].sort());
});

test('the fifteen floor geometries are distinct when labels and the shared core are removed',()=>{
  const signatures=floors.map(floor=>JSON.stringify(geometrySignature(floorPlan(floor))));
  assert.equal(new Set(signatures).size,15,'each floor has its own partition geometry independent of labels');
  assert.ok(floors.every(floor=>geometrySignature(floorPlan(floor)).length>=4), 'each floor has actual interior walls and doorways');
});

test('function programmes include distinct room topologies and six circulation families',()=>{
  const enclosureCounts=[];
  for(const floor of floors){
    const plan=floorPlan(floor),walls=new Set(plan.blueprintPlan.partitions.map(({id})=>id));
    const ids=enclosedRoomIds[floor];
    assert.ok(ids.length>=1,`${floor} has purpose-built enclosed rooms`);
    for(const id of ids){
      for(const side of ['west','east','rear','front'])assert.ok(walls.has(`${id}-${side}`),`${floor}/${id} has actual ${side} wall`);
    }
    enclosureCounts.push(ids.length);
  }
  assert.ok(new Set(enclosureCounts).size>=4,'the programme varies from one to four enclosed rooms');
  const families=new Set();
  const inventory=floorPlan('inventory');
  assert.ok(inventory.objects.some(({id})=>id==='inventory-count-island'));
  assert.deepEqual(createTycoonFloorDimensions('inventory').map(({id})=>id),['inventory-count-loop-west','inventory-count-loop-east']);
  if(inventory.blueprintPlan.partitions.some(({id})=>id==='inventory-count-loop-west')&&inventory.objects.some(({id})=>id==='inventory-count-island'))families.add('central-count-loop');
  const warehouse=new Set(floorPlan('warehouse').blueprintPlan.partitions.map(({id})=>id));
  for(const id of ['warehouse-u-west','warehouse-u-rear','warehouse-u-east'])assert.ok(warehouse.has(id),'Warehouse has a real U-shaped planning lane');
  if(['warehouse-u-west','warehouse-u-rear','warehouse-u-east'].every(id=>warehouse.has(id)))families.add('u-shaped-flow');
  const people=floorPlan('people'),peopleWalls=new Set(people.blueprintPlan.partitions.map(({id})=>id));
  for(const id of ['people-consult-room-a','people-consult-room-b','people-privacy-room'])assert.ok(peopleWalls.has(`${id}-west`)&&peopleWalls.has(`${id}-east`),`${id} is enclosed`);
  if(enclosedRoomIds.people.length===3&&peopleWalls.has('people-consult-room-a-front')&&peopleWalls.has('people-consult-room-b-front'))families.add('private-consult-suite');
  const operations=floorPlan('operations');
  assert.ok(operations.objects.some(({id})=>id==='operations-control-table'),'Operations has a central huddle/control island');
  for(const id of ['operations-control-west','operations-control-east','operations-control-rear'])assert.ok(operations.blueprintPlan.partitions.some(wall=>wall.id===id));
  if(operations.objects.some(({id})=>id==='operations-control-table')&&operations.blueprintPlan.partitions.some(wall=>wall.id==='operations-incident-room-west'))families.add('central-control-island');
  const procurement=floorPlan('procurement');
  assert.ok(procurement.blueprintPlan.areas.some(({id})=>id==='procurement-staff-zone'),'Procurement separates the supplier suite from staff work');
  if(procurement.blueprintPlan.partitions.some(wall=>wall.id==='procurement-supplier-suite-west')&&procurement.blueprintPlan.partitions.some(wall=>wall.id==='procurement-staff-entry'))families.add('public-suite-to-staff-zone');
  const knowledge=floorPlan('knowledge');
  assert.ok(knowledge.objects.some(({id})=>id==='knowledge-research-shelf-b'),'Knowledge has a rear reference aisle with physical shelving');
  if(knowledge.blueprintPlan.areas.find(({id})=>id==='knowledge-library-aisle')?.z<knowledge.blueprintPlan.areas.find(({id})=>id==='knowledge-ingest-prep')?.z&&knowledge.objects.some(({id})=>id==='knowledge-source-shelves'))families.add('rear-library-aisle');
  const growth=floorPlan('growth');
  assert.ok(growth.blueprintPlan.areas.some(({id})=>id==='growth-edit-booth-a'),'Growth has actual editing booths');
  if(growth.blueprintPlan.partitions.some(wall=>wall.id==='growth-edit-booth-a-west')&&growth.blueprintPlan.partitions.some(wall=>wall.id==='growth-edit-booth-b-west'))families.add('studio-with-edit-booths');
  const customerWalls=new Set(floorPlan('customer').blueprintPlan.partitions.map(({id})=>id));
  if(customerWalls.has('customer-consult-a-west')&&customerWalls.has('customer-consult-b-west'))families.add('separate-case-consultations');
  assert.ok(families.size>=6,`at least six actual circulation families are represented: ${[...families].join(', ')}`);
});

test('dimension probes are axis-aligned, bounded, and span actual clear furniture or wall sections',()=>{
  for(const floor of floors){
    const plan=floorPlan(floor),probes=createTycoonFloorDimensions(floor);
    assert.ok(probes.length>=1&&probes.length<=3,`${floor} has one to three useful dimensions`);
    assert.equal(new Set(probes.map(({id})=>id)).size,probes.length,`${floor} dimension IDs are unique`);
    for(const probe of probes){
      const axis=Math.abs(probe.from[1]-probe.to[1])<1e-8?'x':'z';
      assert.ok(Math.abs(probe.from[0]-probe.to[0])<1e-8||Math.abs(probe.from[1]-probe.to[1])<1e-8,`${floor}/${probe.id} is axis-aligned`);
      assert.equal(probe.label,'ทางเดิน');
      for(const point of [probe.from,probe.to]){
        assert.ok(point[0]>=0&&point[0]<=24&&point[1]>=0&&point[1]<=16,`${floor}/${probe.id} endpoint is on the plate`);
        assert.ok(isDimensionSurface(plan,point,axis),`${floor}/${probe.id} endpoint meets furniture or a partition face`);
      }
      const length=Math.hypot(probe.to[0]-probe.from[0],probe.to[1]-probe.from[1]);
      assert.ok(Number.isFinite(length)&&length>=.5,`${floor}/${probe.id} has a positive measured section`);
      assert.equal(probeIsClear(plan,probe,axis),true,`${floor}/${probe.id} has no furniture or closed wall crossing the measured aisle`);
    }
  }
});

test('all department role desks retain stable IDs and pair with a chair exactly 1.20 m away',()=>{
  assert.deepEqual(Object.keys(stationIds).sort(),domainKeys.slice().sort());
  for(const [floor,ids] of Object.entries(stationIds)){
    const plan=floorPlan(floor),objects=new Map(plan.objects.map(object=>[object.id,object]));
    for(const id of ids){
      const desk=objects.get(id),chair=objects.get(deskChairId(id));
      assert.ok(desk,`${floor}/${id} is present`);
      assert.equal(desk.kind,'desk');
      assert.ok(chair,`${floor}/${id} has its stable chair ID`);
      assert.equal(chair.kind,'chair');
      assert.ok(Math.abs(Math.hypot(chair.x-desk.x,chair.z-desk.z)-1.2)<1e-8,`${floor}/${id} has the verified 1.20 m reach`);
      assert.ok(desk.rotation===0||Math.abs(desk.rotation-Math.PI)<1e-8,`${floor}/${id} keeps a contact-verified desk orientation`);
      assert.equal(chair.rotation,desk.rotation,`${floor}/${id} chair faces the station`);
    }
  }
});

test('default furniture fits the 24 by 16 m shell, avoids walls, and leaves real doorways clear',()=>{
  for(const floor of floors){
    const plan=floorPlan(floor),objects=plan.objects,walls=wallBounds(plan);
    for(let index=0;index<objects.length;index++){
      const object=objects[index],bounds=footprint(object);
      assert.ok(bounds.x0>=-12&&bounds.x1<=12&&bounds.z0>=-8&&bounds.z1<=8,`${floor}/${object.id} fits the room`);
      assert.equal(walls.some(wall=>overlaps(bounds,wall)),false,`${floor}/${object.id} stays clear of partition walls and closed door panels`);
      for(const other of objects.slice(index+1))assert.equal(overlaps(bounds,footprint(other)),false,`${floor}/${object.id} does not overlap ${other.id}`);
      if(object.kind==='desk')assert.equal(hasSideEntry(object,objects,walls),true,`${floor}/${object.id} retains a clear 1.2 m side-entry strip`);
    }
  }
});

test('all default role stations remain reachable through their actual partitioned plans',()=>{
  const entry=tycoonGround({x:0,z:7.35}),liftLobby=tycoonGround({x:0,z:-4.5});
  for(const floor of domainKeys){
    const room=createTycoonRoom(floor),navigation=createTycoonNavigation(room);
    assert.ok(navigation.spawnPoint&&navigation.isWalkable(navigation.spawnPoint),`${floor} has a valid floor spawn`);
    assert.deepEqual(navigation.issues,[],`${floor} station approach geometry is clear`);
    assert.ok(navigation.isWalkable(entry),`${floor} actual front entrance is walkable`);
    assert.ok(navigation.isWalkable(liftLobby),`${floor} lift lobby standing point is walkable`);
    assert.ok(navigation.findLocalPath(entry,liftLobby).length>=2,`${floor} connects its actual front entrance to the lift lobby`);
    for(const station of navigation.stations.filter(({type})=>type==='desk')){
      assert.ok(navigation.findLocalPath(navigation.spawnPoint,station.position).length>=2,`${floor} reaches ${station.objectId}`);
      assert.ok(navigation.findLocalPath(entry,station.position).length>=2,`${floor} front entrance reaches ${station.objectId}`);
      assert.ok(navigation.findLocalPath(liftLobby,station.position).length>=2,`${floor} lift lobby reaches ${station.objectId}`);
      if(station.seat)assert.equal(navigation.isWalkable(station.seat,{ignoreIds:[station.seatObjectId]}),true,`${floor} paired seat is reachable`);
    }
  }
  const lobby=createTycoonRoom('lobby');
  assert.equal(tycoonPlan(lobby).areas.length,4);
  const lobbyNavigation=createTycoonNavigation(lobby);
  assert.equal(lobbyNavigation.issues.length,0,'Lobby visitor spaces stay reachable');
  assert.ok(lobbyNavigation.findLocalPath(entry,liftLobby).length>=2,'Lobby entry connects to the lift lobby');
  const liftGround=tycoonGround({x:0,z:-5.6}),liftWorld=tycoonWorld(liftGround);
  assert.ok(Math.abs(liftWorld.x)<1e-8&&Math.abs(liftWorld.z+5.6)<1e-8,'lift world mapping remains on the same plan datum');
});

test('loading and selecting a saved 12 by 8 legacy floor never replaces its stored layout',async()=>{
  const oldRoom=createLegacyTycoonRoom('projects');
  assert.equal(oldRoom.width,12);
  assert.equal(oldRoom.depth,8);
  assert.equal(oldRoom.objects.length,16,'fixture represents the frozen legacy room');
  const storage=memory();
  storage.setItem(TYCOON_KEY,JSON.stringify({version:1,floors:{projects:{revision:4,edition:'tycoon3d',room:oldRoom}}}));
  const store=new TycoonStore(storage,{locks:{request:(_name,_options,write)=>write()}});
  assert.deepEqual(store.get('projects').room,oldRoom);
  assert.equal(await store.select('projects','tycoon3d'),true);
  assert.deepEqual(store.get('projects').room,oldRoom);
  assert.deepEqual(createTycoonFloorPlan('projects').width,24,'the new default changes only an unsaved floor');
});
