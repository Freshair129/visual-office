import test from 'node:test';import assert from 'node:assert/strict';
import {defaultOfficeRoom,normalizeRoom,parseRoomJSON,RoomStore,RoomHistory} from '../web/hybrid-state.js';
import {domainFloors} from '../web/domain-office.js';
const defaultFloorRoom=key=>defaultOfficeRoom(domainFloors.find(f=>f.key===key));
const validateRoom=room=>parseRoomJSON(JSON.stringify(room));
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
test('appearance edits undo, save and round-trip per floor without changing actor identity or count',()=>{
 const room=defaultFloorRoom('projects'),before=room.objects.filter(o=>o.kind.startsWith('avatar-')).map(o=>[o.id,o.kind]);
 const history=new RoomHistory(room),id=before[0][0];history.change({...room,objects:room.objects.map(o=>o.id===id?{...o,appearance:'zuri'}:o)});
 assert.equal(history.current.objects.find(o=>o.id===id).appearance,'zuri');
 assert.deepEqual(history.current.objects.filter(o=>o.kind.startsWith('avatar-')).map(o=>[o.id,o.kind]),before);
 const imported=validateRoom(JSON.parse(JSON.stringify(history.current)));assert.equal(imported.objects.find(o=>o.id===id).appearance,'zuri');
 const store=new RoomStore(storage());assert.equal(store.apply('preview:projects',imported),true);
 assert.equal(store.floor('projects').objects.find(o=>o.id===id).appearance,'zuri');assert.equal(store.floor('growth'),null);
 history.undo();assert.equal(history.current.objects.find(o=>o.id===id).appearance,undefined);
});
test('imports reject arbitrary appearances and do not attach character identity to furniture',()=>{
 for(const [kind,appearance]of [['avatar-01','file:///secret'],['work-desk','zuri']]){
  const room=defaultFloorRoom('projects');const o=room.objects.find(o=>o.kind.startsWith('avatar-'));o.kind=kind;o.appearance=appearance;
  assert.throws(()=>validateRoom(room));assert.equal(normalizeRoom(room).objects.find(x=>x.id===o.id).appearance,undefined);
 }
});
