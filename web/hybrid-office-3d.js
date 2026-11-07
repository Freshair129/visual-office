import {officeAgentState,officeActivityCaption} from './office-activity.js';
import {makeOfficeProp as makeProp,officePropScale as propScale} from './office-prop-models.js';
import {isOfficeSheet,sheetYaw,compileOfficeSheet} from './office-scene-sheet.js';
import {OfficeSheetLayer} from './office-sheet-layer.js';
import {OfficeObjectSkins} from './office-object-skins.js';
import {sheetModelBlockers} from './office-sheet-bounds.js';
import {physicalSkeletonRoom} from './office-skeleton-parts.js';
import {officeArtSource} from './hybrid-state.js';
import {skeletonAlignment,applySkeletonAlignment,alignmentSvgTransform} from './office-skeleton-alignment.js';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {makeStudioDesk,makeStudioChair,makeStudioSofa,makeStudioWhiteboard,makeStudioPlant,disposeStudioObject} from './studio-models.js';
import {officeSceneCamera,groundToWorld,worldToGround} from './office-projection.js';
import {CharacterLibrary,updateCharacter,disposeCharacter,presentedAction} from './characters/runtime.js';
import {resolveAppearance} from './characters/runtime-catalog.js';
import {createOfficeNavigation} from './office-navigation.js';
import {createOfficeArchitecture,disposeOfficeArchitecture} from './office-architecture.js';
import {blueprintDoorOccupied} from './office-blueprints.js';
import {createPaintedFurniture,createPaintedWallMasks,disposePaintedFurniture} from './painted-office-skeleton.js';

export const isOfficeModel=kind=>['work-desk','task-chair','team-sofa','water-cooler','whiteboard','plant','wayfinding-arrow'].includes(kind)||/^avatar-\d\d$/.test(kind);
const point=p=>({x:p.x,y:p.y});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function paintedProp(o,camera,callbacks){const proxy=makeProp(o.kind);proxy.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(proxy).getSize(new THREE.Vector3()),scale=propScale({...o,scale:1}),direction=camera.position.clone().normalize();const depthRise=size.y*scale,depthFront=(size.x*Math.abs(direction.x)+size.z*Math.abs(direction.z))*.5*scale;disposeStudioObject(proxy);return createPaintedFurniture(o,camera,{...callbacks,depthRise,depthFront});}

