const sheets={
  zuri:{file:'zuri-sheet-v1.png',front:[40,50,260,570],face:[410,660,260,305]},
  wangjai:{file:'wangjai-sheet-v1.png',front:[0,0,1536,1024],face:[0,0,1536,1024]},
  'staff-a':{file:'office-staff-sheet-v1.png',front:[50,58,195,460],face:[1035,77,240,410]},
  'staff-b':{file:'office-staff-sheet-v1.png',front:[65,552,230,455],face:[1035,595,245,390]},
};
export function characterReference(id,view='front'){
  const ref=Object.hasOwn(sheets,id)?sheets[id]:null;if(!ref)return null;
  if(id==='zuri'&&['tripo-front','tripo-face'].includes(view)){
    const face=view==='tripo-face',width=963,height=884;
    return {src:`./assets/models/characters/references/${view}-preview.jpg`,box:face?[575,70,205,200]:[530,150,275,620],width,height,kind:'preview-screenshot',caption:'ภาพหน้าจอพรีวิว Tripo · อ้างอิงรูปทรง ไม่ใช่ไฟล์โมเดลที่นำเข้า'};
  }
  return {src:`./assets/models/characters/references/${ref.file}`,box:view==='sheet'?[0,0,1536,1024]:[...ref[view==='face'?'face':'front']]};
}
