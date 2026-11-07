// Presentation-only preferences: no tenant, domain, agent or economy data.
export const ART_KEY='zuri-office:art-studio:v1';
export const artStyles=['soft3d','painted','anime'];
export const parts=['desk','lift','plant','duo'];
export const arrangements=()=>({
  desk:{x:53,y:59,scale:1},lift:{x:73,y:31,scale:1},
  plant:{x:84,y:64,scale:1},duo:{x:16,y:57,scale:1},
});
export const artDefaults=()=>({version:1,style:'soft3d',tone:'cream',cast:true,positions:arrangements()});
const bounded=(value,min,max,fallback)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
export function normalizeArt(value){
  const base=artDefaults();
  if(value?.version!==1)return base;
  return {version:1,style:artStyles.includes(value.style)?value.style:base.style,
    tone:['cream','blue','paper'].includes(value.tone)?value.tone:base.tone,cast:value.cast!==false,
    positions:Object.fromEntries(parts.map(key=>{
      const p=value.positions?.[key],fallback=base.positions[key];
      return [key,{x:bounded(p?.x,12,88,fallback.x),y:bounded(p?.y,20,78,fallback.y),
        scale:bounded(p?.scale,.75,1.25,1)}];
    }))};
}
export class ArtHistory{
  constructor(storage){
    this.storage=storage;
    this.hasSaved=false;
    try{const raw=JSON.parse(storage?.getItem(ART_KEY));this.hasSaved=raw?.version===1;this.saved=normalizeArt(raw);}catch{this.saved=artDefaults();}
    this.current=normalizeArt(this.saved);this.past=[];
  }
  get dirty(){return JSON.stringify(this.current)!==JSON.stringify(this.saved);}
  change(patch){
    const next=normalizeArt({...this.current,...patch});
    if(JSON.stringify(next)===JSON.stringify(this.current))return;
    this.past.push(this.current);this.past=this.past.slice(-30);this.current=next;
  }
  undo(){if(this.past.length)this.current=this.past.pop();}
  cancel(){this.current=normalizeArt(this.saved);this.past=[];}
  save(){
    try{this.storage.setItem(ART_KEY,JSON.stringify(this.current));}
    catch{return false;}
    this.saved=normalizeArt(this.current);this.past=[];this.hasSaved=true;return true;
  }
}
