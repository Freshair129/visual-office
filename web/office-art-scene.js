import {HybridScene} from './hybrid-scene.js';
import {departmentStarterRoom} from './hybrid-state.js';
import {attachFloorViewport} from './office-floor-viewport.js';
import {watchOptionalAssetImages} from './optional-assets.js';

// Physical furniture is presentation. No placeholder role leaves this function.
export function officeArtRoom(source,label='สำนักงาน'){
 const desks=(source?.objects||[]).filter(o=>o.kind==='desk');
 const room=departmentStarterRoom({label,roles:desks.map(()=>null)});
 room.objects=room.objects.filter(o=>!/^avatar-/.test(o.kind));
 let desk=0,chair=0;
 for(const object of room.objects){
  if(object.kind==='work-desk')object.id=desks[desk++]?.id||object.id;
  else if(object.kind==='task-chair')object.id=(source.objects||[]).filter(o=>o.kind==='chair')[chair++]?.id||object.id;
  else if(object.kind==='whiteboard')object.id=source.objects.find(o=>o.kind==='board')?.id||object.id;
  else if(object.kind==='wayfinding-arrow')object.id='lift';
 }
 if(source?.objects.some(o=>o.id==='marketing-ask'))room.objects.push({id:'marketing-ask',kind:'whiteboard',x:80,y:47,scale:.6,flip:false,locked:false});
 return room;
}

// Shares authored art with BuildingView / Hybrid Studio. GLB authoring is retained.
export class OfficeArtScene{
 constructor(root,{onPick,onStatus}={}){this.root=root;this.onPick=onPick;this.onStatus=onStatus;}
 setScene(floor,source,{floorLabel=floor}={}){
  this.clear();const doc=this.root.ownerDocument;
  const viewport=doc.createElement('div');viewport.className='office-art-viewport hy-applied-floor is-default-floor';
  viewport.classList.toggle('is-campus',floor==='building');
  const stage=doc.createElement('div');stage.className='office-art-map';viewport.append(stage);this.root.append(viewport);
  this.viewport=attachFloorViewport(viewport,floor==='building'?{framing:'cover',overscan:1.25}:{});
  if(floor==='building'||floor==='lobby'){
   const picture=doc.createElement('picture'),image=doc.createElement('img');
   image.dataset.optionalAsset='image';image.dataset.optionalLabel=floor==='building'?'Campus preview':'Lobby preview';
   image.src=`./assets/office-world/${floor==='building'?'idle-campus':'lobby'}-desktop.png`;
   image.alt=floor==='building'?'สำนักงานใหญ่ Zuri กลางสวนและถนน':'ล็อบบี้สำนักงาน Zuri';image.draggable=false;picture.append(image);stage.append(picture);this.stopOptionalAssetWatch=watchOptionalAssetImages(picture);
   const places=doc.createElement('div');places.className='office-art-places';
   const choices=floor==='building'?[['shell:lobby','เข้าออฟฟิศ → G Lobby']]:[['reception','ต้อนรับ · เลือก Business'],['lift','ลิฟต์ · เลือกชั้น']];
   for(const [id,label]of choices){const button=doc.createElement('button');button.type='button';button.dataset.officePlace=id;button.textContent=label;button.onclick=()=>this.onPick?.(id);places.append(button);}stage.append(places);
  }else{
   this.hybrid=new HybridScene(stage,{paintedArt:true,getFloor:()=>({key:floor,label:floorLabel}),onActivate:id=>{this.onPick?.(id);return true;}});
   this.hybrid.render(officeArtRoom(source,floorLabel),null,false);
  }
  this.onStatus?.('ฉากสำนักงานพร้อม · ภาพและโครงใช้ชุดเดียวกับ Design Studio');
 }
 zoom(delta){if(this.viewport)this.viewport.zoomTo(this.viewport.zoom+delta);}
 reset(){this.viewport?.fit();}
 clear(){this.stopOptionalAssetWatch?.();this.stopOptionalAssetWatch=null;this.hybrid?.dispose();this.hybrid=null;this.viewport?.();this.viewport=null;this.root.replaceChildren();}
 dispose(){this.clear();}
}
