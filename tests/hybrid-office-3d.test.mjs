import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {HybridOffice3D,isOfficeModel} from '../web/hybrid-office-3d.js';
import {departmentStarterRoom,defaultOfficeRoom} from '../web/hybrid-state.js';
import {groundToWorld,worldToGround,officeSceneCamera} from '../web/office-projection.js';
import {defaultBlueprintPlan,moveBlueprintWall,toggleBlueprintDoor} from '../web/office-blueprint-state.js';
import {blueprintPoint} from '../web/office-blueprints.js';
import * as THREE from 'three';
import {HybridScene} from '../web/hybrid-scene.js';
import {enableHybridCombinedShadowReceiver} from '../web/hybrid-shadow-materials.js';
import {OfficeObjectSkins} from '../web/office-object-skins.js';

function fixture(){
  const dom=new JSDOM('<div id="scene"><div class="hy-objects"></div></div>');
  class Renderer{
    constructor(){this.domElement=dom.window.document.createElement('canvas');this.shadowMap={};this.shadowRenders=new Map();}
    setClearColor(){} setPixelRatio(){} setSize(){}
    render(scene){
      if(this.shadowMap.autoUpdate===false&&!this.shadowMap.needsUpdate)return;
      scene.traverse(light=>{
        if(!light.isLight||!light.castShadow||light.shadow.autoUpdate===false&&!light.shadow.needsUpdate)return;
        const role=light.userData.hybridShadowRole||light.uuid;this.shadowRenders.set(role,(this.shadowRenders.get(role)||0)+1);light.shadow.needsUpdate=false;
      });
      this.shadowMap.needsUpdate=false;
    }
    dispose(){}
  }
  const root=dom.window.document.querySelector('#scene');
  const layer=new HybridOffice3D(root,{Renderer});
  const room=departmentStarterRoom({key:'projects',number:1,label:'Projects',roles:[{id:'a'},{id:'b'},{id:'c'},{id:'d'}]});
  layer.sync(room,true);
  return {dom,root,layer,room,close(){layer.dispose();dom.window.close();}};
}

function sheetFixture(){
  const dom=new JSDOM('<div id="scene"><div class="hy-objects"></div></div>'),root=dom.window.document.querySelector('#scene');
  dom.window.WebGLRenderingContext=function WebGLRenderingContext(){};
  dom.window.HTMLCanvasElement.prototype.getContext=function(type){return type==='2d'?{fillRect(){},strokeRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}}:null;};
  class Renderer{
    constructor(){this.domElement=dom.window.document.createElement('canvas');this.shadowMap={};this.rendered=[];this.passes=[];this.target=null;}
    setClearColor(){} setPixelRatio(){} setSize(){}
    setRenderTarget(target){this.target=target;}
    getRenderTarget(){return this.target;}
    clear(){} clearDepth(){}
    render(scene){
      this.rendered.push(scene);const objects=[];
      scene.traverse(object=>{
        if(!object.isMesh&&!object.isLine&&!object.isPoints)return;
        let visible=object.visible;for(let parent=object.parent;parent&&visible;parent=parent.parent)visible=parent.visible;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        if(visible&&materials.some(material=>material?.visible!==false))objects.push(object);
      });
      this.passes.push({scene,target:this.target,objects});
    }
    dispose(){}
  }
  class LoadedSkinLayer extends OfficeObjectSkins{
    constructor(layer){super(layer,{loader:{load(_src,onLoad){const texture=new THREE.Texture();onLoad?.(texture);return texture;}}});}
    loadSurfaces(){}
  }
  const layer=new HybridOffice3D(root,{Renderer,SkinLayer:LoadedSkinLayer});
  const room=defaultOfficeRoom({key:'projects',number:1,label:'Projects',roles:[{id:'a'},{id:'b'},{id:'c'},{id:'d'}]});
  layer.sync(room,true);
  return {dom,root,layer,room,close(){layer.dispose();dom.window.close();}};
}

