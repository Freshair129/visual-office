import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OFFICE_FLOORS} from '../web/office-floor-registry.js';
import {OFFICE_DEPARTMENTS} from '../web/office-departments.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {createTycoonNavigation,tycoonWorld} from '../web/tycoon-blueprint.js';
import {buildOfficeHandoff,validateOfficeHandoff} from '../web/office-handoff.js';
import {collectHandoffAssets,handoffZip} from '../web/office-handoff-assets.js';
import {designId,canonicalJSON,sha256} from '../web/office-world-identity.js';
const rooms=Object.fromEntries(OFFICE_FLOORS.map(f=>[f.key,createTycoonRoom(f.key)]));
const assets=await collectHandoffAssets(rooms,{readFile:p=>readFile('web/'+p)}),baseline=await buildOfficeHandoff({rooms,assets:assets.descriptors});
const mutate=fn=>{const v=structuredClone(baseline);fn(v);return v;};
const resign=async v=>{const {contentHash,...body}=v;v.contentHash=await sha256(canonicalJSON(body));return v;};
const worldPoint=point=>{if(!point)return null;const value=tycoonWorld(point);return{x:value.x,y:value.y,z:value.z};};
const assertMeasuredClose=(actual,expected)=>{if(typeof expected==='number'){assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);return;}if(expected&&typeof expected==='object'){assert.deepEqual(Object.keys(actual),Object.keys(expected));for(const key of Object.keys(expected))assertMeasuredClose(actual[key],expected[key]);return;}assert.deepEqual(actual,expected);};
test('all floors, scene placements, agent design slots and workflows have linked unique UUIDs',async()=>{
 assert.equal(baseline.entities.filter(e=>e.type==='floor').length,15);assert.equal(baseline.entities.filter(e=>e.type==='agentDesign').length,60);assert.equal(baseline.entities.filter(e=>e.type==='workflow').length,15);
 assert.equal(new Set(baseline.entities.map(e=>e.id)).size,baseline.entities.length);assert.deepEqual(baseline.bindingContext,{tenantId:null,businessId:null,workspaceId:null});
 for(const a of baseline.entities.filter(e=>e.type==='agentDesign'))assert.equal(a.data.agentInstanceId,null);
 assert.deepEqual(await validateOfficeHandoff(baseline),baseline);
});
test('all department, role, slot, workflow, step and handoff records match the complete design catalog',async()=>{
 assert.equal(baseline.entities.filter(e=>e.type==='department').length,OFFICE_DEPARTMENTS.length);
 assert.equal(baseline.entities.filter(e=>e.type==='team').length,OFFICE_DEPARTMENTS.length);
 assert.equal(baseline.entities.filter(e=>e.type==='role').length,OFFICE_DEPARTMENTS.reduce((n,d)=>n+d.roles.length,0));
 assert.equal(baseline.entities.filter(e=>e.type==='agentDesign').length,OFFICE_DEPARTMENTS.reduce((n,d)=>n+d.roles.length,0));
 for(const department of OFFICE_DEPARTMENTS){
  assert.ok(baseline.entities.some(e=>e.type==='department'&&e.key===department.key));
  assert.ok(baseline.entities.some(e=>e.type==='team'&&e.key===`${department.key}/team`));
  for(const role of department.roles){assert.ok(baseline.entities.some(e=>e.type==='role'&&e.key===`${department.key}/${role.key}`));assert.ok(baseline.entities.some(e=>e.type==='agentDesign'&&e.key===`${department.key}/${role.key}/slot-1`));}
  for(const workflow of department.workflows){const key=`${department.key}/${workflow.key}`;assert.ok(baseline.entities.some(e=>e.type==='workflow'&&e.key===key));for(const step of workflow.steps)assert.ok(baseline.entities.some(e=>e.type==='workflowStep'&&e.key===`${key}/${step.key}`));for(const handoff of workflow.handoffs)assert.ok(baseline.entities.some(e=>e.type==='workflowHandoff'&&e.key===`${key}/${handoff.key}`));}
 }
 const project=OFFICE_DEPARTMENTS.find(d=>d.key==='projects'),projectWorkflow=project.workflows[0];
 const edits=[
  v=>{v.entities=v.entities.filter(e=>e.type!=='team'||e.key!=='projects/team');},
  v=>{const key=project.roles[0].key;v.entities=v.entities.filter(e=>e.type!=='role'||e.key!==`projects/${key}`);},
  v=>{const key=project.roles[0].key;v.entities=v.entities.filter(e=>e.type!=='agentDesign'||e.key!==`projects/${key}/slot-1`);},
  v=>{v.entities=v.entities.filter(e=>e.type!=='workflow'||e.key!==`projects/${projectWorkflow.key}`);},
  v=>{v.entities=v.entities.filter(e=>e.type!=='workflowStep'||e.key!==`projects/${projectWorkflow.key}/${projectWorkflow.steps[0].key}`);},
  v=>{v.entities=v.entities.filter(e=>e.type!=='workflowHandoff'||e.key!==`projects/${projectWorkflow.key}/${projectWorkflow.handoffs[0].key}`);},
  v=>{v.entities.find(e=>e.type==='role'&&e.key===`projects/${project.roles[0].key}`).data.responsibilities=null;},
 ];
 for(const edit of edits)await assert.rejects(validateOfficeHandoff(await resign(mutate(edit))));
});
test('role slots bind to ordered real desk stations by each floor object id, with no invented lobby seats',()=>{
 const byId=new Map(baseline.entities.map(e=>[e.id,e]));
 for(const department of OFFICE_DEPARTMENTS){
  const floorRoom=rooms[department.key],desks=createTycoonNavigation(floorRoom).stations.filter(s=>s.type==='desk');
  for(const [i,role]of department.roles.entries()){
   const slot=baseline.entities.find(e=>e.type==='agentDesign'&&e.key===`${department.key}/${role.key}/slot-1`),stationRef=slot.refs.find(r=>r.relation==='station');
   if(i>=desks.length){assert.equal(stationRef,undefined,`${department.key}/${role.key} must remain unallocated without a desk`);continue;}
   assert.ok(stationRef,`${department.key}/${role.key} must use the ordered real desk`);
   const station=byId.get(stationRef.targetId);assert.equal(station.key,`${department.key}/${desks[i].id}`);assert.equal(station.data.interaction.type,'desk');
   assertMeasuredClose(station.data.world,{position:worldPoint(station.data.interaction.position),seat:worldPoint(station.data.interaction.seat),seatRoot:worldPoint(station.data.interaction.seatRoot),footAnchor:worldPoint(station.data.interaction.footAnchor),headingRad:station.data.interaction.heading,seatHeightM:station.data.interaction.seatHeight??null});
   assert.equal(slot.refs.some(r=>r.relation==='seat'),false,'agent design points at a station, never a fabricated seat');
  }
 }
});
test('re-export is deterministic; relabel/move keeps identity but changes content digest',async()=>{
 const again=await buildOfficeHandoff({rooms,assets:assets.descriptors});assert.equal(again.contentHash,baseline.contentHash);
 const edited=structuredClone(rooms);edited.projects.objects.find(o=>o.id==='plant-left').color='#123456';edited.projects.blueprintPlan.areas[0].name='Renamed review room';
 const changed=await buildOfficeHandoff({rooms:edited,assets:assets.descriptors});assert.notEqual(changed.contentHash,baseline.contentHash);assert.deepEqual(changed.entities.map(e=>e.id),baseline.entities.map(e=>e.id));
 assert.notEqual(await designId('placement','projects/furniture/desk-1'),await designId('placement','growth/furniture/desk-1'));
});
test('reordering furniture never reassigns roles and deleting a desk leaves only its role unallocated',async()=>{
 const edited=structuredClone(rooms);edited.projects.objects.reverse();
 const reordered=await buildOfficeHandoff({rooms:edited,assets:assets.descriptors});
 const slots=manifest=>manifest.entities.filter(e=>e.type==='agentDesign'&&e.key.startsWith('projects/'));
 assert.deepEqual(slots(reordered),slots(baseline));
 edited.projects.objects=edited.projects.objects.filter(o=>o.id!=='desk-1');
 const removed=await buildOfficeHandoff({rooms:edited,assets:assets.descriptors});
 for(const slot of slots(removed)){const before=slots(baseline).find(e=>e.id===slot.id);assert.deepEqual(slot.refs,slot.key==='projects/lead/slot-1'?before.refs.filter(r=>r.relation!=='station'):before.refs);}
});
test('rejects duplicate, forged and dangling IDs even with a recomputed package hash',async()=>{
 for(const fn of [v=>v.entities.push(v.entities[0]),v=>v.entities[0].key+='-forged',v=>v.entities.find(e=>e.type==='agentDesign').refs[0].targetId='00000000-0000-5000-8000-000000000000'])await assert.rejects(validateOfficeHandoff(await resign(mutate(fn))));
});
test('rejects fake registration and cross-floor station/role bindings',async()=>{
 await assert.rejects(validateOfficeHandoff(await resign(mutate(v=>v.entities.find(e=>e.type==='agentDesign').data.agentInstanceId='server-looking-id'))),/registered|invalid type/);
 await assert.rejects(validateOfficeHandoff(await resign(mutate(v=>v.bindingContext.businessId='business-id'))),/context/);
 const cross=mutate(v=>{const a=v.entities.find(e=>e.type==='agentDesign'&&e.key.startsWith('projects/')),role=v.entities.find(e=>e.type==='role'&&e.key.startsWith('growth/'));a.refs.find(r=>r.relation==='role').targetId=role.id;});await assert.rejects(validateOfficeHandoff(await resign(cross)),/mismatch/);
});
test('rejects changed placements, omitted stations, unsafe binary paths and orphan workflows',async()=>{
 const edits=[v=>v.entities.find(e=>e.type==='placement').data.object.x=123,v=>v.entities=v.entities.filter(e=>e.type!=='station'||!e.key.startsWith('projects/')),v=>v.entities.find(e=>e.type==='assetRevision').data.uri='../outside.glb',v=>v.entities.find(e=>e.type==='workflowStep'&&e.refs.some(r=>r.relation==='next')).refs=v.entities.find(e=>e.type==='workflowStep'&&e.refs.some(r=>r.relation==='next')).refs.filter(r=>r.relation!=='next')];
 for(const edit of edits)await assert.rejects(validateOfficeHandoff(await resign(mutate(edit))));
});
test('rejects scene-derived room, partition and opening drift and workflow floor mismatch',async()=>{
 const roomKey=baseline.entities.find(e=>e.type==='room').key,partitionKey=baseline.entities.find(e=>e.type==='partition').key,openingKey=baseline.entities.find(e=>e.type==='opening'&&e.data.geometry.start).key;
 const edits=[
  v=>{v.entities=v.entities.filter(e=>e.type!=='room'||e.key!==roomKey);},
  v=>{v.entities.find(e=>e.type==='room'&&e.key===roomKey).data.area.name+=' forged';},
  v=>{v.entities=v.entities.filter(e=>e.type!=='partition'||e.key!==partitionKey);},
  v=>{v.entities.find(e=>e.type==='partition'&&e.key===partitionKey).data.geometry.at+=.2;},
  v=>{v.entities=v.entities.filter(e=>e.type!=='opening'||e.key!==openingKey);},
  v=>{v.entities.find(e=>e.type==='opening'&&e.key===openingKey).data.geometry.start[0]+=.25;},
  v=>{const workflow=v.entities.find(e=>e.type==='workflow'&&e.key.startsWith('projects/'));workflow.refs.find(r=>r.relation==='floor').targetId=v.entities.find(e=>e.type==='floor'&&e.key==='growth').id;},
 ];
 for(const edit of edits)await assert.rejects(validateOfficeHandoff(await resign(mutate(edit))));
});
test('rejects non-desk agent binding, non-meaningful values, and unbounded records',async()=>{
 const lobbyStation=baseline.entities.find(e=>e.type==='station'&&e.key.startsWith('lobby/')&&e.data.interaction.type!=='desk');
 const edits=[
  v=>{const slot=v.entities.find(e=>e.type==='agentDesign'&&e.key==='lobby/host/slot-1');slot.refs.push({relation:'station',targetId:lobbyStation.id});},
  v=>{v.entities.find(e=>e.type==='building').data.units={};},
  v=>{v.entities.find(e=>e.type==='asset').data.kind='not-a-model';},
  v=>{v.entities.find(e=>e.type==='workflow'&&e.key.startsWith('projects/')).data.inputs='not-an-array';},
  v=>{v.entities.find(e=>e.type==='role'&&e.key.startsWith('projects/')).data.outputs=[''];},
  v=>{v.entities.find(e=>e.type==='workflowStep'&&e.key.startsWith('projects/')).data.reviewPolicy='x'.repeat(2001);},
  v=>{v.entities.find(e=>e.type==='station').data.world.position.x+=.25;},
 ];
 for(const edit of edits)await assert.rejects(validateOfficeHandoff(await resign(mutate(edit))));
});
test('package and asset revision identities are derived from their fixed logical keys',async()=>{
 const wrongPackage=mutate(v=>{v.packageId=baseline.entities.find(e=>e.type==='building').id;});
 await assert.rejects(validateOfficeHandoff(await resign(wrongPackage)),/package/i);
 let oldRevisionId;const wrongRevision=mutate(v=>{const revision=v.entities.find(e=>e.type==='assetRevision'),assetId=revision.refs.find(r=>r.relation==='asset').targetId,asset=v.entities.find(e=>e.id===assetId);oldRevisionId=revision.id;revision.key=`${asset.key}/${'0'.repeat(64)}`;});
 const newRevisionId=await designId('assetRevision',wrongRevision.entities.find(e=>e.type==='assetRevision').key);
 wrongRevision.entities.find(e=>e.type==='assetRevision').id=newRevisionId;for(const entity of wrongRevision.entities)for(const relation of entity.refs)if(relation.targetId===oldRevisionId)relation.targetId=newRevisionId;
 await assert.rejects(validateOfficeHandoff(await resign(wrongRevision)),/revision|asset/i);
});
test('generated JSON schemas give every data field concrete types, bounds or references',async()=>{
 const contract=JSON.parse(await readFile('contracts/office-design-handoff-v1.schema.json','utf8'));
 const web=JSON.parse(await readFile('web/office-handoff.schema.json','utf8'));
 assert.deepEqual(web,contract);
 for(const branch of contract.$defs.entity.allOf){
  const fields=branch.then.properties.data.properties;
  for(const schema of Object.values(fields))assert.ok(Object.keys(schema).length>0,'no data field may use an unconstrained {} schema');
 }
 const byType=Object.fromEntries(contract.$defs.entity.allOf.map(branch=>[branch.if.properties.type.const,branch.then.properties.data]));
 assert.equal(byType.assetRevision.properties.bytes.minimum,1);
 assert.equal(byType.workflow.properties.inputs.items.type,'string');
 assert.equal(byType.scene.properties.snapshot.$ref,'#/$defs/tycoonRoom');assert.equal(contract.$defs.tycoonRoom.type,'object');
 assert.equal(byType.station.properties.world.properties.position.properties.z.type,'number');assert.equal(byType.station.properties.world.properties.seatHeightM.oneOf[1].type,'null');
 assert.equal(contract.properties.packageId.const,await designId('package','office-world'));
});
test('asset collection fails on corrupt bytes and ZIP output is deterministic',async()=>{
 await assert.rejects(collectHandoffAssets(rooms,{readFile:async p=>{const bytes=await readFile('web/'+p);if(p.endsWith('.glb'))bytes[bytes.length-1]^=1;return bytes;}}),/hash/);
 const a=handoffZip(baseline,assets.blobs,{}),b=handoffZip(baseline,assets.blobs,{});assert.deepEqual(a,b);assert.equal(new DataView(a.buffer).getUint32(0,true),0x04034b50);
});
test('authored routes/zones and mixed-case legacy blueprint IDs keep complete stable identities',async()=>{
 const edited=structuredClone(rooms),room=edited.projects;
 room.blueprintPlan.areas[0].id='QA_Room';room.blueprintPlan.partitions[0].id='QA_Wall';room.blueprintPlan.windows[0].id='QA_Window';
 room.navigation={version:1,routes:[{id:'Walk_A',points:[{x:49,y:60},{x:51,y:61}]}],forbidden:[{id:'Zone_A',points:[{x:1,y:1},{x:2,y:1},{x:2,y:2}]}],stations:[]};
 const manifest=await buildOfficeHandoff({rooms:edited,assets:assets.descriptors});
 for(const [type,key]of [['room','projects/QA_Room'],['partition','projects/QA_Wall'],['opening','projects/window/QA_Window'],['navigationRoute','projects/Walk_A'],['exclusionZone','projects/Zone_A']])assert.equal(manifest.entities.find(e=>e.type===type&&e.key===key).id,await designId(type,key));
 const route=manifest.entities.find(e=>e.type==='navigationRoute');assert.equal(route.data.worldPoints.length,2);assert.equal(typeof route.data.worldPoints[0].z,'number');
 const missing=structuredClone(manifest);missing.entities=missing.entities.filter(e=>e.type!=='exclusionZone');await assert.rejects(validateOfficeHandoff(await resign(missing)));
 const changed=structuredClone(manifest);changed.entities.find(e=>e.type==='navigationRoute').data.worldPoints[0].x+=.1;await assert.rejects(validateOfficeHandoff(await resign(changed)));
});
