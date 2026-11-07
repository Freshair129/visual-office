import * as THREE from 'three';
import {officeCamera} from '../office-projection.js';
import {makeStudioDesk,makeStudioChair,disposeStudioObject} from '../studio-models.js';
// Authoring utility: generate source-controlled PNGs; no runtime WebGL is added to HybridScene.
try{
const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(1024,1024);renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0x000000,0);
for(const [key,create] of [['work-desk',()=>makeStudioDesk('studio',{chair:false})],['task-chair',makeStudioChair]]){
  const scene=new THREE.Scene(),model=create();model.rotation.y=Math.PI;scene.add(model);
  scene.add(new THREE.HemisphereLight('#fff5e2','#c2c9b8',2.2));const sun=new THREE.DirectionalLight('#fff1da',3.2);sun.position.set(-3,7,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=sun.shadow.camera.bottom=-3;sun.shadow.camera.right=sun.shadow.camera.top=3;sun.shadow.normalBias=.015;scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(6,6),new THREE.ShadowMaterial({opacity:.15}));ground.rotation.x=-Math.PI/2;ground.position.y=-.012;ground.receiveShadow=true;scene.add(ground);
  const camera=officeCamera();scene.updateMatrixWorld(true);const bounds=new THREE.Box2();
  model.traverse(mesh=>{if(!mesh.isMesh)return;const position=mesh.geometry.attributes.position;for(let i=0;i<position.count;i++){const p=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld).project(camera);bounds.expandByPoint(new THREE.Vector2(p.x*512,-p.y*512));}});
  const size=Math.max((bounds.max.x-bounds.min.x)/.88,(bounds.max.y-bounds.min.y)/.8),x=(bounds.min.x+bounds.max.x)/2-size/2+512,y=bounds.max.y-size*.9+512;
  renderer.render(scene,camera);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;canvas.getContext('2d').drawImage(renderer.domElement,x,y,size,size,0,0,1024,1024);
  const section=document.createElement('section'),h=document.createElement('h2'),b=document.createElement('button');h.textContent=key;b.type='button';b.textContent=`Download ${key}`;
  b.onclick=()=>{const a=document.createElement('a');a.download=`${key}-calibrated-v1.png`;a.href=canvas.toDataURL('image/png');a.click();};section.append(h,canvas,b);document.querySelector('main').append(section);
  disposeStudioObject(model);ground.geometry.dispose();ground.material.dispose();sun.shadow.map?.dispose();
}
renderer.dispose();document.querySelector('#status').textContent='Ready · both props share the calibrated camera';
}catch(error){document.querySelector('#status').textContent=`Cannot render: ${error.message}`;}