function legacyProjectedBounds(layer,model){
  model.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(model),min=new THREE.Vector2(Infinity,Infinity),max=new THREE.Vector2(-Infinity,-Infinity);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(layer.camera);min.min(new THREE.Vector2((p.x+1)*50,(1-p.y)*50));max.max(new THREE.Vector2((p.x+1)*50,(1-p.y)*50));}
  return {left:min.x,top:min.y,width:max.x-min.x,height:max.y-min.y};
}

test('cached screen bounds match the legacy projected Box3 after actor transforms change',()=>{
  const f=fixture();try{
    const model=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(.8,1.6,.6),new THREE.MeshBasicMaterial());mesh.position.y=.8;model.add(mesh);f.layer.structureGroup.add(model);
    for(const [x,y,heading]of [[.5,.5,0],[3,-2,.7],[-4,6,-1.2]]){
      model.position.copy(groundToWorld({x:40+x,y:50+y}));model.rotation.y=heading;model.updateMatrix();f.layer.scene.updateMatrixWorld(true);
      const expected=legacyProjectedBounds(f.layer,model),actual=f.layer.bounds(model);
      for(const key of ['left','top','width','height'])assert.ok(Math.abs(actual[key]-expected[key])<1e-5,`${key} remains within 1e-5 design-space percentage points`);
    }
    let updates=0;const update=model.updateWorldMatrix.bind(model);model.updateWorldMatrix=(...args)=>{updates++;return update(...args);};f.layer.bounds(model);
    assert.equal(updates,0,'a repeated static screen bound reuses its projected value without updating the world matrix');
  }finally{f.close();}
});

test('ready skinned actor bounds match the legacy Box3 for the same animated pose',()=>{
  const f=fixture();try{
    const model=new THREE.Group(),geometry=new THREE.BoxGeometry(.8,1.6,.6),count=geometry.attributes.position.count;
    const indices=new Uint16Array(count*4),weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial()),bone=new THREE.Bone();mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));
    model.add(mesh);model.position.copy(groundToWorld({x:48,y:50}));model.userData.runtimeCharacter={status:'ready',clip:'walking'};f.layer.structureGroup.add(model);
    f.layer.scene.updateMatrixWorld(true);bone.position.x=1.7;bone.updateMatrixWorld(true);mesh.skeleton.update();mesh.computeBoundingBox();
    const expected=legacyProjectedBounds(f.layer,model),actual=f.layer.bounds(model);
    for(const key of ['left','top','width','height'])assert.ok(Math.abs(actual[key]-expected[key])<1e-5,`${key} preserves legacy bounds: expected ${expected[key]}, got ${actual[key]}`);
  }finally{f.close();}
});

