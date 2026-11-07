import {ArtHistory,artStyles,parts,arrangements} from './studio-art-state.js';
import {icon} from './icons.js';

export const styleInfo={
  soft3d:{name:'Soft 3D',tag:'ผิวโค้งมน · แสงนุ่ม',description:'เฟอร์นิเจอร์เรนเดอร์ 3D คู่กับตัวละครอนิเมะ 2D'},
  painted:{name:'Painted 2.5D',tag:'ภาพวาด · อบอุ่น',description:'ผิวสัมผัสพู่กันและแสงเงาแบบภาพเกม 2.5D'},
  anime:{name:'2D Anime',tag:'เส้นคม · Cel shading',description:'ฉากลายเส้นอนิเมะ ใช้ภาษาภาพเดียวกับตัวละคร'},
};
const labels={desk:'โต๊ะและเก้าอี้',lift:'ลิฟต์',plant:'ต้นไม้',duo:'Zuri + วางใจ'};
const widths={desk:48,lift:32,plant:23,duo:30};
const asset=(style,part)=>`./assets/studio-styles/${part==='duo'?'shared':style}/${part}.png`;

export class ArtStudio{
  constructor(root,{storage}={}){
    this.root=root;this.selected='desk';this.history=new ArtHistory(storage);
    root.innerHTML=`
      <div class="art-intro"><div><span class="studio-eyebrow">YOUR OFFICE, YOUR STYLE</span><h2>ลองให้เห็น ก่อนเลือกใช้</h2><p>โต๊ะ ลิฟต์ ต้นไม้ และคู่หูเดิม · เลือกภาษาภาพที่เข้ากับออฟฟิศคุณ</p></div><span class="art-local">บันทึกในเครื่อง</span></div>
      <div class="art-style-list" aria-label="เลือกสไตล์ภาพ">${artStyles.map((style,i)=>`
        <button type="button" class="art-style" data-art-style="${style}" aria-pressed="false">
          <img src="${asset(style,'desk')}" alt="" width="160" height="120">
          <span><small>0${i+1}</small><strong>${styleInfo[style].name}</strong><span>${styleInfo[style].tag}</span></span>
          <span class="art-style-check" aria-hidden="true">เลือกอยู่</span>
        </button>`).join('')}</div>
      <div class="art-workspace">
        <section class="art-canvas-panel" aria-label="กระดานจัดฉาก">
          <div class="art-canvas-heading"><div><strong class="art-current-name"></strong><span class="art-current-description"></span></div><button type="button" class="art-reset">${icon('rotate-left')}คืนตำแหน่ง</button></div>
          <div class="art-stage" data-tone="cream">
            ${parts.map(part=>`<button type="button" class="art-object" data-part="${part}" aria-label="เลือก${labels[part]}" aria-pressed="false"><img alt="${labels[part]}" draggable="false" decoding="async"><span class="art-object-label">${labels[part]}</span></button>`).join('')}
          </div>
          <p class="art-stage-hint">${icon('mouse')}แตะชิ้นงานแล้วลากจัดวาง · ใช้ปุ่มลูกศรบนคีย์บอร์ดได้</p>
          <p class="art-load-error" role="status" hidden>ภาพบางชิ้นโหลดไม่ได้ <button type="button">ลองโหลดภาพอีกครั้ง</button></p>
        </section>
        <aside class="art-inspector" aria-label="ปรับชิ้นงาน">
          <span class="studio-eyebrow">COMPONENTS</span><h3>จัดมุมของคุณ</h3>
          <div class="art-part-list">${parts.map(part=>`<button type="button" data-select-part="${part}" aria-pressed="false">${labels[part]}</button>`).join('')}</div>
          <div class="art-selected-heading"><strong class="art-selected-name"></strong><span>ขยับและปรับขนาด</span></div>
          <label class="art-size-label" for="art-size">ขนาด <output class="art-size-value"></output></label><input id="art-size" type="range" min="75" max="125" step="5">
          <div class="art-nudge" aria-label="ขยับชิ้นงาน"><button type="button" data-move="left" aria-label="ขยับซ้าย">←</button><button type="button" data-move="up" aria-label="ขยับขึ้น">↑</button><button type="button" data-move="down" aria-label="ขยับลง">↓</button><button type="button" data-move="right" aria-label="ขยับขวา">→</button></div>
          <fieldset class="art-tones"><legend>โทนกระดาน</legend><div>${[['cream','ครีม'],['blue','ฟ้า'],['paper','ขาว']].map(([key,name])=>`<button type="button" data-tone-choice="${key}" aria-pressed="false">${name}</button>`).join('')}</div></fieldset>
          <label class="art-cast-toggle"><span>แสดง Zuri และวางใจ<small>คาแรกเตอร์ 2D เดิมทุกสไตล์</small></span><input type="checkbox" class="art-cast"></label>
          <div class="art-save-area"><p class="art-feedback" role="status" aria-live="polite"></p><button type="button" class="art-apply">ใช้สไตล์นี้</button><div><button type="button" class="art-undo">ย้อนกลับ</button><button type="button" class="art-cancel">คืนแบบที่บันทึก</button></div></div>
        </aside>
      </div>
      <footer class="art-footnote">ฉากประกอบ 2.5D จากภาพแยกชิ้น · สไตล์ Soft 3D ใช้ภาพเรนเดอร์ ไม่ใช่โมเดลหมุนได้ · ไม่มีผลกับ Business หรือ agent จริง</footer>`;
    root.querySelectorAll('[data-art-style]').forEach(b=>b.onclick=()=>this.change({style:b.dataset.artStyle}));
    root.querySelectorAll('[data-tone-choice]').forEach(b=>b.onclick=()=>this.change({tone:b.dataset.toneChoice}));
    root.querySelectorAll('[data-select-part]').forEach(b=>b.onclick=()=>this.select(b.dataset.selectPart,true));
    root.querySelector('.art-cast').onchange=e=>{
      this.change({cast:e.target.checked});if(!e.target.checked&&this.selected==='duo')this.select('desk');
    };
    root.querySelector('#art-size').onchange=e=>this.move(this.selected,{scale:Number(e.target.value)/100});
    root.querySelector('#art-size').oninput=e=>{root.querySelector('.art-size-value').textContent=`${e.target.value}%`;};
    root.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>this.nudge(b.dataset.move));
    root.querySelector('.art-reset').onclick=()=>this.change({positions:arrangements()});
    root.querySelector('.art-undo').onclick=()=>{this.cancelDrag();this.history.undo();this.update();};
    root.querySelector('.art-cancel').onclick=()=>{this.cancelDrag();this.history.cancel();this.update();};
    root.querySelector('.art-apply').onclick=()=>{
      this.cancelDrag();
      if(this.history.save()){this.update();this.feedback('บันทึกสไตล์และตำแหน่งแล้ว');}
      else this.feedback('บันทึกไม่ได้ · แบบที่ลองยังอยู่ กรุณาลองอีกครั้ง');
    };
    this.failed=new Set();
    root.querySelector('.art-load-error button').onclick=()=>root.querySelectorAll('img').forEach(img=>{const src=img.getAttribute('src');if(src)img.src=src;});
    root.querySelectorAll('img').forEach(img=>{
      img.onerror=()=>{if(this.disposed)return;this.failed.add(img);root.querySelector('.art-load-error').hidden=false;};
      img.onload=()=>{if(this.disposed)return;this.failed.delete(img);root.querySelector('.art-load-error').hidden=!this.failed.size;};
    });
    root.querySelectorAll('[data-part]').forEach(b=>{
      b.onclick=()=>this.select(b.dataset.part);
      b.onkeydown=e=>{
        const dir={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[e.key];
        if(dir){e.preventDefault();this.select(b.dataset.part);this.nudge(dir,e.shiftKey?5:1);}
        if(e.key==='Escape')this.cancelDrag();
      };
      b.onpointerdown=e=>{
        if(e.button!==0)return;
        this.select(b.dataset.part);
        this.drag={part:b.dataset.part,id:e.pointerId,x:e.clientX,y:e.clientY,initial:{...this.history.current.positions[b.dataset.part]},button:b};
        b.setPointerCapture?.(e.pointerId);
      };
      b.onpointermove=e=>{
        if(!this.drag||e.pointerId!==this.drag.id)return;
        const rect=root.querySelector('.art-stage').getBoundingClientRect();if(!rect.width||!rect.height)return;
        const {initial,x,y}=this.drag;
        this.drag.next={...initial,x:Math.max(12,Math.min(88,initial.x+(e.clientX-x)/rect.width*100)),y:Math.max(20,Math.min(78,initial.y+(e.clientY-y)/rect.height*100))};
        this.place(b,this.drag.next);
      };
      b.onpointerup=e=>{
        if(!this.drag||this.drag.id!==e.pointerId)return;
        const {next,part}=this.drag;this.drag=null;b.releasePointerCapture?.(e.pointerId);
        if(next)this.move(part,next);
      };
      b.onpointercancel=()=>this.cancelDrag();
      b.onlostpointercapture=()=>this.cancelDrag();
    });
    this.update();
  }
  feedback(text){this.root.querySelector('.art-feedback').textContent=text;}
  select(part,focus=false){
    if(!parts.includes(part)||part==='duo'&&!this.history.current.cast)return;
    this.selected=part;this.update();
    if(focus)this.root.querySelector(`[data-part="${part}"]`).focus({preventScroll:true});
  }
  place(button,position){
    const width=widths[button.dataset.part]*position.scale;
    // Bound the entire component, including its selection target, as the stage resizes.
    button.style.left=`clamp(${width/2}%, ${position.x}%, ${100-width/2}%)`;
    button.style.top=`clamp(${width/2}cqw, ${position.y}%, calc(100% - ${width/2}cqw))`;
    button.style.width=`${width}%`;
    button.style.zIndex=String(button.dataset.part==='lift'?1:Math.round(position.y));
  }
  move(part,patch){this.change({positions:{...this.history.current.positions,[part]:{...this.history.current.positions[part],...patch}}});}
  nudge(direction,amount=2){
    const p=this.history.current.positions[this.selected],delta={left:[-amount,0],right:[amount,0],up:[0,-amount],down:[0,amount]}[direction];
    if(delta)this.move(this.selected,{x:p.x+delta[0],y:p.y+delta[1]});
  }
  cancelDrag(){
    if(!this.drag)return;
    const {button,id}=this.drag;this.drag=null;
    if(button.hasPointerCapture?.(id))button.releasePointerCapture(id);
    this.update();
  }
  change(patch){this.cancelDrag();this.history.change(patch);this.update();}
  update(){
    const state=this.history.current;
    if(!state.cast&&this.selected==='duo')this.selected='desk';
    this.root.querySelectorAll('[data-art-style]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.artStyle===state.style)));
    this.root.querySelector('.art-current-name').textContent=styleInfo[state.style].name;
    this.root.querySelector('.art-current-description').textContent=styleInfo[state.style].description;
    this.root.querySelector('.art-stage').dataset.tone=state.tone;
    this.root.querySelectorAll('[data-part]').forEach(b=>{
      const part=b.dataset.part,img=b.querySelector('img'),src=asset(state.style,part);
      if(img.getAttribute('src')!==src)img.src=src;
      b.hidden=part==='duo'&&!state.cast;b.setAttribute('aria-pressed',String(part===this.selected));this.place(b,state.positions[part]);
    });
    this.root.querySelectorAll('[data-select-part]').forEach(b=>{
      b.disabled=b.dataset.selectPart==='duo'&&!state.cast;
      b.setAttribute('aria-pressed',String(b.dataset.selectPart===this.selected));
    });
    this.root.querySelectorAll('[data-tone-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.toneChoice===state.tone)));
    this.root.querySelector('.art-selected-name').textContent=labels[this.selected];
    this.root.querySelector('#art-size').value=String(state.positions[this.selected].scale*100);
    this.root.querySelector('.art-size-value').textContent=`${Math.round(state.positions[this.selected].scale*100)}%`;
    this.root.querySelector('.art-cast').checked=state.cast;
    this.root.querySelector('.art-apply').disabled=!this.history.dirty&&this.history.hasSaved;
    this.root.querySelector('.art-cancel').disabled=!this.history.dirty;
    this.root.querySelector('.art-undo').disabled=!this.history.past.length;
    this.feedback(this.history.dirty?'กำลังลองแบบ · ยังไม่ได้บันทึก':'แบบปัจจุบัน · บันทึกเฉพาะเบราว์เซอร์นี้');
  }
  dispose(){
    if(this.disposed)return;this.cancelDrag();this.disposed=true;
    this.root.querySelectorAll('img').forEach(img=>{img.onerror=null;img.onload=null;});
    this.root.replaceChildren();
  }
}
