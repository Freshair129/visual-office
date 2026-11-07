import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {usesPaintedSkeleton,createPaintedFurniture,disposePaintedFurniture,createPaintedWallMasks,paintedAlphaHit} from '../web/painted-office-skeleton.js';
import {officeSceneCamera,groundToWorld} from '../web/office-projection.js';
import {createOfficeArchitecture,disposeOfficeArchitecture} from '../web/office-architecture.js';
import {departmentStarterRoom} from '../web/hybrid-state.js';
import {createOfficeNavigation} from '../web/office-navigation.js';
import {HybridOffice3D} from '../web/hybrid-office-3d.js';
import {createOfficeCharacter,disposeOfficeCharacter} from '../web/office-characters.js';
import {HybridScene} from '../web/hybrid-scene.js';
import {JSDOM} from 'jsdom';

test('Projects original Office art is explicit; other floors and custom plans retain their renderer',()=>{
 assert.equal(usesPaintedSkeleton({background:'office'},'projects'),true);
 for(const [room,floor]of [[{background:'office'},'growth'],[{background:'garden'},'projects'],[{background:'office',blueprint:'medium'},'projects']])assert.equal(usesPaintedSkeleton(room,floor),false);
});
test('furniture uses existing art, matching camera/ground anchor, alpha cutouts and depth',()=>{
 let complete,requested;const texture=new THREE.Texture();
 const o={id:'desk',kind:'work-desk',x:61,y:43,scale:.62,flip:false};
 const camera=officeSceneCamera(),model=createPaintedFurniture(o,camera,{depthFront:.8,loadTexture:(url,ready)=>{requested=url;complete=ready;return texture;}});
 assert.match(requested,/work-desk-isometric-v1.png$/);
 texture.image={width:1200,height:1000};complete(texture);
 const mesh=model.children[0];assert.equal(mesh.material.depthWrite,true);assert.ok(mesh.material.alphaTest>0);assert.equal(mesh.material.toneMapped,false);
 assert.ok(mesh.quaternion.equals(camera.quaternion));const z=mesh.geometry.attributes.position;assert.ok(Math.abs(z.getZ(0)-z.getZ(2))>.1,'art has physical height depth');assert.ok(model.position.equals(groundToWorld(o)));
 const normalOffset=mesh.position.clone().applyQuaternion(camera.quaternion.clone().invert()).z;
 assert.ok(normalOffset>0&&normalOffset<.8,'height and measured rear/front extent shape the image depth');assert.ok(mesh.renderOrder<-10,'static art is preserved before wall masks restrict actors');
 assert.ok(Math.abs(mesh.position.y)<10);assert.equal(model.scale.x,.62);
 disposePaintedFurniture(model);
});
test('wall skeleton writes only depth at the original world transforms',()=>{
 const architecture=createOfficeArchitecture();const masks=createPaintedWallMasks(architecture);
 assert.ok(masks.children.length>0);
 for(const mask of masks.children){assert.equal(mask.material.colorWrite,false);assert.equal(mask.material.depthWrite,true);assert.equal(mask.material.transparent,false);assert.equal(mask.userData.officeWall,true);}
 assert.equal(masks.children.length,architecture.userData.wallMeshes.length);
 disposePaintedFurniture(masks);disposeOfficeArchitecture(architecture);
});
test('late furniture texture completion cannot mutate a disposed model',()=>{
 let complete;const texture=new THREE.Texture();let disposed=0;texture.addEventListener('dispose',()=>disposed++);
 const model=createPaintedFurniture({id:'chair',kind:'task-chair',x:60,y:40,scale:.72},officeSceneCamera(),{loadTexture:(_url,ready)=>{complete=ready;return texture;}});
 disposePaintedFurniture(model);const geometry=model.children[0].geometry;
 texture.image={width:10,height:20};complete(texture);
 assert.equal(model.children[0].geometry,geometry);assert.ok(disposed>=1);
});
test('transparent furniture padding does not intercept picks and UVs match the image origin',()=>{
 const data=new Uint8ClampedArray(16);data[3]=255;const mask={width:2,height:2,data};
 assert.equal(paintedAlphaHit(mask,{x:.1,y:.9}),true);assert.equal(paintedAlphaHit(mask,{x:.9,y:.9}),false);assert.equal(paintedAlphaHit(mask,{x:.1,y:.1}),false);
 const texture=new THREE.Texture();const model=createPaintedFurniture({id:'desk',kind:'work-desk',x:50,y:65,scale:1},officeSceneCamera(),{loadTexture:()=>texture});
 try{const mesh=model.children[0];mesh.userData.alphaMask={width:1,height:1,data:new Uint8Array(4)};model.updateMatrixWorld(true);const ray=new THREE.Raycaster();const camera=officeSceneCamera();ray.setFromCamera(new THREE.Vector2(0,0),camera);assert.equal(ray.intersectObject(model,true).length,0);}finally{disposePaintedFurniture(model);}
});
test('Projects travel between all reachable stations avoids every wall and desk',()=>{
 const room=departmentStarterRoom({key:'projects',number:1,roles:Array(4).fill({}),label:'Projects'}),nav=createOfficeNavigation(room);
 let routes=0;assert.equal(nav.stations.filter(s=>s.type==='desk').length,4);
 for(const a of nav.stations)for(const b of nav.stations){if(a===b)continue;const path=nav.findPath(a.position,b.position);if(!path.length)continue;routes++;
  for(let i=1;i<path.length;i++)assert.equal(nav.isSegmentWalkable(path[i-1],path[i]),true);
 }
 assert.ok(routes>=6,'usable work/rest routes exist');
 for(const desk of room.objects.filter(o=>o.kind==='work-desk'))assert.equal(nav.isWalkable(desk,{ignoreIds:['wall-main-front']}),false);
 assert.equal(nav.isWalkable({x:66.4,y:81},{ignoreIds:['wall-main-front']}),false);
});
test('actual character simulation reaches water, sofa and desk without crossing walls or desks',()=>{
 const room=departmentStarterRoom({key:'projects',number:1,roles:Array(4).fill({}),label:'Projects'});
 const layer=Object.create(HybridOffice3D.prototype),model=createOfficeCharacter(0);model.scale.setScalar(1.5);
 Object.assign(layer,{room,navigation:createOfficeNavigation(room),actors:new Map(),scene:new THREE.Scene(),camera:officeSceneCamera(),playing:true,lastTime:null,draw:()=>{}});
 const actor={id:'role-1-avatar',model,position:{x:64.2,y:40.5},action:'idle',mode:'idle',age:0,path:[],index:0};layer.actors.set(actor.id,actor);layer.scene.add(model);
 try{
  const desk=layer.navigation.stations.find(s=>s.objectId==='role-1-desk');layer.arrive(actor,desk);
  assert.equal(actor.action,'sitting');assert.match(layer.step(0).get(actor.id).thought,/ไม่ทราบสถานะ/,'legacy/prototype callers without a state map remain unknown');
  let time=0;
  for(const type of ['water','sofa','desk']){
   const station=type==='desk'?desk:layer.navigation.stations.find(s=>s.type===type);
   assert.ok(station,`has ${type} station`);assert.equal(layer.travel(actor,station),true,`route to ${type}`);
   actor.mode='test';let steps=0;
   while(actor.path.length&&steps++<3000){const before={...actor.position},ignoreIds=[...(actor.ignoreIds||[])];time+=.1;layer.step(time);
    assert.equal(layer.navigation.isSegmentWalkable(before,actor.position,{ignoreIds}),true,`collision-free ${type} frame ${steps}`);
   }
   assert.ok(steps<3000);assert.equal(actor.station?.id,station.id);
  }
 }finally{disposeOfficeCharacter(model);}
});
test('Projects WebGL fallback remains on authored positions without ambient free walking',()=>{
 const dom=new JSDOM('<main></main>',{url:'http://localhost'}),root=dom.window.document.querySelector('main');
 const scene=new HybridScene(root,{getFloor:()=>({key:'projects'})});
 try{
  const room=departmentStarterRoom({number:1,roles:[{}],label:'Projects'});scene.render(room,null,true);
  assert.equal(scene.modelLayer,undefined);assert.equal(root.dataset.paintedSkeleton,'true');
  const actor=root.querySelector('[data-object="role-1-avatar"]'),before=actor.getAttribute('style');
  scene.elapsed=20000;scene.paintActivity();assert.equal(actor.getAttribute('style'),before);assert.equal(actor.dataset.activity,undefined);
 }finally{scene.dispose();dom.window.close();}
});