test('skin, model, wireframe and image-layer mode toggles update the materials used by the sheet scene',()=>{
  const f=sheetFixture();try{
    const {layer}=f,skin=layer.skinLayer;
    skin.surfaceReady=true;skin.oak=new THREE.Texture();skin.plaster=new THREE.Texture();skin.sync();
    const records=[...skin.records.entries()],work=layer.architecture.userData.officeArchitecture.floorMeshes.work,workRecord=skin.records.get(work),shadowCaster=records.find(([mesh])=>mesh.castShadow)?.[0];
    assert.ok(records.some(([,record])=>record.skin?.uniforms),'the fixture has painted object-skin materials');
    assert.ok(workRecord?.skin,'surface completion creates the floor skin material');
    assert.match(workRecord.skin.customProgramCacheKey(),/hybrid-static-and-actor-shadow\/v1/,'a cloned skin material retains the shadow-composite shader hook');
    assert.equal(!!layer.sceneBatches,false,'unified sheets render source meshes directly, without a separate stale batch');
    const expectState=({skin:skinOn,model:modelOn,wireframe:wireframeOn})=>{
      for(const [mesh,record]of records){
        const hasLoadedSkin=record.skin&&(record.skin.uniforms?skin.loadedAngles.has(record.angle):skin.surfaceReady);
        assert.equal(mesh.material,skinOn&&hasLoadedSkin?record.skin:record.original,`${mesh.name||mesh.uuid} uses the active source material`);
        assert.equal(mesh.visible,record.visible&&(skinOn||modelOn||wireframeOn),`${mesh.name||mesh.uuid} visibility follows the selected render mode`);
      }
      for(const wire of skin.wires)assert.equal(wire.visible,wireframeOn,`${wire.parent?.name||wire.parent?.uuid} wireframe visibility follows the selected mode`);
      assert.equal(layer.renderer.rendered.at(-1),layer.scene,'the renderer submits the scene whose source materials were checked');
    };
    const originalStates=new Map(records.map(([mesh,record])=>[mesh,{renderOrder:mesh.renderOrder,visible:record.visible,materials:[].concat(record.original).map(material=>({map:material.map,opacity:material.opacity,transparent:material.transparent,colorWrite:material.colorWrite,combinedShadow:false}))}]));
    const startPass=layer.renderer.passes.length;layer.sheetLayer.dirty=false;skin.setVisibility({skin:false});assert.equal(layer.sheetLayer.dirty,false,'skin visibility does not invalidate a sheet target that this render path never submits');expectState({skin:false,model:true,wireframe:false});
    const offPasses=layer.renderer.passes.slice(startPass);assert.equal(offPasses.length,1,'skin-off submits one normal scene pass');assert.equal(offPasses[0].scene,layer.scene);assert.equal(offPasses[0].target,null,'skin-off renders directly to the default framebuffer');assert.ok(!offPasses.some(pass=>pass.scene===layer.sheetLayer.imageScene||pass.target===layer.sheetLayer.target),'the separate sheet image and render target are not drawn');
    assert.equal(layer.sheetLayer.image.visible,true,'setVisibility does not mutate the detached sheet image object');assert.equal(layer.sheetLayer.image.material.opacity,1);assert.equal(layer.sheetLayer.image.renderOrder,-1000);
    const drawn=new Set(offPasses[0].objects);for(const [mesh,record]of records){const before=originalStates.get(mesh);assert.equal(mesh.material,record.original,`${mesh.name||mesh.uuid} uses its original material`);assert.equal(mesh.visible,before.visible);assert.equal(mesh.renderOrder,before.renderOrder);assert.equal(mesh.customDepthMaterial,undefined,`${mesh.name||mesh.uuid} uses the renderer's main depth-material selection`);if(before.visible)assert.ok(drawn.has(mesh),`${mesh.name||mesh.uuid} is drawn`);assert.deepEqual([].concat(mesh.material).map(material=>({map:material.map,opacity:material.opacity,transparent:material.transparent,colorWrite:material.colorWrite,combinedShadow:material.userData.hybridCombinedShadowReceiver===true})),before.materials,`${mesh.name||mesh.uuid} keeps the main skin-off material/map/opacity/color-write state`);}
    assert.ok(shadowCaster,'fixture includes a source shadow caster');assert.equal(layer.shadowMaterials.objects.size,0,'skin-off removes cached depth overrides');assert.equal(shadowCaster.customDepthMaterial,undefined);
    assert.ok(workRecord.original.map,'the original floor retains the decorateSheet grain map');assert.notEqual(workRecord.original.map,skin.oak,'skin-off does not use the painted oak surface map');assert.doesNotMatch(work.material.customProgramCacheKey(),/hybrid-static-and-actor-shadow\/v1/,'skin-off original material uses the main single-light shader path');
    assert.equal(layer.sun.shadow.autoUpdate,true,'skin-off matches the main continuously refreshed shadow map');assert.equal(layer.sun.layers.isEnabled(1),true,'the legacy sun still lights actor models on layer 1');assert.equal(layer.sun.shadow.camera.layers.isEnabled(1),true,'the legacy shadow pass includes actor casters on layer 1');assert.equal(layer.ambientLight.layers.isEnabled(1),true,'the ambient light reaches actor models on layer 1');assert.equal(layer.actorSun.castShadow,false,'skin-off uses the single main shadow map');
    skin.setVisibility({skin:true});expectState({skin:true,model:true,wireframe:false});assert.ok(shadowCaster.customDepthMaterial,'the cached shadow depth path returns with the skin layer');assert.equal(layer.sun.shadow.autoUpdate,false);assert.equal(layer.sun.layers.isEnabled(1),false);assert.equal(layer.sun.shadow.camera.layers.isEnabled(1),false);assert.equal(layer.ambientLight.layers.isEnabled(1),false);assert.equal(layer.actorSun.castShadow,true);
    assert.match(work.material.customProgramCacheKey(),/hybrid-static-and-actor-shadow\/v1/,'skin-on material retains the same shadow path');
    skin.setVisibility({model:false});expectState({skin:true,model:false,wireframe:false});
    skin.setVisibility({model:true});expectState({skin:true,model:true,wireframe:false});
    skin.setVisibility({wireframe:true});expectState({skin:true,model:true,wireframe:true});
    skin.setVisibility({wireframe:false});expectState({skin:true,model:true,wireframe:false});
    skin.setVisibility({skin:false,model:false,wireframe:true});expectState({skin:false,model:false,wireframe:true});
    layer.sheetLayer.dirty=false;layer.setImageLayerMode('structure');assert.equal(layer.sheetLayer.dirty,true,'structure mode invalidates the cached sheet image');expectState({skin:false,model:false,wireframe:true});
    layer.sheetLayer.dirty=false;layer.setImageLayerMode('art');assert.equal(layer.sheetLayer.dirty,true,'art mode invalidates the cached sheet image');expectState({skin:true,model:true,wireframe:false});
  }finally{f.close();}
});

