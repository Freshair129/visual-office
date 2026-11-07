import {CustomAssetPanel} from './custom-asset-panel.js';
import {FurnitureLibrary,captureFurnitureSet,placeFurnitureSet} from './tycoon-prefabs.js';
import {exportFurnitureBundle,importFurnitureBundle} from './tycoon-prefab-files.js';
const emptyPNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=';
export class TycoonPrefabLibrary{
 constructor(editor){
  this.e=editor;this.store=new FurnitureLibrary(editor.store.storage);
  this.root=document.createElement('section');this.root.className='tycoon-prefab-library';
  this.root.innerHTML=`<details open><summary>Asset Library · ชุดของฉัน</summary><p>เก็บชุดเฟอร์นิเจอร์พร้อมสี Texture และจุดนั่งในเครื่องนี้ · วางแล้วกดบันทึกชั้นอีกครั้ง</p><div class="tycoon-tool-row"><label>ชื่อชุด<input data-prefab-name maxlength="60" placeholder="เช่น โต๊ะทีมสีอำพัน"></label><button type="button" data-prefab-save>บันทึกชุดที่เลือก</button><label>ตำแหน่งวาง X (ม.)<input data-prefab-x type="number" step="0.1" value="0"></label><label>ตำแหน่งวาง Z (ม.)<input data-prefab-z type="number" step="0.1" value="0"></label><button type="button" data-prefab-refresh>โหลดคลังใหม่</button></div><p data-prefab-status role="status"></p><div class="tycoon-prefab-cards" data-prefab-cards></div></details>`;
  editor.q('.tycoon-edit-layout').before(this.root);this.q=s=>this.root.querySelector(s);
  this.q('[data-prefab-save]').onclick=()=>this.save();this.q('[data-prefab-refresh]').onclick=()=>this.render();
  const label=document.createElement('label'),input=document.createElement('input');label.textContent='นำเข้าชุดจากไฟล์';input.type='file';input.accept='.json,application/json';input.dataset.prefabImport='';label.append(input);this.q('.tycoon-tool-row').append(label);
  this.custom=new CustomAssetPanel(this);
  input.onchange=async()=>{const file=input.files?.[0];if(file)await this.importFile(file);input.value='';};
 }
 async importFile(file){
  const token=this.importToken=(this.importToken||0)+1;this.message('กำลังตรวจแพ็กเกจและโมเดล…');
  try{if(file.size>64000000)throw Error('ไฟล์ต้องไม่เกิน 64 MB');const set=await importFurnitureBundle(await file.text());if(this.e.disposed||!this.e.visible||token!==this.importToken)return false;this.store.save(set);this.render();this.message(`นำเข้าชุด “${set.name}” แล้ว · ยังไม่เปลี่ยนแบบชั้น`);return true;}
  catch(error){if(!this.e.disposed&&token===this.importToken)this.message(error.message);return false;}
 }
 async exportFile(set){
  this.message('กำลังรวม GLB และภาพลงไฟล์…');
  try{const text=await exportFurnitureBundle(set);if(this.e.disposed||!this.e.visible)return false;const win=this.e.root.ownerDocument.defaultView,url=win.URL.createObjectURL(new win.Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='visual-office-furniture.office-set.json';a.click();setTimeout(()=>win.URL.revokeObjectURL(url),1000);this.message('ส่งออกไฟล์แล้ว · รวม GLB สี Texture ภาพพรีวิว และจุดนั่ง');return true;}catch(error){if(!this.e.disposed)this.message(error.message);return false;}
 }
 message(text){this.q('[data-prefab-status]').textContent=text;}
 async save(){
  if(this.busy)return false;const e=this.e,generation=e.editGeneration,load=e.loadGeneration,selection=e.editTools.selectionGeneration;
  this.busy=true;this.q('[data-prefab-save]').disabled=true;this.message('กำลังสร้างภาพพรีวิวชุด…');
  try{
   const set=captureFurnitureSet(e.room,e.selection,this.q('[data-prefab-name]').value,emptyPNG);
   if(!e.scene?.furnitureThumbnail)throw Error('ต้องเปิดฉาก GLB ให้พร้อมก่อนสร้างภาพพรีวิว');
   set.preview=await e.scene.furnitureThumbnail(set.room);
   if(e.disposed||!e.visible||generation!==e.editGeneration||load!==e.loadGeneration||selection!==e.editTools.selectionGeneration){this.message('ยกเลิกการบันทึกชุด เพราะฉากหรือสิ่งที่เลือกเปลี่ยนแล้ว');return false;}
   this.store.save(set);this.message(`บันทึกชุด “${set.name}” แล้ว · เลือกชั้นอื่นแล้วกดวางชุดได้`);this.render();return true;
  }catch(error){if(!e.disposed)this.message(error.message);return false;}finally{this.busy=false;this.q('[data-prefab-save]').disabled=false;}
 }
 place(set){const e=this.e;try{const placed=placeFurnitureSet(e.room,set,{x:Number(this.q('[data-prefab-x]').value),z:Number(this.q('[data-prefab-z]').value)});if(e.change(()=>placed.room)){e.selectIds(placed.ids);this.message(`วางชุด “${set.name}” แล้ว · ตรวจทางเดิน/จุดนั่ง แล้วกดบันทึกชั้นนี้`);return true;}}catch(error){this.message(error.message);}return false;}
 render(){
  const cards=this.q('[data-prefab-cards]');cards.replaceChildren();let entries;
  try{entries=this.store.list();}catch{this.message('อ่านคลังในเครื่องไม่ได้');return;}
  if(this.store.invalidEntries)this.message('บางชุดในคลังเสียหายหรืออ่านไม่ได้ · ข้อมูลเดิมยังอยู่ในเครื่อง');
  if(!entries.length){const p=document.createElement('p');p.textContent=this.store.invalidEntries?'ยังไม่มีชุดที่อ่านได้ · ข้อมูลเดิมยังอยู่ในเครื่อง':'ยังไม่มีชุด · เลือกโต๊ะและเก้าอี้ ตั้งชื่อ แล้วบันทึกชุดที่เลือก';cards.append(p);}
  for(const {id,...set} of entries){const card=document.createElement('article'),image=document.createElement('img'),title=document.createElement('h4'),meta=document.createElement('p'),button=document.createElement('button');
   image.src=set.preview;image.alt=`พรีวิว ${set.name}`;image.width=320;image.height=240;title.textContent=set.name;meta.textContent=`${set.room.objects[0]?.asset?.category||'ชุดเฟอร์นิเจอร์'} · ${set.room.objects.length} ชิ้น · ${set.room.navigation?.stations.length||0} จุดใช้งาน`;
   button.type='button';button.textContent=`วางชุด ${set.name}`;button.onclick=()=>this.place(set);const exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent=`ส่งออกชุด ${set.name}`;exportButton.onclick=()=>this.exportFile(set);card.append(image,title,meta,button,exportButton);cards.append(card);
  }
 }
}
