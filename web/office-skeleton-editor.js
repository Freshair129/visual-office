import {skeletonTargets,pieceAlignment} from './office-skeleton-parts.js';
import {skeletonAlignment,validateSkeletonAlignment,defaultSkeletonAlignment,ALIGNMENT_REFERENCE} from './office-skeleton-alignment.js';

// Transient authoring state; only onCommit enters the existing floor history.
export class SkeletonAlignmentEditor{
 constructor(host,{stage,getRoom,onPreview,onCommit,onView,onPartCommit,onArtChange,onPick,onSelectTarget}){
  Object.assign(this,{host,stage,getRoom,onPreview,onCommit,onView,onPartCommit,onArtChange,onPick,onSelectTarget});
  host.innerHTML=`<button type="button" class="hy-dev-toggle" aria-pressed="false">Dev · ปรับแนวโครง 3D</button><div class="hy-dev-body" hidden><p>เลือกปรับโครงทั้งชุดหรือรายชิ้นเทียบภาพเดิม · X/Y เป็น px อ้างอิงภาพ 1536 × 1024 · ภาพและข้อมูล agent คงเดิม</p><div class="hy-dev-fields"><label>ชุดภาพอ้างอิง<select class="hy-dev-art"><option value="legacy-v4">ภาพเดิม v4</option><option value="perspective-v5">ภาพมุมกล้องใหม่ v5</option></select></label><label>โครงที่กำลังแก้<select class="hy-dev-target"><option value="all">โครงทั้งหมด</option></select></label><label><input class="hy-dev-pick" type="checkbox">เลือกชิ้นจากฉาก</label><label>มุมมอง<select class="hy-dev-view"><option value="overlay">ซ้อนเทียบ</option><option value="structure">โครง 3D</option><option value="art">ภาพเดิม</option></select></label><label>X (px)<input class="hy-dev-x" type="number" min="-400" max="400" step="0.01"></label><label>Y (px)<input class="hy-dev-y" type="number" min="-400" max="400" step="0.01"></label><label>ขนาดโครง (%)<input class="hy-dev-scale" type="number" min="50" max="150" step="0.01"></label><label>ความทึบโครง<input class="hy-dev-opacity" type="range" min="10" max="100" value="55"></label><button type="button" class="hy-dev-reset">คืนแนวโครงเริ่มต้น</button></div><p class="hy-dev-status" role="status"></p><small>ลากในฉากเพื่อเลื่อนโครงที่เลือก · Undo ได้ · กดบันทึกชั้นนี้เพื่อเก็บ</small></div>`;
  const q=s=>host.querySelector(s);this.q=q;this.mode='overlay';this.opacity=.55;this.target='all';
  this.handle=stage.ownerDocument.createElement('div');this.handle.className='hy-calibration-drag';this.handle.hidden=true;this.handle.setAttribute('aria-label','ลากเพื่อปรับแนวโครง 3D');stage.append(this.handle);
  q('.hy-dev-art').onchange=e=>{this.cancel();this.onArtChange?.(e.target.value);};
  q('.hy-dev-target').onchange=e=>{this.cancel();this.target=e.target.value;this.fields(this.value());this.onSelectTarget?.(this.target);};
  q('.hy-dev-toggle').onclick=()=>this.setEnabled(!this.enabled);
  q('.hy-dev-view').onchange=e=>{this.cancel();this.mode=e.target.value;this.showView();};
  q('.hy-dev-opacity').oninput=e=>{this.opacity=Number(e.target.value)/100;this.showView();};
  for(const field of ['x','y','scale'])q(`.hy-dev-${field}`).onchange=()=>{this.cancel();try{const value=validateSkeletonAlignment({x:Number(q('.hy-dev-x').value),y:Number(q('.hy-dev-y').value),scale:Number(q('.hy-dev-scale').value)/100});this.commit(value);this.status('ปรับในแบบร่างแล้ว · กดบันทึกชั้นนี้');}catch(e){this.status(e.message);this.render(this.getRoom());}};
  q('.hy-dev-reset').onclick=()=>{this.cancel();if(this.target==='all')this.onCommit(defaultSkeletonAlignment());else this.onPartCommit?.(this.target,null);};
  this.handle.onpointerdown=e=>{if(e.button!==0||!this.enabled||this.mode==='art')return;e.preventDefault();if(q('.hy-dev-pick').checked){const id=this.onPick?.(e.clientX,e.clientY);if(id&&skeletonTargets(this.getRoom()).some(t=>t.id===id)){this.target=id;q('.hy-dev-target').value=id;this.fields(this.value());this.onSelectTarget?.(id);}else return;}this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,room:this.getRoom(),start:this.value(),target:this.target};this.handle.setPointerCapture?.(e.pointerId);};
  this.handle.onpointermove=e=>{const d=this.drag;if(!d||e.pointerId!==d.id)return;const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;d.next={...d.start,x:Math.max(-400,Math.min(400,d.start.x+(e.clientX-d.x)/r.width*ALIGNMENT_REFERENCE.width/(d.target==='all'?1:skeletonAlignment(d.room).scale))),y:Math.max(-400,Math.min(400,d.start.y+(e.clientY-d.y)/r.height*ALIGNMENT_REFERENCE.height/(d.target==='all'?1:skeletonAlignment(d.room).scale)))};this.onPreview(this.previewRoom(d.room,d.next,d.target));this.fields(d.next);};
  this.handle.onpointerup=e=>{const d=this.drag;if(!d||e.pointerId!==d.id)return;this.drag=null;this.release(d.id);if(d.next)this.commit(d.next,d.target);};
  this.handle.onpointercancel=()=>this.cancel();this.handle.onlostpointercapture=()=>this.cancel();
 }
 value(){return this.target==='all'?skeletonAlignment(this.getRoom()):pieceAlignment(this.getRoom(),this.target);}
 previewRoom(room,value,target=this.target){return target==='all'?{...room,skeletonAlignment:value}:{...room,skeletonParts:[...(room.skeletonParts||[]).filter(p=>p.id!==target),{id:target,...value}]};}
 commit(value,target=this.target){if(target==='all')this.onCommit(value);else this.onPartCommit?.(target,value);}
 status(text){this.q('.hy-dev-status').textContent=text;}
 fields(a){for(const key of ['x','y','scale'])this.q(`.hy-dev-${key}`).value=String(Math.round((key==='scale'?a.scale*100:a[key])*100)/100);}
 release(id){if(this.handle.hasPointerCapture?.(id))this.handle.releasePointerCapture(id);}
 cancel(){const d=this.drag;if(!d)return;this.drag=null;this.release(d.id);this.onPreview(d.room);this.fields(d.start);}
 showView(){this.handle.hidden=!this.enabled||this.mode==='art';const ok=this.onView(this.enabled?this.mode:null,this.opacity);this.status(ok===false?'ไม่พบ WebGL · ยังปรับตัวเลขและบันทึกแบบร่างได้':'ภาพอ้างอิงคงที่ · ปรับเฉพาะโครง 3D');}
 setEnabled(value){this.cancel();const next=value===true;if(next===!!this.enabled)return;this.enabled=next;this.q('.hy-dev-toggle').setAttribute('aria-pressed',String(this.enabled));this.q('.hy-dev-body').hidden=!this.enabled;this.showView();}
 render(room){const eligible=room.background==='office'&&!room.blueprint&&!room.blueprintPlan;this.host.hidden=!eligible;if(!eligible&&this.enabled)this.setEnabled(false);const select=this.q('.hy-dev-target'),items=[{id:'all',label:'โครงทั้งหมด'},...skeletonTargets(room)];if(!items.some(t=>t.id===this.target))this.target='all';select.replaceChildren();for(const t of items){const o=select.ownerDocument.createElement('option');o.value=t.id;o.textContent=t.label;select.append(o);}select.value=this.target;this.q('.hy-dev-art').value=room.officeArt||'legacy-v4';this.fields(this.value());}
 dispose(){this.cancel();this.handle.remove();this.host.replaceChildren();}
}
