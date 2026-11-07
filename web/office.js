import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {registerNativeInlineBuffers} from './native-gltf.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeAvatar,makeChair,makeDecoration,box,palette} from './models.js';
import {makeTower,FLOOR_HEIGHT} from './tower-model.js';
import {DESKS,defaultNativeRoom,validateNativeRoom,nativeObjects,nativeBounds} from './native-state.js';
import {builtInDecor} from './room-surfaces.js';
import {SurfaceFinish} from './surface-finish.js';
import {translateObjects,objectScale,scaleObjects} from './native-transform.js';
import {PLACEABLE_STUDIO_GLBS,OFFICE_ASSET_BY_ID} from './office-assets.js';

export {DESKS};

export class Office {
  constructor(container,{onSelect,onZoom,labelsRoot,loadingNode,editable=false,loadStudioAssets=false,onObjectSelect,onObjectSelectMany,onObjectMove,onObjectUse,onSurfaceSelect,onObjectResize}={}){
    this.container=container;this.onSelect=onSelect;this.onZoom=onZoom;this.avatars=[];this.labels=[];this.selected=0;this.agents=[];this.labelsVisible=true;
    this.view='floor';this.towerLabels=[];this.disposed=false;this.loaded=false;this.running=true;this.frameId=null;this.loadPromise=null;this.ownedNodes=new Set();this.generatedGeometries=new Set();this.generatedMaterials=new Set();this.generatedTextures=new Set();this.gltfResources=null;
    this.selectionIds=new Set();this.snapGrid=0;this.snapAlign=false;this.onObjectResize=onObjectResize;this.localLabels=labelsRoot;this.loadingNode=loadingNode;this.editable=editable;this.loadStudioAssets=loadStudioAssets;this.onObjectSelect=onObjectSelect;this.onObjectSelectMany=onObjectSelectMany;this.onObjectMove=onObjectMove;this.onObjectUse=onObjectUse;this.onSurfaceSelect=onSurfaceSelect;this.furniture=new Map();this.objectFinishes=new Map();this.decorSources=new Map();this.assetModels=new Map();this.nativeRoom=defaultNativeRoom();
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,150);this.camera.position.set(15,15,19);this.camera.lookAt(0,0,0);
    try{
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;this.ownedNodes.add(this.renderer.domElement);container.prepend(this.renderer.domElement);
    this.onContextLost=e=>{e.preventDefault();if(this.disposed)return;const loading=this.loadingNode||document.querySelector('#scene-loading');if(loading){loading.hidden=false;loading.textContent='การแสดงผล 3D หยุดชั่วคราว กรุณารีเฟรช — ยังดูสถานะได้จากรายชื่อทีม'}};
    this.onPointerDown=e=>{
      if(this.disposed)return;this.down={x:e.clientX,y:e.clientY};
      if(!this.editable||this.playing||this.orbitMode||e.button!==0)return;
      const hit=this.pickFurniture(e);
      if(!hit){
        e.preventDefault?.();e.stopImmediatePropagation?.();const r=this.renderer.domElement.getBoundingClientRect();
        this.marqueeDrag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,left:e.clientX-r.left,top:e.clientY-r.top,rect:r,additive:!!(e.shiftKey||e.ctrlKey||e.metaKey),base:[...this.selectionIds],active:false};
        this.renderer.domElement.setPointerCapture?.(e.pointerId);return;
      }
      e.preventDefault?.();e.stopImmediatePropagation?.();
      this.onObjectSelect?.(hit.id,{additive:!!(e.shiftKey||e.ctrlKey||e.metaKey),preserve:true});
      if(e.shiftKey||e.ctrlKey||e.metaKey)return;
      const o=nativeObjects(this.nativeRoom).find(o=>o.id===hit.id),selected=nativeObjects(this.nativeRoom).filter(p=>this.selectionIds.has(p.id)),lockedGroup=selected.some(p=>p.groupId&&selected.some(q=>q.groupId===p.groupId&&q.locked));if(!o||o.locked||lockedGroup)return;
      const start=this.groundPoint(e);if(!start)return;this.controls.enabled=false;
      this.drag={pointerId:e.pointerId,id:hit.id,start,object:{...o},ids:[...(this.selectionIds.has(hit.id)?this.selectionIds:new Set([hit.id]))]};
      this.renderer.domElement.setPointerCapture?.(e.pointerId);
    };
    this.onPointerMove=e=>{
      const box=this.marqueeDrag;
      if(box?.pointerId===e.pointerId){
        if(!box.active&&Math.hypot(e.clientX-box.x,e.clientY-box.y)>5){box.active=true;this.controls.enabled=false;}
        if(box.active){const r=this.renderer.domElement.getBoundingClientRect();box.endX=e.clientX-r.left;box.endY=e.clientY-r.top;const left=Math.min(box.left,box.endX),top=Math.min(box.top,box.endY),width=Math.abs(box.endX-box.left),height=Math.abs(box.endY-box.top);if(!this.marqueeElement){this.marqueeElement=document.createElement('div');this.marqueeElement.className='ns-selection-marquee';this.container.append(this.marqueeElement);this.ownedNodes.add(this.marqueeElement);}Object.assign(this.marqueeElement.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`});this.marqueeElement.hidden=false;
          const rect={left,top,right:left+width,bottom:top+height},ids=box.additive?new Set(box.base):new Set();
          for(const o of nativeObjects(this.nativeRoom)){const b=this.projectedObjectBounds(o.id);if(b&&b.left<=rect.right&&b.right>=rect.left&&b.top<=rect.bottom&&b.bottom>=rect.top)ids.add(o.id);}
          this.onObjectSelectMany?.([...ids]);
        }
        return;
      }
      if(this.drag?.pointerId!==e.pointerId)return;const p=this.groundPoint(e);if(!p)return;const d=this.drag;
      const items=translateObjects(this.nativeRoom,d.ids,d.id,{x:d.object.x+p.x-d.start.x,z:d.object.z+p.z-d.start.z},{grid:this.snapGrid,align:this.snapAlign});
      const anchor=items.find(o=>o.id===d.id);if(!anchor)return;d.next={x:anchor.x,z:anchor.z};
      for(const o of items)this.furniture.get(o.id)?.position.set(o.x,o.kind==='chair'?.02:0,o.z);
    };
    this.onPointerUp=e=>{if(this.disposed||!this.down||Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>6)return;const r=this.renderer.domElement.getBoundingClientRect();if(!r.width||!r.height)return;this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hits=this.raycaster.intersectObjects(this.scene.children,true);for(const hit of hits){let p=hit.object;while(p){if(this.view==='building'&&p.userData.domainKey){this.onFloor?.(p.userData.domainKey);return}if(this.view!=='building'&&p.userData.slot!==undefined){this.onSelect?.(p.userData.slot);return}p=p.parent}}};
    const legacyPointerUp=this.onPointerUp;
    this.onPointerUp=e=>{
      if(this.disposed)return;
      if(this.marqueeDrag?.pointerId===e.pointerId){const box=this.marqueeDrag;this.marqueeDrag=null;this.controls.enabled=true;if(this.renderer.domElement.hasPointerCapture?.(e.pointerId))this.renderer.domElement.releasePointerCapture(e.pointerId);if(this.marqueeElement)this.marqueeElement.hidden=true;
        if(box.active){this.down=null;return;}const surface=this.pickSurface(e);if(surface)this.onSurfaceSelect?.(surface);else legacyPointerUp(e);this.down=null;return;
      }
      if(this.drag?.pointerId===e.pointerId){const d=this.drag;this.drag=null;this.controls.enabled=true;this.renderer.domElement.releasePointerCapture?.(e.pointerId);this.down=null;if(d.next)this.onObjectMove?.(d.id,d.next);return;}
      if(this.down&&Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)<=6){
        if(this.editable&&!this.playing&&!this.orbitMode)return;
        const hit=this.pickFurniture(e);
        if(hit){if(this.editable&&!this.playing){this.onObjectSelect?.(hit.id);return;}
          const o=nativeObjects(this.nativeRoom).find(o=>o.id===hit.id);
          if(o?.interaction.type!=='none'&&this.onObjectUse){this.onObjectUse(o);return;}
          if(o?.slot===undefined)return;}
      }
      legacyPointerUp(e);
    };
    this.onPointerCancel=()=>this.cancelObjectDrag();
    this.renderer.domElement.addEventListener('webglcontextlost',this.onContextLost);this.renderer.domElement.addEventListener('pointerdown',this.onPointerDown);this.renderer.domElement.addEventListener('pointerup',this.onPointerUp);
    this.renderer.domElement.addEventListener('pointermove',this.onPointerMove);this.renderer.domElement.addEventListener('pointercancel',this.onPointerCancel);this.renderer.domElement.addEventListener('lostpointercapture',this.onPointerCancel);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.minZoom=.65;this.controls.maxZoom=1.8;this.controls.minPolarAngle=.55;this.controls.maxPolarAngle=1.08;this.controls.target.set(0,.2,0);this.onControlsChange=()=>{if(!this.disposed)this.onZoom?.(Math.round(this.camera.zoom*100))};this.controls.addEventListener('change',this.onControlsChange);
    this.scene.add(new THREE.AmbientLight(0xffffff,1.5));const sun=new THREE.DirectionalLight(0xfff9ed,3);sun.position.set(-4,14,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:40});sun.shadow.normalBias=.04;sun.shadow.bias=-.0001;this.scene.add(sun);const fill=new THREE.DirectionalLight(0xd6ecfa,1);fill.position.set(8,6,-5);this.scene.add(fill);this.floor=new THREE.Group();this.scene.add(this.floor);this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.down=null;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.lastFrame=0;this.tick=this.tick.bind(this);this.resize();this.frameId=requestAnimationFrame(this.tick);
    }catch(error){this.dispose();throw error}
  }

  load(){if(this.disposed)return Promise.resolve(false);if(!this.loadPromise)this.loadPromise=this.loadScene();return this.loadPromise}

  async loadScene(){
    const loader=registerNativeInlineBuffers(new GLTFLoader()),names=['room','desk','floor-tile'];
    const [results,studioResults]=await Promise.all([
      Promise.allSettled(names.map(n=>loader.loadAsync(`./assets/models/${n}.gltf`))),
      Promise.allSettled(this.loadStudioAssets?PLACEABLE_STUDIO_GLBS.map(asset=>loader.loadAsync(asset.file)):[]),
    ]);
    const allResults=[...results,...studioResults],assets=allResults.filter(r=>r.status==='fulfilled').map(r=>r.value),resources=this.collectGLTFResources(assets);
    if(this.disposed){this.disposeGLTFResources(resources);return false}
    const failure=results.find(r=>r.status==='rejected');
    if(failure){this.disposeGLTFResources(resources);this.dispose();throw failure.reason}
    this.gltfResources=resources;
    try{
      const [room,desk,tile]=results.map(r=>r.value),labelsRoot=this.localLabels||document.querySelector('#labels');
      if(!labelsRoot)throw new Error('Office labels container is unavailable');
      this.assetModels=new Map(PLACEABLE_STUDIO_GLBS.flatMap((asset,index)=>studioResults[index]?.status==='fulfilled'?[[asset.assetId,studioResults[index].value.scene]]:[]));
      this.labelsRoot=labelsRoot;this.roomAsset=room.scene;this.deskAsset=desk.scene;this.floor.add(room.scene);
      for(let x=-6;x<=6;x+=2)for(let z=-4;z<=4;z+=2){const t=tile.scene.clone(true);t.position.set(x,0,z);this.floor.add(t)}
      this.roomAsset.traverse(n=>{if(builtInDecor.some(d=>d.source===n.userData.surfaceId)){this.decorSources.set(n.userData.surfaceId,n);n.visible=false;}});
      this.surfaceFinish=new SurfaceFinish(this.floor,{exclude:builtInDecor.map(d=>d.source)});
      DESKS.forEach(([x,z],i)=>{const d=desk.scene.clone(true);d.position.set(x,0,z);d.userData.slot=i;d.userData.objectId=`desk-${i}`;this.furniture.set(d.userData.objectId,d);this.floor.add(d);const c=makeChair();c.position.set(x,.02,z+.95);c.userData.slot=i;c.userData.objectId=`chair-${i}`;this.furniture.set(c.userData.objectId,c);this.floor.add(c);this.trackGenerated(c);const label=document.createElement('button');label.className='desk-label';label.addEventListener('click',()=>{if(!this.disposed)this.onSelect?.(i)});labelsRoot.append(label);this.labels.push(label);this.ownedNodes.add(label)});
      this.floor.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});this.addWallSign();const ring=new THREE.Mesh(new THREE.RingGeometry(.5,.54,48),new THREE.MeshBasicMaterial({color:palette.brand,side:THREE.DoubleSide,transparent:true,opacity:.65}));ring.rotation.x=-Math.PI/2;ring.position.y=.012;this.floor.add(ring);this.selectionRing=ring;this.trackGenerated(ring);this.generatedMaterials.add(ring.material);
      const bubble=document.createElement('div');bubble.className='speech-bubble';labelsRoot.append(bubble);this.ownedNodes.add(bubble);this.bubble=bubble;const loading=this.loadingNode||document.querySelector('#scene-loading');if(loading)loading.hidden=true;this.loaded=true;this.setNativeRoom(this.nativeRoom);this.setAgents(this.agents);this.select(this.selected);return true;
    }catch(error){this.dispose();throw error}
  }

  ray(e){
    const r=this.renderer.domElement.getBoundingClientRect();if(!r.width||!r.height)return false;
    this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);return true;
  }
  pickFurniture(e){
    if(this.view==='building'||!this.ray(e))return null;
    for(const hit of this.raycaster.intersectObjects([...this.furniture.values()],true)){let p=hit.object;while(p){if(p.userData.objectId)return {id:p.userData.objectId};p=p.parent;}}
    return null;
  }
  pickSurface(e){
    if(this.view==='building'||!this.ray(e))return null;
    for(const hit of this.raycaster.intersectObjects(this.floor.children,true)){
      let p=hit.object,surface=null,object=false,visible=true;
      while(p){if(!p.visible)visible=false;if(p.userData.objectId)object=true;if(p.userData.surfaceId)surface=p.userData.surfaceId;p=p.parent;}
      if(!visible)continue;if(object)return null;if(surface)return surface;
    }
    return null;
  }
  groundPoint(e){if(!this.ray(e))return null;return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());}
  cancelObjectDrag(){
    this.cancelResize();this.cancelMarquee();if(!this.drag)return;const d=this.drag;this.drag=null;
    for(const o of nativeObjects(this.nativeRoom).filter(o=>(d.ids||[d.id]).includes(o.id)))this.furniture.get(o.id)?.position.set(o.x,o.kind==='chair'?.02:0,o.z);
    if(this.controls)this.controls.enabled=true;
    if(this.renderer.domElement.hasPointerCapture?.(d.pointerId))this.renderer.domElement.releasePointerCapture(d.pointerId);
    this.down=null;
  }
  cancelMarquee(){
    if(!this.marqueeDrag)return;const d=this.marqueeDrag;this.marqueeDrag=null;if(this.marqueeElement)this.marqueeElement.hidden=true;
    if(this.controls)this.controls.enabled=true;if(this.renderer?.domElement?.hasPointerCapture?.(d.pointerId))this.renderer.domElement.releasePointerCapture(d.pointerId);this.down=null;
  }
  projectedObjectBounds(id){
    this.camera.updateMatrixWorld(true);const m=this.furniture.get(id),b=m?.userData.localBounds;if(!m||!b)return null;m.updateMatrixWorld(true);const points=[];
    for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(m.matrixWorld).project(this.camera);if(p.z>=-1&&p.z<=1)points.push([(p.x*.5+.5)*this.width,(-p.y*.5+.5)*this.height]);}
    if(!points.length)return null;const left=Math.min(...points.map(p=>p[0])),top=Math.min(...points.map(p=>p[1]));return {left,top,right:Math.max(...points.map(p=>p[0])),bottom:Math.max(...points.map(p=>p[1]))};
  }
  setNativeRoom(room){
    if(this.disposed)return;
    this.nativeRoom=validateNativeRoom(room||defaultNativeRoom());
    if(!this.loaded)return;
    if(this.view!=='building')this.setProjection(this.nativeRoom.projection||'orthographic');
    this.surfaceFinish?.apply(this.nativeRoom.surfaces||{});
    const current=nativeObjects(this.nativeRoom),objects=new Map(current.map(o=>[o.id,o]));
    for(const [id,m] of this.furniture){
      if(!objects.has(id)||(m.userData.furnitureKind&&m.userData.furnitureKind!==objects.get(id).kind)||(objects.has(id)&&m.userData.source!==objects.get(id).source)||(objects.has(id)&&m.userData.assetId!==objects.get(id).assetId)){
        this.objectFinishes.get(id)?.dispose();this.objectFinishes.delete(id);this.floor.remove(m);this.releaseGenerated(m);this.furniture.delete(id);
      }
    }
    for(const [layerIndex,o]of current.entries()){
      let m=this.furniture.get(o.id);
      if(!m){
        if(o.kind==='room-decor'){
          const source=this.decorSources.get(o.source);if(!source)continue;
          const anchor=builtInDecor.find(d=>d.source===o.source),content=source.clone(true);content.visible=true;content.position.set(-anchor.x,0,-anchor.z);
          m=new THREE.Group();m.add(content);m.userData.source=o.source;
        }else if(o.kind==='asset'){
          const source=OFFICE_ASSET_BY_ID.get(o.assetId),model=this.assetModels.get(o.assetId);
          if(!source||!model)continue;
          m=model.clone(true);
        }else m=o.kind==='desk'?this.deskAsset.clone(true):o.kind==='chair'?makeChair():makeDecoration(o.kind);
        // GLTF resources are shared with other desks and the tower; only generated geometry is owned here.
        if(!['desk','room-decor','asset'].includes(o.kind))this.trackGenerated(m);
        m.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
        m.userData.objectId=o.id;if(o.assetId)m.userData.assetId=o.assetId;else delete m.userData.assetId;if(o.slot!==undefined)m.userData.slot=o.slot;else delete m.userData.slot;
        this.floor.add(m);this.furniture.set(o.id,m);
      }
      if(!this.objectFinishes.has(o.id))this.objectFinishes.set(o.id,new SurfaceFinish(m,{targetId:o.id,materialColors:o.kind==='desk'?['f5efe4','f7f8fa']:o.kind==='chair'?['b1beb9']:undefined}));
      this.objectFinishes.get(o.id).apply(o.finish?{[o.id]:o.finish}:{});
      if(!m.userData.baseSize){
        m.position.set(0,0,0);m.rotation.set(0,0,0);m.scale.set(1,1,1);m.updateMatrixWorld(true);
        const bounds=new THREE.Box3().setFromObject(m);m.userData.baseSize=bounds.getSize(new THREE.Vector3());m.userData.localBounds=bounds.clone();
      }
      const scale=objectScale(o);m.scale.set(scale.x,scale.y,scale.z);
      m.userData.furnitureKind=o.kind;m.userData.assetId=o.assetId;m.position.set(o.x,o.kind==='chair'?.02:0,o.z);m.rotation.set((o.tilt?.x||0)*Math.PI/180,o.rotation*Math.PI/180,(o.tilt?.z||0)*Math.PI/180,'YXZ');
      // Saved layers set the editor stack and transparent draw priority; the depth buffer still occludes real 3D geometry.
      m.traverse(node=>{if(node.isMesh)node.renderOrder=current.length-layerIndex;});
    }
    this.select(this.selected);
  }
  setProjection(mode){
    if((this.camera.isPerspectiveCamera?'perspective':'orthographic')===mode)return;
    const old=this.camera;this.camera=mode==='perspective'?new THREE.PerspectiveCamera(35,1,.1,150):new THREE.OrthographicCamera(-10,10,10,-10,.1,150);
    this.camera.position.copy(old.position);this.camera.quaternion.copy(old.quaternion);this.camera.zoom=old.zoom;
    this.controls.object=this.camera;this.resize();this.controls.update();
  }
  objectDimensions(id){const m=this.furniture.get(id);if(!m?.userData.baseSize)return null;return {base:m.userData.baseSize.clone(),size:m.userData.baseSize.clone().multiply(m.scale)};}
  projectedSelection(){
    this.camera.updateMatrixWorld();const points=[];
    for(const id of this.selectionIds){const m=this.furniture.get(id),b=m?.userData.localBounds;if(!b)continue;m.updateMatrixWorld(true);
      for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
        const p=new THREE.Vector3(x,y,z).applyMatrix4(m.matrixWorld).project(this.camera);points.push([(p.x*.5+.5)*this.width,(-p.y*.5+.5)*this.height]);
      }
    }
    if(!points.length)return null;const x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1]));
    return {x,y,width:Math.max(...points.map(p=>p[0]))-x,height:Math.max(...points.map(p=>p[1]))-y};
  }
  updateEditOverlay(){
    if(!this.editable)return;
    if(this.gridStep!==this.snapGrid){
      if(this.editGrid){this.floor.remove(this.editGrid);this.editGrid.geometry.dispose();this.editGrid.material.dispose();this.generatedGeometries.delete(this.editGrid.geometry);this.generatedMaterials.delete(this.editGrid.material);}
      this.gridStep=this.snapGrid;this.editGrid=null;
      if(this.snapGrid){const lines=[];
        for(let i=-Math.round(7/this.snapGrid);i<=Math.round(7/this.snapGrid);i++){const x=i*this.snapGrid;lines.push(x,.018,-5,x,.018,5);}
        for(let i=-Math.round(5/this.snapGrid);i<=Math.round(5/this.snapGrid);i++){const z=i*this.snapGrid;lines.push(-7,.018,z,7,.018,z);}
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
        this.editGrid=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xc6a052,transparent:true,opacity:.23}));this.floor.add(this.editGrid);this.generatedGeometries.add(geometry);this.generatedMaterials.add(this.editGrid.material);
      }
    }
    if(this.editGrid)this.editGrid.visible=!this.playing;
    if(!this.editOverlay){
      const el=document.createElement('div');el.className='ns-selection-box';el.innerHTML='<span></span><button type="button" aria-label="ลากเพื่อปรับขนาดตามมุมกล้อง">↘</button>';this.container.append(el);this.ownedNodes.add(el);this.editOverlay=el;
      const handle=el.querySelector('button');
      handle.onpointerdown=e=>{e.preventDefault();e.stopPropagation();if(this.playing||nativeObjects(this.nativeRoom).some(o=>this.selectionIds.has(o.id)&&o.locked))return;const box=this.projectedSelection();if(!box)return;this.controls.enabled=false;this.resizeDrag={id:e.pointerId,x:e.clientX,y:e.clientY,box,factor:1,ids:[...this.selectionIds]};handle.setPointerCapture(e.pointerId);};
      handle.onpointermove=e=>{const d=this.resizeDrag;if(d?.id!==e.pointerId)return;const items=nativeObjects(this.nativeRoom).filter(o=>d.ids.includes(o.id));
        const requested=1+((e.clientX-d.x)*d.box.width+(e.clientY-d.y)*d.box.height)/(d.box.width*d.box.width+d.box.height*d.box.height);
        const scales=items.flatMap(o=>Object.values(objectScale(o)));d.factor=Math.max(.1/Math.min(...scales),Math.min(4/Math.max(...scales),requested));
        for(const o of scaleObjects(items,d.factor)){const mesh=this.furniture.get(o.id);mesh?.scale.set(o.scale.x,o.scale.y,o.scale.z);mesh?.position.set(o.x,o.kind==='chair'?.02:0,o.z);}
      };
      handle.onpointerup=e=>{const d=this.resizeDrag;if(!d)return;this.resizeDrag=null;this.controls.enabled=true;handle.releasePointerCapture(e.pointerId);this.onObjectResize?.(d.ids,d.factor);};
      handle.onpointercancel=()=>this.cancelResize();handle.onlostpointercapture=()=>this.cancelResize();
    }
    const b=this.projectedSelection();this.editOverlay.hidden=this.playing||this.view==='building'||!b;
    this.editOverlay.querySelector('button').disabled=this.playing||nativeObjects(this.nativeRoom).some(o=>this.selectionIds.has(o.id)&&o.locked);
    if(b){Object.assign(this.editOverlay.style,{left:`${b.x}px`,top:`${b.y}px`,width:`${b.width}px`,height:`${b.height}px`});this.editOverlay.querySelector('span').textContent=`${Math.round(b.width)} × ${Math.round(b.height)} px บนจอ · ${this.selectionIds.size} ชิ้น`;}
  }
  cancelResize(){if(!this.resizeDrag)return;this.resizeDrag=null;this.controls.enabled=true;this.setNativeRoom(this.nativeRoom);}
  snapshotNativeRoom(){
    const decor=this.nativeRoom.decor?.map(o=>{const m=this.furniture.get(o.id);return m?{...o,x:m.position.x,z:m.position.z,rotation:Math.round(m.rotation.y*180/Math.PI*100)/100}:o;});
    return validateNativeRoom({...this.nativeRoom,...(decor?{decor}:{}),objects:this.nativeRoom.objects.map(o=>{const m=this.furniture.get(o.id);return m?{...o,x:m.position.x,z:m.position.z,rotation:Math.round(m.rotation.y*180/Math.PI*100)/100}:o;})});
  }
  seatPosition(i){const c=this.furniture.get(`chair-${i}`);return c?[c.position.x,c.position.z-.95]:DESKS[i]||[0,0];}

  showBuilding(domains,onFloor){
    if(this.disposed||!this.loaded)return;
    this.onFloor=onFloor;
    if(!this.tower){
      // The overview's shared template must never capture one floor's temporary finish materials.
      this.surfaceFinish?.reset();for(const source of this.decorSources.values())source.visible=true;
      try{this.tower=makeTower(this.roomAsset,this.deskAsset,domains);}
      finally{for(const source of this.decorSources.values())source.visible=false;this.surfaceFinish?.apply(this.nativeRoom.surfaces||{});}
      this.scene.add(this.tower.building);
      for(const geometry of this.tower.geometries)this.generatedGeometries.add(geometry);
      for(const material of this.tower.materials)this.generatedMaterials.add(material);
      for(const domain of domains){const label=document.createElement('button');label.className='tower-marker';label.textContent=String(domain.number).padStart(2,'0');label.setAttribute('aria-label',`เข้าชั้น ${domain.number} ${domain.label}`);label.style.setProperty('--floor-color',domain.color);label.onclick=()=>this.onFloor?.(domain.key);this.labelsRoot.append(label);this.ownedNodes.add(label);this.towerLabels.push({label,domain});}
    }
    this.view='building';this.floor.visible=false;this.tower.building.visible=true;
    this.avatars.forEach(avatar=>avatar.visible=false);this.labels.forEach(label=>label.hidden=true);this.bubble.hidden=true;
    this.camera.position.set(28,24,54);this.controls.target.set(0,16,0);this.camera.zoom=1;
    this.controls.minPolarAngle=1.1;this.controls.maxPolarAngle=1.48;
    this.resize();this.controls.update();
  }

  highlightFloor(key){
    if(!this.tower)return;
    for(const {domain,group,material} of this.tower.floors){const selected=domain.key===key;group.position.x=selected?.75:0;material.emissive.set(selected?domain.color:'#000000');material.emissiveIntensity=selected?.24:0;}
    this.towerLabels.forEach(({label,domain})=>label.classList.toggle('selected',domain.key===key));
  }

  showDomain(domain,agents){
    if(this.disposed||!this.loaded)return;
    const changed=this.view!=='floor'||this.domainKey!==domain.key;
    this.view='floor';this.domainKey=domain.key;this.floor.visible=true;if(this.tower)this.tower.building.visible=false;
    this.towerLabels.forEach(({label})=>label.hidden=true);
    this.controls.minPolarAngle=.55;this.controls.maxPolarAngle=1.08;
    if(changed){this.camera.position.set(15,15,19);this.controls.target.set(0,.2,0);this.camera.zoom=1;this.resize();this.controls.update();
      const c=this.signCanvas.getContext('2d');c.fillStyle='#e9ebe6';c.fillRect(0,0,768,180);c.fillStyle='#1F2937';c.font='800 42px Manrope';c.fillText(domain.label.toUpperCase(),30,85,710);c.fillStyle=domain.color;c.fillRect(30,112,45,8);c.fillStyle='#6B7280';c.font='20px Manrope';c.fillText(`FLOOR ${String(domain.number).padStart(2,'0')} / ZURI OFFICE`,95,130);this.signTexture.needsUpdate=true;
    }
    this.setAgents(agents);
  }

  collectGLTFResources(assets){
    const resources={geometries:new Set(),materials:new Set(),textures:new Set()};
    for(const asset of assets)asset.scene?.traverse(node=>{if(node.geometry)resources.geometries.add(node.geometry);for(const material of (Array.isArray(node.material)?node.material:[node.material]))if(material){resources.materials.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.textures.add(value)}});
    return resources;
  }

  disposeGLTFResources(resources){if(!resources)return;for(const geometry of resources.geometries)geometry.dispose();for(const material of resources.materials)material.dispose();for(const texture of resources.textures)texture.dispose();resources.geometries.clear();resources.materials.clear();resources.textures.clear()}

  trackGenerated(root){root.traverse(node=>{if(node.geometry)this.generatedGeometries.add(node.geometry)})}

  releaseGenerated(root){const geometries=new Set();root.traverse(node=>{if(node.geometry&&this.generatedGeometries.delete(node.geometry))geometries.add(node.geometry)});for(const geometry of geometries)geometry.dispose()}

  addWallSign(){
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=180;const c=canvas.getContext('2d');c.fillStyle='#e9ebe6';c.fillRect(0,0,768,180);c.fillStyle='#1F2937';c.font='800 53px Manrope';c.fillText('M A R K E T I N G  &  C R M',30,90);c.fillStyle='#6B7280';c.font='18px Mono';c.fillText('SPACE TO THINK. ROOM TO BUILD.',34,137);c.fillStyle='#E8820C';c.fillRect(711,32,17,17);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(4,.94),new THREE.MeshBasicMaterial({map:texture}));sign.position.set(-.1,3.35,-5.03);this.signCanvas=canvas;this.signTexture=texture;this.floor.add(sign);this.trackGenerated(sign);this.generatedMaterials.add(sign.material);this.generatedTextures.add(texture);const plaque=box(this.floor,4.2,1.09,.13,-.1,3.35,-5.13,'#e9ebe6');this.trackGenerated(plaque);
  }

  resize(){if(this.disposed)return;const {width:w,height:h}=this.container.getBoundingClientRect();if(!w||!h)return;this.width=w;this.height=h;this.renderer.setSize(w,h);const aspect=w/h;const half=this.view==='building'?Math.max(22,11.5/aspect):Math.max(7.5,11.2/aspect);if(this.camera.isPerspectiveCamera){this.camera.aspect=aspect;this.camera.fov=2*Math.atan(half/this.camera.position.distanceTo(this.controls.target))*180/Math.PI;}else{this.camera.left=-half*aspect;this.camera.right=half*aspect;this.camera.top=half;this.camera.bottom=-half;}this.camera.updateProjectionMatrix()}

  setAgents(agents){if(this.disposed)return;this.agents=agents;if(!this.loaded)return;this.labels.forEach((label,i)=>label.hidden=i>=agents.length);this.avatars.forEach((avatar,i)=>avatar.visible=i<agents.length&&!!agents[i]?.id);agents.forEach((a,i)=>{const key=JSON.stringify(a.avatar);if(!this.avatars[i]||this.avatars[i].userData.avatarKey!==key){if(this.avatars[i]){const previous=this.avatars[i];this.scene.remove(previous);this.releaseGenerated(previous)}const model=makeAvatar(a.avatar);model.userData.avatarKey=key;model.userData.slot=i;model.scale.setScalar(.96);this.scene.add(model);this.avatars[i]=model;this.trackGenerated(model)}const label=this.labels[i];if(!label)return;label.replaceChildren();const dot=document.createElement('span');dot.className=`status-dot ${a.status}`;const name=document.createElement('span');name.className='name';name.textContent=a.name;label.append(dot,name);label.title=`โต๊ะ ${i+1}: ${a.name}`;if(this.avatars[i])this.avatars[i].visible=!!a.id});this.select(this.selected)}

  select(i){if(this.disposed)return;this.selected=i;this.labels.forEach((l,j)=>l.classList.toggle('selected',i===j));if(this.selectionRing&&DESKS[i]){const [x,z]=this.seatPosition(i);this.selectionRing.position.set(x,.02,z+1.04)}if(this.bubble&&this.agents[i]){const a=this.agents[i];this.bubble.replaceChildren();const small=document.createElement('small');small.textContent=a.name.toUpperCase();const text=document.createElement('span');text.textContent=(a.lastLog||'พร้อมสำหรับงานถัดไป').slice(0,88);this.bubble.append(small,text)}}

  control(action){if(this.disposed)return;if(action==='reset'){this.camera.position.set(15,15,19);this.camera.zoom=1;this.controls.target.set(0,.2,0);if(this.view==='building'){this.camera.position.set(28,24,54);this.controls.target.set(0,16,0)}}else if(action==='in'||action==='out'){this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom+(action==='in'?.15:-.15),.65,1.8)}else{const v=this.camera.position.clone().sub(this.controls.target);v.applyAxisAngle(new THREE.Vector3(0,1,0),action==='rotate-left'?.3:-.3);this.camera.position.copy(this.controls.target).add(v)}this.camera.updateProjectionMatrix();this.controls.update();this.onZoom?.(Math.round(this.camera.zoom*100))}

  toggleLabels(){if(this.disposed)return false;this.labelsVisible=!this.labelsVisible;return this.labelsVisible}

  project(x,y,z){const v=new THREE.Vector3(x,y,z).project(this.camera);return [(v.x*.5+.5)*this.width,(-v.y*.5+.5)*this.height]}

  tick(ms){this.frameId=null;if(this.disposed)return;this.frameId=requestAnimationFrame(this.tick);if(document.hidden||this.suspended||ms-this.lastFrame<32)return;this.lastFrame=ms;const t=this.reduced?0:ms/1000;this.controls.update();this.updateEditOverlay();if(this.view==='building'){this.towerLabels.forEach(({label,domain})=>{const p=this.project(7.5,(domain.number-1)*FLOOR_HEIGHT+.8,3);label.style.left=`${p[0]}px`;label.style.top=`${p[1]}px`;label.hidden=!this.labelsVisible});this.renderer.render(this.scene,this.camera);return}this.avatars.forEach((a,i)=>{const agent=this.agents[i];if(!agent)return;const [x,z]=this.seatPosition(i);const u=a.userData;const active=agent.status==='working';const stuck=agent.status==='stuck';const done=agent.status==='done';a.position.set(x,0,z+1.04);a.rotation.y=Math.PI;u.body.position.y=0;u.leftLeg.rotation.x=0;u.rightLeg.rotation.x=0;u.leftArm.rotation.set(0,0,0);u.rightArm.rotation.set(0,0,0);if(stuck){a.position.x=x+.7+Math.sin(t*.8+i)*.42;a.position.z=z+1.8;a.rotation.y=Math.cos(t*.8+i)>0?Math.PI/2:-Math.PI/2;u.leftLeg.rotation.x=Math.sin(t*5)*.28;u.rightLeg.rotation.x=-Math.sin(t*5)*.28;u.leftArm.rotation.x=-Math.sin(t*5)*.2;u.rightArm.rotation.x=Math.sin(t*5)*.2}else if(done){a.position.x=x+.87;a.position.z=z+1.04;a.rotation.y=.4;u.rightArm.rotation.z=-2.4+Math.sin(t*4)*.22;u.head.rotation.z=Math.sin(t*2)*.04}else if(this.furniture.has(`chair-${i}`)){a.position.y=.05;u.leftLeg.rotation.x=-1.25;u.rightLeg.rotation.x=-1.25;u.body.position.y=-.12;u.head.rotation.x=active?.10:Math.sin(t*.65+i)*.07;u.leftArm.rotation.x=active?-1.12+Math.sin(t*13+i)*.10:-.4;u.rightArm.rotation.x=active?-1.12+Math.cos(t*13+i)*.10:-.4}a.rotation.y+=(this.furniture.get(`chair-${i}`)?.rotation.y||0);const p=this.project(x,0,z+1.6);const l=this.labels[i];if(!l)return;l.style.left=`${p[0]}px`;l.style.top=`${p[1]}px`;l.hidden=!this.labelsVisible||p[0]<10||p[0]>this.width-10});if(this.bubble&&this.avatars[this.selected]){const a=this.avatars[this.selected];const p=this.project(a.position.x,a.position.y+2.45,a.position.z);this.bubble.style.left=`${THREE.MathUtils.clamp(p[0],100,this.width-100)}px`;this.bubble.style.top=`${Math.max(125,p[1])}px`;this.bubble.hidden=!this.labelsVisible||!this.agents[this.selected]?.id}this.renderer.render(this.scene,this.camera)}

  dispose(){
    if(this.disposed)return;this.cancelObjectDrag();this.disposed=true;this.running=false;
    if(this.frameId!==null){cancelAnimationFrame(this.frameId);this.frameId=null}
    this.resizeObserver?.disconnect();this.renderer?.domElement?.removeEventListener('webglcontextlost',this.onContextLost);this.renderer?.domElement?.removeEventListener('pointerdown',this.onPointerDown);this.renderer?.domElement?.removeEventListener('pointerup',this.onPointerUp);this.renderer?.domElement?.removeEventListener('pointermove',this.onPointerMove);this.renderer?.domElement?.removeEventListener('pointercancel',this.onPointerCancel);this.renderer?.domElement?.removeEventListener('lostpointercapture',this.onPointerCancel);this.controls?.removeEventListener('change',this.onControlsChange);this.controls?.dispose();
    if(this.floor)this.scene?.remove(this.floor);if(this.tower)this.scene?.remove(this.tower.building);for(const avatar of this.avatars)this.scene?.remove(avatar);
    for(const node of this.ownedNodes)node.parentNode?.removeChild(node);this.ownedNodes.clear();
    for(const geometry of this.generatedGeometries)geometry.dispose();this.generatedGeometries.clear();for(const material of this.generatedMaterials)material.dispose();this.generatedMaterials.clear();for(const texture of this.generatedTextures)texture.dispose();this.generatedTextures.clear();
    for(const finish of this.objectFinishes.values())finish.dispose();this.objectFinishes.clear();
    this.surfaceFinish?.dispose();this.disposeGLTFResources(this.gltfResources);this.gltfResources=null;this.labels=[];this.avatars=[];this.bubble=null;this.loaded=false;this.renderer?.dispose();
  }
}

export function avatarPreview(container,options){const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(32,container.clientWidth/container.clientHeight,.1,30);camera.position.set(2.2,1.75,4.9);camera.lookAt(0,.95,0);const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(container.clientWidth,container.clientHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.4;container.replaceChildren(renderer.domElement);scene.add(new THREE.AmbientLight(0xffffff,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,4,4);scene.add(light);let model;let stopped=false;const update=o=>{if(model){scene.remove(model);model.traverse(m=>m.geometry?.dispose())}model=makeAvatar(o);scene.add(model)};update(options);const render=()=>{if(stopped)return;renderer.render(scene,camera);requestAnimationFrame(render)};render();return{update,dispose(){stopped=true;renderer.dispose();model.traverse(m=>m.geometry?.dispose());container.replaceChildren()}}}
