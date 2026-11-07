import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {makeStudioPlant,makeStudioMeetingTable,makeStudioSofa,makeStudioCoffeeTable,makeStudioCabinet,makeStudioReceptionCounter,makeStudioWhiteboard,makeStudioCoffeeStation,makeStudioElevator} from './studio-models.js';
import {makeTycoonFactoryDesk as makeStudioDesk,makeTycoonFactoryChair as makeStudioChair} from './tycoon-furniture-models.js';
import {createOfficeCharacter,updateOfficeCharacter} from './office-characters.js';
// Original local kit. Values are bounding dimensions X,Y,Z in metres.
const entries={plaza:[16,.3,12],facade:[12,3.2,8],roof:[12,.4,8],floor:[1,.1,1],wall:[1,2.8,.2],window:[1.8,1.8,.2],'door-frame':[1.4,2.35,.2],door:[1.2,2.2,.06],glass:[1,2,.08],column:[.3,2.8,.3],skirting:[1,.12,.03],reception:[2.55,1.15,1.1],lift:[2.55,2.7,.85],kiosk:[.6,1.4,.5],board:[1.95,1.8,.58],desk:[1.6,1.3,.8],chair:[.9,1.0,.95],meeting:[2.7,.76,1.45],sofa:[2.05,1.0,1.05],'coffee-table':[1.65,.45,1.35],coffee:[1.55,1.55,.88],cabinet:[1.55,1.8,.85],plant:[.6,1.35,.6],actor:[.55,1.7,.4]};
export const TYCOON_ASSETS=Object.freeze(Object.fromEntries(Object.entries(entries).map(([key,size])=>[key,{id:`tycoon:${key}:1`,size,quality:'prototype',footprint:[size[0],size[2]]}])));
// Narrower pads leave the Tycoon rig's measured thigh span clear; the Studio chair keeps its original pads.
const factories={reception:makeStudioReceptionCounter,lift:makeStudioElevator,board:makeStudioWhiteboard,desk:()=>makeStudioDesk('studio',{chair:false}),chair:()=>makeStudioChair({armPadWidth:.18}),meeting:makeStudioMeetingTable,sofa:makeStudioSofa,'coffee-table':makeStudioCoffeeTable,coffee:makeStudioCoffeeStation,cabinet:makeStudioCabinet,plant:makeStudioPlant,actor:()=>createOfficeCharacter(0)};
function box(group,name,w,h,d,x,y,z,color,round=.025){
  const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(round,w/4,h/4,d/4)),new THREE.MeshStandardMaterial({color,roughness:.65}));
  m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
}
function architecture(kind){
  const g=new THREE.Group(),[w,h,d]=entries[kind],cream='#f2e2c9',dark='#24545b',gold='#c69c54';
  if(kind==='facade'){
    box(g,'slab',w,.22,d,0,.11,0,cream);
    box(g,'cornice',w,.2,d,0,h-.1,0,cream);
    for(const x of [-w/2+.15,w/2-.15])for(const z of [-d/2+.15,d/2-.15])box(g,'corner',.3,h,.3,x,h/2,z,cream);
    for(const z of [-d/2+.1,d/2-.1]){
      box(g,'glazing',w-.6,h-.55,.08,0,h/2,z,'#629da3');
      for(let x=-5;x<=5;x+=2)box(g,'mullion',.08,h-.4,.17,x,h/2,z,dark);
      box(g,'accent',w,.08,.15,0,.5,z,gold);
    }
    for(const x of [-w/2+.1,w/2-.1]){
      box(g,'side-glazing',.08,h-.55,d-.6,x,h/2,0,'#4d8189');
      for(let z=-3;z<=3;z+=2)box(g,'side-mullion',.17,h-.4,.08,x,h/2,z,dark);
    }
  }else if(['window','door-frame','glass'].includes(kind)){
    box(g,'frame-left',.08,h,d,-w/2+.04,h/2,0,cream);box(g,'frame-right',.08,h,d,w/2-.04,h/2,0,cream);
    box(g,'frame-top',w,.08,d,0,h-.04,0,cream);
    if(kind!=='door-frame'){
      box(g,'frame-bottom',w,.08,d,0,.04,0,cream);
      const glass=box(g,'glass-pane',w-.16,h-.16,.025,0,h/2,0,'#a6d6dc');
      glass.material.transparent=true;glass.material.opacity=.6;
    }
  }else if(kind==='kiosk'){
    box(g,'base',w,.08,d,0,.04,0,dark);box(g,'stem',.18,.9,.18,0,.49,0,cream);
    box(g,'display',w,.55,.13,0,1.125,0,dark);box(g,'screen',w-.1,.4,.02,0,1.13,.08,'#e6f1eb');
  }else{
    box(g,kind,w,h,d,0,h/2,0,['wall','column','door'].includes(kind)?cream:kind==='roof'?dark:kind==='skirting'?gold:'#d6c4a9');
    if(kind==='door')box(g,'handle',.04,.22,.06,w*.34,1,.06,gold);
  }
  return g;
}
export function createTycoonModel(kind){
  const meta=TYCOON_ASSETS[kind];if(!meta)throw Error('Unknown Tycoon asset');
  const mesh=factories[kind]?.()||architecture(kind);
  const animations=kind==='actor'?bakeActorClips(mesh):[];
  // Character source keeps object references in userData; exports only serializable metadata.
  mesh.traverse(n=>{n.userData={};});
  const b=new THREE.Box3().setFromObject(mesh),s=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());
  const offset=new THREE.Group();offset.add(mesh);mesh.position.sub(new THREE.Vector3(center.x,b.min.y,center.z));
  const root=new THREE.Group();root.name=`tycoon-${kind}`;root.add(offset);
  offset.scale.set(meta.size[0]/s.x,meta.size[1]/s.y,meta.size[2]/s.z);
  root.animations=animations;root.userData={assetId:meta.id,units:'metres',quality:'prototype',footprint:meta.footprint};root.updateMatrixWorld(true);return root;
}
function bakeActorClips(actor){
  const nodes=[];actor.traverse(n=>{if((n.isGroup||n.isBone)&&n!==actor)nodes.push(n);});
  const snapshot=()=>nodes.map(n=>({p:n.position.clone(),q:n.quaternion.clone()}));
  updateOfficeCharacter(actor,{action:'idle',time:0});const standing=snapshot();updateOfficeCharacter(actor,{action:'seated',seatHeight:.5,time:0});const seated=snapshot();
  const clips=[];
  for(const [name,duration,pose] of [['idle',3,'idle'],['walk',.9,'walking'],['sit_down',.8,'seated'],['seated_work',2.4,'seated'],['stand_up',.8,'idle'],['talk',2.5,'idle'],['gesture_point',1.2,'thinking']]){
    const times=[],positions=nodes.map(()=>[]),rotations=nodes.map(()=>[]),steps=24;
    for(let i=0;i<=steps;i++){
      const time=i/steps*duration;times.push(time);updateOfficeCharacter(actor,{action:pose,time,seatHeight:.5});
      if(name==='sit_down'||name==='stand_up')nodes.forEach((n,j)=>{const u=name==='sit_down'?i/steps:1-i/steps;n.position.copy(standing[j].p).lerp(seated[j].p,u);n.quaternion.copy(standing[j].q).slerp(seated[j].q,u);});
      if(name==='talk'){const head=actor.getObjectByName('office-head');if(head)head.rotation.y=Math.sin(time*4)*.12;}
      nodes.forEach((n,j)=>{positions[j].push(...n.position.toArray());rotations[j].push(...n.quaternion.toArray());});
    }
    clips.push(new THREE.AnimationClip(name,duration,nodes.flatMap((n,i)=>[new THREE.VectorKeyframeTrack(n.name+'.position',times,positions[i]),new THREE.QuaternionKeyframeTrack(n.name+'.quaternion',times,rotations[i])])));
  }
  updateOfficeCharacter(actor,{action:'idle',time:0});return clips;
}