// One real depth buffer for the Three.js room shell, furniture and articulated people. All movement and interactions use the same ground coordinates as nav.
export class HybridOffice3D{
  constructor(root,{Renderer=THREE.WebGLRenderer,painted=false,SkinLayer=OfficeObjectSkins}={}){
    this.SkinLayer=SkinLayer;
    this.painted=painted;
    this.root=root;this.doc=root.ownerDocument;this.win=this.doc.defaultView;this.scene=new THREE.Scene();this.camera=officeSceneCamera();
    this.renderer=new Renderer({alpha:true,antialias:true});this.renderer.setClearColor(0x000000,0);this.renderer.setPixelRatio(Math.min(this.win.devicePixelRatio||1,1.5));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.08;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.domElement.className='hy-model-canvas';this.renderer.domElement.setAttribute('aria-hidden','true');root.insertBefore(this.renderer.domElement,root.querySelector('.hy-objects'));
    this.scene.add(new THREE.HemisphereLight('#fff5e2','#b8c0b3',1.8));const sun=new THREE.DirectionalLight('#fff1d9',2.2);sun.position.set(-5,16,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=sun.shadow.camera.bottom=-16;sun.shadow.camera.right=sun.shadow.camera.top=16;sun.shadow.camera.far=70;sun.shadow.normalBias=.018;this.scene.add(sun);this.sun=sun;
    this.structureGroup=new THREE.Group();this.structureGroup.name='calibrated-physical-skeleton';this.scene.add(this.structureGroup);
    this.ground=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.ShadowMaterial({opacity:.16}));this.ground.rotation.x=-Math.PI/2;this.ground.position.y=-.02;this.ground.receiveShadow=true;this.structureGroup.add(this.ground);
    this.architecture=createOfficeArchitecture();this.architecture.userData.officeArchitecture.daylight.visible=false;this.architecture.userData.officeArchitecture.ambient.visible=false;this.architecture.userData.officeArchitecture.backplane.visible=false;this.structureGroup.add(this.architecture);
    this.characterNotice=this.doc.createElement('small');this.characterNotice.className='hy-character-notice';this.characterNotice.setAttribute('role','status');this.characterNotice.hidden=true;root.append(this.characterNotice);this.characters=new CharacterLibrary();this.models=new Map();this.actors=new Map();this.agentStates=new Map();this.wallMeshes=this.architecture.userData.wallMeshes;this.raycaster=new THREE.Raycaster();this.lastTime=null;
    if(painted){this.architecture.visible=false;this.ground.visible=false;this.wallMasks=createPaintedWallMasks(this.architecture);this.wallMeshes=this.wallMasks.children;this.structureGroup.add(this.wallMasks);}
    this.navSvg=this.doc.createElementNS('http://www.w3.org/2000/svg','svg');this.navSvg.setAttribute('viewBox','0 0 100 100');this.navSvg.setAttribute('preserveAspectRatio','none');this.navSvg.classList.add('hy-navigation-map');this.navSvg.setAttribute('hidden','');root.append(this.navSvg);
    this.resize=()=>{const r=root.getBoundingClientRect();if(!r.width||!r.height)return;this.renderer.setSize(r.width,r.height,false);this.draw();};
    this.observer=this.win.ResizeObserver?new this.win.ResizeObserver(this.resize):null;this.observer?.observe(root);this.resize();
    this.lost=e=>{e.preventDefault();this.unavailable=true;root.dispatchEvent(new this.win.CustomEvent('office-3d-unavailable'));};this.renderer.domElement.addEventListener('webglcontextlost',this.lost);
  }
  sync(room,playing){
    this.skinLayer?.clear();
    this.sheetLayer?.restoreStatic();const unified=isOfficeSheet(room);if(unified&&!this.sheetLayer)this.sheetLayer=new OfficeSheetLayer(this);if(!unified&&this.sheetLayer){this.sheetLayer.dispose();this.sheetLayer=null;}if(this.sheetLayer){const key=JSON.stringify(room);if(this.sheetKey!==key){this.sheetKey=key;this.sheetLayer.invalidate();}this.compiledSheet=compileOfficeSheet(room);}
    const architectureKey=JSON.stringify({plan:room.blueprintPlan||room.blueprint,walls:room.skeletonParts?.filter(p=>p.id.startsWith('wall:'))});
    if(this.architectureKey!==architectureKey){
      if(this.wallMasks){this.wallMasks.removeFromParent();disposePaintedFurniture(this.wallMasks);}
      this.architecture.removeFromParent();disposeOfficeArchitecture(this.architecture);this.architecture=createOfficeArchitecture(room.blueprintPlan||room.blueprint,room.skeletonParts);this.architectureKey=architectureKey;
      const a=this.architecture.userData.officeArchitecture;a.daylight.visible=a.ambient.visible=a.backplane.visible=false;
      this.wallMeshes=a.wallMeshes;this.structureGroup.add(this.architecture);
      if(this.painted){this.architecture.visible=false;this.wallMasks=createPaintedWallMasks(this.architecture);this.wallMeshes=this.wallMasks.children;this.structureGroup.add(this.wallMasks);}
    }
    this.authoredRoom=room;this.room=physicalSkeletonRoom(room);this.playing=playing;this.testWalk=null;this.lastTime=null;this.navigation=createOfficeNavigation(room);
    const keep=new Set(room.objects.filter(o=>isOfficeModel(o.kind)).map(o=>o.id));
    for(const [id,model]of this.models)if(!keep.has(id)){model.removeFromParent();this.disposeModel(model);this.models.delete(id);this.actors.delete(id);}
    for(const source of room.objects){
      const o=this.room.objects.find(o=>o.id===source.id)||source;
      if(!isOfficeModel(o.kind))continue;let model=this.models.get(o.id);const character=o.kind.startsWith('avatar-');
      if(model&&(model.userData.officeKind!==o.kind||character&&model.userData.runtimeCharacter?.id!==resolveAppearance(o)||this.painted&&!character&&model.userData.artSource!==officeArtSource(room,o.kind))){model.removeFromParent();this.disposeModel(model);this.models.delete(o.id);this.actors.delete(o.id);model=null;}
      if(!model){model=character?this.characters.create(resolveAppearance(o),{index:Number(o.kind.slice(-2))-1,onReady:loaded=>{if(!this.disposed){const current=this.room.objects.find(item=>item.id===o.id);if(current)this.styleModel(loaded,current);this.characterStatus();this.resize();}}}):this.painted?paintedProp(source,this.camera,{imageSrc:officeArtSource(room,o.kind),onReady:()=>{if(!this.disposed)this.resize();},onError:()=>{if(!this.disposed)this.root.dispatchEvent(new this.win.CustomEvent('office-3d-unavailable'));}}):makeProp(o.kind,unified?'signature':'studio');model.userData.officeId=o.id;model.userData.officeKind=o.kind;if(!character)model.userData.skeletonTarget=`object:${o.id}`;if(this.painted&&!character)model.userData.artSource=officeArtSource(room,o.kind);this.models.set(o.id,model);(this.painted&&!character?this.scene:this.structureGroup).add(model);}
      if(character){
        let actor=this.actors.get(o.id);if(!actor){actor={id:o.id,model,position:point(o),action:'idle',mode:'auto',age:0,path:[],walkDistance:0,speed:0,index:this.actors.size};this.actors.set(o.id,actor);}
        actor.authored=o;model.scale.setScalar(o.scale/.82*(this.painted?1.5:1));
        if(!playing){actor.position=point(o);actor.mode='auto';actor.action='idle';actor.path=[];actor.station=null;actor.target=null;actor.afterPath=null;actor.ignoreIds=[];actor.settlingSeat=null;actor.age=0;actor.initialized=false;}
        else if(!actor.initialized){actor.initialized=true;const station=this.stationFor(actor,'desk');if(station&&![...this.actors.values()].some(other=>other!==actor&&other.station?.id===station.id))this.arrive(actor,station);else actor.position=this.safePoint(o)||point(o);}
      }else{
        model.position.copy(groundToWorld(this.painted?source:o));model.scale.setScalar(this.painted?source.scale:propScale(o));
        if(this.painted){model.rotation.y=0;model.children[0].scale.x=o.flip?-1:1;}
        else if(unified){model.rotation.y=sheetYaw(o);model.userData.skinRotation=((Math.round((sheetYaw(o)-(o.kind==='team-sofa'?-Math.PI/2:0))*180/Math.PI)%360)+360)%360;}else model.rotation.y=o.kind==='team-sofa'?(o.flip?Math.PI/2:-Math.PI/2):['whiteboard','water-cooler'].includes(o.kind)?0:o.flip?-Math.PI/2:Math.PI;
      }
      this.styleModel(model,o);
    }
    applySkeletonAlignment(this.structureGroup,skeletonAlignment(room));
    if(unified){this.modelBlockers=sheetModelBlockers(this.models,this.structureGroup);this.navigation=createOfficeNavigation(room,{objectBlockers:this.modelBlockers,includeObjectStations:true});this.styleSheetSurfaces();}
    if(unified&&this.SkinLayer){if(!this.skinLayer){this.skinLayer=new this.SkinLayer(this);this.skinLayer.loadSurfaces();}this.skinLayer.sync();}else if(this.skinLayer){this.skinLayer.dispose();this.skinLayer=null;}
    this.characterStatus();this.drawNavigation();this.step(0,{staticPose:!playing});this.resize();
  }
  characterStatus(){
    const states=[...this.models.values()].map(m=>m.userData.runtimeCharacter).filter(Boolean);
    this.root.dataset.characterLoad=states.map(s=>s.status).join(',');this.root.dataset.characterAssets=states.filter(s=>s.status==='ready').map(s=>s.id).join(',');
    const failed=states.some(s=>s.status==='fallback'),loading=states.some(s=>s.status==='loading');this.characterNotice.hidden=!failed&&!loading;
    this.characterNotice.textContent=failed?'ใช้ตัวละครสำรอง · โหลดโมเดลไม่สำเร็จ · รีเฟรชเพื่อลองใหม่':loading?'กำลังโหลดตัวละครชั่วคราว…':'';
  }
  styleModel(model,o){model.traverse(mesh=>{if(!mesh.isMesh)return;const opacity=o.effects?.opacity??1;for(const material of [].concat(mesh.material)){material.userData.baseOpacity??=material.opacity;material.userData.baseTransparent??=material.transparent;material.opacity=material.userData.baseOpacity*opacity;material.transparent=material.userData.baseTransparent||opacity<1;if(material.emissive)material.emissive.set(o.effects?.glow?'#332511':'#000000');}});}
  disposeModel(model){if(model.userData.paintedFurniture)disposePaintedFurniture(model);else if(model.userData.officeKind?.startsWith('avatar-'))disposeCharacter(model);else disposeStudioObject(model);}
  stationFor(actor,type){
    const paired=actor.id.replace(/-avatar$/,'-desk'),available=this.navigation.stations.filter(s=>s.type===type&&!this.stationOccupied(s,actor));return available.find(s=>s.objectId===paired)||available.sort((a,b)=>distance(actor.position,a.position)-distance(actor.position,b.position))[0];
  }
  stationOccupied(station,actor){
    return [...this.actors.values()].some(other=>other!==actor&&[other.station,other.target].some(s=>s&&(s.id===station.id||(!station.slot&&station.seatObjectId&&s.seatObjectId===station.seatObjectId))));
  }
  setAgentStates(values){
    const previous=this.agentStates||new Map();
    this.agentStates=new Map((Array.isArray(values)?values:[]).filter(v=>v&&typeof (v.avatarId||v.id)==='string').map(v=>[v.avatarId||v.id,officeAgentState(v)]));
    for(const actor of this.actors.values()){
      const status=this.agentStates?.get(actor.id)?.state||'unknown';
      if(previous.get(actor.id)?.state!==status)actor.age=0;
      if(actor.station?.type==='desk'&&actor.station.seat)actor.action=status==='working'?'seated':'sitting';
      if(actor.mode!=='auto')continue;
      if(['unknown','offline'].includes(status))this.stopAutomaticTrip(actor);
      else if(['working','thinking','waiting','done'].includes(status)&&actor.station?.type!=='desk'&&actor.target?.type!=='desk'){
        if(!this.travel(actor,this.stationFor(actor,'desk')))this.stopAutomaticTrip(actor);
      }
    }
  }
  stopAutomaticTrip(actor){
    const seat=actor.target,seatObjectId=seat?.seatObjectId;
    if(actor.settlingSeat&&actor.path.length)return;
    if(seat?.seat&&seatObjectId&&!this.navigation.isWalkable(actor.position)&&this.navigation.isWalkable(actor.position,{ignoreIds:[seatObjectId]})){
      // Entry already crossed a reserved seat's clearance boundary. Finish just
      // that local sitting transition instead of standing inside the furniture.
      const entry=this.navigation.findLocalPath(actor.position,seat.seat,{ignoreIds:[seatObjectId]});
      if(entry.length){
        const object=this.room.objects.find(o=>o.id===seat.objectId),direction=object?groundToWorld(object).sub(groundToWorld(seat.seat)):null;
        actor.path=entry.slice(1);actor.ignoreIds=[seatObjectId];actor.afterPath=null;actor.speed=0;actor.action=seat.type==='sofa'?'resting':'sitting';
        actor.settlingSeat={...seat,heading:seat.heading??(direction?Math.atan2(direction.x,direction.z):actor.heading)};
        if(!actor.path.length)this.arrive(actor,seat);return;
      }
    }
    // Freeze the last collision-checked position, including a validated local
    // chair/sofa approach. Do not snap to safePoint or invent a replacement trip.
    actor.path=[];actor.target=null;actor.afterPath=null;actor.speed=0;actor.settlingSeat=null;
    if(this.navigation?.isWalkable(actor.position))actor.ignoreIds=[];
    actor.action=actor.station?.type==='sofa'?'resting':actor.station?.type==='desk'&&actor.station.seat?'sitting':'idle';
  }
  seatedAction(actor){return this.agentStates?.get(actor.id)?.state==='working'?'seated':'sitting';}
  safePoint(position){
    if(this.navigation.isWalkable(position))return point(position);
    for(let radius=.75;radius<=15;radius+=.75)for(let i=0;i<24;i++){const a=i*Math.PI/12,p={x:position.x+Math.cos(a)*radius,y:position.y+Math.sin(a)*radius};if(this.navigation.isWalkable(p))return p;}
    return null;
  }
  arrive(actor,station){
    actor.settlingSeat=null;
    actor.path=[];actor.target=null;actor.ignoreIds=[];actor.station=station;actor.position=point(station.seat||station.position);actor.action=station.type==='desk'?(station.seat?this.seatedAction(actor):'idle'):station.type==='sofa'?'resting':'drinking';actor.age=0;
    const o=this.room.objects.find(o=>o.id===station.objectId);if(o){if(station.type==='sofa'){actor.position=point(station.seat||o);actor.heading=station.heading??((o.flip?-Math.PI/2:Math.PI/2)+(o.rotation||0)*Math.PI/180);}else{const direction=groundToWorld(o).sub(groundToWorld(actor.position));actor.heading=Math.atan2(direction.x,direction.z);}}
  }
  travel(actor,station,{approachOnly=false}={}){
    if(!approachOnly&&station&&actor.station?.id===station.id)return true;
    if(!station||(!approachOnly&&this.stationOccupied(station,actor)))return false;
    const source=this.safePoint(actor.station?.position||actor.position);if(!source)return false;
    const exitIds=actor.station?.type==='sofa'?[actor.station.objectId]:actor.station?.seatObjectId?[actor.station.seatObjectId]:actor.ignoreIds||[];
    const exit=this.navigation.findLocalPath(actor.position,source,{ignoreIds:exitIds});
    if(!exit.length)return false;
    const path=this.navigation.findPath(source,station.position);if(!path.length)return false;
    const seat=approachOnly?null:station.seat||(station.type==='sofa'?this.room.objects.find(o=>o.id===station.objectId):null);
    const entryIds=approachOnly?[]:station.type==='sofa'?[station.objectId]:station.seatObjectId?[station.seatObjectId]:[];
    const entry=seat?this.navigation.findLocalPath(station.position,seat,{ignoreIds:entryIds}):[];
    if(seat&&!entry.length)return false;
    actor.settlingSeat=null;actor.afterPath=approachOnly?'idle':null;actor.ignoreIds=[...exitIds,...entryIds];actor.station=null;actor.target=approachOnly?null:station;actor.path=[...exit,...path,...entry].map(point);actor.action='walking';actor.age=0;return true;
  }

