import test from 'node:test';import assert from 'node:assert/strict';
import {createTycoonRoom,validateTycoonRoom,tycoonFloorFile,parseTycoonFloorJSON} from '../web/tycoon-state.js';
import {expandSelection,groupSelection,ungroupSelection,transformSelection,duplicateSelection,deleteSelection,reorderSelection} from '../web/tycoon-transform.js';
import {tycoonGround,tycoonWorld} from '../web/tycoon-blueprint.js';
const pair=['desk-1','chair-1'];
test('bounded embedded textures roundtrip on furniture and room surfaces without external URLs',()=>{
 const texture={data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',repeatX:2,repeatY:3,offsetX:.1,offsetY:0,rotation:45,opacity:.8},room=createTycoonRoom('projects');
 room.objects[4].finish={material:'wood',texture};room.finishes={floor:{texture}};assert.deepEqual(parseTycoonFloorJSON(JSON.stringify(tycoonFloorFile('projects',room))).room,room);
 for(const data of ['https://example.test/texture.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,AAAA']){const bad=structuredClone(room);bad.finishes.floor.texture.data=data;assert.throws(()=>validateTycoonRoom(bad));}
 const bad=structuredClone(room);bad.objects[4].finish.texture.repeatX=Infinity;assert.throws(()=>validateTycoonRoom(bad));
});
test('group expansion, transforms and duplicate retain relative layout and independent identities',()=>{
 const original=createTycoonRoom('projects'),grouped=groupSelection(original,pair);
 assert.deepEqual(expandSelection(grouped,['desk-1']),pair);assert.equal(original.objects[4].groupId,undefined);
 const before=grouped.objects.filter(o=>pair.includes(o.id)),moved=transformSelection(grouped,pair,{dx:1,dz:.5,factor:1.5});
 const after=moved.objects.filter(o=>pair.includes(o.id));assert.equal(after[0].scale,1.5);assert.ok(Math.abs((after[0].z-after[1].z)-(before[0].z-before[1].z)*1.5)<1e-8);
 assert.equal((after[0].x+after[1].x)/2,(before[0].x+before[1].x)/2+1);
 const copied=duplicateSelection(moved,['desk-1']);assert.equal(copied.ids.length,2);assert.equal(copied.room.objects.length,original.objects.length+2);
 assert.ok(copied.ids.every(id=>/^(desk|chair)-copy-[a-f0-9]{32}$/.test(id)));
 const additions=copied.room.objects.filter(o=>copied.ids.includes(o.id));assert.equal(additions[0].groupId,additions[1].groupId);assert.notEqual(additions[0].groupId,after[0].groupId);
 const withoutCopy=deleteSelection(copied.room,copied.ids),replacement=duplicateSelection(withoutCopy,['desk-1']);
 assert.equal(replacement.ids.length,2);assert.ok(replacement.ids.every(id=>!copied.ids.includes(id)),'deleted duplicate IDs are never allocated again');
 assert.equal(copied.room.objects.some(o=>o.kind==='actor'||o.intent==='agent'),false);
 const ungrouped=ungroupSelection(copied.room,copied.ids);assert.ok(ungrouped.objects.filter(o=>copied.ids.includes(o.id)).every(o=>!o.groupId));
 assert.deepEqual(parseTycoonFloorJSON(JSON.stringify(tycoonFloorFile('projects',copied.room))).room,copied.room);
 assert.throws(()=>transformSelection(grouped,pair,{factor:4}));assert.equal(grouped.objects.find(o=>o.id==='desk-1').scale,1);
});
test('station anchors follow transforms and copies; deletion removes only selected local objects',()=>{
 let room=groupSelection(createTycoonRoom('projects'),pair);room.navigation={version:1,routes:[],forbidden:[],stations:[{objectId:'desk-1',approach:tycoonGround({x:-2,z:-3.2}),seat:tycoonGround({x:-1.7,z:-2.9})}]};
 const moved=transformSelection(room,pair,{dx:1,dz:.5}),point=tycoonWorld(moved.navigation.stations[0].seat);assert.ok(Math.abs(point.x-(-.7))<1e-6);
 const copy=duplicateSelection(moved,pair);assert.equal(copy.room.navigation.stations.length,2);assert.notEqual(copy.room.navigation.stations[1].objectId,'desk-1');
 const deleted=deleteSelection(copy.room,['desk-1']);assert.equal(deleted.objects.length,room.objects.length);assert.equal(deleted.navigation.stations.length,1);validateTycoonRoom(deleted);
});
test('layer operations move complete groups and reject dangling IDs and unsafe metadata',()=>{
 let room=groupSelection(createTycoonRoom('projects'),pair);room=reorderSelection(room,['chair-1'],'front');assert.deepEqual(room.layers.slice(0,2),pair);
 room=reorderSelection(room,pair,'back');assert.deepEqual(room.layers.slice(-2),pair);validateTycoonRoom(room);
 for(const edit of [r=>r.layers.push('missing'),r=>r.layers[0]=r.layers[1],r=>r.objects[0].groupId='solo',r=>r.objects[0].finish={texture:{data:'https://evil.test'}},r=>r.objects[0].role='admin']){const bad=structuredClone(room);edit(bad);assert.throws(()=>validateTycoonRoom(bad));}
});
