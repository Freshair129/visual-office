// Browser-local art sandbox only. Never stores tenant, business, role or rewards.
export const STUDIO_STORAGE_KEY='zuri-office:design-sandbox:v1';
export const levels=['starter','studio','signature'];
export const defaults=()=>({version:1,room:'starter',desks:['starter','starter','starter','starter'],wing:false,plant:0,mannequin:false});
export function normalizeStudioState(value) {
  if(value?.version!==1)return defaults();
  return {version:1,room:levels.includes(value.room)?value.room:'starter',
    desks:Array.from({length:4},(_,i)=>levels.includes(value.desks?.[i])?value.desks[i]:'starter'),
    wing:value.wing===true,plant:[0,1,2].includes(value.plant)?value.plant:0,mannequin:value.mannequin===true};
}
export function readStudioState(storage) {
  try{return normalizeStudioState(JSON.parse(storage.getItem(STUDIO_STORAGE_KEY)));}catch{return defaults();}
}
export function saveStudioState(storage,value) {
  try{storage.setItem(STUDIO_STORAGE_KEY,JSON.stringify(normalizeStudioState(value)));return true;}catch{return false;}
}
export class StudioHistory {
  constructor(initial){this.saved=normalizeStudioState(initial);this.current=normalizeStudioState(initial);this.past=[];}
  get dirty(){return JSON.stringify(this.current)!==JSON.stringify(this.saved);}
  change(patch){
    const next=normalizeStudioState({...this.current,...patch});
    if(JSON.stringify(next)===JSON.stringify(this.current))return;
    this.past.push(this.current);if(this.past.length>30)this.past.shift();this.current=next;
  }
  undo(){if(this.past.length)this.current=this.past.pop();}
  cancel(){this.current=normalizeStudioState(this.saved);this.past=[];}
  commit(){this.saved=normalizeStudioState(this.current);this.past=[];}
}
