import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {PLACEABLE_STUDIO_GLBS} from '../web/office-assets.js';

const sourceRequire=createRequire(import.meta.url);
let officeModulePromise;

function officeModule(){
 return officeModulePromise??=build({
  entryPoints:['web/office.js'],bundle:true,write:false,format:'esm',platform:'browser',
  plugins:[{name:'office-lifecycle-fixtures',setup(builder){
   builder.onResolve({filter:/^threeReal$/},()=>({path:sourceRequire.resolve('three'),namespace:'file'}));
   builder.onResolve({filter:/^three$/},()=>({path:'three',namespace:'office-fixture'}));
   builder.onResolve({filter:/^three\/addons\/loaders\/GLTFLoader\.js$/},()=>({path:'loader',namespace:'office-fixture'}));
   builder.onResolve({filter:/^three\/addons\/controls\/OrbitControls\.js$/},()=>({path:'controls',namespace:'office-fixture'}));
   builder.onResolve({filter:/^\.\/models\.js$/},args=>args.importer.endsWith('office.js')?{path:'models',namespace:'office-fixture'}:undefined);
   builder.onLoad({filter:/.*/,namespace:'office-fixture'},args=>({loader:'js',contents:({
    three:`import * as T from 'threeReal'; export * from 'threeReal'; export class WebGLRenderer { constructor(){const state=globalThis.officeLifecycleMocks;this.domElement=globalThis.document.createElement('canvas');this.domElement._listeners=new Map();const add=this.domElement.addEventListener.bind(this.domElement),remove=this.domElement.removeEventListener.bind(this.domElement);this.domElement.addEventListener=(type,fn,...rest)=>{this.domElement._listeners.set(type,fn);return add(type,fn,...rest)};this.domElement.removeEventListener=(type,fn,...rest)=>{if(this.domElement._listeners.get(type)===fn)this.domElement._listeners.delete(type);return remove(type,fn,...rest)};this.shadowMap={};state.renderers.push(this)} setPixelRatio(){} setSize(){this.sizes=(this.sizes||0)+1} render(){this.renders=(this.renders||0)+1} dispose(){this.disposes=(this.disposes||0)+1} }`,
    loader:`export class GLTFLoader { register(){return this} loadAsync(url){const key=url.split('/').at(-1).replace('.gltf','');return globalThis.officeLifecycleMocks.assets[key]} }`,
    controls:`import {Vector3} from 'three'; export class OrbitControls { constructor(){this.target=new Vector3();this.listeners=new Map();this.disposes=0;globalThis.officeLifecycleMocks.controls.push(this)} addEventListener(k,fn){this.listeners.set(k,fn)} removeEventListener(k,fn){if(this.listeners.get(k)===fn)this.listeners.delete(k)} update(){} dispose(){this.disposes++} }`,
    models:`import * as T from 'three'; const state=globalThis.officeLifecycleMocks,cached=state.sharedMaterial; export const palette={brand:'#E8820C'}; export function box(parent,w,h,d,x,y,z){const m=new T.Mesh(state.watch(new T.BoxGeometry(w,h,d)),cached);m.position.set(x,y,z);parent.add(m);return m} export function makeChair(){const g=new T.Group();box(g,1,1,1,0,0,0);return g} export const makeDecoration=makeChair; export function makeAvatar(){const g=new T.Group();g.userData={body:new T.Group(),leftLeg:new T.Group(),rightLeg:new T.Group(),leftArm:new T.Group(),rightArm:new T.Group(),head:new T.Group()};for(const k of ['body','leftLeg','rightLeg','leftArm','rightArm','head'])g.add(g.userData[k]);box(g,.4,.5,.2,0,0,0);return g}`
   })[args.path]}));
  }}]
 }).then(async result=>{const source=result.outputFiles[0].text;return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))});
}

function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}