test('PCFSoft receiver combines cached static and live actor maps with a stable shader key',()=>{
  const material=new THREE.ShadowMaterial(),initial=material.customProgramCacheKey();assert.equal(enableHybridCombinedShadowReceiver(material),true);
  const shader={uniforms:{},fragmentShader:THREE.ShaderLib.shadow.fragmentShader};material.onBeforeCompile(shader,{});
  assert.match(shader.fragmentShader,/getHybridCombinedShadow/);assert.match(shader.fragmentShader,/SHADOWMAP_TYPE_PCF_SOFT/);
  assert.match(shader.fragmentShader,/hybridTexture2DCompare\( staticMap, actorMap/);
  const key=material.customProgramCacheKey();assert.notEqual(key,initial);assert.equal(material.customProgramCacheKey(),key,'the material program cache key is stable after installation');
  const lit=new THREE.MeshStandardMaterial();assert.equal(enableHybridCombinedShadowReceiver(lit),true);const litShader={uniforms:{},fragmentShader:THREE.ShaderLib.standard.fragmentShader};lit.onBeforeCompile(litShader,{});
  assert.match(litShader.fragmentShader,/getHybridCombinedShadow/);assert.match(lit.customProgramCacheKey(),/hybrid-static-and-actor-shadow\/v1/);
  material.dispose();lit.dispose();
});

test('static shadow maps skip actor-only frames and refresh after edit, door toggle and floor switch',()=>{
  const f=fixture();try{
    const renderer=f.layer.renderer,roles=new Map();f.layer.scene.traverse(light=>{if(light.userData.hybridShadowRole)roles.set(light.userData.hybridShadowRole,light);});
    const staticLight=roles.get('static'),dynamicLight=roles.get('dynamic');assert.ok(staticLight&&dynamicLight,'static and character casters use separate shadow maps');
    const count=role=>renderer.shadowRenders.get(role)||0,staticBefore=count('static'),dynamicBefore=count('dynamic');
    const actorId=[...f.layer.actors.keys()][0];f.layer.setAgentStates([{avatarId:actorId,state:'working',source:'synthetic'}]);f.layer.draw();
    assert.equal(count('static'),staticBefore,'a status/pose frame does not redraw static casters');assert.ok(count('dynamic')>dynamicBefore,'the character shadow still updates');
    const desk=f.room.objects.find(object=>object.kind==='work-desk'),afterEdit=count('static');f.layer.previewMove(desk.id,{...desk,x:desk.x+1});
    assert.equal(count('static'),afterEdit+1,'Studio preview edits refresh the cached static map once');
    const plan={...defaultBlueprintPlan('medium'),partitions:[{id:'split',axis:'z',at:5,start:0,end:8,door:{offset:4,width:1.4}}]},withDoor={...f.room,blueprint:'medium',blueprintPlan:plan};
    let before=count('static');f.layer.sync(withDoor,false);assert.equal(count('static'),before+1,'adding floor structure refreshes static shadows');
    before=count('static');f.layer.sync({...withDoor,blueprintPlan:toggleBlueprintDoor(plan,'partition:split')},false);
    assert.equal(count('static'),before+1,'door state changes refresh static shadows');
    before=count('static');f.layer.sync({...f.room,name:'Design Review'},false);
    assert.equal(count('static'),before+1,'a floor switch refreshes static shadows');
  }finally{f.close();}
});

test('custom structural edits rebuild only architecture, dispose the old shell and keep model identity/transforms',()=>{
  const f=fixture();try{
    const base={...f.room,blueprint:'medium',blueprintPlan:defaultBlueprintPlan('medium')};f.layer.sync(base,false);
    const shell=f.layer.architecture,models=[...f.layer.models.entries()].map(([id,m])=>[id,m,m.position.clone()]);
    const edited={...base,blueprintPlan:moveBlueprintWall(base.blueprintPlan,'right',1)};f.layer.sync(edited,false);
    assert.notEqual(f.layer.architecture,shell);assert.equal(shell.userData.officeArchitectureDisposed,true);
    assert.equal(f.layer.architecture.userData.officeArchitecture.dimensions.width,13);
    for(const [id,m,p] of models){assert.equal(f.layer.models.get(id),m);assert.ok(m.position.equals(p));}
    const unchanged=f.layer.architecture;f.layer.sync(edited,false);assert.equal(f.layer.architecture,unchanged);
  }finally{f.close();}
});

test('walk-test follows exact authored vertices, reports completion and never writes scene state',()=>{
  const f=fixture();try{
    const snapshot=JSON.stringify(f.room),points=f.layer.navigation.findLocalPath({x:43,y:48},{x:32,y:56});
    const result=f.layer.startWalkTest(points);
    assert.equal(result.ok,true);
    for(let tick=0;tick<900&&f.layer.testWalk.status==='running';tick++)f.layer.step(tick/10);
    assert.equal(f.layer.testWalk.status,'completed');
    const actor=f.layer.actors.get(f.layer.testWalk.actorId);
    assert.deepEqual(actor.position,points.at(-1));assert.equal(actor.action,'idle');
    assert.equal(JSON.stringify(f.room),snapshot);
    assert.equal(f.layer.startWalkTest([{x:60,y:43},{x:62,y:43}]).ok,false,'a segment through a desk is refused');
  }finally{f.close();}
});

test('generated multi-room probes accept more than 32 safe vertices with a bounded limit',()=>{
  const f=fixture();try{
    const path=f.layer.navigation.findLocalPath({x:43,y:48},{x:32,y:56}),a=path[0],b=path[1];
    const points=Array.from({length:42},(_,i)=>({x:a.x+(b.x-a.x)*i/41,y:a.y+(b.y-a.y)*i/41}));
    assert.equal(f.layer.startWalkTest(points).ok,true);assert.equal(f.layer.startWalkTest(Array(513).fill(a)).ok,false);
  }finally{f.close();}
});

test('closing a door invalidates active motion and threshold occupancy is detectable',()=>{
  const f=fixture();try{
    const p={...defaultBlueprintPlan('medium'),partitions:[{id:'split',axis:'z',at:5,start:0,end:8,door:{offset:4,width:1.4}}]};
    const from=blueprintPoint(p,4,4.7),to=blueprintPoint(p,6,4.7),r={...f.room,blueprint:'medium',blueprintPlan:p,objects:f.room.objects.filter(o=>o.kind.startsWith('avatar-')).map(o=>({...o,...from}))};
    f.layer.sync(r,false);const actor=[...f.layer.actors.values()][0];actor.position=blueprintPoint(p,5,4.7);
    assert.equal(f.layer.isDoorOccupied('partition:split'),true);actor.position=from;
    // Put the remaining actors safely away from the threshold.
    for(const other of [...f.layer.actors.values()].slice(1))other.position=blueprintPoint(p,2,2);
    assert.equal(f.layer.isDoorOccupied('partition:split'),false);
    actor.initialized=true;actor.path=[to];actor.mode='walking';actor.action='walking';
    f.layer.sync({...r,blueprintPlan:toggleBlueprintDoor(p,'partition:split')},true);
    for(let i=0;i<40;i++)f.layer.step(i/10);
    assert.ok(actor.position.x<blueprintPoint(p,5,4.7).x);assert.equal(actor.path.length,0);
  }finally{f.close();}
});

test('closed door panels can be picked directly and occlude furniture picking',()=>{
  const f=fixture();try{
    const p={...defaultBlueprintPlan('medium'),partitions:[{id:'split',axis:'z',at:5,start:0,end:8,door:{offset:4,width:1.4,open:false}}]};
    f.layer.sync({...f.room,objects:[],blueprint:'medium',blueprintPlan:p},false);f.root.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});
    const door=f.layer.architecture.userData.officeArchitecture.doors.find(d=>d.id==='partition:split'),v=new THREE.Vector3(.2,.6,0);door.group.localToWorld(v);v.project(f.layer.camera);
    assert.equal(f.layer.pickDoor((v.x+1)*500,(1-v.y)*350),'partition:split');assert.ok(door.panels.every(m=>f.layer.wallMeshes.includes(m)));
  }finally{f.close();}
});

