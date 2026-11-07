import * as THREE from 'three';
// Calibrated against the painted room's two ground-plane axes (pixel slope ~.52).
// This is an orthographic art camera, not a Business or Agent coordinate system.
export function officeCamera(){
  const camera=new THREE.OrthographicCamera(-2,2,2,-2,.01,100);
  const elevation=Math.asin(.52),distance=12;
  camera.position.set(Math.cos(elevation)*distance/Math.SQRT2,Math.sin(elevation)*distance,Math.cos(elevation)*distance/Math.SQRT2);
  camera.lookAt(0,0,0);camera.updateMatrixWorld(true);return camera;
}
export function officeSceneCamera(){const camera=officeCamera();camera.left=-10;camera.right=10;camera.top=13.3333333333*.65;camera.bottom=-13.3333333333*.35;camera.updateProjectionMatrix();return camera;}
export function groundToWorld({x,y}){
  const horizontal=(x/100-.5)*20,vertical=(.65-y/100)*(40/3),sum=-vertical/.52;
  return new THREE.Vector3((horizontal+sum)/Math.SQRT2,0,(sum-horizontal)/Math.SQRT2);
}
export function worldToGround(position){const horizontal=(position.x-position.z)/Math.SQRT2,vertical=-(position.x+position.z)*.52/Math.SQRT2;return{x:50+horizontal*5,y:65-vertical/(40/3)*100};}