  setMode(id,mode){
    const actor=this.actors.get(id);if(!actor)return false;const previousMode=actor.mode;actor.mode=mode;actor.age=0;
    if(mode==='seated'||mode==='water'||mode==='resting'){const ok=this.travel(actor,this.stationFor(actor,mode==='seated'?'desk':mode==='water'?'water':'sofa'));if(!ok)actor.mode=previousMode;return ok;}
    if(mode==='walking'){const stations=this.navigation.stations.filter(s=>s.id!==actor.station?.id);for(const station of stations)if(distance(actor.position,station.position)>3&&this.travel(actor,station,{approachOnly:true}))return true;actor.mode=previousMode;return false;}
    if(mode==='idle'||mode==='thinking'){
      const destination=this.safePoint(actor.station?.position||actor.position);
      const ignoreIds=actor.station?.type==='sofa'?[actor.station.objectId]:actor.station?.seatObjectId?[actor.station.seatObjectId]:actor.ignoreIds||[];
      const exit=destination?this.navigation.findLocalPath(actor.position,destination,{ignoreIds}):[];
      if(!exit.length){actor.mode=previousMode;return false;}
      actor.path=exit;actor.action='walking';actor.afterPath=mode;actor.ignoreIds=ignoreIds;actor.station=null;actor.target=null;
    }
    return true;
  }
  interact(objectId,actorId){
    const station=this.navigation.stations.find(s=>s.objectId===objectId&&!this.stationOccupied(s,this.actors.get(actorId)));if(!station)return false;
    const actors=[...this.actors.values()].sort((a,b)=>distance(a.position,station.position)-distance(b.position,station.position));
    const actor=this.actors.get(actorId)||actors[0];if(!actor)return false;const ok=this.travel(actor,station);if(ok)actor.mode=station.type==='desk'?'seated':station.type==='sofa'?'resting':'water';return ok;
  }
  doorControls(){
    return (this.architecture.userData.officeArchitecture.doors||[]).map(door=>{const center=new THREE.Vector3(0,Math.min(.85,door.height*.65),.12);door.group.localToWorld(center);center.project(this.camera);return {...door,x:(center.x+1)*50,y:(1-center.y)*50};});
  }
  isDoorOccupied(id){
    return !!this.room.blueprint&&blueprintDoorOccupied(this.room.blueprintPlan||this.room.blueprint,id,[...this.actors.values()].map(actor=>actor.position));
  }
  startWalkTest(points){
    if(!Array.isArray(points)||points.length<2||points.length>512||points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)))return {ok:false,message:'ต้องมีเส้นทาง 2–512 จุด'};
    for(let i=1;i<points.length;i++)if(!this.navigation.isSegmentWalkable(points[i-1],points[i]))return {ok:false,message:`เดินไม่ได้ระหว่างจุด ${i}–${i+1} · ย้ายจุดให้พ้นกำแพง โต๊ะ หรือพื้นที่ห้ามเดิน`};
    const actor=[...this.actors.values()][0];if(!actor)return {ok:false,message:'ฉากนี้ไม่มีตัวละครสำหรับลองเดิน'};
    // A local probe starts at the first authored vertex; no scene/Agent records change.
    for(const item of this.actors.values()){item.mode='idle';item.path=[];item.station=null;item.target=null;item.afterPath=null;item.ignoreIds=[];item.settlingSeat=null;item.action='idle';}
    actor.position=point(points[0]);actor.path=points.slice(1).map(point);actor.action='walking';actor.mode='test';actor.afterPath='idle';
    this.testWalk={status:'running',actorId:actor.id,total:points.length-1};this.playing=true;this.lastTime=null;
    return {ok:true,message:'กำลังลองเดินตามจุดที่วางไว้ · กดหยุดทดสอบเพื่อกลับไปแก้'};
  }
  step(time,{staticPose=false}={}){
    if(this.disposed)return;const dt=this.lastTime==null?0:Math.max(0,Math.min(.1,time-this.lastTime));this.lastTime=time;
    const result=new Map();
    for(const actor of this.actors.values()){
      if(this.playing&&!staticPose){
        actor.age+=dt;
        if(actor.path.length&&!this.navigation.isSegmentWalkable(actor.position,actor.path[0],{ignoreIds:actor.ignoreIds||[]})){
          const path=this.navigation.findLocalPath(actor.position,actor.path.at(-1),{ignoreIds:actor.ignoreIds||[]});actor.path=path.slice(1);
          if(!actor.path.length){actor.target=null;actor.afterPath=null;actor.settlingSeat=null;actor.action='idle';actor.mode='idle';if(this.testWalk?.actorId===actor.id)this.testWalk.status='blocked';}
        }
        if(actor.path.length){
          const next=actor.path[0],from=groundToWorld(actor.position),to=groundToWorld(next),length=from.distanceTo(to),targetSpeed=Math.min(actor.settlingSeat?.35:.9,Math.sqrt(Math.max(0,length)*2.4)),step=dt*(actor.speed=Math.min(targetSpeed,(actor.speed||0)+dt*1.8));
          if(length<=step+.001){actor.walkDistance=(actor.walkDistance||0)+length;actor.position=point(next);actor.path.shift();if(!actor.path.length&&actor.target){const target=actor.target;actor.target=null;this.arrive(actor,target);}else if(!actor.path.length&&actor.afterPath){actor.action=actor.afterPath;actor.afterPath=null;actor.ignoreIds=[];}}
          else{const targetHeading=actor.settlingSeat?.heading??Math.atan2(to.x-from.x,to.z-from.z),delta=Math.atan2(Math.sin(targetHeading-(actor.heading||0)),Math.cos(targetHeading-(actor.heading||0)));actor.heading=(actor.heading||0)+delta*Math.min(1,dt*8);actor.walkDistance=(actor.walkDistance||0)+step;from.lerp(to,step/length);actor.position=worldToGround(from);}
        }else if(actor.mode==='auto'){
          const status=this.agentStates?.get(actor.id)?.state||'unknown';
          if(status==='idle'){
            const dwell=actor.station?.type==='water'?8:actor.station?.type==='sofa'?45:60+actor.index*12;
            if(actor.age>dwell){
              const type=['water','sofa'].includes(actor.station?.type)?'desk':actor.breakCount%2===1?'sofa':'water';
              if(this.travel(actor,this.stationFor(actor,type))){if(type!=='desk')actor.breakCount=(actor.breakCount||0)+1;}
              actor.age=0;
            }
          }
        }
      }
      if(!actor.path.length)actor.speed=0;
      actor.model.position.copy(groundToWorld(actor.position));
      const contactSeat=actor.station||actor.settlingSeat;
      const seatHeight=contactSeat?.seatHeight!=null?contactSeat.seatHeight/actor.model.scale.x:undefined;
      const targetHeading=actor.heading||0,oldHeading=actor.renderHeading??targetHeading;
      actor.renderHeading=dt&&!staticPose?oldHeading+Math.atan2(Math.sin(targetHeading-oldHeading),Math.cos(targetHeading-oldHeading))*(1-Math.exp(-dt*10)):targetHeading;
      updateCharacter(actor.model,{action:actor.action,time:staticPose?0:time,heading:actor.renderHeading,seatHeight,walkDistance:actor.walkDistance,speed:actor.speed,dt:staticPose?0:dt});
      const visualAction=presentedAction(actor.model,actor.action),bounds=this.bounds(actor.model);result.set(actor.id,{...actor.position,action:visualAction,thought:officeActivityCaption(visualAction,this.agentStates?.get(actor.id)),status:officeAgentState(this.agentStates?.get(actor.id)),bounds});
    }
    if(this.testWalk?.status==='running'&&!this.actors.get(this.testWalk.actorId)?.path.length)this.testWalk.status='completed';
    this.scene.updateMatrixWorld(true);this.draw();if(this.showNavigation)this.updatePaths();return result;
  }
  bounds(model){
    model.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(model),min=new THREE.Vector2(Infinity,Infinity),max=new THREE.Vector2(-Infinity,-Infinity);
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(this.camera);min.min(new THREE.Vector2((p.x+1)*50,(1-p.y)*50));max.max(new THREE.Vector2((p.x+1)*50,(1-p.y)*50));}
    return {left:min.x,top:min.y,width:max.x-min.x,height:max.y-min.y};
  }
  previewMove(id,object){if(this.disposed)return;const model=this.models.get(id);if(!model)return;if(!this.painted&&this.authoredRoom)object=physicalSkeletonRoom({...this.authoredRoom,objects:this.authoredRoom.objects.map(o=>o.id===id?{...o,...object}:o)}).objects.find(o=>o.id===id)||object;const actor=this.actors.get(id);if(actor){actor.position=point(object);model.position.copy(groundToWorld(object));}else{model.position.copy(groundToWorld(object));if(isOfficeSheet(this.authoredRoom)){model.rotation.y=sheetYaw(object);const angle=((Math.round((sheetYaw(object)-(object.kind==='team-sofa'?-Math.PI/2:0))*180/Math.PI)%360)+360)%360;this.skinLayer?.setModelRotation(model,angle);}}this.draw();}
  groundPointAt(x,y){const r=this.root.getBoundingClientRect();if(!r.width||!r.height)return null;this.raycaster.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),this.camera);const p=this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());return p?worldToGround(p):null;}
  pickDoor(x,y){
    const r=this.root.getBoundingClientRect();if(!r.width||!r.height)return null;
    this.raycaster.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),this.camera);
    const hit=this.raycaster.intersectObjects([...this.models.values(),...this.wallMeshes],true)[0];let object=hit?.object;
    while(object){if(object.userData.officeDoorId)return object.userData.officeDoorId;object=object.parent;}return null;
  }
  pick(x,y){
    const r=this.root.getBoundingClientRect();if(!r.width||!r.height)return null;
    this.raycaster.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),this.camera);
    for(const hit of this.raycaster.intersectObjects([...this.models.values(),...this.wallMeshes],true)){
      let object=hit.object;while(object&&!object.userData.officeId&&!object.userData.officeWall)object=object.parent;
      if(object?.userData.officeWall)return null;if(object?.userData.officeId)return object.userData.officeId;
    }return null;
  }
  pickSkeleton(x,y){
    const r=this.root.getBoundingClientRect();if(!r.width||!r.height)return null;this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),this.camera);
    for(const hit of this.raycaster.intersectObjects([...this.models.values(),...this.wallMeshes],true)){let n=hit.object;while(n){if(n.userData.skeletonTarget)return n.userData.skeletonTarget;if(n.userData.wallId)return `wall:${n.userData.wallId}`;n=n.parent;}}return null;
  }
  highlightSkeleton(id){
    if(this.selectionHelper){this.selectionHelper.removeFromParent();this.selectionHelper.geometry.dispose();this.selectionHelper.material.dispose();this.selectionHelper=null;}
    const target=id?.startsWith('object:')?this.models.get(id.slice(7)):this.architecture.userData.officeArchitecture.walls.find(w=>`wall:${w.id}`===id)?.group;
    if(target){target.updateWorldMatrix(true,true);this.selectionHelper=new THREE.BoxHelper(target,0xe8820c);this.scene.add(this.selectionHelper);}this.draw();
  }
  styleSheetSurfaces(){
    const a=this.architecture.userData.officeArchitecture;this.decorateSheet();for(const [zone,mesh]of Object.entries(a.floorMeshes)){mesh.material.color.set({work:'#ddc3a2',lounge:'#f2e5d2',corridor:'#eadfcd',outerBoundary:'#d3bfa0'}[zone]||'#e8dac7');}
    for(const wall of a.walls)wall.group.traverse(n=>{if(n.isMesh)n.castShadow=n.receiveShadow=true;});
  }
  decorateSheet(){
    const key=`${this.architecture.uuid}:${this.room.name}`;if(this.sheetDecorKey===key||!this.win.WebGLRenderingContext)return;this.sheetDecorKey=key;
    if(this.sheetPlaque){this.sheetPlaque.removeFromParent();if(!this.sheetPlaqueOwner?.userData.officeArchitectureDisposed){this.sheetPlaque.geometry.dispose();const oldTexture=this.sheetPlaque.material.map;oldTexture?.dispose();this.sheetPlaqueOwner?.userData.ownedTextures?.delete(oldTexture);this.sheetPlaque.material.dispose();}}
    const data=this.compiledSheet.fixtures[0],canvas=this.doc.createElement('canvas');canvas.width=768;canvas.height=256;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.fillStyle='#fcf3df';ctx.fillRect(0,0,768,256);ctx.strokeStyle='#bc8748';ctx.lineWidth=16;ctx.strokeRect(8,8,752,240);ctx.fillStyle='#344b55';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillText('ZURI OFFICE',384,86);ctx.font='28px sans-serif';ctx.fillText(data.text.slice(0,42),384,160);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshStandardMaterial({map:texture,roughness:.8});this.sheetPlaque=new THREE.Mesh(new THREE.BoxGeometry(...data.dimensions),material);this.sheetPlaque.name=data.id;this.sheetPlaque.position.fromArray(data.position);this.architecture.add(this.sheetPlaque);this.sheetPlaqueOwner=this.architecture;this.architecture.userData.ownedTextures??=new Set();this.architecture.userData.ownedTextures.add(texture);this.sheetLayer?.invalidate();
    const floor=a=>a?.floorMeshes?.work;const work=floor(this.architecture.userData.officeArchitecture);if(work&&!work.material.map){const grain=this.doc.createElement('canvas');grain.width=grain.height=256;const g=grain.getContext('2d');g.fillStyle='#edddc4';g.fillRect(0,0,256,256);for(let i=0;i<32;i++){g.strokeStyle=i%4?'#dfc9a980':'#c5a77d';g.lineWidth=i%4?1:2;g.beginPath();g.moveTo(0,i*8);g.lineTo(256,i*8);g.stroke();}g.strokeStyle='#bda484';for(let row=0;row<4;row++){g.beginPath();g.moveTo(row%2?64:160,row*64);g.lineTo(row%2?64:160,(row+1)*64);g.stroke();}const t=new THREE.CanvasTexture(grain);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(.45,.45);t.colorSpace=THREE.SRGBColorSpace;work.material.map=t;this.architecture.userData.ownedTextures.add(t);work.material.needsUpdate=true;}
  }
  setImageLayerMode(mode){if(!this.sheetLayer)return false;if(this.skinLayer){this.sheetLayer.mode=mode;this.sheetLayer.image.visible=mode!=='structure';this.skinLayer.setVisibility(mode==='structure'?{skin:false,model:false,wireframe:true}:{skin:true,model:true,wireframe:false});}else this.sheetLayer.setMode(mode);return true;}
  setPresentationVisibility(next){if(!this.skinLayer)return false;return this.skinLayer.setVisibility(next);}
  draw(){if(!this.disposed&&!this.unavailable){if(this.skinLayer)this.skinLayer.render();else if(this.sheetLayer)this.sheetLayer.render();else this.renderer.render(this.scene,this.camera);}}
  toggleNavigation(){this.showNavigation=!this.showNavigation;this.navSvg.toggleAttribute('hidden',!this.showNavigation);this.drawNavigation();return this.showNavigation;}
  drawNavigation(){
    if(!this.navigation)return;this.navSvg.replaceChildren();this.navHost=this.doc.createElementNS('http://www.w3.org/2000/svg','g');this.navHost.setAttribute('transform',alignmentSvgTransform(skeletonAlignment(this.room)));this.navSvg.append(this.navHost);const add=(tag,attrs)=>{const el=this.doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,String(v));this.navHost.append(el);return el;};
    for(const zone of this.navigation.zones){const polygon=zone.polygon||zone;add('polygon',{points:polygon.map(p=>Array.isArray(p)?p.join(','):`${p.x},${p.y}`).join(' '),fill:'#69bfa51f',stroke:'#238968','stroke-width':.25});}
    for(const blocker of this.navigation.blockers){const polygon=blocker.polygon;if(polygon)add('polygon',{points:polygon.map(p=>Array.isArray(p)?p.join(','):`${p.x},${p.y}`).join(' '),fill:'#df715a44',stroke:'#b45038','stroke-width':.2});}
    for(const route of this.room?.navigation?.routes||[])add('polyline',{points:route.points.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke:'#2589aa','stroke-width':.5});
    for(const station of this.navigation.stations)add('circle',{cx:station.position.x,cy:station.position.y,r:.7,fill:'#e8ad46',stroke:'#fff','stroke-width':.2});
    this.pathHost=this.doc.createElementNS('http://www.w3.org/2000/svg','g');this.navHost.append(this.pathHost);this.updatePaths();
  }
  updatePaths(){if(!this.pathHost)return;this.pathHost.replaceChildren();for(const actor of this.actors.values())if(actor.path.length){const el=this.doc.createElementNS('http://www.w3.org/2000/svg','polyline');el.setAttribute('points',[actor.position,...actor.path].map(p=>`${p.x},${p.y}`).join(' '));el.setAttribute('fill','none');el.setAttribute('stroke','#e8820c');el.setAttribute('stroke-width','.45');this.pathHost.append(el);}}
  dispose(){
    this.highlightSkeleton(null);this.skinLayer?.dispose();this.sheetLayer?.dispose();this.disposed=true;this.observer?.disconnect();this.renderer.domElement.removeEventListener('webglcontextlost',this.lost);
    for(const model of this.models.values())this.disposeModel(model);
    this.characters.dispose();this.characterNotice.remove();
    if(this.wallMasks)disposePaintedFurniture(this.wallMasks);
    disposeOfficeArchitecture(this.architecture);this.ground.geometry.dispose();this.ground.material.dispose();this.sun.shadow.map?.dispose();this.renderer.dispose();this.renderer.domElement.remove();this.navSvg.remove();
  }
}
