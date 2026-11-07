import * as THREE from 'three';
import {objectSkinFrame,SKIN_KINDS} from './office-skin-frame.js';
export const SKIN_ATLAS='./assets/office-world/skins/projects-painted-atlas-v1.png';
// Owns presentation only. Original nodes/geometry remain authoritative for depth,
// collision, ray picking and saves; no proxy furniture or Agent records are made.
export class OfficeObjectSkins{
 constructor(layer,{loader=new THREE.TextureLoader()}={}){
  this.layer=layer;this.visibility={skin:true,model:true,wireframe:false};this.records=new Map();this.wires=[];this.disposed=false;this.ready=false;this.status='loading';
  this.loader=loader;this.atlases=new Map();this.loadedAngles=new Set();this.failedAngles=new Set();this.requiredAngles=new Set([0]);this.loadAngle(0);
  const doc=layer.root.ownerDocument;if(doc){this.notice=doc.createElement('output');this.notice.className='hy-skin-notice';this.notice.setAttribute('role','status');this.notice.textContent='โหลดภาพสกินไม่สำเร็จ · แสดงโมเดลแทน';layer.root.append(this.notice);}
 }
 loadAngle(angle){
  if(this.disposed||this.atlases.has(angle))return;const src=angle?`./assets/office-world/skins/projects-painted-atlas-r${angle}-v1.png`:SKIN_ATLAS;
  try{const texture=this.loader.load(src,t=>{if(this.disposed)return;this.atlases.set(angle,t);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;this.loadedAngles.add(angle);this.ready=this.loadedAngles.has(0);this.apply();this.layer.draw();},undefined,()=>{if(this.disposed)return;this.loadedAngles.delete(angle);this.failedAngles.add(angle);this.ready=this.loadedAngles.has(0);this.apply();this.layer.draw();});this.atlases.set(angle,texture);if(!angle)this.atlas=texture;}catch{this.failedAngles.add(angle);}
 }
 setModelRotation(model,angle){if(this.disposed)return;if(model.userData.skinRotation===angle)return;model.userData.skinRotation=angle;this.sync();}
 loadSurfaces(loader=new THREE.TextureLoader()){
  try{this.surfaceAtlas=loader.load('./assets/office-world/skins/projects-surfaces-v1.png',texture=>{if(this.disposed)return;texture.colorSpace=THREE.SRGBColorSpace;const crop=side=>{const image=texture.image,canvas=this.layer.doc.createElement('canvas');canvas.width=image.width/2;canvas.height=image.height;canvas.getContext('2d').drawImage(image,side*image.width/2,0,image.width/2,image.height,0,0,canvas.width,canvas.height);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;};this.plaster=crop(0);this.oak=crop(1);this.oak.repeat.set(.25,.25);this.surfaceReady=true;this.sync();this.layer.draw();},undefined,()=>{if(!this.disposed){this.surfaceError=true;this.apply();this.layer.draw();}});}catch{this.surfaceError=true;}
 }
 restore(){for(const [mesh,r]of this.records){mesh.material=r.original;mesh.visible=r.visible;} }
 clear(){this.restore();for(const r of this.records.values())r.skin?.dispose();this.records.clear();for(const wire of this.wires){wire.removeFromParent();wire.geometry.dispose();wire.material.dispose();}this.wires=[];}
 sync(){
  if(this.disposed)return;this.clear();const l=this.layer,actorNodes=new Set();for(const actor of l.actors.values())actor.model.traverse(n=>actorNodes.add(n));
  const frames=new Map();for(const model of l.models.values()){const index=SKIN_KINDS.indexOf(model.userData.officeKind);if(index>=0){const angle=model.userData.skinRotation||0;this.loadAngle(angle);frames.set(model,{index,angle,...objectSkinFrame(model,model.userData.officeKind,angle),inverse:model.matrixWorld.clone().invert()});}}
  this.requiredAngles=new Set([...frames.values()].map(f=>f.angle));
  const nodes=[];l.structureGroup.traverse(n=>{if((n.isMesh||n.isLine||n.isPoints)&&!actorNodes.has(n)&&!n.userData.skinWire)nodes.push(n);});
  for(const mesh of nodes){let root=mesh;while(root&&!frames.has(root))root=root.parent;const frame=frames.get(root),original=mesh.material,r={original,visible:mesh.visible,angle:frame?.angle||0};
   if(frame&&!Array.isArray(original)){const projection=frame.matrix.clone().multiply(frame.inverse).multiply(mesh.matrixWorld);r.skin=new THREE.ShaderMaterial({name:'painted-object-skin',uniforms:{art:{value:this.atlases.get(r.angle)},projection:{value:projection},cell:{value:new THREE.Vector2(frame.index%3,1-Math.floor(frame.index/3))},base:{value:original.color?.clone()||new THREE.Color('#eee2ca')},alpha:{value:original.opacity},glow:{value:original.emissive?.clone()||new THREE.Color(0)}},vertexShader:'uniform mat4 projection; varying vec2 artUv; void main(){vec4 p=projection*vec4(position,1.);artUv=p.xy/p.w*.5+.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D art;uniform vec2 cell;uniform vec3 base;uniform vec3 glow;uniform float alpha;varying vec2 artUv;void main(){vec2 uv=clamp(artUv,vec2(0.001),vec2(.999));vec4 skin=texture2D(art,(uv+cell)/vec2(3.,2.));gl_FragColor=vec4(mix(base,skin.rgb,skin.a)+glow,alpha);\n#include <colorspace_fragment>\n}',transparent:original.transparent,opacity:original.opacity,depthWrite:original.depthWrite,depthTest:original.depthTest,side:original.side,toneMapped:false});r.skin.userData.officeSkin=true;}
   if(mesh.isMesh&&!frame&&this.surfaceReady&&!Array.isArray(original)){const a=l.architecture.userData.officeArchitecture,work=a?.floorMeshes?.work;let isWall=false;for(const wall of a?.walls||[]){let p=mesh;while(p){if(p===wall.group){isWall=true;break;}p=p.parent;}if(isWall)break;}if(mesh===work||(isWall&&!original.transparent&&original.color?.r>.5&&original.color?.g>.4)){r.skin=original.clone();r.skin.map=mesh===work?this.oak:this.plaster;r.skin.color.set('#ffffff');r.skin.needsUpdate=true;r.skin.userData.officeSkin=true;}}
   this.records.set(mesh,r);if(mesh===l.ground||!mesh.isMesh)continue;const wire=new THREE.LineSegments(new THREE.WireframeGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:'#9b692b',transparent:true,opacity:.42,depthTest:true,depthWrite:false}));wire.userData.skinWire=true;wire.raycast=()=>{};wire.renderOrder=10;wire.visible=false;mesh.add(wire);this.wires.push(wire);
  }
  this.apply();this.layer.prepareShadowMaterials?.();
 }
 setVisibility(next){let changed=false;for(const k of ['skin','model','wireframe'])if(typeof next[k]==='boolean'&&this.visibility[k]!==next[k]){this.visibility[k]=next[k];changed=true;}if(changed)this.layer.invalidateStaticShadows?.();this.apply();if(changed)this.layer.prepareShadowMaterials?.();this.render();return {...this.visibility};}
 apply(){if(this.disposed)return;this.status=[...this.requiredAngles].some(a=>this.failedAngles.has(a))?'error':[...this.requiredAngles].every(a=>this.loadedAngles.has(a))?'ready':'loading';const v=this.visibility;for(const [mesh,r]of this.records){const art=v.skin&&(r.skin?.uniforms?this.loadedAngles.has(r.angle):this.surfaceReady)&&r.skin;mesh.material=art?r.skin:r.original;if(r.skin){r.skin.opacity=r.original.opacity;if(r.skin.uniforms){r.skin.uniforms.art.value=this.atlases.get(r.angle);r.skin.uniforms.alpha.value=r.original.opacity;r.skin.uniforms.glow.value.copy(r.original.emissive||new THREE.Color(0));}}mesh.visible=r.visible&&(v.skin||v.model);}
  // Lines are children of physical meshes, so wire-only needs depth-bearing
  // parents visible with colour writes disabled. Restore flags before each pass.
  const d=this.layer.root.dataset;d.skinStatus=this.status;d.skinVisible=String(v.skin);d.sheetImageVisible=String(v.skin);d.modelVisible=String(v.model);d.wireframeVisible=String(v.wireframe);
  if(this.notice){this.notice.hidden=!v.skin||!(this.status==='error'||this.surfaceError);this.notice.textContent=this.status==='error'?'โหลดภาพสกินไม่สำเร็จ · แสดงโมเดลแทน':'โหลดสกินพื้นผิวไม่สำเร็จ · แสดงพื้นผิวโมเดลแทน';}
 }
 render(){if(this.disposed)return;this.apply();const l=this.layer,v=this.visibility,flags=[];try{for(const [mesh,r]of this.records){if(v.wireframe&&!v.skin&&!v.model)mesh.visible=r.visible;for(const material of [].concat(mesh.material)){flags.push([material,material.colorWrite]);if(!v.skin&&!v.model)material.colorWrite=false;}}for(const wire of this.wires)wire.visible=v.wireframe;l.renderer.render(l.scene,l.camera);}finally{for(const [m,c]of flags)m.colorWrite=c;}}
 dispose(){if(this.disposed)return;this.disposed=true;this.clear();for(const t of new Set(this.atlases.values()))t?.dispose();this.atlases.clear();this.surfaceAtlas?.dispose();this.plaster?.dispose();this.oak?.dispose();this.notice?.remove();}
}