test('scene pointer capture toggles a real door mesh; an occupied threshold cannot close',()=>{
  const f=fixture();let scene;try{
    const p={...defaultBlueprintPlan('medium'),partitions:[{id:'split',axis:'z',at:5,start:0,end:8,door:{offset:4,width:1.4,open:false}}]},r={...f.room,blueprint:'medium',blueprintPlan:p};
    const calls=[];scene=new HybridScene(f.root,{onDoorToggle:id=>{calls.push(id);return {ok:true,message:'changed'};}});scene.modelLayer=f.layer;scene.room=r;
    f.layer.sync({...r,objects:[]},false);f.root.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:700});scene.renderDoors();
    const door=f.layer.architecture.userData.officeArchitecture.doors.find(d=>d.id==='partition:split'),v=new THREE.Vector3(.2,.6,0);door.group.localToWorld(v);v.project(f.layer.camera);
    f.root.querySelector('.hy-motion-toggle').dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true,cancelable:true,detail:1,clientX:(v.x+1)*500,clientY:(1-v.y)*350}));assert.equal(calls.length,0,'HUD controls keep input even when a door is behind them');
    f.root.dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true,cancelable:true,detail:1,clientX:(v.x+1)*500,clientY:(1-v.y)*350}));assert.deepEqual(calls,['partition:split']);
    const opened=toggleBlueprintDoor(p,'partition:split');scene.room={...r,blueprintPlan:opened};f.layer.sync(scene.room,false);[...f.layer.actors.values()][0].position=blueprintPoint(p,5,4.7);
    scene.toggleDoor('partition:split');assert.equal(calls.length,1);assert.match(f.root.querySelector('.hy-door-status').textContent,/ตัวละครอยู่ในช่องประตู/);
  }finally{if(scene){scene.modelLayer=null;scene.dispose();}f.close();}
});

