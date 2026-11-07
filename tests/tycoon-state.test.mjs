import test from 'node:test';
import assert from 'node:assert/strict';
import {createTycoonRoom,validateTycoonRoom,tycoonFloorFile,parseTycoonFloorJSON,TycoonStore,TYCOON_KEY} from '../web/tycoon-state.js';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('all floor and edition writers wait for the same exclusive lock; stale queued save conflicts',async()=>{
 const pending=[],locks={request:(name,options,write)=>new Promise(resolve=>pending.push({name,options,run:()=>resolve(write())}))};
 const storage=memory(),a=new TycoonStore(storage,{locks}),b=new TycoonStore(storage,{locks});
 const draft=createTycoonRoom('projects'),first=a.save('projects',draft),second=b.save('projects',createTycoonRoom('projects'));
 const originalX=draft.objects[0].x,lobby=a.save('lobby',createTycoonRoom('lobby')),edition=b.select('lobby','legacy');draft.objects[0].x=originalX+1.2;
 assert.equal(storage.getItem(TYCOON_KEY),null);assert.equal(pending.length,4);
 assert.ok(pending.every(p=>p.name===TYCOON_KEY&&p.options.mode==='exclusive'&&p.options.signal));
 pending.shift().run();assert.equal((await first).ok,true);assert.equal(a.get('projects').room.objects[0].x,originalX);
 pending.shift().run();assert.equal((await second).reason,'conflict');
 pending.shift().run();assert.equal((await lobby).ok,true);pending.shift().run();assert.equal(await edition,true);
 assert.equal(a.get('projects').revision,1);assert.equal(a.get('lobby').edition,'legacy');assert.equal(a.get('lobby').revision,2);
});
test('no cross-tab lock or a failed lock never falls back to an unlocked write',async()=>{
 const storage=memory(),room=createTycoonRoom('lobby');
 const unsupported=new TycoonStore(storage,{locks:null});assert.equal((await unsupported.save('lobby',room)).reason,'locking-unavailable');assert.equal(await unsupported.select('lobby','legacy'),false);
 const failed=new TycoonStore(storage,{locks:{request:async()=>{throw Error('timeout');}}});assert.equal((await failed.save('lobby',room)).reason,'busy');assert.equal(storage.getItem(TYCOON_KEY),null);
});
test('Lobby and Projects have metric independent scenes and roundtrip without business data',()=>{
  for(const floor of ['lobby','projects','growth']){
    const room=createTycoonRoom(floor);assert.equal(room.width,24);assert.equal(room.depth,16);
    assert.deepEqual(parseTycoonFloorJSON(JSON.stringify(tycoonFloorFile(floor,room))).room,room);
    assert.ok(room.objects.some(o=>o.intent==='floors'));
  }
  assert.notDeepEqual(createTycoonRoom('lobby').objects,createTycoonRoom('projects').objects);
});
test('untrusted scene cannot import credentials, URLs, nonfinite transforms or duplicate IDs',()=>{
  for(const mutate of [r=>r.businessId='secret',r=>r.objects[0].url='https://evil.test',r=>r.objects[0].x=Infinity,r=>r.objects.push({...r.objects[0]}),r=>r.objects[0].kind='actor',r=>r.objects[0].intent='agent']){
    const r=createTycoonRoom('projects');mutate(r);assert.throws(()=>validateTycoonRoom(r));
  }
  assert.throws(()=>createTycoonRoom('finance'));
  assert.throws(()=>parseTycoonFloorJSON(JSON.stringify({schemaVersion:'office-floor/v1'})));
});
test('per-floor save, stale revision and quota failure preserve legacy bytes and previous snapshot',async()=>{
  const s=memory();s.setItem('zuri-office:hybrid-studio:v1','legacy bytes');const store=new TycoonStore(s);
  assert.equal((await store.save('lobby',createTycoonRoom('lobby'),0)).ok,true);
  assert.equal(store.get('projects'),null);
  assert.equal((await store.save('lobby',createTycoonRoom('lobby'),0)).reason,'conflict');
  const before=s.getItem(TYCOON_KEY);s.setItem=()=>{throw Error('quota');};
  const r=createTycoonRoom('lobby');r.objects[0].x+=1;
  assert.equal((await store.save('lobby',r,1)).reason,'storage');assert.equal(s.getItem(TYCOON_KEY),before);
  assert.equal(s.getItem('zuri-office:hybrid-studio:v1'),'legacy bytes');
});