function setupDOM(){
 const dom=new JSDOM('<!doctype html><body><div id="scene"><span id="keep-scene">keep</span></div><div id="labels"><span id="keep-label">keep</span></div><div id="scene-loading" hidden></div></body>',{pretendToBeVisual:true});
 const state={assets:{},renderers:[],controls:[],observers:[],frames:new Map(),cancelled:new Set(),nextFrame:0,sharedMaterial:{isMaterial:true,disposed:0,dispose(){this.disposed++}},watch(resource){if(!resource._disposeObserved){resource.disposeCount=0;resource.addEventListener('dispose',()=>resource.disposeCount++);resource._disposeObserved=true}return resource}};
 dom.window.HTMLCanvasElement.prototype.getContext=()=>({fillStyle:'',font:'',fillRect(){},fillText(){}});
 const previous={document:globalThis.document,window:globalThis.window,matchMedia:globalThis.matchMedia,devicePixelRatio:globalThis.devicePixelRatio,ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 globalThis.document=dom.window.document;globalThis.window=dom.window;globalThis.matchMedia=()=>({matches:false});globalThis.devicePixelRatio=1;
 globalThis.ResizeObserver=class{constructor(callback){this.callback=callback;this.disconnects=0;state.observers.push(this)}observe(){}disconnect(){this.disconnects++}};
 globalThis.requestAnimationFrame=callback=>{const id=++state.nextFrame;state.frames.set(id,callback);return id};globalThis.cancelAnimationFrame=id=>{state.cancelled.add(id);state.frames.delete(id)};
 globalThis.officeLifecycleMocks=state;
 return{dom,state,restore(){for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}delete globalThis.officeLifecycleMocks;dom.window.close()}};
}

function fixtureAsset(){return{scene:assetScene()}}

function assetScene(){
 const Geometry=globalThis.officeLifecycleMocks.assetGeometry;
 if(!Geometry)throw new Error('asset geometry fixture factory not initialized');
 const root=Geometry.group(),mesh=Geometry.mesh();globalThis.officeLifecycleMocks.watch(mesh.geometry);globalThis.officeLifecycleMocks.watch(mesh.material);root.add(mesh);return root;
}

