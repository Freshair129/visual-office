import * as THREE from 'three';
import {officeCamera} from './office-projection.js';
export const SKIN_KINDS=['work-desk','task-chair','team-sofa','water-cooler','whiteboard','plant'];
// Reference and runtime share this local projection. World translation/scale never
// enter its UVs; those are applied by the original object hierarchy afterwards.
export function objectSkinFrame(model,kind,rotation=0){
 const source=officeCamera(),yaw=(kind==='team-sofa'?-Math.PI/2:0)+rotation*Math.PI/180;
 const view=source.matrixWorldInverse.clone();view.setPosition(0,0,0);view.multiply(new THREE.Matrix4().makeRotationY(yaw));
 model.updateWorldMatrix(true,true);const inverse=model.matrixWorld.clone().invert(),bounds=new THREE.Box3(),p=new THREE.Vector3();
 model.traverse(n=>{if(!n.isMesh||n.userData.skinWire)return;const a=n.geometry.attributes.position,m=new THREE.Matrix4().multiplyMatrices(inverse,n.matrixWorld);for(let i=0;i<a.count;i++)bounds.expandByPoint(p.fromBufferAttribute(a,i).applyMatrix4(m).applyMatrix4(view));});
 const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),half=Math.max(size.x,size.y)*.55;
 const camera=new THREE.OrthographicCamera(center.x-half,center.x+half,center.y+half,center.y-half,.01,100);
 camera.matrixAutoUpdate=false;camera.matrix.copy(view.clone().invert());camera.position.setFromMatrixPosition(camera.matrix);camera.matrixWorld.copy(camera.matrix);camera.matrixWorldInverse.copy(view);camera.updateProjectionMatrix();
 // A camera-local translation keeps all reference vertices in front of the eye.
 camera.matrix.elements[12]+=source.position.x*Math.cos(yaw)-source.position.z*Math.sin(yaw);
 camera.matrix.elements[13]+=source.position.y;
 camera.matrix.elements[14]+=source.position.x*Math.sin(yaw)+source.position.z*Math.cos(yaw);
 camera.matrixWorld.copy(camera.matrix);camera.matrixWorldInverse.copy(camera.matrix).invert();
 return {camera,matrix:new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),bounds};
}
