import {PoseTransaction,drainPoseSteps} from './tycoon-pose-transaction.js';
// @tested tests/tycoon-scene-preparation.test.mjs, tests/tycoon-repair-cache.test.mjs, tests/tycoon-probe-budget.test.mjs, tests/tycoon-pose-resume.test.mjs, tests/tycoon-pose-parity.test.mjs
import {customModels,inspectCustomGLB,verifyCustomMeasurement,normalizeCustomModel,disposeCustomModel} from './custom-assets.js';
import * as THREE from 'three';
import {visibleThreeLoop} from './visible-animation.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {officeCamera} from './office-projection.js';
import {TycoonActivity} from './tycoon-activity.js';
import {tycoonGround,tycoonStructure,tycoonWorld} from './tycoon-blueprint.js';
import {TycoonSelection} from './tycoon-selection.js';
import {SurfaceFinish} from './surface-finish.js';
import {orderedObjects} from './tycoon-transform.js';
import {TYCOON_FACTORY_ASSETS} from './tycoon-factory-assets.js';
import {FramePacer} from './tycoon-frame-pacer.js';
import {createSeatFitSteps,runSeatFitSteps,measuredSeatDirection,measuredSeatRoot,rememberSeatDirection} from './tycoon-seat-fit.js';
import {ProbeContact} from './tycoon-contact.js';
import {TycoonCollisionWorld} from './tycoon-limb-collision.js';
import {measureSeatContact,measurePelvisSeatSupport} from './tycoon-seat-contact.js';
import {tycoonCameraFrame} from './tycoon-camera.js';
import {prepareTycoonProbePrograms,releaseTycoonDepthMaterials} from './tycoon-render-preparation.js';
import {prepareTycoonHiddenDraw} from './tycoon-draw-preparation.js';

function disposeCachedSkeletons(root){
  const skeletons=new Set();
  root.traverse(node=>{if(node.isSkinnedMesh&&node.skeleton)skeletons.add(node.skeleton);});
  for(const skeleton of skeletons)skeleton.dispose();
}

function respawnProbe(scene,result){
  TycoonScene.prototype.cancelPoseSolve.call(scene);
  // An explicit new test spawns a transient probe at its chosen start; it is not a walked segment.
  if(result.ok){const actor=scene.assembly.owned.find(m=>m.userData.instanceId==='demo-agent');actor.visible=false;actor.userData.contact?.reset();actor.userData.probeSnapshot=null;}
  return result;
}
const copyGroundPoint=point=>point?{x:point.x,y:point.y}:null;
// A 30 Hz render owes two 60 Hz poses. Keep headroom for rendering while
// giving that frame more solve time; individual work units remain atomic.
export const defaultProbeStepBudgetMs=rate=>rate===30?12:8;