test('existing Office geometry round-trips native transforms; chairs anchor avatars and pointer drag cancels cleanly',async t=>{
 const fixture=setupDOM();t.after(()=>fixture.restore());const three=await import('three');
 fixture.state.assetGeometry={group:()=>new three.Group(),mesh:()=>new three.Mesh(new three.BoxGeometry(1,1,1),new three.MeshBasicMaterial())};
 const surfaceAsset=fixtureAsset();surfaceAsset.scene.userData.surfaceId='wall-left';
 fixture.state.assets={room:Promise.resolve(surfaceAsset),desk:Promise.resolve(fixtureAsset()),'floor-tile':Promise.resolve(fixtureAsset())};
 const {Office}=await officeModule(),{defaultNativeRoom}=await import('../web/native-state.js');
 const moves=[],office=new Office(document.querySelector('#scene'),{editable:true,onObjectMove:(id,p)=>moves.push([id,p])});
 await office.load();const room=defaultNativeRoom();room.objects[0].x=-1;room.objects[1].x=2;room.objects[1].z=1;room.objects[1].rotation=45;
 office.setNativeRoom(room);assert.deepEqual(office.snapshotNativeRoom(),room);
 assert.equal(office.furniture.get('desk-0').position.x,-1);assert.equal(office.furniture.get('chair-0').position.x,2);
 office.setAgents([{id:'one',name:'One',avatar:{},status:'idle'}]);office.tick(100);
 assert.equal(office.avatars[0].position.x,2);assert.ok(Math.abs(office.avatars[0].position.z-1.09)<.001);
 office.pickFurniture=()=>({id:'desk-0'});office.groundPoint=e=>new three.Vector3(e.clientX,0,e.clientY);
 office.onPointerDown({button:0,pointerId:1,clientX:0,clientY:0});
 office.onPointerMove({pointerId:1,clientX:1,clientY:1});
 assert.equal(office.controls.enabled,false);assert.equal(office.furniture.get('desk-0').position.x,0);
 office.onPointerCancel();assert.equal(office.controls.enabled,true);assert.equal(office.furniture.get('desk-0').position.x,-1);assert.equal(moves.length,0);
 office.onPointerDown({button:0,pointerId:2,clientX:0,clientY:0});office.onPointerMove({pointerId:2,clientX:2,clientY:0});office.onPointerUp({pointerId:2});
 assert.deepEqual(moves,[['desk-0',{x:1,z:-2.5}]]);
 office.setNativeRoom(defaultNativeRoom());assert.equal(office.furniture.get('desk-0').position.x,-3.25);
 const roster=office.agents,avatar=office.avatars[0],labels=office.labels.length;
 const {createNativeObject}=await import('../web/native-state.js');
 const extra=createNativeObject('chair','prop-copy-chair-0001'),decor=createNativeObject('plant','prop-plant-000001');
 const expanded={...defaultNativeRoom(),objects:[...defaultNativeRoom().objects.filter(o=>o.id!=='chair-0'),extra,decor]};
 office.setNativeRoom(expanded);office.tick(200);
 assert.equal(office.furniture.has('chair-0'),false);assert.equal(office.furniture.size,13);
 assert.equal(office.furniture.get(extra.id).userData.slot,undefined);
 assert.equal(office.agents,roster);assert.equal(office.avatars[0],avatar);assert.equal(office.labels.length,labels);
 assert.equal(avatar.userData.leftLeg.rotation.x,0);assert.equal(avatar.position.x,-3.25);
 const removed=[];office.furniture.get(decor.id).traverse(n=>{if(n.geometry)removed.push(n.geometry)});
 const deskGeometry=office.furniture.get('desk-0').children[0].geometry;
 office.setNativeRoom({schemaVersion:'office-3d/v1',objects:[]});office.tick(300);
 assert.equal(office.furniture.size,0);assert.ok(removed.every(g=>g.disposeCount===1));assert.equal(deskGeometry.disposeCount,0);
 assert.equal(office.avatars[0],avatar);assert.equal(office.agents,roster);
 office.setNativeRoom(expanded);assert.deepEqual(office.snapshotNativeRoom(),expanded);
 office.setNativeRoom(defaultNativeRoom());assert.equal(office.furniture.size,12);
 const sourceMaterial=surfaceAsset.scene.children[0].material;
 office.setNativeRoom({...defaultNativeRoom(),surfaces:{'wall-left':{color:'#a6b9b3',material:'wood'}}});
 const painted=surfaceAsset.scene.children[0].material;fixture.state.watch(painted);
 assert.notEqual(painted,sourceMaterial);assert.equal(painted.color.getHexString(),'a6b9b3');
 const {domainFloors}=await import('../web/domain-office.js');office.showBuilding(domainFloors.slice(0,1),()=>{});
 assert.equal(painted.disposeCount,1);let paintedInTower=false;
 office.tower.building.traverse(n=>{if(n.material?.color?.getHexString()==='a6b9b3')paintedInTower=true});assert.equal(paintedInTower,false);
 office.showDomain(domainFloors[0],roster);office.setNativeRoom(defaultNativeRoom());assert.equal(surfaceAsset.scene.children[0].material,sourceMaterial);
 office.dispose();assert.ok(removed.every(g=>g.disposeCount===1));assert.equal(deskGeometry.disposeCount,1);
});

