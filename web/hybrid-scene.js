import {OfficeGridEditor} from './office-grid-editor.js';
import {groundToWorld,worldToGround} from './office-projection.js';
import {isOfficeSheet} from './office-scene-sheet.js';
import {skeletonAlignment} from './office-skeleton-alignment.js';
import {backgrounds,catalog,defaultEffects,interactionFor,officeArtSource} from './hybrid-state.js';
import {sampleOfficeActivity,activityNames} from './office-activity.js';
import {HybridOffice3D,isOfficeModel} from './hybrid-office-3d.js';
import {openFloorTasks} from './floor-tasks.js';
import {blueprintPoint,blueprintLayout,blueprintDoorOccupied,officeBlueprints} from './office-blueprints.js';
import {resolveOfficeBlueprint} from './office-blueprint-state.js';
import {usesPaintedSkeleton} from './painted-office-skeleton.js';
import {fallbackOptionalImage} from './optional-assets.js';

// Shared renderer used by editor and applied preview floors.
export class HybridScene{
  constructor(root,{onSelect,onMove,onUse,onActivate,onDoorToggle,paintedArt=false,editable=false,getFloor,getTasks,onOpenWork,onOpenTask,getObjectWorkspace}={}){
    this.root=root;this.editable=editable;this.onSelect=onSelect;this.onMove=onMove;this.onUse=onUse;
    this.onActivate=onActivate;
    this.paintedArt=paintedArt===true;
    this.getFloor=getFloor;this.getTasks=getTasks;this.onOpenWork=onOpenWork;this.onOpenTask=onOpenTask;
    this.getObjectWorkspace=getObjectWorkspace;
    this.onDoorToggle=onDoorToggle;
    root.classList.add('hy-scene');
    root.innerHTML='<img class="hy-background" alt="ฉากสำนักงานวาดแบบ Painted 2.5D" draggable="false"><div class="hy-reference-props" aria-hidden="true"></div><div class="hy-objects"></div><p class="hy-image-error" role="status" hidden>ภาพบางชิ้นโหลดไม่ได้ <button type="button">ลองใหม่</button></p>';
    this.failed=new Set();
    this.alpha=new Map();
    root.querySelector('.hy-image-error button').onclick=()=>root.querySelectorAll('img').forEach(img=>{const src=img.dataset.optionalAssetOriginalSrc||img.getAttribute('src');if(src)img.src=src;});
    this.watch(root.querySelector('.hy-background'));
    this.win=root.ownerDocument.defaultView;this.agentStates=[];this.elapsed=0;this.activityModes=new Map();
    this.motionPreference=this.win?.matchMedia?.('(prefers-reduced-motion: reduce)');
    const hud=root.ownerDocument.createElement('div');hud.className='hy-activity-hud';hud.hidden=true;
    const note=root.ownerDocument.createElement('span');note.textContent='กิจกรรมจำลอง · แตะตัวละครเลือก Action';
    const toggle=root.ownerDocument.createElement('button');toggle.type='button';toggle.className='hy-motion-toggle';toggle.textContent='หยุดกิจกรรม';toggle.setAttribute('aria-pressed','false');
    toggle.onclick=()=>{this.motionPaused=!this.motionPaused;toggle.setAttribute('aria-pressed',String(this.motionPaused));toggle.textContent=this.motionPaused?'เล่นกิจกรรม':'หยุดกิจกรรม';this.syncActivity();};
    hud.append(note,toggle);root.append(hud);
    const nav=root.ownerDocument.createElement('button');nav.type='button';nav.className='hy-nav-toggle';nav.textContent='เส้นทางเดิน';nav.hidden=true;nav.setAttribute('aria-pressed','false');nav.onclick=()=>nav.setAttribute('aria-pressed',String(this.modelLayer?.toggleNavigation()||false));hud.append(nav);
    const sign=root.ownerDocument.createElement('div');sign.className='hy-floor-sign';sign.setAttribute('aria-label','ป้ายชื่อชั้น');sign.hidden=true;root.append(sign);
    const notice=root.ownerDocument.createElement('p');notice.className='hy-render-notice';notice.hidden=true;notice.textContent='3D ไม่พร้อม · กำลังแสดงภาพสำรอง 2D';root.append(notice);
    const doors=root.ownerDocument.createElement('div');doors.className='hy-door-controls';root.append(doors);
    const status=root.ownerDocument.createElement('p');status.className='hy-door-status';status.setAttribute('role','status');status.hidden=true;root.append(status);
    this.doorPointer=e=>{if(this.gridPlacement?.enabled||!this.onDoorToggle||!e.detail&&e.type==='click'||e.target.closest('button:not(.hy-object)'))return;const id=this.modelLayer?.pickDoor(e.clientX,e.clientY);if(id){e.preventDefault();e.stopPropagation();if(e.type==='click')this.toggleDoor(id);}};
    root.addEventListener('pointerdown',this.doorPointer,true);root.addEventListener('click',this.doorPointer,true);
    this.canvasPointerDown=e=>this.handleCanvasPointerDown(e);this.canvasPointerMove=e=>this.handleCanvasPointerMove(e);this.canvasPointerUp=e=>this.handleCanvasPointerUp(e);this.canvasPointerCancel=e=>this.handleCanvasPointerCancel(e);this.canvasPointerLeave=()=>this.clearCanvasHover();
    root.addEventListener('pointerdown',this.canvasPointerDown,true);root.addEventListener('pointermove',this.canvasPointerMove,true);root.addEventListener('pointerup',this.canvasPointerUp,true);root.addEventListener('pointercancel',this.canvasPointerCancel,true);root.addEventListener('lostpointercapture',this.canvasPointerCancel,true);root.addEventListener('pointerleave',this.canvasPointerLeave,true);
    this.contextLost=()=>{this.modelLayer?.dispose();this.modelLayer=null;this.modelUnavailable=true;this.render(this.room,this.selected,this.playing);};root.addEventListener('office-3d-unavailable',this.contextLost);
    this.visibilityChanged=()=>this.syncActivity();root.ownerDocument.addEventListener('visibilitychange',this.visibilityChanged);
    this.preferenceChanged=()=>this.syncActivity();this.motionPreference?.addEventListener?.('change',this.preferenceChanged);
  }
  isCanvasPointer(e){return !!this.modelLayer&&e.target===this.modelLayer.renderer.domElement;}
  handleCanvasPointerDown(e){
    if(!this.isCanvasPointer(e)||e.button!==0||!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return;
    if(this.onDoorToggle&&this.modelLayer.pickDoor(e.clientX,e.clientY))return;
    const target=this.pick(e),current=this.room?.objects.find(object=>object.id===target?.dataset.object);if(!current||this.gridPlacement&&!this.gridPlacement.movable(current))return;
    e.preventDefault();
    if(this.editable&&!this.playing){
      this.onSelect?.(current.id);if(current.locked)return;
      const pointerId=e.pointerId??1;this.drag={id:pointerId,object:current.id,x:e.clientX,y:e.clientY,start:{...current},el:target,capture:e.target,canvas:true};try{e.target.setPointerCapture?.(pointerId);}catch{}
      if(this.gridPlacement?.enabled)e.stopPropagation();return;
    }
    const pointerId=e.pointerId??1;this.canvasTap={id:pointerId,object:current.id,x:e.clientX,y:e.clientY,capture:e.target};try{e.target.setPointerCapture?.(pointerId);}catch{}
  }
  handleCanvasPointerMove(e){
    const drag=this.drag;
    if(drag?.canvas&&drag.id===(e.pointerId??1)){
      const rect=this.root.getBoundingClientRect();if(!rect.width||!rect.height)return;
      const physical=this.modelLayer&&(!this.modelLayer.painted||/^avatar-/.test(drag.start.kind)),factor=physical?skeletonAlignment(this.room).scale:1;
      drag.next={...drag.start,x:Math.max(8,Math.min(92,drag.start.x+(e.clientX-drag.x)/rect.width*100/factor)),y:Math.max(18,Math.min(94,drag.start.y+(e.clientY-drag.y)/rect.height*100/factor))};
      if(this.gridPlacement?.enabled){drag.candidate=this.gridPlacement.preview(drag.object,drag.next);if(drag.candidate.object)this.place(drag.el,drag.candidate.object);}
      else{this.modelLayer?.previewMove(drag.object,drag.next);this.place(drag.el,drag.next);}return;
    }
    if(!this.isCanvasPointer(e))return;
    const target=this.pick(e),id=target?.dataset.object||null;
    if(id===this.canvasHover)return;this.clearCanvasHover();this.canvasHover=id;if(id)target.dataset.pointerHover='true';
  }
  handleCanvasPointerUp(e){
    if(this.drag?.canvas&&this.drag.id===(e.pointerId??1)){
      const drag=this.drag;this.drag=null;try{drag.capture.releasePointerCapture?.(drag.id);}catch{}
      if(drag.next){
        if(this.gridPlacement?.enabled){this.gridPlacement.skipClick=true;if(drag.candidate?.ok)this.onMove?.(drag.object,{x:drag.candidate.object.x,y:drag.candidate.object.y,...(drag.candidate.object.rotation!==undefined?{rotation:drag.candidate.object.rotation}:{})});else{this.gridPlacement.cancel();this.place(drag.el,drag.start);}}
        else this.onMove?.(drag.object,{x:drag.next.x,y:drag.next.y});
      }return;
    }
    const tap=this.canvasTap;if(!tap||tap.id!==(e.pointerId??1))return;this.canvasTap=null;try{tap.capture?.releasePointerCapture?.(tap.id);}catch{}
    if(Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<8)this.activate(tap.object);
  }
  handleCanvasPointerCancel(e){
    if(this.drag?.canvas&&this.drag.id===(e.pointerId??1)){this.cancelDrag();return;}
    if(this.canvasTap?.id===(e.pointerId??1))this.canvasTap=null;
  }
  clearCanvasHover(){if(!this.canvasHover)return;[...this.root.querySelectorAll('[data-object]')].find(el=>el.dataset.object===this.canvasHover)?.removeAttribute('data-pointer-hover');this.canvasHover=null;}
  setAgentStates(values){
    this.agentStates=(Array.isArray(values)?values:[]).filter(v=>v&&typeof v.avatarId==='string').map(v=>({...v}));
    const note=this.root.querySelector('.hy-activity-hud span');if(note)note.textContent=this.agentStates.some(v=>String(v.source).startsWith('synthetic'))?'สถานะ synthetic · กิจกรรมในฉากจำลอง':this.agentStates.some(v=>v.source)?'สถานะจากข้อมูลที่ผูกไว้ · กิจกรรมในฉากจำลอง':'ยังไม่ผูกสถานะ agent · กิจกรรมในฉากจำลอง';
    this.modelLayer?.setAgentStates(this.agentStates);this.paintActivity();
  }
  watch(img){
    img.onerror=()=>{if(this.disposed||!this.root.contains(img))return;this.failed.add(img);fallbackOptionalImage(img);this.root.querySelector('.hy-image-error').hidden=false;};
    img.onload=()=>{
      if(this.disposed||!this.root.contains(img))return;
      if(img.dataset.optionalAssetFallback==='true'&&img.getAttribute('src')!==img.dataset.optionalAssetPlaceholder){delete img.dataset.optionalAssetFallback;delete img.dataset.optionalAssetPlaceholder;delete img.dataset.optionalAssetOriginalSrc;}
      this.failed.delete(img);this.root.querySelector('.hy-image-error').hidden=!this.failed.size;
      if(img.closest('.hy-object')&&!this.alpha.has(img.src)){
        // Low-resolution alpha hit map only; original artwork is never changed.
        try{const c=this.root.ownerDocument.createElement('canvas');c.width=c.height=128;
          const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,128,128);
          this.alpha.set(img.src,ctx.getImageData(0,0,128,128).data);
        }catch{/* Keyboard and layer list remain available if pixel sampling is blocked. */}
      }
    };
  }
  renderDoors(){
    const host=this.root.querySelector('.hy-door-controls');host.replaceChildren();
    if(!this.room.blueprint)return;
    const doors=this.modelLayer?this.modelLayer.doorControls():blueprintLayout(this.room.blueprintPlan||this.room.blueprint).doors.map(d=>({...d,x:(d.start[0]+d.end[0])/2,y:(d.start[1]+d.end[1])/2-5}));
    for(const door of doors){
      const b=this.root.ownerDocument.createElement('button');b.type='button';b.className='hy-door-control';b.dataset.door=door.id;
      b.style.left=`${door.x}%`;b.style.top=`${door.y}%`;b.textContent=door.open?'เปิดอยู่':'ปิดอยู่';b.setAttribute('aria-label',`${door.label} · ${door.open?'เปิดอยู่ · กดเพื่อปิด':'ปิดอยู่ · กดเพื่อเปิด'}`);b.setAttribute('aria-pressed',String(door.open));b.disabled=!this.onDoorToggle;b.onclick=()=>this.toggleDoor(door.id);host.append(b);
    }
  }
  toggleDoor(id){
    if(this.gridPlacement?.enabled)return false;
    if(!this.onDoorToggle)return;
    const door=blueprintLayout(this.room.blueprintPlan||this.room.blueprint).doors.find(d=>d.id===id),status=this.root.querySelector('.hy-door-status');let result;
    const occupied=door?.open&&(this.modelLayer?this.modelLayer.isDoorOccupied(id):blueprintDoorOccupied(this.room.blueprintPlan||this.room.blueprint,id,this.room.objects.filter(o=>o.kind.startsWith('avatar-')||o.kind==='duo')));
    if(occupied)result={ok:false,message:'มีตัวละครอยู่ในช่องประตู · รอให้พ้นก่อนปิด'};
    else result=this.onDoorToggle(id);
    status.hidden=false;status.textContent=result?.message||'เปลี่ยนสถานะประตูแล้ว';
    [...this.root.querySelectorAll('[data-door]')].find(b=>b.dataset.door===id)?.focus({preventScroll:true});return result;
  }
  pick(e,fallback){
    if(!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return fallback;
    if(this.modelLayer&&!this.onActivate){const id=this.modelLayer.pick(e.clientX,e.clientY);if(id)return [...this.root.querySelector('.hy-objects').children].find(el=>el.dataset.object===id);}
    const elements=[...this.root.querySelectorAll('[data-object]')].sort((a,b)=>Number(b.style.zIndex)-Number(a.style.zIndex));
    for(const el of elements){
      if(el.dataset.renderType==='model'&&!this.onActivate)continue;
      const r=el.getBoundingClientRect();if(!r.width||e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)continue;
      const img=el.querySelector('img'),map=this.alpha.get(img.src);
      if(this.onActivate&&!map)continue;
      if(el.dataset.renderType==='sprite'){
        const art=el.querySelector('.hy-sprite-art'),bounds=art.getBoundingClientRect();
        const area=bounds.width?bounds:r;
        if(e.clientX<area.left||e.clientX>area.right||e.clientY<area.top||e.clientY>area.bottom)continue;
        let x=(e.clientX-area.left)/area.width;
        if(art.style.transform.includes('scaleX(-1)'))x=1-x;
        const y=(e.clientY-area.top)/area.height,item=catalog[el.dataset.kind];
        const ax=Math.min(127,Math.floor((item.spriteIndex%4+x)/4*128)),ay=Math.min(127,Math.floor((Math.floor(item.spriteIndex/4)+y)/3*128));
        if(!map||map[(ay*128+ax)*4+3]>24)return el;
        continue;
      }
      let x=(e.clientX-r.left)/r.width;if(img.style.transform)x=1-x;
      const y=(e.clientY-r.top)/r.height;
      if(!map||map[(Math.min(127,Math.floor(y*128))*128+Math.min(127,Math.floor(x*128)))*4+3]>24)return el;
    }
    return null;
  }
  place(el,o){
    if(this.modelLayer&&isOfficeModel(o.kind)&&this.modelLayer.models.has(o.id)){
      this.placeModel(el,this.modelLayer.bounds(this.modelLayer.models.get(o.id)));return;
    }
    el.style.height='';el.style.aspectRatio='';el.style.transform='';
    if(o.kind==='elevator-door'&&this.room?.background==='office'){
      el.style.width='6.6%';el.style.height='19%';el.style.left=`${o.x-3.3}%`;el.style.top=`${o.y-17}%`;el.style.transform='skewY(-28deg)';el.style.zIndex='900';return;
    }
    if(o.kind==='wayfinding-arrow'){el.dataset.interaction=interactionFor(o).type;el.classList.add('hy-wayfinding-arrow');}
    const width=catalog[o.kind].width*o.scale;
    el.style.width=`${width}%`;
    el.style.left=`clamp(${width/2}%, ${o.x}%, ${100-width/2}%)`;
    el.style.top=`${o.y}%`;
    el.style.zIndex=String(Math.round(o.y*10));
    const img=el.querySelector('img'),art=el.querySelector('.hy-sprite-art'),fx={...defaultEffects,...o.effects};
    const target=el.dataset.renderType==='sprite'?art:img;
    img.style.transform=o.flip?'scaleX(-1)':'';
    target.style.opacity=String(fx.opacity);
    target.style.filter=[fx.shadow?`drop-shadow(0 ${fx.shadow/2}px ${fx.shadow}px #263a4050)`:'',fx.glow?'drop-shadow(0 0 8px #e8b962)':''].filter(Boolean).join(' ');
    el.dataset.hover=fx.hover;el.dataset.interaction=interactionFor(o).type;
  }
  placeModel(el,bounds){if(!bounds)return;el.style.left=`${bounds.left}%`;el.style.top=`${bounds.top}%`;el.style.width=`${bounds.width}%`;el.style.height=`${bounds.height}%`;el.style.aspectRatio='auto';el.style.transform='none';el.style.zIndex=String(Math.round((bounds.top+bounds.height)*10));}
  activate(id){
    const o=this.room.objects.find(p=>p.id===id);if(!o)return;
    if(this.onActivate?.(id)===true)return;
    const action=interactionFor(o);
    if(action.type==='tasks'){
      this.taskPopup?.dispose?.();this.taskPopup=openFloorTasks(this.root,{floor:this.getFloor?.()||{key:'',label:this.room.name},getTasks:this.getTasks,onOpenWork:this.onOpenWork,onOpenTask:this.onOpenTask});return;
    }
    if(action.type==='none'&&catalog[o.kind].renderType==='sprite')return this.openActivity(o);
    if(action.type==='none'&&(this.modelLayer?.navigation.stations.some(s=>s.objectId===id)||this.getObjectWorkspace&&['work-desk','task-chair'].includes(o.kind)))return this.openStation(o);
    if(action.type!=='popup'){this.onUse?.(id);return;}
    this.popup?.remove();
    const d=this.root.ownerDocument.createElement('dialog');d.className='hy-interaction-popup';
    const h=this.root.ownerDocument.createElement('h2');h.textContent=action.title||catalog[o.kind].name;
    const p=this.root.ownerDocument.createElement('p');p.textContent=action.body;
    const b=this.root.ownerDocument.createElement('button');b.type='button';b.textContent='ปิด';b.onclick=()=>d.close();
    d.append(h,p,b);this.root.append(d);this.popup=d;d.setAttribute('aria-label',h.textContent);d.showModal();
  }
  openActivity(object){
    this.selectedActor=object.id;
    this.popup?.remove();const doc=this.root.ownerDocument,d=doc.createElement('dialog');d.className='hy-interaction-popup';
    const h=doc.createElement('h2');h.textContent=`${catalog[object.kind].name} · เลือกกิจกรรม`;
    d.append(h);this.appendWorkspaceActions(d,object);
    const p=doc.createElement('p');p.textContent='กิจกรรมภาพจำลองในฉาก ไม่ใช่สถานะหรือคำสั่ง Agent จาก Zuri';d.append(p);
    for(const [mode,name] of Object.entries({...activityNames,...(this.modelLayer?{water:'ดื่มน้ำ',resting:'พักที่โซฟา'}:{})})){
      const b=doc.createElement('button');b.type='button';b.textContent=name;b.disabled=mode==='walking'&&!this.modelLayer;if(b.disabled)b.title='การเดินต้องใช้ฉาก 3D และทางเดินที่ตรวจสอบแล้ว';b.onclick=()=>{if(this.modelLayer&&!this.modelLayer.setMode(object.id,mode)){p.textContent='ยังเดินไปจุดนี้ไม่ได้ · ตรวจพื้นที่เดินหรือสิ่งกีดขวาง';return;}this.activityModes.set(object.id,{mode,at:this.elapsed});this.paintActivity();d.close();};d.append(b);
    }
    const close=doc.createElement('button');close.type='button';close.textContent='ปิด';close.onclick=()=>d.close();d.append(close);
    this.root.append(d);this.popup=d;d.setAttribute('aria-label',h.textContent);d.showModal();
  }
  openStation(object){
    this.popup?.remove();const doc=this.root.ownerDocument,d=doc.createElement('dialog');d.className='hy-interaction-popup';const h=doc.createElement('h2');h.textContent=catalog[object.kind].name;
    d.append(h);this.appendWorkspaceActions(d,object);
    const p=doc.createElement('p');p.textContent='กิจกรรมจำลอง · ตัวละครจะเดินตามทางที่เปิดให้เดินได้';const use=doc.createElement('button');use.type='button';use.dataset.useStation='';use.textContent='ให้ตัวละครมาใช้งาน';use.disabled=!this.modelLayer?.navigation.stations.some(s=>s.objectId===object.id);use.onclick=()=>{if(this.modelLayer?.interact(object.id,this.selectedActor)){this.paintActivity();d.close();}else p.textContent='ยังไม่มีเส้นทางเข้าถึง · ลองย้ายสิ่งกีดขวางใน Design Studio';};const close=doc.createElement('button');close.type='button';close.textContent='ปิด';close.onclick=()=>d.close();d.append(p,use,close);this.root.append(d);this.popup=d;d.setAttribute('aria-label',h.textContent);d.showModal();
  }
  appendWorkspaceActions(dialog,object){
    const context=this.getObjectWorkspace?.(object);if(!context)return;
    const doc=this.root.ownerDocument,section=doc.createElement('section'),heading=doc.createElement('h3'),note=doc.createElement('p');
    section.className='hy-workspace-actions';heading.textContent=context.heading;note.textContent=context.note;section.append(heading,note);
    for(const action of context.actions||[]){const button=doc.createElement('button');button.type='button';button.dataset.workspaceAction='';button.textContent=action.label;button.onclick=()=>{dialog.close();dialog.remove();action.run();};section.append(button);}
    dialog.append(section);
  }
  stopActivity(){if(this.raf!=null)this.win?.cancelAnimationFrame?.(this.raf);this.raf=null;this.lastFrame=null;}
  syncActivity(){
    this.stopActivity();if(this.disposed||!this.room)return;
    this.root.classList.toggle('hy-motion-paused',!!this.motionPaused||this.root.ownerDocument.visibilityState==='hidden');
    const active=(this.playing||this.testing)&&(!this.room.blueprint||!!this.modelLayer)&&this.room.objects.some(o=>catalog[o.kind].renderType==='sprite');
    this.root.querySelector('.hy-activity-hud').hidden=!active;
    this.paintActivity();
    if(!active||this.motionPaused||this.motionPreference?.matches||this.root.ownerDocument.visibilityState==='hidden'||!this.win?.requestAnimationFrame)return;
    const frame=now=>{
      if(this.disposed)return;
      if(this.lastFrame!=null)this.elapsed+=Math.min(100,now-this.lastFrame);this.lastFrame=now;
      this.paintActivity();if(this.testing||this.playing)this.raf=this.win.requestAnimationFrame(frame);
    };
    this.raf=this.win.requestAnimationFrame(frame);
  }
  paintActivity({freeze=false}={}){
    if(!this.room)return;let index=0;
    if(this.modelLayer){
      const poses=this.modelLayer.step(this.elapsed/1000,{staticPose:freeze||(!this.playing&&!this.testing)||!!this.motionPreference?.matches});
      for(const o of this.room.objects){if(!isOfficeModel(o.kind))continue;const el=[...this.root.querySelector('.hy-objects').children].find(el=>el.dataset.object===o.id);if(!el)continue;
        const pose=poses?.get(o.id);this.placeModel(el,pose?.bounds||this.modelLayer.bounds(this.modelLayer.models.get(o.id)));const bubble=el.querySelector('.hy-thought');bubble.hidden=(!this.playing&&!this.testing)||!pose;
        if(pose){el.dataset.activity=pose.action;bubble.textContent=pose.thought;el.setAttribute('aria-label',`${catalog[o.kind].name} · ${pose.thought}`);}
      }
      if(this.testing&&['completed','blocked'].includes(this.modelLayer.testWalk?.status)){const blocked=this.modelLayer.testWalk.status==='blocked';this.testing=false;this.modelLayer.playing=this.playing;this.onTestStatus?.(blocked?'เส้นทางถูกปิดระหว่างทดสอบ · หยุดเดินแล้ว':'เดินครบทุกจุดแล้ว · เส้นทางนี้ผ่านการทดสอบ');this.stopActivity();}
      return;
    }
    for(const o of this.room.objects){
      if(catalog[o.kind].renderType!=='sprite')continue;
      const el=[...this.root.querySelector('.hy-objects').children].find(el=>el.dataset.object===o.id);if(!el)continue;
      const bubble=el.querySelector('.hy-thought'),art=el.querySelector('.hy-sprite-art');
      bubble.hidden=!this.playing;
      if(!this.playing||this.room.blueprint||this.paintedSkeleton){bubble.hidden=true;delete el.dataset.activity;this.avatarArt(art,catalog[o.kind],o.flip);this.place(el,o);continue;}
      const override=this.activityModes.get(o.id),pose=sampleOfficeActivity(this.room,o,index++,override?this.elapsed-override.at:this.elapsed,{reduced:this.motionPreference?.matches,mode:override?.mode==='walking'?'idle':override?.mode||'auto',agentState:this.agentStates.find(v=>v.avatarId===o.id)});
      this.place(el,{...o,...pose});el.dataset.activity=pose.action;
      const caption=pose.thought;if(bubble.textContent!==caption)bubble.textContent=caption;
      el.setAttribute('aria-label',`${catalog[o.kind].name} · ${pose.thought}`);
      this.avatarArt(art,catalog[o.kind],pose.flip,['seated','sitting'].includes(pose.action)?'seated':pose.action==='walking'&&pose.frame?'walk':null);
    }
  }
  startWalkTest(points,onStatus){
    this.stopWalkTest();
    if(!this.modelLayer)return {ok:false,message:'ลองเดินต้องใช้ฉาก Office 3D ที่พร้อมใช้งาน'};
    if(this.motionPreference?.matches)return {ok:false,message:'เปิดโหมดลดการเคลื่อนไหวอยู่ · ตรวจเส้นทางจาก overlay ได้ แต่ไม่เล่นแอนิเมชัน'};
    const result=this.modelLayer.startWalkTest(points);if(!result.ok)return result;
    this.testing=true;this.onTestStatus=onStatus;this.syncActivity();return result;
  }
  stopWalkTest(){
    if(!this.testing&&!this.modelLayer?.testWalk)return;
    this.testing=false;this.onTestStatus=null;this.stopActivity();if(this.room&&this.modelLayer)this.modelLayer.sync(this.room,this.playing);this.syncActivity();
  }
  avatarArt(art,item,flip,pose=null){
    const src=pose?`./assets/office-world/hybrid/characters/avatar-${pose}-12-v1.png`:item.spriteAtlas;
    const img=art.parentElement.querySelector('img'),missing=img.dataset.optionalAssetFallback==='true'&&img.dataset.optionalAssetOriginalSrc===src;
    const image=`url("${missing?img.dataset.optionalAssetPlaceholder:src}")`;if(art.style.backgroundImage!==image)art.style.backgroundImage=image;
    this.setImageSource(img,src);
    art.style.backgroundSize='400% 300%';art.style.backgroundPosition=`${item.spriteIndex%4*100/3}% ${Math.floor(item.spriteIndex/4)*50}%`;
    art.style.transform=`translateX(-50%)${flip?' scaleX(-1)':''}`;
  }
  setImageSource(img,src){
    if(img.dataset.optionalAssetFallback==='true'&&img.dataset.optionalAssetOriginalSrc===src)return;
    if(img.getAttribute('src')!==src)img.src=src;
  }
  setCalibrationView(mode,opacity=.55){
    this.calibrationMode=mode;this.structureView=mode==='overlay'||mode==='structure';
    this.root.dataset.calibrationView=mode||'';this.root.style.setProperty('--skeleton-opacity',String(opacity));
    if(isOfficeSheet(this.room))return this.modelLayer?.setImageLayerMode(mode||'art')||false;
    if(this.room)this.render(this.room,this.selected,false);return !!this.modelLayer;
  }
  renderCalibrationReference(room){
    const host=this.root.querySelector('.hy-reference-props');host.replaceChildren();if(!this.calibrationMode||isOfficeSheet(room))return;
    for(const o of room.objects){if(catalog[o.kind].renderType==='sprite')continue;const img=this.root.ownerDocument.createElement('img');img.alt='';img.draggable=false;this.watch(img);this.setImageSource(img,officeArtSource(room,o.kind));img.style.cssText=`position:absolute;left:${o.x}%;top:${o.y}%;width:${catalog[o.kind].width*o.scale}%;transform:translate(-50%,-90%) ${o.flip?'scaleX(-1)':''};z-index:${Math.round(o.y*10)}`;host.append(img);}
  }
  canInspectStructure(){return isOfficeSheet(this.room)||usesPaintedSkeleton(this.room,this.getFloor?.()?.key);}
  setGridPlacement(enabled){if(enabled&&!isOfficeSheet(this.room))return false;this.cancelDrag();if(!this.gridPlacement)this.gridPlacement=new OfficeGridEditor(this);this.gridPlacement.setEnabled(enabled);return true;}
  setPresentationVisibility(next){return this.modelLayer?.setPresentationVisibility(next)||false;}
  setStructureView(enabled){
    if(isOfficeSheet(this.room)){this.structureView=enabled===true;return this.modelLayer?.setImageLayerMode(enabled?'structure':'art')||false;}
    if(!this.canInspectStructure()||!this.modelLayer||this.modelUnavailable)return false;
    const activity=new Map([...(this.modelLayer.actors||[])].map(([id,{model,authored,...state}])=>[id,state]));
    this.structureView=enabled===true;this.render(this.room,this.selected,this.playing);
    for(const [id,state]of activity){const actor=this.modelLayer?.actors.get(id);if(actor)Object.assign(actor,state);}
    // Repaint hitboxes synchronously even when no animation frame is scheduled.
    if(this.modelLayer)this.modelLayer.lastTime=this.elapsed/1000;
    this.paintActivity({freeze:true});this.modelLayer?.resize?.();return true;
  }
  render(room,selected=null,playing=false){
    if(isOfficeSheet(this.room)!==isOfficeSheet(room)){this.structureView=false;this.calibrationMode=null;this.root.dataset.calibrationView='';}
    const doorStatus=this.root.querySelector('.hy-door-status');doorStatus.hidden=true;doorStatus.textContent='';
    this.testing=false;this.onTestStatus=null;this.room=room;this.selected=selected;this.playing=playing;
    this.root.dataset.unifiedSheet=String(isOfficeSheet(room));this.paintedSkeleton=!isOfficeSheet(room)&&!this.structureView&&(this.paintedArt||usesPaintedSkeleton(room,this.getFloor?.()?.key));
    if(this.modelLayer&&this.modelLayer.painted!==this.paintedSkeleton){this.modelLayer.dispose();this.modelLayer=null;}
    if(room.background!=='office'&&this.modelLayer){this.modelLayer.dispose();this.modelLayer=null;}
    if(room.background==='office'&&!this.modelLayer&&!this.modelUnavailable&&this.win?.WebGLRenderingContext){try{this.modelLayer=new HybridOffice3D(this.root,{painted:this.paintedSkeleton});this.modelLayer.setAgentStates(this.agentStates);}catch{this.modelUnavailable=true;}}
    this.root.dataset.paintedSkeleton=String(this.paintedSkeleton);
    this.root.dataset.architecture=this.modelLayer?'threejs-room':'painted-fallback';
    this.root.dataset.renderer=this.modelLayer?'3d':room.background==='office'?'2d-fallback':'2d';
    this.root.querySelector('.hy-nav-toggle').hidden=!this.modelLayer;
    this.root.querySelector('.hy-render-notice').hidden=room.background!=='office'||!!this.modelLayer;this.root.querySelector('.hy-render-notice').textContent=isOfficeSheet(room)?'ต้องใช้ WebGL เพื่อแสดงฉากจาก Scene Sheet นี้':'3D ไม่พร้อม · กำลังแสดงภาพสำรอง 2D';
    const sign=this.root.querySelector('.hy-floor-sign'),floor=this.getFloor?.();sign.hidden=room.background!=='office';sign.replaceChildren();
    if(room.blueprint){const shape=room.blueprintPlan||room.blueprint,p=blueprintPoint(shape,0,resolveOfficeBlueprint(shape).depth*.42);sign.style.left=`${p.x-4}%`;sign.style.top=`${p.y-11}%`;}else{sign.style.left='';sign.style.top='';}
    if(!sign.hidden){const number=this.root.ownerDocument.createElement('strong');number.textContent=Number.isInteger(floor?.number)?`F${String(floor.number).padStart(2,'0')}`:'OFFICE';const label=this.root.ownerDocument.createElement('span');label.textContent=floor?.label||room.name;sign.append(number,label);}
    this.renderCalibrationReference(room);
    const bg=this.root.querySelector('.hy-background');
    if(isOfficeSheet(room))bg.removeAttribute('src');else this.setImageSource(bg,officeArtSource(room));
    const host=this.root.querySelector('.hy-objects'),keep=new Set(room.objects.map(o=>o.id));
    host.querySelectorAll('[data-object]').forEach(el=>{if(!keep.has(el.dataset.object)){const img=el.querySelector('img');this.failed.delete(img);el.remove();}});
    this.root.querySelector('.hy-image-error').hidden=!this.failed.size;
    for(const o of room.objects){
      let el=[...host.children].find(el=>el.dataset.object===o.id);
      if(!el){
        el=this.root.ownerDocument.createElement('button');el.type='button';el.className='hy-object';el.dataset.object=o.id;
        const img=this.root.ownerDocument.createElement('img');img.draggable=false;img.alt='';this.watch(img);
        const art=this.root.ownerDocument.createElement('span');art.className='hy-sprite-art';art.setAttribute('aria-hidden','true');
        const label=this.root.ownerDocument.createElement('span');label.className='hy-object-label';
        const thought=this.root.ownerDocument.createElement('span');thought.className='hy-thought';thought.hidden=true;
        el.append(img,art,label,thought);host.append(el);
        el.onclick=e=>{
          // Context-owned painted hotspots use image alpha; Studio retains its
          // geometry/depth picker. Transparent foreground art must pass through.
          const target=e.detail?this.pick(e,el):el;if(!target)return;
          this.playing||!this.editable?this.activate(target.dataset.object):this.onSelect?.(target.dataset.object);
        };
        el.onkeydown=e=>{
          const target=this.pick(e,el),current=this.room.objects.find(p=>p.id===target?.dataset.object);
          if(e.key==='Escape')this.cancelDrag();
          if(this.gridPlacement?.enabled&&e.key.toLowerCase()==='r'){e.preventDefault();this.gridPlacement.rotate(current?.id);return;}
          if(this.gridPlacement?.pending&&e.key==='Enter'){e.preventDefault();this.gridPlacement.confirm();return;}
          const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
          if(this.editable&&!this.playing&&current&&!current.locked&&delta){e.preventDefault();if(this.gridPlacement?.enabled){if(!this.gridPlacement.movable(current))return;const local=this.gridPlacement.grid;const w=groundToWorld(current);const step=local.size;const p=worldToGround({x:w.x+delta[0]*step,z:w.z+delta[1]*step});this.gridPlacement.commit(current.id,p);}else this.onMove?.(current.id,{x:current.x+delta[0]*(e.shiftKey?5:1),y:current.y+delta[1]*(e.shiftKey?5:1)});}
        };
        el.onpointerdown=e=>{
          const target=this.pick(e,el),current=this.room.objects.find(p=>p.id===target?.dataset.object);
          if(e.button!==0||!this.editable||this.playing||!current||this.gridPlacement&&!this.gridPlacement.movable(current))return;
          this.onSelect?.(current.id);
          if(current.locked)return;
          this.drag={id:e.pointerId,object:current.id,x:e.clientX,y:e.clientY,start:{...current},el:target,capture:el};
          if(this.gridPlacement?.enabled)e.stopPropagation();el.setPointerCapture?.(e.pointerId);
        };
        el.onpointermove=e=>{
          if(!this.drag||this.drag.id!==e.pointerId)return;
          const r=this.root.getBoundingClientRect();if(!r.width||!r.height)return;
          const d=this.drag,physical=this.modelLayer&&(!this.modelLayer.painted||/^avatar-/.test(d.start.kind)),factor=physical?skeletonAlignment(this.room).scale:1;d.next={...d.start,x:Math.max(8,Math.min(92,d.start.x+(e.clientX-d.x)/r.width*100/factor)),y:Math.max(18,Math.min(94,d.start.y+(e.clientY-d.y)/r.height*100/factor))};if(this.gridPlacement?.enabled){d.candidate=this.gridPlacement.preview(d.object,d.next);if(d.candidate.object)this.place(d.el,d.candidate.object);}else{this.modelLayer?.previewMove(d.object,d.next);this.place(d.el,d.next);}
        };
        el.onpointerup=e=>{
          if(this.drag?.id!==e.pointerId)return;const d=this.drag;this.drag=null;el.releasePointerCapture?.(e.pointerId);
          if(d.next){if(this.gridPlacement?.enabled){this.gridPlacement.skipClick=true;if(d.candidate?.ok)this.onMove?.(d.object,{x:d.candidate.object.x,y:d.candidate.object.y,...(d.candidate.object.rotation!==undefined?{rotation:d.candidate.object.rotation}:{})});else{this.gridPlacement.cancel();this.place(d.el,d.start);}}else this.onMove?.(d.object,{x:d.next.x,y:d.next.y});}
        };
        el.onpointercancel=()=>this.cancelDrag();el.onlostpointercapture=()=>this.cancelDrag();
      }
      el.dataset.kind=o.kind;el.dataset.locked=String(o.locked);
      el.setAttribute('aria-label',`${catalog[o.kind].name}${o.locked?' · ล็อกตำแหน่ง':''}`);
      el.setAttribute('aria-pressed',String(this.editable&&!playing&&selected===o.id));
      el.querySelector('.hy-object-label').textContent=catalog[o.kind].name;
      el.classList.toggle('hy-wayfinding-arrow',o.kind==='wayfinding-arrow');
      const item=catalog[o.kind],img=el.querySelector('img'),art=el.querySelector('.hy-sprite-art');
      const sprite=item.renderType==='sprite'&&item.spriteAtlas&&Number.isInteger(item.spriteIndex);
      el.dataset.renderType=sprite?'sprite':'image';
      if(isOfficeSheet(room)){img.hidden=true;art.hidden=true;art.style.backgroundImage='';img.removeAttribute('src');}
      else if(sprite){
        const column=item.spriteIndex%4,row=Math.floor(item.spriteIndex/4);
        img.hidden=true;art.hidden=false;
        art.style.backgroundImage=`url("${item.spriteAtlas}")`;art.style.backgroundSize='400% 300%';
        art.style.backgroundPosition=`${column*100/3}% ${row*50}%`;art.style.transform=`translateX(-50%)${o.flip?' scaleX(-1)':''}`;
        this.setImageSource(img,item.spriteAtlas);
      }else{
        img.hidden=false;art.hidden=true;art.style.backgroundImage='';art.style.backgroundPosition='';art.style.backgroundSize='';art.style.transform='';
        this.setImageSource(img,officeArtSource(room,o.kind));
      }
      this.place(el,o);
    }
    if(this.modelLayer){this.modelLayer.sync(room,playing);for(const o of room.objects)if(isOfficeModel(o.kind)){const el=[...host.children].find(el=>el.dataset.object===o.id);el.dataset.renderType='model';el.querySelector('img').hidden=true;el.querySelector('.hy-sprite-art').hidden=true;}}
    this.renderDoors();
    if(this.gridPlacement?.enabled){if(isOfficeSheet(room))this.gridPlacement.sync(room);else this.gridPlacement.setEnabled(false);}
    this.root.classList.toggle('hy-playing',playing);
    this.syncActivity();
  }
  cancelDrag(){this.gridPlacement?.cancel();if(!this.drag)return;const d=this.drag;this.drag=null;if(d.capture.hasPointerCapture?.(d.id))d.capture.releasePointerCapture(d.id);this.modelLayer?.previewMove(d.object,d.start);this.place(d.el,d.start);}
  dispose(){this.cancelDrag();this.clearCanvasHover?.();this.gridPlacement?.dispose();this.disposed=true;this.stopActivity();this.modelLayer?.dispose();this.taskPopup?.dispose?.();this.root.removeEventListener('pointerdown',this.doorPointer,true);this.root.removeEventListener('click',this.doorPointer,true);this.root.removeEventListener('pointerdown',this.canvasPointerDown,true);this.root.removeEventListener('pointermove',this.canvasPointerMove,true);this.root.removeEventListener('pointerup',this.canvasPointerUp,true);this.root.removeEventListener('pointercancel',this.canvasPointerCancel,true);this.root.removeEventListener('lostpointercapture',this.canvasPointerCancel,true);this.root.removeEventListener('pointerleave',this.canvasPointerLeave,true);this.root.removeEventListener('office-3d-unavailable',this.contextLost);this.root.ownerDocument.removeEventListener('visibilitychange',this.visibilityChanged);this.motionPreference?.removeEventListener?.('change',this.preferenceChanged);this.popup?.remove();this.root.querySelectorAll('img').forEach(img=>{img.onerror=null;img.onload=null;});this.root.replaceChildren();}
}
