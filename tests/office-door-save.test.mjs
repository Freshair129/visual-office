import test from 'node:test';
import assert from 'node:assert/strict';
import {saveOfficeDoor} from '../web/office-door-save.js';
import {RoomStore} from '../web/hybrid-state.js';
import {applyOfficeBlueprint} from '../web/office-blueprints.js';
const fixture=()=>{const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},store=new RoomStore(storage);store.apply('preview:projects',applyOfficeBlueprint({schemaVersion:'office-room/v1',name:'P',brief:'',objects:[]},'medium'));return {storage,store};};
test('door floor save is scoped and rejects stale writers or failed storage without replacing scene state',()=>{
  const {storage,store}=fixture(),revision=store.floorRevision('projects'),r=saveOfficeDoor(storage,'projects',revision,'entry');
  assert.equal(r.ok,true);assert.equal(r.room.blueprintPlan.door.open,false);assert.equal(new RoomStore(storage).floor('customer'),null);
  assert.equal(saveOfficeDoor(storage,'projects',revision,'entry').ok,false);assert.equal(new RoomStore(storage).floor('projects').blueprintPlan.door.open,false);
  const fresh=new RoomStore(storage),bad={getItem:storage.getItem,setItem:()=>{throw Error('quota');}};
  assert.equal(saveOfficeDoor(bad,'projects',fresh.floorRevision('projects'),'entry').ok,false);assert.equal(new RoomStore(storage).floor('projects').blueprintPlan.door.open,false);
  assert.equal(saveOfficeDoor(storage,'lobby','null','entry').ok,false);
});