test('ground positions roundtrip and match the actual scene camera',()=>{
  const camera=officeSceneCamera();
  for(const p of [{x:20,y:59},{x:61,y:43},{x:78,y:82}]){
    const world=groundToWorld(p),roundtrip=worldToGround(world),projected=world.clone().project(camera);
    assert.ok(Math.abs(roundtrip.x-p.x)<1e-8&&Math.abs(roundtrip.y-p.y)<1e-8);
    assert.ok(Math.abs((projected.x+1)*50-p.x)<1e-7);
    assert.ok(Math.abs((1-projected.y)*50-p.y)<1e-7);
  }
});

test('3D actors reserve interactions, walk only on safe ground and leave authored state untouched',()=>{
  const f=fixture();try{
    const {layer,room}=f,snapshot=JSON.stringify(room),[first,second]=layer.actors.values();
    assert.equal(first.action,'sitting');
    const bounds=layer.bounds(first.model);assert.ok(bounds.top>20&&bounds.left>20&&bounds.width<15&&bounds.height<30,'DOM controls track the actual model bounds');
    assert.equal(layer.setMode(first.id,'water'),true);
    assert.equal(layer.setMode(second.id,'water'),false,'the cooler is reserved while walking');
    assert.equal(second.mode,'auto','failed commands preserve the previous mode');
    for(let tick=0;tick<1600;tick++){
      layer.step(tick/10);
      for(const actor of layer.actors.values())if(actor.action==='walking')assert.equal(layer.navigation.isWalkable(actor.position,{ignoreIds:actor.ignoreIds||[]}),true);
      if(first.action==='drinking')break;
    }
    assert.equal(first.action,'drinking');
    assert.equal(layer.setMode(first.id,'idle'),true);
    assert.equal(first.target,null);
    assert.equal(layer.setMode(second.id,'water'),true,'cancelled interaction frees the station');
    assert.equal(JSON.stringify(room),snapshot);
    layer.sync(room,false);
    assert.ok([...layer.actors.values()].every(actor=>!actor.target&&!actor.station&&actor.action==='idle'&&actor.mode==='auto'));
  }finally{f.close();}
});

