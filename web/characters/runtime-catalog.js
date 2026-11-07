// Owner-approved presentation assets (7 November 2026). IDs never identify Agents or roles.
const root='./assets/models/characters/';
export const CHARACTER_APPEARANCES=Object.freeze([
 {id:'staff-a',label:'พนักงาน A',path:root+'staff-a.glb',seatHeight:.41,family:'human'},
 {id:'staff-b',label:'พนักงาน B',path:root+'staff-b.glb',seatHeight:.443,family:'human'},
 {id:'zuri',label:'Zuri',path:root+'candidates/zuri-face-r4.glb',metadata:root+'candidates/zuri-face-r4.json',seatHeight:.41,family:'anime'},
 {id:'wangjai',label:'น้องวางใจ',path:root+'wangjai.glb',seatHeight:.20,family:'robot'},
].map(v=>Object.freeze({...v,artApproved:true,artApprovedAt:'2026-11-07'})));
export const characterAppearance=id=>CHARACTER_APPEARANCES.find(v=>v.id===id)||null;
// Saved appearance identity is independent of the chosen geometry detail.
// Keep full-detail sources available to the Lab and historical comparisons.
const lods=new Map(CHARACTER_APPEARANCES.map(info=>[info.id,Object.freeze({
 ...info,lod:1,path:root+`lod/${info.id}-lod1.glb`,metadata:null,manifest:root+'lod/manifest.json',
})]));
export function characterAsset(id,surface='hybrid'){
 const info=characterAppearance(id);if(!info)return null;
 return surface==='hybrid'?lods.get(id):surface==='lab'?info:null;
}
export function resolveAppearance(object,index=0){
 if(characterAppearance(object?.appearance))return object.appearance;
 const n=/^avatar-(\d\d)$/.exec(object?.kind||'');return (n?Number(n[1])-1:index)%2?'staff-b':'staff-a';
}
export function characterClip(action,names){
 const desired=['walking','walk'].includes(action)?'walking':['seated','sitting','resting','seated_work','sit_down'].includes(action)?'seated':['wave','point'].includes(action)?action:action==='gesture_point'?'point':'idle';
 return names.includes(desired)?desired:names.includes('idle')?'idle':null;
}
export const characterLegs=family=>family==='anime'?[['ThighL','ShinL','FootL'],['ThighR','ShinR','FootR']]:family==='human'?[['left-hip','left-knee','left-ankle'],['right-hip','right-knee','right-ankle']]:[];
