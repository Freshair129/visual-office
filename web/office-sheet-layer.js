import * as THREE from 'three';
// One static render of the SAME scene/camera, followed by depth-only static meshes
// and live actors. Dev changes visibility/material flags, never scene membership.
export class OfficeSheetLayer{
 constructor(layer,{Target=THREE.WebGLRenderTarget}={}){
  this.layer=layer;this.target=new Target(1536,1024,{depthBuffer:true});this.target.texture.colorSpace=THREE.SRGBColorSpace;
  const c=layer.camera,w=c.right-c.left,h=c.top-c.bottom;
  this.image=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:this.target.texture,transparent:true,depthWrite:false,depthTest:false,toneMapped:false}));
  this.image.name='same-sheet-image-layer';this.image.renderOrder=-1000;this.image.frustumCulled=false;this.image.quaternion.copy(c.quaternion);this.image.position.set((c.left+c.right)/2,(c.top+c.bottom)/2,0).applyQuaternion(c.quaternion);this.imageScene=new THREE.Scene();this.imageScene.add(this.image);
  this.mode='art';this.dirty=true;this.actorNodes=new Set();this.originalStates=new Map();
 }
 staticMeshes(){this.actorNodes.clear();for(const actor of this.layer.actors.values())actor.model.traverse(n=>this.actorNodes.add(n));const result=[];this.layer.structureGroup.traverse(n=>{if((n.isMesh||n.isLine||n.isPoints)&&!this.actorNodes.has(n))result.push(n);});return result;}
 configure(){for(const node of this.staticMeshes()){if(!this.originalStates.has(node))this.originalStates.set(node,{renderOrder:node.renderOrder,materials:[].concat(node.material).map(m=>[m,m.colorWrite,m.wireframe])});node.renderOrder=-500;for(const m of [].concat(node.material)){m.colorWrite=this.mode!=='art';if(m.wireframe!==(this.mode!=='art')){m.wireframe=this.mode!=='art';m.needsUpdate=true;}}}this.image.visible=this.mode!=='structure';this.layer.root.dataset.sheetImageVisible=String(this.image.visible);this.image.material.opacity=1;}
 bake(){
  const l=this.layer,r=l.renderer;if(!r.setRenderTarget)return;const target=r.getRenderTarget(),actors=[...l.actors.values()].map(a=>[a.model,a.model.visible]),imageVisible=this.image.visible,helperVisible=l.selectionHelper?.visible;
  const meshes=this.staticMeshes(),flags=meshes.map(n=>[n,n.renderOrder,[].concat(n.material).map(m=>[m,m.colorWrite,m.wireframe])]);
  try{this.image.visible=false;for(const [actor]of actors)actor.visible=false;if(l.selectionHelper)l.selectionHelper.visible=false;for(const n of meshes){n.renderOrder=0;for(const m of [].concat(n.material)){m.colorWrite=true;m.wireframe=false;m.needsUpdate=true;}}r.setRenderTarget(this.target);r.clear();r.render(l.scene,l.camera);this.dirty=false;}
  finally{r.setRenderTarget(target);this.image.visible=imageVisible;for(const [actor,visible]of actors)actor.visible=visible;if(l.selectionHelper)l.selectionHelper.visible=helperVisible;for(const [n,order,materials]of flags){n.renderOrder=order;for(const [m,colorWrite,wireframe]of materials){m.colorWrite=colorWrite;m.wireframe=wireframe;m.needsUpdate=true;}}}
 }
 render(){
  if(this.dirty)this.bake();this.configure();const l=this.layer,r=l.renderer,autoClear=r.autoClear,hidden=[];
  try{r.autoClear=false;r.clear();if(this.image.visible)r.render(this.imageScene,l.camera);r.clearDepth?.();
   if(this.mode==='art'){
    const actors=[...l.actors.values()].map(a=>[a.model,a.model.visible]),helper=l.selectionHelper,helperVisible=helper?.visible;
    try{for(const [actor]of actors)actor.visible=false;if(helper)helper.visible=false;r.render(l.scene,l.camera);}
    finally{for(const [actor,visible]of actors)actor.visible=visible;if(helper)helper.visible=helperVisible;}
    // A dedicated static depth pass handles depth-writing transparent props too.
    // Intentionally see-through glass retains depthWrite=false.
    for(const node of this.staticMeshes()){hidden.push([node,node.visible]);node.visible=false;}r.render(l.scene,l.camera);
   }else r.render(l.scene,l.camera);
  }finally{for(const [node,visible]of hidden)node.visible=visible;r.autoClear=autoClear;}
 }

 setMode(mode){this.mode=mode||'art';this.image.visible=this.mode!=='structure';this.layer.root.dataset.sheetImageVisible=String(this.image.visible);this.render();}
 invalidate(){this.dirty=true;}
 restoreStatic(){for(const [node,state]of this.originalStates){node.renderOrder=state.renderOrder;for(const [m,colorWrite,wireframe]of state.materials){m.colorWrite=colorWrite;if(m.wireframe!==wireframe){m.wireframe=wireframe;m.needsUpdate=true;}}}this.originalStates.clear();}
 dispose(){this.restoreStatic();this.image.removeFromParent();this.image.geometry.dispose();this.image.material.dispose();this.target.dispose();}
}