test('built-in room decor becomes independent movable clones with isolated finishes and owned-resource cleanup',async t=>{
 const fixture=setupDOM();t.after(()=>fixture.restore());const three=await import('three');
 const {makeRoom}=await import('../web/models.js'),{defaultNativeRoom,nativeDecor,createNativeObject}=await import('../web/native-state.js');
 fixture.state.assetGeometry={group:()=>new three.Group(),mesh:()=>new three.Mesh(new three.BoxGeometry(1,1,1),new three.MeshStandardMaterial())};
 const sourceRoom=makeRoom();sourceRoom.traverse(n=>{if(n.material)n.material=n.material.clone()});
 fixture.state.assets={room:Promise.resolve({scene:sourceRoom}),desk:Promise.resolve(fixtureAsset()),'floor-tile':Promise.resolve(fixtureAsset())};
 const {Office}=await officeModule(),office=new Office(document.querySelector('#scene'));await office.load();
 assert.equal(office.furniture.size,20);
 const source=office.decorSources.get('lounge-sofa'),sofa=office.furniture.get('builtin-lounge-sofa');
 assert.equal(source.visible,false);
 sourceRoom.updateMatrixWorld(true);office.floor.updateMatrixWorld(true);
 assert.deepEqual(new three.Box3().setFromObject(sofa).min.toArray(),new three.Box3().setFromObject(source).min.toArray());
 const original=source.children[0].material,geometry=source.children[0].geometry;fixture.state.watch(geometry);
 const room=defaultNativeRoom();room.decor=nativeDecor(room);room.decor[0]={...room.decor[0],x:-4,z:1,rotation:45,finish:{color:'#d6ecfa',material:'fabric'}};
 room.objects.push({...room.decor[0],id:'prop-sofa-copy-0001',x:3,finish:{color:'#c6a052',material:'wood'}});
 room.objects.push({...createNativeObject('desk','prop-colored-desk'),finish:{color:'#e8820c',material:'metal'}});
 office.setNativeRoom(room);assert.equal(sofa.position.x,-4);assert.equal(sofa.rotation.y,Math.PI/4);
 const sourceClone=sofa.children[0].children[0],copyClone=office.furniture.get('prop-sofa-copy-0001').children[0].children[0];
 assert.equal(sourceClone.material.color.getHexString(),'d6ecfa');assert.equal(copyClone.material.color.getHexString(),'c6a052');
 assert.equal(source.children[0].material,original);
 const finish=office.objectFinishes.get('builtin-lounge-sofa'),owned=[...finish.materials,...finish.textures.values()];owned.forEach(r=>fixture.state.watch(r));
 office.setNativeRoom({...room,decor:room.decor.filter(o=>o.source!=='lounge-sofa')});
 assert.equal(office.furniture.has('builtin-lounge-sofa'),false);assert.ok(office.furniture.has('prop-sofa-copy-0001'));
 assert.ok(owned.every(r=>r.disposeCount===1));assert.equal(geometry.disposeCount,0);
 office.setNativeRoom(defaultNativeRoom());assert.equal(office.furniture.size,20);
 assert.equal(office.furniture.get('builtin-lounge-sofa').position.x,-5.87);
 assert.equal(office.furniture.get('builtin-lounge-sofa').children[0].children[0].material.color.getHex(),original.color.getHex());
 office.dispose();assert.equal(geometry.disposeCount,1);assert.ok(owned.every(r=>r.disposeCount===1));
});

