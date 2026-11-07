import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {makeStudioDesk,makeStudioChair,makeStudioSofa,makeStudioWhiteboard,makeStudioPlant} from './studio-models.js';
function waterCooler(){
  const group=new THREE.Group(),add=(w,h,d,x,y,z,color)=>{const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,.035),new THREE.MeshStandardMaterial({color,roughness:.65}));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;group.add(m);};
  add(.56,1,.5,0,.5,0,'#e3e5dc');add(.4,.34,.03,0,.76,.265,'#596e70');add(.35,.04,.3,0,.55,.23,'#a4c6c6');
  const bottle=new THREE.Mesh(new THREE.CylinderGeometry(.2,.22,.48,24),new THREE.MeshStandardMaterial({color:'#76b8d1',roughness:.25,transparent:true,opacity:.85}));bottle.position.y=1.23;group.add(bottle);return group;
}
function groundArrow(){
  const group=new THREE.Group();
  const plate=new THREE.Mesh(new RoundedBoxGeometry(1.2,.025,.7,2,.012),new THREE.MeshStandardMaterial({color:'#fff1d5',roughness:.9}));plate.position.y=.028;plate.receiveShadow=true;group.add(plate);
  const shape=new THREE.Shape();shape.moveTo(-.16,-.18);shape.lineTo(.16,-.18);shape.lineTo(.16,.02);shape.lineTo(.34,.02);shape.lineTo(0,.26);shape.lineTo(-.34,.02);shape.lineTo(-.16,.02);shape.closePath();
  const arrow=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshStandardMaterial({color:'#d09534',roughness:.9,side:THREE.DoubleSide}));arrow.rotation.x=-Math.PI/2;arrow.position.y=.045;group.add(arrow);return group;
}
export function makeOfficeProp(kind,tier='studio'){return kind==='wayfinding-arrow'?groundArrow():kind==='work-desk'?makeStudioDesk(tier,{chair:false}):kind==='task-chair'?makeStudioChair():kind==='team-sofa'?makeStudioSofa():kind==='whiteboard'?makeStudioWhiteboard():kind==='plant'?makeStudioPlant():waterCooler();}
export const officePropScale=o=>o.kind==='work-desk'?o.scale/.62:o.kind==='task-chair'?o.scale/.72:o.scale;