export class TycoonAssembly{
  constructor(root,load,onOptionalError){this.root=root;this.load=load;this.onOptionalError=onOptionalError;this.generation=0;this.owned=[];}
  clear(){for(const node of this.owned){node.userData.mixer?.stopAllAction();node.userData.finish?.dispose();releaseTycoonDepthMaterials(node);const skeletons=new Set();node.traverse(n=>{if(n.isSkinnedMesh)skeletons.add(n.skeleton);if(n.isMesh)for(const m of [].concat(n.material))m.dispose();});skeletons.forEach(s=>s.dispose());this.root.remove(node);}this.owned=[];}
  async replace(objects){
    const generation=++this.generation;this.clear();
    await Promise.all(objects.map(async o=>{
      let source;try{source=await this.load(o.kind,o.asset);}catch(error){if(generation!==this.generation)return;if(o.optional){this.onOptionalError?.(o,error);return;}throw error;}if(generation!==this.generation)return;
      const model=cloneSkeleton(source);model.userData={instanceId:o.id,intent:o.intent,clips:source.animations||[]};
      model.renderOrder=o.renderOrder||0;
      model.traverse(n=>{if(n.isMesh){n.renderOrder=o.renderOrder||0;n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone();n.castShadow=true;n.receiveShadow=true;for(const m of [].concat(n.material)){if(o.color)m.color.set(o.color);}}});
      if(o.finish){model.userData.finish=new SurfaceFinish(model,{targetId:'item'});model.userData.finish.apply({item:o.finish});}
      model.position.set(o.x||0,o.y||0,o.z||0);model.rotation.y=o.rotation||0;
      if(Array.isArray(o.size))model.scale.set(...o.size);else model.scale.setScalar(o.scale||1);
      this.root.add(model);this.owned.push(model);
      if(o.clip&&source.animations?.length){const mixer=new THREE.AnimationMixer(model);const clip=source.animations.find(c=>c.name===o.clip);if(clip)mixer.clipAction(clip).play();model.userData.mixer=mixer;model.userData.clip=o.clip;}
    }));
  }
  dispose(){this.generation++;this.clear();}
}
export function tycoonSceneObjects(kind,room,{domainRows}={}){
  if(kind==='building'&&Array.isArray(domainRows))return [{id:'plaza',kind:'plaza',y:-.3},{id:'shell:lobby',kind:'facade',intent:'enter'},...domainRows.slice(0,8).map((row,i)=>({id:'domain:'+row.domainKey,kind:'facade',y:(i+1)*3.2,intent:'work'})),{id:'roof',kind:'roof',y:(Math.min(8,domainRows.length)+1)*3.2}];
  if(kind==='building')return [
    {id:'plaza',kind:'plaza',y:-.3},{id:'lobby',kind:'facade',intent:'enter'},
    {id:'projects',kind:'facade',y:3.2,intent:'projects'},{id:'growth',kind:'facade',y:6.4,intent:'work'},{id:'roof',kind:'roof',y:9.6},
    ...[-6.7,6.7].flatMap(x=>[-4,0,4].map(z=>({id:`tree${x}${z}`,kind:'plant',x,z,scale:1.7}))),
  ];
  return [...tycoonStructure(room).map(o=>({...o,finish:room.finishes?.[o.kind==='floor'?'floor':o.kind==='wall'?'walls':'none']})),...orderedObjects(room).map((o,i)=>({...o,renderOrder:room.objects.length-i}))];
}
export class TycoonScene{
  constructor(root,{onPick,onError,onStatus,loadAsset,onSelection,onMove,frameRate=0,probeStepBudgetMs}={}){
    this.root=root;this.onPick=onPick;this.onError=onError;this.onStatus=onStatus;this.disposed=false;this.cache=new Map();this.autoProbeStepBudget=probeStepBudgetMs===undefined;this.probeStepBudgetMs=this.autoProbeStepBudget?defaultProbeStepBudgetMs(frameRate):probeStepBudgetMs;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#c8d9c0');
    this.camera=officeCamera();this.camera.position.multiplyScalar(2);this.camera.lookAt(0,1.5,0);
    this.renderer=new THREE.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    root.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','ฉาก GLB ออฟฟิศแบบสามมิติ');
    this.scene.add(new THREE.HemisphereLight('#fff4dc','#6c8278',2.8));
    const light=new THREE.DirectionalLight('#fff2dc',3);light.position.set(-5,14,8);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-12,right:12,top:12,bottom:-12});light.shadow.bias=-.0005;this.sunLight=light;this.scene.add(light);
    this.stage=new THREE.Group();this.scene.add(this.stage);this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();
    this.assembly=new TycoonAssembly(this.stage,loadAsset||this.loadAsset.bind(this),()=>this.onStatus?.('โหลดตัวละครทดลองไม่ได้ · ฉากและเมนูยังใช้งานได้'));
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(root);this.scale=1;this.pan=new THREE.Vector3();
    const canvas=this.renderer.domElement;
    if(onSelection)this.editor=new TycoonSelection(this,{onSelection,onMove});
    this.down=e=>{if(this.editor?.down(e))return;this.press={x:e.clientX,y:e.clientY,pan:this.pan.clone()};canvas.setPointerCapture?.(e.pointerId);};
    this.move=e=>{if(this.editor?.move(e))return;if(!this.press)return;const dx=e.clientX-this.press.x,dy=e.clientY-this.press.y;if(Math.hypot(dx,dy)<6&&!this.dragged)return;this.dragged=true;this.pan.copy(this.press.pan);const k=.015/this.scale;this.pan.x-=dx*k;this.pan.z+=dy*k;const limit=Math.max(this.room?.width||0,this.room?.depth||0)>16?Math.max(this.room.width,this.room.depth)/2:5;this.pan.clampScalar(-limit,limit);this.fit();};
    this.up=e=>{if(this.editor?.up(e))return;const moved=this.dragged;this.press=null;this.dragged=false;if(moved)return;const r=canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObjects(this.stage.children,true)[0];let n=hit?.object;while(n&&!n.userData.instanceId)n=n.parent;if(n?.userData.intent&&n.userData.intent!=='none')onPick?.(n.userData.instanceId);};
    this.wheel=e=>{e.preventDefault();this.zoom(e.deltaY<0?.1:-.1);};
    this.cancel=()=>{this.editor?.cancel();this.press=null;this.dragged=false;};this.lost=e=>{e.preventDefault();this.contextLost=true;this.ready=false;this.cancel();this.activity?.stop();this.onError?.('การแสดงผล 3D หยุดทำงาน · ยังเลือกวัตถุจากเมนูด้านล่างได้');};
    canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.cancel);canvas.addEventListener('wheel',this.wheel,{passive:false});canvas.addEventListener('webglcontextlost',this.lost);
    this.framePacer=new FramePacer(frameRate);this.stopVisibleLoop=visibleThreeLoop(root.ownerDocument,this.renderer,this.framePacer,ms=>this.renderFrame(ms));
  }
  // @tested tests/tycoon-render-cadence.test.mjs
  renderFrame(ms){
    if(this.disposed||this.contextLost||this.handoffPauses)return;const dt=this.framePacer.sample(ms);if(dt===null)return;
    const actor=this.assembly.owned.find(m=>m.userData.instanceId==='demo-agent');
    const reduced=actor&&globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduced)this.activity?.stop();
    // At30Hz, submit the last committed pose on the callback boundary. The
    // transactional solver then prepares the next frame; partial solves remain
    // rolled back. This adds one rendered interval of visual latency, while
    // removing variable solve cost from the draw submission's critical path.
    const renderFirst=this.framePacer.rate===30&&!reduced;
    if(renderFirst){
      try{this.renderer.render(this.scene,this.camera);}
      finally{if(actor)this.updateProbe(actor,dt);}
    }else{
      if(actor)this.updateProbe(actor,dt);
      this.renderer.render(this.scene,this.camera);
    }
  }
  pauseForHandoff(){
    this.handoffPauses=(this.handoffPauses||0)+1;let released=false;
    return()=>{if(released)return;released=true;this.handoffPauses=Math.max(0,(this.handoffPauses||0)-1);if(!this.handoffPauses&&!this.disposed)this.framePacer.setRate(this.framePacer.rate);};
  }
  async loadAsset(kind,asset){
    if(asset){
      const key='custom:'+asset.id;
      if(!this.cache.has(key))this.cache.set(key,(async()=>{const info=await inspectCustomGLB(await customModels.get(asset.id));if(info.id!==asset.id){disposeCustomModel(info.model);throw Error('Custom GLB hash mismatch');}info.model.userData.customMeasurement={id:info.id,size:info.size,origin:info.origin};return info.model;})());
      const pending=this.cache.get(key);let model;try{model=await pending;}catch(error){if(this.cache.get(key)===pending)this.cache.delete(key);throw error;}
      verifyCustomMeasurement(model.userData.customMeasurement,asset);return normalizeCustomModel(model,asset);
    }
    const factory=TYCOON_FACTORY_ASSETS[kind];
    if(!factory&&!this.manifest)this.manifest=fetch('./assets/models/tycoon/manifest.json').then(r=>{if(!r.ok)throw Error('manifest');return r.json();}).catch(error=>{this.manifest=null;throw error;});
    if(!this.cache.has(kind))this.cache.set(kind,(async()=>{
      const meta=factory||(await this.manifest).assets.find(a=>a.kind===kind);if(!meta||!/^[a-z0-9-]+\.glb$/.test(meta.file))throw Error('Unknown GLB');
      const response=await fetch('./assets/models/'+(factory?'tycoon-factory/':'tycoon/')+meta.file);if(!response.ok)throw Error('GLB unavailable');const bytes=await response.arrayBuffer();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==meta.sha256)throw Error('GLB hash mismatch');
      const gltf=await new GLTFLoader().parseAsync(bytes,'');gltf.scene.animations=gltf.animations;return gltf.scene;
    })());
    const pending=this.cache.get(kind);try{return await pending;}catch(error){if(this.cache.get(kind)===pending)this.cache.delete(kind);throw error;}
  }
  async setScene(kind,room,{demoActors=false,preserveCamera=false,allowProbe=true,domainRows}={}){
    TycoonScene.prototype.cancelPoseSolve.call(this);this.cancelStationStart?.();const generation=this.sceneGeneration=(this.sceneGeneration||0)+1;this.ready=false;if(this.stage)this.stage.visible=false;this.editor?.cancel();this.activity?.stop();this.kind=kind;this.room=room;this.domainRows=domainRows;
    this.collisionWorld=null;this.probeClock=null;this.lastProbeStepMetrics=null;this.preparationDiagnostics=[];this.renderPreparationDiagnostics=null;
    if(!preserveCamera)this.reset();else this.fit();
    try{
      this.activity=null;try{if(room)this.activity=new TycoonActivity(room,{onStatus:m=>this.onStatus?.(m)});}catch{this.onStatus?.('ห้องขนาดเดิม · เลือกขนาด S/M/L/XL เพื่อใช้เครื่องมือแปลนและทางเดิน');}
      const objects=tycoonSceneObjects(kind,room,{domainRows});
      // A transient probe is always available locally; it is never in saved inventory.
      if(room&&allowProbe)objects.push({id:'demo-agent',kind:'actor',intent:'agent',clip:'idle',optional:true});
      this.loading=this.assembly.replace(objects);await this.loading;
      if(generation!==this.sceneGeneration||this.disposed)return;
      this.collisionWorld=room?new TycoonCollisionWorld(this.assembly.owned):null;
      const actor=this.assembly.owned.find(m=>m.userData.instanceId==='demo-agent');if(actor)actor.visible=false;
      const renderPreparation=this.renderer?.compile&&this.renderer?.properties?.get
        ?await prepareTycoonProbePrograms(this.renderer,this.scene,this.camera,{isCurrent:()=>!this.disposed&&generation===this.sceneGeneration})
        :{completed:false,cancelled:false,color:{completed:false,programCount:0,parallelCompile:false,durationMs:0,reason:'renderer-program-preparation-unavailable'},shadow:{completed:false,programCount:0,parallelCompile:false,durationMs:0,reason:'renderer-program-preparation-unavailable'},durationMs:0,reason:'renderer-program-preparation-unavailable'};
      if(generation!==this.sceneGeneration||this.disposed)return;
      if(!renderPreparation.cancelled){
        const draw=await prepareTycoonHiddenDraw(this.renderer,this.scene,this.camera,{stage:this.stage,actor,isCurrent:()=>!this.disposed&&generation===this.sceneGeneration});
        if(generation!==this.sceneGeneration||this.disposed)return;
        Object.assign(renderPreparation,{draw,completed:renderPreparation.completed&&draw.completed,cancelled:draw.cancelled,durationMs:renderPreparation.durationMs+draw.durationMs,...(draw.reason&&(renderPreparation.completed||draw.cancelled)?{reason:draw.reason}:{})});
      }
      this.renderPreparationDiagnostics=renderPreparation;
      if(renderPreparation.cancelled){
        if(renderPreparation.reason==='context-lost')this.onError?.('การแสดงผล 3D ถูกขัดจังหวะ · เปิดฉากใหม่หรือรีเฟรชหน้า');
        return;
      }
      const preparation=actor&&this.activity&&!this.editor?await TycoonScene.prototype.prepareStations.call(this,actor):[];
      if(generation!==this.sceneGeneration||this.disposed)return;
      this.preparationDiagnostics=preparation;this.ready=!this.contextLost;if(this.stage)this.stage.visible=this.ready;this.editor?.highlight();if(this.ready)this.onStatus?.('ฉาก 3D พร้อมใช้งาน');
      if(this.ready&&actor&&this.activity&&kind==='projects'&&demoActors&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)this.startWalk(room.navigation?.routes?.[0]?.points||this.activity.nav.suggestRoute());
    }catch(error){if(!this.disposed&&generation===this.sceneGeneration)this.onError?.('โหลดฉากหรือโมเดลไม่ได้ · '+String(error?.message||'ส่งออกแบบร่างเพื่อเก็บงานได้').slice(0,180));}
  }
  setEditorState(mode,ids){this.editor?.set(mode,ids);}
  async furnitureThumbnail(room,{loadAsset,markers=[]}={}){
    const preview=new THREE.Scene();preview.background=new THREE.Color('#f3f0e4');
    preview.add(new THREE.HemisphereLight('#fff4dc','#6c8278',2.8));const light=new THREE.DirectionalLight('#fff2dc',3);light.position.set(-5,14,8);preview.add(light);
    const group=new THREE.Group();preview.add(group);const assembly=new TycoonAssembly(group,loadAsset||this.loadAsset.bind(this));let target;const dots=[];
    try{
      await assembly.replace(room.objects);
      for(const marker of markers){const dot=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),new THREE.MeshBasicMaterial({color:marker.color,depthTest:false}));dot.position.set(...marker.position);dot.renderOrder=999;group.add(dot);dots.push(dot);}
      const decoded=await Promise.all(assembly.owned.flatMap(n=>n.userData.finish?.pending||[]));
      if(this.disposed||decoded.some(ok=>!ok))throw Error('ภาพพรีวิวยังไม่พร้อม');
      const bounds=new THREE.Box3().setFromObject(group),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
      const h=Math.max(2,(size.x+size.z)*.72+size.y*1.25),camera=new THREE.OrthographicCamera(-h*2/3,h*2/3,h/2,-h/2,.1,100);
      camera.position.copy(center).add(new THREE.Vector3(12,10.3,12));camera.lookAt(center);
      target=new THREE.WebGLRenderTarget(320,240);target.texture.colorSpace=THREE.SRGBColorSpace;const previous=this.renderer.getRenderTarget(),bytes=new Uint8Array(320*240*4);
      try{this.renderer.setRenderTarget(target);this.renderer.render(preview,camera);this.renderer.readRenderTargetPixels(target,0,0,320,240,bytes);}finally{this.renderer.setRenderTarget(previous);}
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const context=canvas.getContext('2d'),data=context.createImageData(320,240);
      for(let y=0;y<240;y++)data.data.set(bytes.subarray((239-y)*1280,(240-y)*1280),y*1280);
      context.putImageData(data,0,0);return canvas.toDataURL('image/png');
    }finally{target?.dispose();assembly.dispose();for(const dot of dots){dot.geometry.dispose();dot.material.dispose();}}
  }
  cancelPoseSolve(){
    const job=this.poseSolve;if(!job)return;this.poseSolve=null;if(job.done&&!job.failed){job.cancel();return;}job.cancel();
    // A cancelled fixed step must not leave an unfinished contact or mixer to
    // feed a replacement activity. New motion starts from its own initial pose.
    const actor=job.actor,pose=job.publishedPose;actor.userData.contact?.reset();actor.userData.mixer?.stopAllAction();actor.userData.clip=undefined;actor.userData.probeSnapshot=null;
    for(const item of pose.nodes){item.node.position.copy(item.position);item.node.quaternion.copy(item.quaternion);item.node.scale.copy(item.scale);item.node.visible=item.visible;}actor.updateMatrixWorld(true);
  }
  updateProbe(actor,dt){
    if(this.ready===false||this.disposed){TycoonScene.prototype.cancelPoseSolve.call(this);actor.visible=false;return;}
    const activity=this.activity;if(!activity){TycoonScene.prototype.cancelPoseSolve.call(this);return;}
    if(!activity.snapshot||activity.phase==='blocked'){
      TycoonScene.prototype.cancelPoseSolve.call(this);this.probeClock=null;this.lastProbeStepMetrics={steps:0,workMs:0,pendingSeconds:0,budgetYielded:false};TycoonScene.prototype.updateProbeStep.call(this,actor,0);return;
    }
    if(this.probeClock?.activity!==activity||this.probeClock?.snapshot!==activity.snapshot||this.probeClock?.world!==this.collisionWorld||this.probeClock?.generation!==this.sceneGeneration||this.probeClock?.actor!==actor){
      TycoonScene.prototype.cancelPoseSolve.call(this);this.probeClock={activity,snapshot:activity.snapshot,world:this.collisionWorld,generation:this.sceneGeneration,actor,remainder:0};
    }
    const clock=this.probeClock,step=1/60;
    clock.remainder+=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
    const now=this.probeNow||(()=>performance.now()),started=now(),budget=Number.isFinite(this.probeStepBudgetMs)&&this.probeStepBudgetMs>0?this.probeStepBudgetMs:Infinity;
    let count=0,poseCheckpoints=0,budgetYielded=false;
    while(clock.remainder+1e-10>=step&&count<6){
      if(Number.isFinite(budget))actor.userData.contact??=new ProbeContact(actor,this.collisionWorld);
      if((this.poseSolve||Number.isFinite(budget))&&actor.userData.contact?.updateSteps){
        this.poseSolve??=new PoseTransaction(actor,activity,TycoonScene.prototype.updateProbeStepSteps.call(this,actor,step,{cooperative:true}));
        const job=this.poseSolve,before=job.checkpoints;let result;
        try{result=job.advance(()=>now()-started>=budget);}catch(error){TycoonScene.prototype.cancelPoseSolve.call(this);throw error;}
        poseCheckpoints+=job.checkpoints-before;
        if(!result.done){budgetYielded=true;break;}
        if(this.poseSolve===job)this.poseSolve=null;
      }else TycoonScene.prototype.updateProbeStep.call(this,actor,step);
      clock.remainder=Math.max(0,clock.remainder-step);count++;
      if(this.activity!==activity||this.collisionWorld!==clock.world||this.sceneGeneration!==clock.generation||activity.phase==='blocked'||activity.snapshot!==clock.snapshot){clock.remainder=0;break;}
      // Count only committed poses. Suspended work and unconsumed time remain
      // owed; subsequent frames resume in the same fixed-step order.
      if(clock.remainder+1e-10>=step&&now()-started>=budget){budgetYielded=true;break;}
    }
    this.lastProbeStepMetrics={steps:count,workMs:now()-started,pendingSeconds:clock.remainder,budgetYielded,posePending:!!this.poseSolve,poseCheckpoints};
  }
  updateProbeStep(actor,dt){return drainPoseSteps(TycoonScene.prototype.updateProbeStepSteps.call(this,actor,dt));}
  *updateProbeStepSteps(actor,dt,{cooperative=false}={}){
    if(this.ready===false){actor.visible=false;return;}
    const a=this.activity;if(!a)return;
    actor.userData.contact??=new ProbeContact(actor,this.collisionWorld);const contact=actor.userData.contact;
    if((contact.collisionWorld!==this.collisionWorld||contact.armContact?.collisionWorld!==this.collisionWorld)&&contact.bindCollisionWorld){contact.bindCollisionWorld(this.collisionWorld);actor.userData.probeSnapshot=null;a.departureFeetReady=undefined;}
    if(a.phase==='blocked'){actor.visible=true;return;}
    if(a.station?.type==='desk'&&a.workContactReady===undefined)a.workContactReady=false;
    a.transitArmsReady=a.station?.type==='desk'?(actor.userData.probeSnapshot===a.snapshot&&contact.transitReady===true):undefined;
    if(a.phase==='entering'&&a.entryFeetReady===undefined)a.entryFeetReady=false;
    if(a.phase==='settling'&&a.settleFeetReady===undefined)a.settleFeetReady=false;
    if(a.phase==='leaving'&&a.departureFeetReady===undefined)a.departureFeetReady=false;
    contact.restore();a.tick(dt);const state=a.snapshot;actor.visible=!!state;
    if(!state){contact.reset();actor.userData.probeSnapshot=null;return;}
    if(actor.userData.probeSnapshot!==state){contact.reset();actor.userData.probeSnapshot=state;}
    const p=tycoonWorld(state.position);actor.position.set(p.x,0,p.z);
    this.play(actor,state.clip);actor.userData.mixer?.update(dt);
    try{
      const seatPoint=a.station?.seat?tycoonWorld(a.station.seat):null,seatFootAnchor=a.station?.footAnchor?tycoonWorld(a.station.footAnchor):null,workSurfaceObjectId=a.station?.type==='desk'?a.station.objectId:null,options={seatObjectId:a.station?.seatObjectId,seatPoint,seatFootAnchor,seatFootWidthScale:a.station?.footWidthScale??1,seatFootToeOutRad:a.station?.footToeOutRad??0,entryFlexM:a.station?.entryFlexM??0,workSurfaceObjectId,contactSeatHeight:a.station?.seatHeight,prepareDeparture:a.phase==='leaving'&&a.departureFeetReady!==true},result=cooperative&&contact.updateSteps?yield* contact.updateSteps(state,a.phase,dt,options):contact.update(state,a.phase,dt,options);a.poseReady=result.ready;if(a.phase==='entering')a.entryFeetReady=!!result.feetReady;if(a.phase==='settling')a.settleFeetReady=!!result.ok&&result.collision?.ok!==false&&!!result.feetReady;if(a.phase==='leaving'&&a.departureFeetReady!==true)a.departureFeetReady=!!result.ok&&result.collision?.ok!==false&&!!result.feetReady&&!!result.ready;
      if(a.phase==='turning'){const delta=Math.atan2(Math.sin(contact.heading-(a.station?.heading??contact.heading)),Math.cos(contact.heading-(a.station?.heading??contact.heading)));a.headingErrorRad=delta;a.headingReady=Math.abs(delta)<=.02;result.collision.headingErrorRad=delta;result.collision.headingReady=a.headingReady;}else{a.headingReady=undefined;a.headingErrorRad=null;}
        if(workSurfaceObjectId&&['sit','working'].includes(a.phase))a.workContactReady=!!result.ok&&result.collision?.ok!==false&&result.collision?.armContact?.status==='contact';
        if(a.station?.seatObjectId&&['sit','working'].includes(a.phase)&&a.poseReady){const seatModel=this.assembly?.owned.find(m=>m.userData.instanceId===a.station.seatObjectId)||this.collisionWorld?.objectRoot?.(a.station.seatObjectId),seatSupport=measurePelvisSeatSupport(actor,seatModel,a.station.seatHeight);result.collision.seatSupport=seatSupport;if(!seatSupport.ok)throw Object.assign(Error('pelvis does not have measured seat support'),{reason:'pelvis-seat-support',seatSupport});}
      if(!result.ok){
        actor.userData.limbCollisionDiagnostics=result.collision;
        const safe=contact.safePose?.position,hit=result.collision.hit,where=hit?.reason==='desktop-target-outside-arm-range'?'มือเอื้อมถึงโต๊ะไม่ได้':hit?.reason==='desktop-support-surface-unavailable'?'ไม่พบพื้นผิวโต๊ะที่รองรับมือได้':hit?.objectId?`${hit.limb} ชน ${hit.objectId}`:hit?.reason==='sweep-range-exceeded'?'การเคลื่อนไหวเร็วเกินขอบเขตตรวจสอบ':`${hit?.limb||'ขา'} ไม่มีจุดยืนปลอดภัย`;
        const message=`หยุดทดสอบการเดิน · ${where}`;
        if(safe&&a.blockMotion){const ground=tycoonGround({x:safe.x,z:safe.z});a.blockMotion(message,ground,contact.heading);actor.visible=true;}
        else{a.stop();actor.visible=false;this.onStatus?.(message);}
        return;
      }
      actor.userData.limbCollisionDiagnostics=result.collision;
      if(a.phase==='walking'&&workSurfaceObjectId&&a.elapsed>8&&!contact.transitReady)throw Object.assign(Error('ไม่สามารถเตรียมท่าแขนก่อนเดินภายในเวลาทดสอบ'),{reason:'transit-posture-timeout'});
      if(a.phase==='settling'&&a.elapsed>8&&(!a.poseReady||!a.settleFeetReady))throw Object.assign(Error('ไม่สามารถวางเท้าให้มั่นคงหลังหยุดภายในเวลาทดสอบ'),{reason:'stop-contact-timeout'});
      if(a.phase==='leaving'&&a.elapsed>8&&a.departureFeetReady===false)throw Object.assign(Error('ไม่สามารถจัดเท้าก่อนเดินออกจากที่นั่งภายในเวลาทดสอบ'),{reason:'departure-contact-timeout'});
      if(a.phase==='sit'&&a.elapsed>8&&workSurfaceObjectId&&!a.workContactReady)throw Object.assign(Error('ไม่สามารถจัดมือให้สัมผัสโต๊ะภายในเวลาทดสอบ'),{reason:'desktop-contact-timeout'});
      if(['sit','standing'].includes(a.phase)&&a.elapsed>8&&!a.poseReady)throw Error('ไม่สามารถจัดท่าให้ถึงเบาะและพื้นได้');
    }catch(error){
      const safe=contact.safePose?.position,attempted=actor.position.clone(),message='หยุดทดสอบท่า · '+error.message;
      if(safe&&a.blockMotion){
          contact.restoreSafePose();const diagnostic={ok:false,phase:'pose-error',reason:error.reason||'pose-error',message:error.message,seatSupport:error.seatSupport||null,swingClearancePlan:error.swingPlan||contact.swingPlan||null,stepBackoffM:attempted.distanceTo(safe),safeRoot:safe.toArray(),attemptedRoot:attempted.toArray(),hit:null};
        diagnostic.armContact=contact.armContact?.lastDiagnostic||null;contact.lastCollision=diagnostic;actor.userData.limbCollisionDiagnostics=diagnostic;a.blockMotion(message,tycoonGround({x:safe.x,z:safe.z}),contact.heading);actor.visible=true;
      }else{a.stop();actor.visible=false;contact.reset();actor.userData.limbCollisionDiagnostics={ok:false,phase:'pose-error',reason:'pose-error',message:error.message,hit:null};this.onStatus?.(message);}
    }
  }
  play(model,name){
    if(model.userData.clip===name)return;const mixer=model.userData.mixer,clip=model.userData.clips.find(c=>c.name===name);if(!clip||!mixer)return;
    const old=model.userData.clips.find(c=>c.name===model.userData.clip);if(old)mixer.clipAction(old).fadeOut(.15);
    const action=mixer.clipAction(clip);action.reset();action.setLoop(['sit_down','stand_up'].includes(name)?THREE.LoopOnce:THREE.LoopRepeat,Infinity);action.clampWhenFinished=true;action.fadeIn(.15).play();model.userData.clip=name;
  }
  cancelStationStart({preserveStartPoint=false}={}){const request=this.stationStartRequest;this.stationStartToken=(this.stationStartToken||0)+1;this.stationStartRequest=null;return preserveStartPoint?request:null;}
  startWalk(points){this.cancelStationStart?.();if(!this.ready)return {ok:false,message:'กำลังโหลดโมเดล · ลองอีกครั้งเมื่อฉากพร้อม'};if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return {ok:false,message:'ปิดการเคลื่อนไหวตามการตั้งค่าของคุณ'};if(!this.assembly?.owned.some(m=>m.userData.instanceId==='demo-agent'))return {ok:false,message:'ตัวละครทดลองยังไม่พร้อม'};return respawnProbe(this,this.activity?.startRoute(points)||{ok:false,message:'ฉากยังไม่พร้อม'});}
  async prepareStations(actor,{now,yieldTurn,budgetMs=2,isCurrent}={}){
    const world=this.collisionWorld,activity=this.activity,generation=this.sceneGeneration;
    const current=()=>!this.disposed&&this.sceneGeneration===generation&&this.collisionWorld===world&&this.activity===activity&&(!isCurrent||isCurrent());
    if(this.ready!==false)throw Error('Seat preparation requires a loading scene');
    if(!current())throw new DOMException('Scene preparation was superseded','AbortError');
    actor.userData.contact??=new ProbeContact(actor,world);if(!actor.userData.contact.valid)return [];
    const records=[];
    for(const station of activity.nav.stations.filter(station=>station.seat&&station.footAnchor)){
      const started=performance.now(),result=await runSeatFitSteps(TycoonScene.prototype.fitStation.call(this,station.id),{now,yieldTurn,budgetMs,isCurrent:current});
      if(!current())throw new DOMException('Scene preparation was superseded','AbortError');
      records.push({stationId:station.id,durationMs:performance.now()-started,result,fit:structuredClone(station.footPlacementDiagnostic||null)});
    }
    return records;
  }
  startStation(id){TycoonScene.prototype.cancelPoseSolve.call(this);const pending=this.cancelStationStart?.({preserveStartPoint:true}),activity=this.activity,generation=this.sceneGeneration,world=this.collisionWorld,room=this.room,nav=activity?.nav;const startPoint=pending&&pending.sceneGeneration===generation&&pending.activity===activity&&pending.world===world&&pending.room===room&&pending.nav===nav?copyGroundPoint(pending.startPoint):null;if(!this.ready)return {ok:false,message:'กำลังโหลดโมเดล · ลองอีกครั้งเมื่อฉากพร้อม'};if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return {ok:false,message:'ปิดการเคลื่อนไหวตามการตั้งค่าของคุณ'};if(!this.assembly?.owned.some(m=>m.userData.instanceId==='demo-agent'))return {ok:false,message:'ตัวละครทดลองยังไม่พร้อม'};
    const steps=TycoonScene.prototype.fitStation.call(this,id);let fitted=steps.next();while(!fitted.done)fitted=steps.next();if(!fitted.value.ok)return fitted.value;
    return respawnProbe(this,activity?.startStation(id,startPoint?{startPoint}:undefined)||{ok:false,message:'ฉากยังไม่พร้อม'});
  }
  async startStationAsync(id,{now,yieldTurn,budgetMs=2}={}){
    const generation=this.sceneGeneration,activity=this.activity,world=this.collisionWorld,room=this.room,nav=activity?.nav;
    const pending=this.cancelStationStart({preserveStartPoint:true});
    const reusable=pending&&pending.sceneGeneration===generation&&pending.activity===activity&&pending.world===world&&pending.room===room&&pending.nav===nav;
    const startPoint=copyGroundPoint(reusable?pending.startPoint:(activity?.snapshot?.position??nav?.spawnPoint));
    if(!this.ready)return {ok:false,message:'กำลังโหลดโมเดล · ลองอีกครั้งเมื่อฉากพร้อม'};
    if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return {ok:false,message:'ปิดการเคลื่อนไหวตามการตั้งค่าของคุณ'};
    const actor=this.assembly?.owned.find(model=>model.userData.instanceId==='demo-agent');
    if(!actor)return {ok:false,message:'ตัวละครทดลองยังไม่พร้อม'};
    if(!activity||!world||!nav)return {ok:false,message:'ฉากยังไม่พร้อม'};
    const token=this.stationStartToken,request={token,sceneGeneration:generation,activity,world,room,nav,startPoint};
    this.stationStartRequest=request;
    const current=()=>!this.disposed&&this.stationStartRequest===request&&this.stationStartToken===token&&this.sceneGeneration===generation&&this.activity===activity&&this.collisionWorld===world&&this.room===room&&activity.nav===nav&&this.ready===true;
    const scheduleTurn=yieldTurn||(()=>typeof globalThis.scheduler?.yield==='function'?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0)));
    const scheduler={budgetMs,now,yieldTurn:scheduleTurn,isCurrent:current};
    const cancelled=()=>({ok:false,cancelled:true,message:'ยกเลิกการทดสอบแล้ว'});
    TycoonScene.prototype.cancelPoseSolve.call(this);this.probeClock=null;activity.stop();actor.visible=false;actor.userData.probeSnapshot=null;actor.userData.contact?.reset();
    try{
      await scheduleTurn();if(!current())return cancelled();
      const fit=await runSeatFitSteps(TycoonScene.prototype.fitStation.call(this,id),scheduler);
      if(!current())return cancelled();
      if(!fit?.ok)return fit||{ok:false,message:'จุดใช้งานยังไม่พร้อม'};
      const station=nav.stations.find(candidate=>candidate.id===id||candidate.objectId===id);
      const routeStart=startPoint??nav.spawnPoint;
      if(station&&routeStart&&nav.isWalkable(routeStart)){
        if(typeof nav.findLocalPathSteps!=='function')return {ok:false,message:'การวางแผนทางเดินแบบร่วมมือยังไม่พร้อม'};
        await runSeatFitSteps(nav.findLocalPathSteps(routeStart,station.position),scheduler);
      }
      if(!current())return cancelled();
      const result=activity.startStation(id,startPoint?{startPoint}:undefined)||{ok:false,message:'ฉากยังไม่พร้อม'};
      if(!current())return cancelled();
      return respawnProbe(this,result);
    }catch(error){
      if(error?.name==='AbortError'||!current())return cancelled();
      throw error;
    }finally{if(this.stationStartRequest===request)this.stationStartRequest=null;}
  }
  *fitStation(id){const station=this.activity?.nav.stations.find(s=>s.id===id||s.objectId===id);
      if(station?.seat){const model=this.assembly.owned.find(m=>m.userData.instanceId===station.seatObjectId),p=tycoonWorld(station.seat),seatContact=measureSeatContact(model,p,station.seatHeight);if(!seatContact.ok){this.activity.stop();return seatContact;}station.seatHeight=seatContact.height;
        if(station.footAnchor){const front=measuredSeatDirection(station,this.collisionWorld,tycoonWorld(station.footAnchor).sub(p).setY(0).normalize()),seatExtent=this.collisionWorld?.topSurfaceExtent?.(station.seatObjectId,p,front),chairExtent=this.collisionWorld?.projectionExtent?.(station.seatObjectId,p,front),actor=this.assembly?.owned.find(m=>m.userData.instanceId==='demo-agent');let probe=actor?.userData.contact;if(actor&&!probe){probe=new ProbeContact(actor,this.collisionWorld);actor.userData.contact=probe;}const shoeRear=probe?.shoeRearExtent(station.heading,front),seatRoot=measuredSeatRoot(station,this.collisionWorld,tycoonWorld(station.seatRoot||station.seat)),deskClearance=.005,step=.005,maxDistance=.78;
          if(Number.isFinite(seatExtent)&&seatExtent>0&&Number.isFinite(chairExtent)&&chairExtent>0&&Number.isFinite(shoeRear)&&shoeRear>0&&probe){const search=createSeatFitSteps(probe,this.collisionWorld),options={point:p,root:seatRoot,heading:station.heading,seatHeight:station.seatHeight,seatExtent,chairExtent,shoeRear,front,clearanceM:deskClearance,stepM:step,maxDistance};
            let fit=yield*search(options),fittedRoot=seatRoot,additionalRootAdvanceM=0;const rootTrials=[];
            if(!fit.selected&&probe.pelvisSupportOffset){
              const offset=probe.pelvisSupportOffset.clone().applyAxisAngle(new THREE.Vector3(0,1,0),station.heading);
              for(const advance of [.02,.04,.06,.08,.10]){
                const candidate=seatRoot.clone().addScaledVector(front,advance),supportPoint=candidate.clone().add(offset),support=measureSeatContact(model,supportPoint,station.seatHeight);
                const corridor=this.activity.nav.isSegmentWalkable(tycoonGround(seatRoot),tycoonGround(candidate),{ignoreIds:[station.seatObjectId,station.objectId]});
                const trial={advanceM:advance,seatSupport:support,corridor,footFit:false};rootTrials.push(trial);
                if(!support.ok||Math.abs(support.height-station.seatHeight)>.003||!corridor)continue;
                const alternative=yield*search({...options,root:candidate});trial.footFit=!!alternative.selected;
                if(alternative.selected){fit=alternative;fittedRoot=candidate;additionalRootAdvanceM=advance;break;}
              }
            }
            const {selected,candidates,lastCandidate,lastReachableCandidate}=fit;
            if(selected){const shoeClearance=selected.distance-seatExtent;station.measuredSeatFrontExtentM=seatExtent;station.measuredChairCollisionFrontExtentM=chairExtent;station.measuredShoeRearExtentM=shoeRear;station.seatFootClearanceM=shoeClearance;station.footWidthScale=selected.footWidthScale;station.footToeOutRad=selected.footToeOutRad;station.entryFlexM=selected.entryFlexM;station.footPlacementDiagnostic={ok:true,distanceM:selected.distance,footWidthScale:selected.footWidthScale,footToeOutRad:selected.footToeOutRad,entryFlexM:selected.entryFlexM,minimumClearanceM:selected.clearance,seatedReach:selected.seatedReach,standingReach:selected.standingReach,candidateCount:selected.tests,geometryQueries:fit.sessionGeometryQueries,reachQueries:fit.reachQueries,cacheHit:fit.cacheHit,additionalRootAdvanceM,rootTrials};station.footAnchor=tycoonGround({x:selected.anchor.x,z:selected.anchor.z});if(additionalRootAdvanceM)station.seatRoot=tycoonGround(fittedRoot);rememberSeatDirection(station,this.collisionWorld,front,fittedRoot);}
            else{station.footPlacementDiagnostic={ok:false,reason:'no-clear-leg-and-shoe-target',seatExtent,chairExtent,shoeRear,maxDistance,candidates,lastCandidate,lastReachableCandidate,rootTrials};this.activity.stop();return {ok:false,reason:'seat-foot-placement-unreachable',message:'ไม่พบตำแหน่งเท้าที่พ้นขาเก้าอี้และยังเอื้อมถึงได้',diagnostic:station.footPlacementDiagnostic};}}
          else{this.activity.stop();return {ok:false,reason:'seat-foot-clearance-unavailable',message:'ไม่สามารถวัดระยะปลอดภัยจากขาเก้าอี้และรองเท้าได้'};}}
      }
    return {ok:true};}
  stopTest(){TycoonScene.prototype.cancelPoseSolve.call(this);this.cancelStationStart?.();this.activity?.stop();}
  setFrameRate(rate){this.framePacer.setRate(rate);if(this.autoProbeStepBudget)this.probeStepBudgetMs=defaultProbeStepBudgetMs(rate);}
  get actorPositions(){return this.activity?.positions||[];}
  get collisionDiagnostics(){const actor=this.assembly?.owned.find(m=>m.userData.instanceId==='demo-agent');return actor?.userData.limbCollisionDiagnostics||actor?.userData.contact?.lastCollision||null;}
  probeVisible(){return !!this.assembly?.owned.some(m=>m.userData.instanceId==='demo-agent'&&m.visible);}
  focusProbe(){
    const actor=this.assembly?.owned.find(m=>m.userData.instanceId==='demo-agent');
    if(!actor?.visible)return {ok:false,message:'ตัวละครทดลองยังไม่ปรากฏในฉาก'};
    const plan=this.room?.blueprintPlan,center=plan?{x:plan.originX+plan.width/2+2,z:plan.originZ+plan.depth/2+2}:{x:0,z:0};
    this.pan.set(actor.position.x-center.x,0,actor.position.z-center.z);this.scale=Math.max(this.scale,1.3);this.fit();
    return {ok:true};
  }

  resize(){if(this.disposed)return;const r=this.root.getBoundingClientRect();this.renderer.setSize(Math.max(1,r.width),Math.max(1,r.height));this.fit();}
  fit(){const r=this.root.getBoundingClientRect(),ratio=Math.max(.1,r.width/Math.max(1,r.height)),frame=tycoonCameraFrame(this.room,ratio,this.scale,this.kind);if(this.kind==='building'&&this.domainRows){frame.height=Math.max((Math.min(8,this.domainRows.length)+1)*3.2+10,23/ratio)/this.scale;frame.width=frame.height*ratio;}Object.assign(this.camera,{left:-frame.width/2,right:frame.width/2,top:frame.height/2,bottom:-frame.height/2});const target=new THREE.Vector3(this.pan.x+frame.centerX,this.kind==='building'?(this.domainRows?(Math.min(8,this.domainRows.length)+1)*1.6:2.8):.4,this.pan.z+frame.centerZ);const e=Math.asin(.52),distance=28;this.camera.position.set(Math.cos(e)*distance/Math.SQRT2,Math.sin(e)*distance,Math.cos(e)*distance/Math.SQRT2).add(target);this.camera.lookAt(target);this.camera.updateProjectionMatrix();if(this.sunLight){const extent=Math.max(12,Math.hypot(this.room?.width||16,this.room?.depth||10)/2+2);Object.assign(this.sunLight.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent});this.sunLight.shadow.camera.updateProjectionMatrix();}}
  focusArea(id){const area=this.room?.blueprintPlan?.areas?.find(area=>area.id===id);if(!area)return {ok:false,message:'ไม่พบพื้นที่นี้ในฉากที่เปิดอยู่'};const r=this.root.getBoundingClientRect(),ratio=Math.max(.1,r.width/Math.max(1,r.height)),frame=tycoonCameraFrame(this.room,ratio,1,this.kind),plan=this.room.blueprintPlan;this.pan.set(plan.originX+area.x+area.width/2+2-frame.centerX,0,plan.originZ+area.z+area.depth/2+2-frame.centerZ);const needed=Math.max((area.width+area.depth)/Math.SQRT2*.52+4,(area.width+area.depth)/Math.SQRT2/ratio+2);this.scale=Math.max(1,Math.min(4,frame.height/needed));this.fit();return {ok:true,areaId:id};}
  zoom(delta){this.scale=Math.max(.6,Math.min(4,this.scale+delta));this.fit();}
  reset(){this.scale=1;this.pan.set(0,0,0);this.resize();}
  dispose(){if(this.disposed)return;TycoonScene.prototype.cancelPoseSolve.call(this);this.cancelStationStart?.();this.disposed=true;this.probeClock=null;this.activity?.stop();this.editor?.dispose();this.assembly.dispose();this.resizeObserver.disconnect();const c=this.renderer.domElement;for(const [event,fn]of [['pointerdown',this.down],['pointermove',this.move],['pointerup',this.up],['pointercancel',this.cancel],['wheel',this.wheel],['webglcontextlost',this.lost]])c.removeEventListener(event,fn);if(this.stopVisibleLoop)this.stopVisibleLoop();else this.renderer.setAnimationLoop(null);c.remove();const releases=[...this.cache.values()].map(pending=>pending.then(model=>{disposeCachedSkeletons(model);const gs=new Set(),ms=new Set(),ts=new Set();model.traverse(n=>{if(n.geometry)gs.add(n.geometry);for(const m of [].concat(n.material||[])){ms.add(m);for(const value of Object.values(m))if(value?.isTexture)ts.add(value);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());}).catch(()=>{}));this.cache.clear();this.disposal=Promise.all(releases).then(()=>this.renderer.dispose());}
}