test('Office disposal is idempotent, releases owned resources once, and waits for all GLTF loads',async t=>{
 const fixture=setupDOM();t.after(()=>fixture.restore());
 const three=await import('three');
 fixture.state.assetGeometry={group:()=>new three.Group(),mesh:()=>new three.Mesh(new three.BoxGeometry(1,1,1),new three.MeshBasicMaterial())};
 const {Office}=await officeModule();
 const container=document.querySelector('#scene'),unrelated=container.querySelector('#keep-scene'),unrelatedLabel=document.querySelector('#keep-label');
 fixture.state.assets={room:Promise.resolve(fixtureAsset()),desk:Promise.resolve(fixtureAsset()),'floor-tile':Promise.resolve(fixtureAsset())};
 const office=new Office(container);await office.load();assert.equal(office.loaded,true);assert.equal(fixture.state.frames.size,1);assert.equal(fixture.state.observers.length,1);
 const loadedGeometries=new Set(office.gltfResources.geometries),generated=[...office.generatedGeometries];const gltfMaterials=new Set(office.gltfResources.materials),gltfTextures=new Set(office.gltfResources.textures);const signMaterial=[...office.generatedMaterials].find(m=>m.map);const signTexture=signMaterial.map;const signGeometry=signMaterial&&[...office.generatedGeometries].find(g=>g.type==='PlaneGeometry');const resources=new Set([...loadedGeometries,...generated,...gltfMaterials,...gltfTextures,...office.generatedMaterials,...office.generatedTextures]);for(const resource of resources)fixture.state.watch(resource);
 const staleFrame=[...fixture.state.frames.values()][0],renderer=fixture.state.renderers[0],controls=fixture.state.controls[0],observer=fixture.state.observers[0];
 office.dispose();office.dispose();
 assert.equal(renderer.disposes,1);assert.equal(controls.disposes,1);assert.equal(observer.disconnects,1);assert.equal(controls.listeners.size,0);assert.equal(fixture.state.frames.size,0);
 assert.deepEqual([...container.children],[unrelated]);assert.deepEqual([...document.querySelector('#labels').children],[unrelatedLabel]);assert.equal(renderer.domElement._listeners.size,0);
 assert.ok([...resources].every(resource=>resource.disposeCount===1));assert.equal(fixture.state.sharedMaterial.disposed,0);assert.equal(signMaterial.disposeCount,1);assert.equal(signTexture.disposeCount,1);assert.equal(signGeometry.disposeCount,1);
 const renderCount=renderer.renders||0,resizeCount=renderer.sizes;staleFrame(1000);observer.callback();office.setAgents([{id:'new',name:'late'}]);office.control('in');assert.equal(renderer.renders||0,renderCount);assert.equal(renderer.sizes,resizeCount);assert.equal(fixture.state.frames.size,0);
});

test('Office constructor releases renderer resources when ResizeObserver is unavailable or fails to observe',async t=>{
 const fixture=setupDOM();t.after(()=>fixture.restore());const {Office}=await officeModule();
 const container=document.querySelector('#scene'),unrelated=container.querySelector('#keep-scene');delete globalThis.ResizeObserver;
 assert.throws(()=>new Office(container),ReferenceError);
 assert.equal(fixture.state.renderers[0].disposes,1);assert.equal(fixture.state.controls[0].disposes,1);assert.equal(fixture.state.renderers[0].domElement._listeners.size,0);
 assert.equal(fixture.state.frames.size,0);assert.deepEqual([...container.children],[unrelated]);
 globalThis.ResizeObserver=class{constructor(){this.disconnects=0;fixture.state.observers.push(this)}observe(){throw new Error('fixture observe failed')}disconnect(){this.disconnects++}};
 assert.throws(()=>new Office(container),/fixture observe failed/);
 assert.equal(fixture.state.renderers[1].disposes,1);assert.equal(fixture.state.controls[1].disposes,1);assert.equal(fixture.state.observers[0].disconnects,1);
 assert.equal(fixture.state.renderers[1].domElement._listeners.size,0);assert.equal(fixture.state.frames.size,0);assert.deepEqual([...container.children],[unrelated]);
});

