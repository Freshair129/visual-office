import * as THREE from 'three';
import {catalog} from './hybrid-state.js';
import {groundToWorld} from './office-projection.js';

// Presentation only; persisted room/Agent data never selects or owns this policy.
export const usesPaintedSkeleton=(room,floor)=>floor==='projects'&&room?.background==='office'&&!room.blueprint&&!room.blueprintPlan;
export function paintedAlphaHit(mask,uv){if(!mask||!uv)return true;const x=Math.max(0,Math.min(mask.width-1,Math.floor(uv.x*mask.width))),y=Math.max(0,Math.min(mask.height-1,Math.floor((1-uv.y)*mask.height)));return mask.data[(y*mask.width+x)*4+3]>=Math.ceil(.08*255);}

export function createPaintedFurniture(object,camera,{depthRise=1.5,depthFront=0,imageSrc,loadTexture=(url,ready,error)=>new THREE.TextureLoader().load(url,ready,undefined,error),onReady=()=>{},onError=()=>{}}={}){
 const item=catalog[object.kind],group=new THREE.Group();
 group.userData.paintedFurniture=true;group.userData.officeId=object.id;
 const width=item.width/100*20;
 const material=new THREE.MeshBasicMaterial({alphaTest:.08,depthWrite:true,toneMapped:false,side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width),material);
 // Preserve authored static art before approximate room masks restrict actors.
 mesh.renderOrder=-20;
 mesh.raycast=function(raycaster,hits){const candidates=[];THREE.Mesh.prototype.raycast.call(this,raycaster,candidates);for(const hit of candidates)if(paintedAlphaHit(this.userData.alphaMask,hit.uv))hits.push(hit);};
 // Project the exact original image silhouette, but give its height measured
 // world-depth from the existing prop model. A constant-depth card puts torsos
 // in front; using the entire image height as metres hides seated heads.
 mesh.quaternion.copy(camera.quaternion);group.add(mesh);
 // Upper isometric pixels include the rear edge as well as object height.
 // Subtract the measured ground-depth span so monitors do not mask seated heads
 // while the nearer desktop still masks the torso.
 const rise=depthRise*camera.position.clone().normalize().y-depthFront*2;
 const geometry=height=>{const g=new THREE.PlaneGeometry(width,height),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,p.getY(i)/height*rise);p.needsUpdate=true;g.computeVertexNormals();return g;};
 // An impostor represents the prop's front surface, not a sheet through its centre.
 const place=height=>{mesh.position.set(0,height*.4,rise*.4+depthFront).applyQuaternion(camera.quaternion);};
 mesh.geometry.dispose();mesh.geometry=geometry(width);
 place(width);group.position.copy(groundToWorld(object));group.scale.set(object.flip?-object.scale:object.scale,object.scale,object.scale);
 // Mirror the image in camera coordinates rather than reflecting the world axes.
 group.scale.x=object.scale;mesh.scale.x=object.flip?-1:1;
 const ready=texture=>{
  if(group.userData.disposed){texture.dispose();return;}
  texture.colorSpace=THREE.SRGBColorSpace;
  const height=width*(texture.image?.height||1)/(texture.image?.width||1);
  mesh.geometry.dispose();mesh.geometry=geometry(height);place(height);
  material.map=texture;material.needsUpdate=true;onReady();
  try{const canvas=texture.image?.ownerDocument?.createElement('canvas');if(canvas){canvas.width=canvas.height=128;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(texture.image,0,0,128,128);mesh.userData.alphaMask={width:128,height:128,data:context.getImageData(0,0,128,128).data};}}catch{/* Keyboard selection remains available if image sampling is blocked. */}
 };
 const texture=loadTexture(imageSrc||item.src,ready,()=>{if(!group.userData.disposed)onError();});
 texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;
 return group;
}

export function createPaintedWallMasks(architecture){
 const group=new THREE.Group();group.name='painted-room-depth-skeleton';
 architecture.updateWorldMatrix(true,true);
 for(const source of architecture.userData.wallMeshes){
  const material=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,side:THREE.DoubleSide});
  const mask=new THREE.Mesh(source.geometry.clone(),material);
  mask.matrix.copy(source.matrixWorld);if(architecture.parent)mask.matrix.premultiply(architecture.parent.matrixWorld.clone().invert());mask.matrixAutoUpdate=false;
  mask.userData={...source.userData,officeWall:true};mask.renderOrder=-10;group.add(mask);
 }
 return group;
}

export function disposePaintedFurniture(group){
 if(!group||group.userData.disposed)return;group.userData.disposed=true;
 const textures=new Set();group.traverse(node=>{node.geometry?.dispose();for(const material of [].concat(node.material||[])){if(material.map)textures.add(material.map);material.dispose();}});
 textures.forEach(texture=>texture.dispose());
}