test('navigation overlay, actual Three.js room walls and stationary reduced-motion poses remain available',()=>{
  const f=fixture();try{
    assert.ok(f.layer.architecture?.isGroup,'the room is real geometry in the shared scene');
    assert.ok(f.layer.wallMeshes.length>=4);
    assert.ok(f.layer.wallMeshes.every(mesh=>mesh.material.colorWrite!==false));
    assert.equal(f.layer.toggleNavigation(),true);
    assert.equal(f.root.querySelector('.hy-navigation-map').hasAttribute('hidden'),false);
    assert.equal(f.root.querySelectorAll('.hy-navigation-map circle').length,f.layer.navigation.stations.length);
    const first=[...f.layer.actors.values()][0],position={...first.position};
    f.layer.step(30,{staticPose:true});
    assert.equal(first.action,'sitting');assert.deepEqual(first.position,position);
  }finally{f.close();}
});

test('moved chairs define seats, removed chairs cannot produce floating seated people',()=>{
  const f=fixture();try{
    const desk=f.room.objects.find(o=>o.kind==='work-desk');
    const station=f.layer.navigation.stations.find(s=>s.objectId===desk.id);
    assert.ok(station.seatObjectId);
    const chair=f.room.objects.find(o=>o.id===station.seatObjectId);
    chair.x+=.5;
    f.layer.sync(f.room,false);f.layer.sync(f.room,true);
    const moved=f.layer.navigation.stations.find(s=>s.objectId===desk.id);
    assert.equal(moved.seat.x,chair.x);
    f.room.objects=f.room.objects.filter(o=>o.kind!=='task-chair');
    f.layer.sync(f.room,false);f.layer.sync(f.room,true);
    assert.ok([...f.layer.actors.values()].every(actor=>actor.action!=='seated'));
    assert.equal(f.layer.navigation.isWalkable({x:37,y:76}),false,'the whiteboard blocks walking');
  }finally{f.close();}
});

test('explicit walking trip remains on safe paths without automatically sitting or drinking',()=>{
  const f=fixture();try{
    const actor=[...f.layer.actors.values()][0];
    assert.equal(f.layer.setMode(actor.id,'walking'),true);
    let positions=new Set();
    for(let tick=0;tick<900;tick++){
      f.layer.step(tick/10);
      assert.ok(['walking','idle'].includes(actor.action));
      assert.equal(f.layer.navigation.isWalkable(actor.position,{ignoreIds:actor.ignoreIds||[]}),true);
      positions.add(`${Math.round(actor.position.x)},${Math.round(actor.position.y)}`);
    }
    assert.ok(positions.size>15);
    assert.equal(actor.mode,'walking');
  }finally{f.close();}
});
test('wayfinding arrow is real ground geometry sharing the Office depth buffer',()=>{
  assert.equal(isOfficeModel('wayfinding-arrow'),true);
});