test('Office disposes partial GLTF results after rejection and ignores successful loads that finish after disposal',async t=>{
 const fixture=setupDOM();t.after(()=>fixture.restore());const three=await import('three');
 fixture.state.assetGeometry={group:()=>new three.Group(),mesh:()=>new three.Mesh(new three.BoxGeometry(1,1,1),new three.MeshBasicMaterial())};const {Office}=await officeModule();
 const lateFailure=deferred(),oneAsset=fixtureAsset(),twoAsset=fixtureAsset();fixture.state.assets={room:Promise.resolve(oneAsset),desk:Promise.reject(new Error('fixture load failed')),'floor-tile':lateFailure.promise};
 const failed=new Office(document.querySelector('#scene'));const rejection=assert.rejects(failed.load(),/fixture load failed/);lateFailure.resolve(twoAsset);await rejection;
 for(const asset of [oneAsset,twoAsset])asset.scene.traverse(node=>{if(node.geometry)assert.equal(node.geometry.disposeCount,1);if(node.material)assert.equal(node.material.disposeCount,1)});
 assert.equal(fixture.state.renderers[0].disposes,1);assert.equal(document.querySelectorAll('#labels .desk-label').length,0);
 const pending={room:deferred(),desk:deferred(),'floor-tile':deferred()};fixture.state.assets=Object.fromEntries(Object.entries(pending).map(([key,value])=>[key,value.promise]));
 const disposed=new Office(document.querySelector('#scene'));const loading=disposed.load();disposed.dispose();const afterDispose=Object.values(pending).map(()=>fixtureAsset());Object.values(pending).forEach((value,i)=>value.resolve(afterDispose[i]));assert.equal(await loading,false);
 for(const asset of afterDispose)asset.scene.traverse(node=>{if(node.geometry)assert.equal(node.geometry.disposeCount,1);if(node.material)assert.equal(node.material.disposeCount,1)});
 assert.equal(fixture.state.renderers[1].disposes,1);assert.equal(document.querySelectorAll('#labels .desk-label').length,0);assert.equal(document.querySelectorAll('#labels .speech-bubble').length,0);
});

test('one renderer switches between every floor and the tower, then releases shared tower resources once',async t=>{
 const fixture=setupDOM();t.after(()=>fixture.restore());const three=await import('three');
 const {domainFloors,floorAgents}=await import('../web/domain-office.js');
 fixture.state.assetGeometry={group:()=>new three.Group(),mesh:()=>new three.Mesh(new three.BoxGeometry(1,1,1),new three.MeshBasicMaterial())};
 fixture.state.assets={room:Promise.resolve(fixtureAsset()),desk:Promise.resolve(fixtureAsset()),'floor-tile':Promise.resolve(fixtureAsset())};
 const {Office}=await officeModule();const office=new Office(document.querySelector('#scene'));await office.load();
 let entered;office.showBuilding(domainFloors,key=>entered=key);
 assert.equal(office.tower.floors.length,14);assert.equal(office.floor.visible,false);
 assert.equal(document.querySelectorAll('.tower-marker').length,14);
 document.querySelectorAll('.tower-marker')[8].click();assert.equal(entered,'procurement');
 const tower=office.tower;const owned=[...tower.geometries,...tower.materials];owned.forEach(resource=>fixture.state.watch(resource));
 for(const domain of domainFloors){office.showDomain(domain,floorAgents(domain));assert.equal(office.floor.visible,true);assert.equal(tower.building.visible,false);assert.equal(office.agents.length,4);assert.ok(office.towerLabels.every(({label})=>label.hidden));office.showBuilding(domainFloors,()=>{});assert.equal(office.tower,tower);assert.ok(office.avatars.every(avatar=>!avatar.visible));}
 assert.equal(fixture.state.renderers.length,1);assert.equal(fixture.state.frames.size,1);
 office.dispose();assert.ok(owned.every(resource=>resource.disposeCount===1));assert.equal(document.querySelectorAll('.tower-marker').length,0);
});


