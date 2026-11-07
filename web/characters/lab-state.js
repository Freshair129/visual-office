import {characterAppearance,characterAsset} from './runtime-catalog.js';
const IDS=new Set(['zuri','wangjai','staff-a','staff-b','anime','rain','zuri-anime','zuri-face-r4']);
export const isZuriAdaptation=id=>id==='zuri-anime'||id==='zuri-face-r4';
export function initialCharacterSelection(requested){
  if(requested==='blender')return {id:'zuri',version:'blender'};
  return {id:IDS.has(requested)?requested:'zuri-face-r4',version:'current'};
}
export function characterReviewScope(id){
  const appearance=id==='zuri-face-r4'?'zuri':id==='zuri'||id==='zuri-anime'?null:id;
  return characterAppearance(appearance)?'ใช้ในชั้นแบบชั่วคราว · งานภาพยังไม่อนุมัติ':'โมเดลเปรียบเทียบ · ไม่ใช้ในชั้นจริง';
}
export const importedCharacterIds=Object.freeze(['anime','rain','zuri-anime','zuri-face-r4']);
export function isImportedCharacter(id){return importedCharacterIds.includes(id);}

export function characterModelPath(id,version='current'){
  if(!IDS.has(id))return null;
  if(version==='current'&&id==='zuri-face-r4')return characterAsset('zuri','lab').path;
  if(version==='current'&&['wangjai','staff-a','staff-b'].includes(id))return characterAsset(id,'lab').path;
  if(isImportedCharacter(id))return version==='current'?`./assets/models/characters/candidates/${id}.glb`:null;
  if(version==='blender')return id==='zuri'?'./assets/models/characters/reviews/zuri-head-revision.glb':null;
  if(version==='rejected')return id==='zuri'?'./assets/models/characters/reviews/zuri-blender-pilot.glb':null;
  if(version==='before')return id==='zuri'?'./assets/models/characters/reviews/zuri-before-refinement.glb':null;
  return version==='current'?`./assets/models/characters/${id}.glb`:null;
}

export function availableCharacterActions(clips){
  const present=new Set(clips.map(c=>c.name));
  return ['idle','walking','seated','wave','point'].filter(name=>present.has(name));
}

export function selectedCharacterAction(clips,previous='idle'){
  const available=availableCharacterActions(clips);
  return available.includes(previous)?previous:available.includes('idle')?'idle':available[0]||null;
}

/** A pending/failed model has no downloadable keyboard or pointer target. */
export function setCharacterDownload(link,id,ready,version='current'){
  const path=characterModelPath(id,version),enabled=Boolean(ready&&path);
  link.setAttribute('aria-disabled',String(!enabled));link.tabIndex=enabled?0:-1;
  if(enabled){link.href=path;link.download=path.split('/').at(-1);}
  else{link.removeAttribute('href');link.removeAttribute('download');}
}