test('structure inspection is transient and refuses an unavailable renderer',()=>{
 const room={background:'office',objects:[{id:'keep-agent',kind:'avatar-01'}]},calls=[];
 const scene={paintActivity(){},canInspectStructure:()=>true,room,selected:'keep-agent',playing:true,modelLayer:{},render(...args){calls.push(args)}};
 assert.equal(HybridScene.prototype.setStructureView.call(scene,true),true);
 assert.equal(scene.structureView,true);assert.equal(calls[0][0],room);assert.equal(calls[0][1],'keep-agent');
 assert.equal(HybridScene.prototype.setStructureView.call(scene,false),true);assert.equal(scene.structureView,false);
 scene.modelUnavailable=true;assert.equal(HybridScene.prototype.setStructureView.call(scene,true),false);assert.equal(scene.structureView,false);
 assert.equal(room.objects.length,1);assert.equal(room.objects[0].id,'keep-agent');
});


test('structure inspection preserves walking actor runtime across renderer replacement',()=>{
 const oldModel={},newModel={},room={background:'office'},state={id:'a',position:{x:42,y:31},action:'walking',mode:'water',age:2,path:[{x:45,y:30}],heading:1,initialized:true};
 let painted=0;const scene={elapsed:2500,paintActivity({freeze}){assert.equal(freeze,true);painted++;assert.equal(this.modelLayer.actors.get('a').action,'walking');assert.equal(this.modelLayer.lastTime,2.5);},room,playing:true,canInspectStructure:()=>true,modelLayer:{actors:new Map([['a',{...state,model:oldModel,authored:{id:'a'}}]])},render(){this.modelLayer={actors:new Map([['a',{model:newModel,authored:{id:'a'}}]])}}};
 assert.equal(HybridScene.prototype.setStructureView.call(scene,true),true);
 assert.equal(painted,1);const actor=scene.modelLayer.actors.get('a');assert.equal(actor.model,newModel);assert.equal(actor.action,'walking');assert.equal(actor.mode,'water');assert.deepEqual(actor.position,state.position);assert.deepEqual(actor.path,state.path);assert.equal(actor.age,2);
});
test('structure toggle eligibility matches only Projects painted baseline',()=>{
 for(const [room,key,expected]of [[{background:'office'},'projects',true],[{background:'office'},'growth',false],[{background:'office',blueprint:'medium'},'projects',false]])assert.equal(HybridScene.prototype.canInspectStructure.call({room,getFloor:()=>({key})}),expected);
});
