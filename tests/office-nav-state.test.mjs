import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomStore,floorFile,normalizeRoom,parseFloorJSON,parseRoomJSON,roomDiff,starterRoom} from '../web/hybrid-state.js';
import {normalizeOfficeNavigation,validateOfficeNavigation} from '../web/office-nav-state.js';

const point=(x,y)=>({x,y});
const object={id:'desk-a',kind:'work-desk',x:64,y:43,scale:.62,flip:false,locked:false};
const valid={version:1,
  routes:[{id:'main-route',points:[point(43,48),point(36,54),point(32,56)]}],
  forbidden:[{id:'restricted',points:[point(33,53),point(35,53),point(35,55),point(33,55)]}],
  stations:[{objectId:'desk-a',approach:point(60,40),seat:point(61,40)}]};
const room=(navigation)=>({schemaVersion:'office-room/v1',name:'Room',background:'office',brief:'',
  objects:[object],...(navigation===undefined?{}:{navigation})});

test('navigation schema strictly validates bounded routes, polygons, and object stations',()=>{
  assert.deepEqual(validateOfficeNavigation(valid,[object]),valid);
  assert.deepEqual(normalizeOfficeNavigation(valid,[object]),valid);
  assert.throws(()=>validateOfficeNavigation({...valid,unexpected:'script'},[object]));
  assert.throws(()=>validateOfficeNavigation({...valid,routes:[{id:'r',points:[point(2,2),point(Infinity,4)]}]},[object]));
  assert.throws(()=>validateOfficeNavigation({...valid,routes:[{id:'r',points:[point(2,2),point(2,2)]}]},[object]));
  assert.throws(()=>validateOfficeNavigation({...valid,forbidden:[{id:'bow',points:[point(10,10),point(20,20),point(10,20),point(20,10)]}]},[object]));
  assert.throws(()=>validateOfficeNavigation({...valid,stations:[{objectId:'missing',approach:point(60,40)}]},[object]));
  assert.throws(()=>validateOfficeNavigation({...valid,routes:Array.from({length:17},(_,i)=>({id:`r${i}`,points:[point(1,1),point(2,2)]}))},[object]));
  assert.throws(()=>validateOfficeNavigation({...valid,routes:[{id:'too-long',points:Array.from({length:33},(_,i)=>point(i*2,20))}]},[object]));
  assert.throws(()=>validateOfficeNavigation({...valid,forbidden:Array.from({length:17},(_,i)=>({id:`area-${i}`,points:[point(1,1),point(3,1),point(2,3)]}))},[object]));
  assert.throws(()=>validateOfficeNavigation({...valid,stations:Array.from({length:41},()=>({objectId:'desk-a',approach:point(60,40)}))},[object]));
  assert.throws(()=>validateOfficeNavigation({...valid,routes:[{id:'bad-point',points:[point(2,2),point(101,2)]}]},[object]));
  assert.throws(()=>validateOfficeNavigation({...valid,routes:[{id:'bad-key',points:[point(2,2),{x:3,y:3,script:'alert(1)'}]}]},[object]));
  assert.equal(normalizeOfficeNavigation({...valid,version:2},[object]),undefined);
});

test('water cooler stations cannot define a seat anchor',()=>{
  const cooler={id:'water-a',kind:'water-cooler',x:37,y:68,scale:1,flip:false,locked:false};
  const navigation={version:1,routes:[],forbidden:[],stations:[{
    objectId:'water-a',approach:point(34,70),seat:point(37,68),
  }]};
  assert.throws(()=>validateOfficeNavigation(navigation,[object,cooler]),/water cooler.*seat/i);
  assert.equal(normalizeOfficeNavigation(navigation,[object,cooler]),undefined);
  assert.throws(()=>parseRoomJSON(JSON.stringify({...room(),objects:[object,cooler],navigation})),/water cooler.*seat/i);
});

test('room JSON keeps legacy rooms compatible and persists validated navigation',()=>{
  const legacy=starterRoom();
  assert.equal(Object.hasOwn(normalizeRoom(legacy),'navigation'),false);
  const withNavigation=room(valid);
  assert.deepEqual(normalizeRoom(withNavigation).navigation,valid);
  assert.deepEqual(parseRoomJSON(JSON.stringify(withNavigation)).navigation,valid);
  assert.throws(()=>parseRoomJSON(JSON.stringify(room({...valid,extra:'nope'}))));
  assert.throws(()=>parseRoomJSON(JSON.stringify(room({...valid,stations:[{objectId:'orphan',approach:point(50,50)}]}))));
});

test('floor JSON and local floor storage preserve authored navigation',()=>{
  const source=room(valid),floor=parseFloorJSON(JSON.stringify(floorFile('projects',source)));
  assert.deepEqual(floor.room.navigation,valid);
  const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  assert.equal(new RoomStore(storage).apply('preview:projects',source),true);
  assert.deepEqual(new RoomStore(storage).floor('projects').navigation,valid);
  const other={...valid,routes:[{id:'other-route',points:[point(40,50),point(45,50)]}]};
  const store=new RoomStore(storage);store.apply('preview:customer',room(other));
  store.apply('preview:projects',room({...valid,forbidden:[]}));
  assert.deepEqual(new RoomStore(storage).floor('customer').navigation,other);
});

test('legacy office fixtures become a ground arrow, while explicit saved actions keep precedence',()=>{
  const source={...starterRoom(),background:'office',objects:[
    {id:'old-lift',kind:'lift',x:78,y:44,scale:1,flip:false,locked:false},
    {id:'custom-lift',kind:'elevator-door',x:78,y:44,scale:1,flip:false,locked:false,interaction:{type:'popup',title:'Help',body:'Custom saved action'}},
    {id:'old-printer',kind:'printer',x:80,y:65,scale:1,flip:false,locked:false},
  ]};
  const normalized=normalizeRoom(source);
  assert.deepEqual(normalized.objects.map(o=>o.kind),['wayfinding-arrow','wayfinding-arrow']);
  assert.equal(normalized.objects[0].x,30);assert.equal(normalized.objects[0].y,82);
  assert.equal(normalized.objects[1].interaction.type,'popup');
});

test('roomDiff exposes navigation edits independently from object changes',()=>{
  const before=room(valid),after=room({...valid,stations:[{objectId:'desk-a',approach:point(60,41),seat:point(61,40)}]});
  assert.equal(roomDiff(before,after).navigation,true);
  assert.equal(roomDiff(before,room(valid)).navigation,false);
  assert.equal(roomDiff(room(undefined),room(valid)).navigation,true);
});