test('scaled and tilted meshes, perspective projection and group pointer preview use saved transforms',async t=>{
 const fixture=setupDOM();let office;t.after(()=>{office?.dispose();fixture.restore();});const three=await import('three');
 fixture.state.assetGeometry={group:()=>new three.Group(),mesh:()=>new three.Mesh(new three.BoxGeometry(1,1,1),new three.MeshBasicMaterial())};
 fixture.state.assets={room:Promise.resolve(fixtureAsset()),desk:Promise.resolve(fixtureAsset()),'floor-tile':Promise.resolve(fixtureAsset())};
 const {Office}=await officeModule(),{defaultNativeRoom}=await import('../web/native-state.js');
 office=new Office(document.querySelector('#scene'),{editable:true});await office.load();
 office.container.getBoundingClientRect=()=>({width:900,height:600});office.resize();
 const room=defaultNativeRoom();room.objects[0].scale={x:1.5,y:2,z:.75};room.objects[0].tilt={x:15,z:10};room.projection='perspective';
 office.setNativeRoom(room);office.selectionIds=new Set(['desk-0','chair-0']);
 assert.equal(office.camera.isPerspectiveCamera,true);assert.deepEqual(office.furniture.get('desk-0').scale.toArray(),[1.5,2,.75]);
 assert.deepEqual(office.objectDimensions('desk-0').size.toArray(),[1.5,2,.75]);assert.deepEqual(office.snapshotNativeRoom(),room);
 assert.ok(office.projectedSelection().width>0);office.updateEditOverlay();assert.match(office.editOverlay.textContent,/px/);
 office.pickFurniture=()=>({id:'desk-0'});office.groundPoint=e=>new three.Vector3(e.clientX,0,e.clientY);office.snapGrid=.25;
 office.onPointerDown({button:0,pointerId:3,clientX:0,clientY:0});office.onPointerMove({pointerId:3,clientX:.33,clientY:0});
 assert.equal(office.furniture.get('desk-0').position.x,-3);assert.equal(office.furniture.get('chair-0').position.x,-3);
 office.onPointerCancel();assert.equal(office.furniture.get('chair-0').position.x,-3.25);
 office.setNativeRoom(defaultNativeRoom());assert.equal(office.camera.isOrthographicCamera,true);assert.deepEqual(office.furniture.get('desk-0').scale.toArray(),[1,1,1]);assert.equal(office.furniture.get('desk-0').rotation.x,0);
});

test('Studio-only GLBs load on demand and render as stable-ID scene props',async t=>{
 const fixture=setupDOM();t.after(()=>fixture.restore());const three=await import('three');
 fixture.state.assetGeometry={group:()=>new three.Group(),mesh:()=>new three.Mesh(new three.BoxGeometry(1,1,1),new three.MeshBasicMaterial())};
 fixture.state.assets={room:Promise.resolve(fixtureAsset()),desk:Promise.resolve(fixtureAsset()),'floor-tile':Promise.resolve(fixtureAsset()),
  ...Object.fromEntries(PLACEABLE_STUDIO_GLBS.map(asset=>[asset.file.split('/').at(-1),Promise.resolve(fixtureAsset())]))};
 const {Office}=await officeModule(),office=new Office(document.querySelector('#scene'),{editable:true,loadStudioAssets:true});await office.load();
 assert.equal(office.assetModels.size,PLACEABLE_STUDIO_GLBS.length);
 const {defaultNativeRoom}=await import('../web/native-state.js'),room=defaultNativeRoom();
 const assets=['visual-office.desk.signature.v1','visual-office.sofa.lounge.v1','visual-office.elevator.bay.v1'].map((assetId,index)=>({id:`prop-studio-asset-${String(index+1).padStart(4,'0')}`,kind:'asset',assetId,x:1+index,z:2,rotation:15,locked:false,interaction:{type:'none'}}));
 room.objects.push(...assets);office.setNativeRoom(room);
 for(const asset of assets){const placed=office.furniture.get(asset.id);assert.ok(placed);assert.equal(placed.userData.assetId,asset.assetId);assert.equal(placed.userData.furnitureKind,'asset');assert.equal(placed.position.x,asset.x);assert.equal(placed.position.z,asset.z);assert.equal(placed.rotation.y,Math.PI/12);}
 office.dispose();
});

test('non-Studio Office view does not request optional Studio GLB inventory',async t=>{
 const fixture=setupDOM();t.after(()=>fixture.restore());const three=await import('three');
 fixture.state.assetGeometry={group:()=>new three.Group(),mesh:()=>new three.Mesh(new three.BoxGeometry(1,1,1),new three.MeshBasicMaterial())};
 fixture.state.assets={room:Promise.resolve(fixtureAsset()),desk:Promise.resolve(fixtureAsset()),'floor-tile':Promise.resolve(fixtureAsset())};
 const {Office}=await officeModule(),office=new Office(document.querySelector('#scene'));await office.load();
 assert.equal(office.assetModels.size,0);assert.equal(office.loaded,true);office.dispose();
});
