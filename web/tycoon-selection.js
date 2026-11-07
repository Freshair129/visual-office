import * as THREE from 'three';
export function projectedBounds(model,camera,viewport){
 const box=new THREE.Box3().setFromObject(model),points=[];if(box.isEmpty())return null;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);points.push({x:(p.x+1)*viewport.width/2,y:(1-p.y)*viewport.height/2});}
 return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
}
export function marqueeSelection(models,camera,viewport,a,b,allowed){
 const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y),ids=new Set(allowed);
 return models.filter(m=>{if(!ids.has(m.userData.instanceId))return false;const r=projectedBounds(m,camera,viewport);return r&&r.right>=left&&r.left<=right&&r.bottom>=top&&r.top<=bottom;}).map(m=>m.userData.instanceId);
}
// Scene-owned transient input/selection. Drag preview changes meshes only; release commits once.
export class TycoonSelection{
 constructor(scene,{onSelection,onMove}){this.scene=scene;this.onSelection=onSelection;this.onMove=onMove;this.mode='select';this.ids=[];this.helpers=[];this.rect=document.createElement('div');this.rect.className='tycoon-marquee';this.rect.hidden=true;scene.root.append(this.rect);const canvas=scene.renderer.domElement;canvas.tabIndex=0;this.key=e=>{if(e.key==='Escape'){this.cancel();e.preventDefault();}else if(this.mode==='move'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();scene.stopTest?.();const step=e.shiftKey?1:.1;this.onMove({dx:e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dz:e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0});}};canvas.addEventListener('keydown',this.key);}
 set(mode,ids){this.cancel();this.mode=mode;this.ids=[...ids];this.highlight();}
 highlight(){for(const h of this.helpers){this.scene.scene.remove(h);h.geometry.dispose();h.material.dispose();}this.helpers=[];for(const m of this.scene.assembly.owned)if(this.ids.includes(m.userData.instanceId)){const h=new THREE.BoxHelper(m,0xe8820c);h.material.depthTest=true;this.scene.scene.add(h);this.helpers.push(h);}}
 local(e){const r=this.scene.renderer.domElement.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
 ground(e){const scene=this.scene,r=scene.renderer.domElement.getBoundingClientRect();scene.pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);scene.ray.setFromCamera(scene.pointer,scene.camera);return scene.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());}
 pick(e){this.ground(e);const s=this.scene,allowed=new Set(s.room?.objects.map(o=>o.id));const hit=s.ray.intersectObjects(s.stage.children,true)[0];let node=hit?.object;while(node&&!node.userData.instanceId)node=node.parent;return allowed.has(node?.userData.instanceId)?node.userData.instanceId:null;}
 down(e){if(this.mode==='pan'||e.button!==0||!this.scene.ready)return false;this.scene.stopTest?.();this.scene.renderer.domElement.focus();const start=this.local(e),id=this.pick(e);if(this.mode==='move'&&id&&!this.ids.includes(id))this.onSelection([id],false);const origin=this.ground(e);this.active={start,id,origin,add:e.shiftKey||e.ctrlKey||e.metaKey,positions:this.scene.assembly.owned.filter(m=>this.ids.includes(m.userData.instanceId)).map(m=>[m,m.position.clone()])};this.scene.renderer.domElement.setPointerCapture?.(e.pointerId);return true;}
 move(e){if(!this.active)return false;const a=this.active,p=this.local(e);a.moved ||= Math.hypot(p.x-a.start.x,p.y-a.start.y)>5;if(!a.moved)return true;
  if(this.mode==='select'){Object.assign(this.rect.style,{left:Math.min(a.start.x,p.x)+'px',top:Math.min(a.start.y,p.y)+'px',width:Math.abs(p.x-a.start.x)+'px',height:Math.abs(p.y-a.start.y)+'px'});this.rect.hidden=false;}
  else if(a.id&&a.origin){const point=this.ground(e);if(point){a.delta={dx:point.x-a.origin.x,dz:point.z-a.origin.z};for(const [m,position]of a.positions)m.position.copy(position).add(new THREE.Vector3(a.delta.dx,0,a.delta.dz));this.helpers.forEach(h=>h.update());}}return true;
 }
 up(e){if(!this.active)return false;const a=this.active,p=this.local(e);this.cancel();if(this.mode==='select'&&a.moved){const r=this.scene.renderer.domElement.getBoundingClientRect();this.onSelection(marqueeSelection(this.scene.assembly.owned,this.scene.camera,r,a.start,p,this.scene.room.objects.map(o=>o.id)),a.add);}
  else if(this.mode==='move'&&a.moved&&a.delta)this.onMove(a.delta);
  else this.onSelection(a.id?[a.id]:[],a.add);return true;
 }
 cancel(){if(this.active){for(const [m,p]of this.active.positions)m.position.copy(p);this.active=null;this.helpers.forEach(h=>h.update());}this.rect.hidden=true;}
 dispose(){this.scene.renderer.domElement.removeEventListener('keydown',this.key);this.cancel();this.ids=[];this.highlight();this.rect.remove();}
}
