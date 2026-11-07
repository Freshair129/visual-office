// Stable IDs exported into the original room GLTF. These are visual surfaces, never agent slots.
export const roomSurfaces=[
  {id:'wall-left',label:'ผนังซ้าย',color:'#e4e5df'},
  {id:'wall-back',label:'ผนังหลัง',color:'#e9ebe6'},
  {id:'floor',label:'พื้นห้อง',color:'#e9e7e1'},
  ...[1,2,3].flatMap(n=>[
    {id:`window-${n}-frame`,label:`กรอบหน้าต่าง ${n}`,color:'#b5c8cc'},
    {id:`window-${n}-glass`,label:`กระจกหน้าต่าง ${n}`,color:'#e4f0f2'},
  ]),
  {id:'lounge-sofa',label:'โซฟาพักผ่อน',color:'#a6b9b3'},
  {id:'lounge-table',label:'โต๊ะมุมพัก',color:'#f5efe4'},
  {id:'storage',label:'ตู้มุมกาแฟ',color:'#d8dcd5'},
  {id:'coffee-kit',label:'ชุดชงกาแฟ',color:'#1f2937'},
  {id:'pinboard',label:'บอร์ดติดผนัง',color:'#f5efe4'},
  ...[1,2,3].map(n=>({id:`room-plant-${n}`,label:`ต้นไม้เดิม ${n}`,color:'#7e947e'})),
];
export const surfaceMaterials=[
  {id:'original',label:'วัสดุเดิม'},
  {id:'matte',label:'สีด้าน',roughness:.92,metalness:0},
  {id:'wood',label:'ไม้',roughness:.72,metalness:0},
  {id:'stone',label:'หิน',roughness:.88,metalness:0},
  {id:'fabric',label:'ผ้า',roughness:1,metalness:0},
  {id:'metal',label:'โลหะ',roughness:.28,metalness:.72},
  {id:'glass',label:'กระจกฝ้า',roughness:.16,metalness:.1,opacity:.65},
];
export const surfaceColors=['#fff8f0','#e4e5df','#a6b9b3','#d6ecfa','#c6a052','#e8820c','#9b7352','#3d4b50'];
export const builtInDecor=[
  {source:'lounge-sofa',x:-5.87,z:2.8},{source:'lounge-table',x:-4.66,z:3.3},
  {source:'storage',x:-6.58,z:-2.84},{source:'coffee-kit',x:-6.48,z:-3.1},
  {source:'pinboard',x:-6.93,z:-.2},
  {source:'room-plant-1',x:6.1,z:-4.08},{source:'room-plant-2',x:-6.05,z:4.35},{source:'room-plant-3',x:-6.24,z:-4.27},
];
export function validateFinish(s){
  if(!s||Array.isArray(s)||typeof s!=='object'||
    Object.keys(s).some(k=>!['color','material','texture'].includes(k))||
    (s.color!==undefined&&(typeof s.color!=='string'||!/^#[0-9a-f]{6}$/i.test(s.color)))||
    (s.material!==undefined&&!surfaceMaterials.some(m=>m.id===s.material)))throw Error('เลือกสีและวัสดุจากรายการที่รองรับ');
  if(s.texture!==undefined&&s.texture!==null)validateTexture(s.texture);
}
export function validateTexture(t){
  if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).some(k=>!['data','repeatX','repeatY','offsetX','offsetY','rotation','opacity'].includes(k)))throw Error('Texture ไม่ถูกต้อง');
  const data=t.data;
  if(typeof data!=='string'||data.length>180000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data))throw Error('Texture ต้องเป็น PNG ที่ฝังในแบบ ขนาดไม่เกิน 180 KB');
  const bytes=Uint8Array.from(atob(data.slice(22)),c=>c.charCodeAt(0));
  if(bytes.length<33||[137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v)||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')throw Error('ข้อมูลภาพ PNG ไม่ถูกต้อง');
  const view=new DataView(bytes.buffer),w=view.getUint32(16),h=view.getUint32(20);
  if(w<1||h<1||w>512||h>512)throw Error('Texture รองรับสูงสุด 512 × 512 px');
  for(const [k,a,b]of [['repeatX',.1,20],['repeatY',.1,20],['offsetX',-1,1],['offsetY',-1,1],['rotation',-180,180],['opacity',0,1]]){
    if(!Number.isFinite(t[k])||t[k]<a||t[k]>b)throw Error('ค่า Texture อยู่นอกช่วงที่รองรับ');
  }
}
export function validateSurfaces(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('พื้นผิวห้องไม่ถูกต้อง');
  for(const [id,s] of Object.entries(value)){
    if(!roomSurfaces.some(p=>p.id===id))throw Error('เลือกพื้นผิวจากรายการที่รองรับ');
    validateFinish(s);
  }
}
