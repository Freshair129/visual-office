import * as THREE from 'three';
import {surfaceMaterials} from './room-surfaces.js';

// Instance-owned overrides: never mutate materials shared by the source GLTF or tower.
export class SurfaceFinish{
  constructor(root,{targetId,exclude=[],materialColors}={}){
    this.materialColors=materialColors;
    this.meshes=new Map();this.originals=new Map();this.materials=new Set();this.textures=new Map();this.customTextures=new Map();this.revision=null;this.generation=0;
    root.traverse(node=>{
      if(!node.isMesh)return;
      let p=node;while(p&&!p.userData.surfaceId)p=p.parent;
      const id=targetId||p?.userData.surfaceId;if(!id||exclude.includes(id))return;
      if(!this.meshes.has(id))this.meshes.set(id,[]);
      this.meshes.get(id).push(node);this.originals.set(node,node.material);
    });
  }
  texture(kind){
    if(this.textures.has(kind))return this.textures.get(kind);
    const n=64,bytes=new Uint8Array(n*n*4);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const noise=((x*13+y*37+x*y*7)%31)/31;
      const v=kind==='wood'?244+8*Math.sin(y*.7+Math.sin(x*.12)*2):
        kind==='fabric'?((x%4===0||y%4===0)?240:252):238+noise*15;
      const i=(y*n+x)*4;bytes[i]=bytes[i+1]=bytes[i+2]=v;bytes[i+3]=255;
    }
    const t=new THREE.DataTexture(bytes,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(3,3);t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
    t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;
    this.textures.set(kind,t);return t;
  }
  apply(surfaces={}){
    const revision=JSON.stringify(surfaces);if(revision===this.revision)return;
    this.reset();this.revision=revision;
    for(const [id,finish] of Object.entries(surfaces)){
      const preset=surfaceMaterials.find(m=>m.id===finish.material);
      for(const mesh of this.meshes.get(id)||[]){
        const paint=source=>{
          if(this.materialColors&&!this.materialColors.includes(source.color?.getHexString()))return source;
          const m=source.clone();this.materials.add(m);
          if(finish.color)m.color.set(finish.color);
          if(preset&&preset.id!=='original'){
            m.roughness=preset.roughness;m.metalness=preset.metalness;
            m.transparent=!!preset.opacity;m.opacity=preset.opacity??1;m.depthWrite=!m.transparent;
            m.map=['wood','stone','fabric'].includes(preset.id)?this.texture(preset.id):null;
          }
          if(finish.texture)m.map=this.imageTexture(finish.texture);
          m.needsUpdate=true;return m;
        };
        const original=this.originals.get(mesh);mesh.material=Array.isArray(original)?original.map(paint):paint(original);
      }
    }
  }
  imageTexture(spec){
    const key=JSON.stringify(spec);if(this.customTextures.has(key))return this.customTextures.get(key);
    // Keep GPU allocation dimensions stable after the first render while PNG decoding is pending.
    const canvas=document.createElement('canvas');
    let width=512,height=512;
    try{const bytes=Uint8Array.from(atob(spec.data.slice(22)),c=>c.charCodeAt(0)),v=new DataView(bytes.buffer),w=v.getUint32(16),h=v.getUint32(20);if(w>=1&&h>=1&&w<=512&&h<=512){width=w;height=h;}}catch{}
    canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
    const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.repeat.set(spec.repeatX,spec.repeatY);t.offset.set(spec.offsetX,spec.offsetY);t.center.set(.5,.5);t.rotation=spec.rotation*Math.PI/180;
    this.customTextures.set(key,t);const generation=this.generation;
    let settled;const loaded=new Promise(resolve=>settled=resolve);(this.pending||=[]).push(loaded);
    const image=new Image();
    image.onload=()=>{
      if(generation!==this.generation){settled(false);return;}
      context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
      context.globalAlpha=spec.opacity;context.drawImage(image,0,0,canvas.width,canvas.height);context.globalAlpha=1;t.needsUpdate=true;settled(true);
    };
    image.onerror=()=>{settled(false);if(generation===this.generation)console.warn('ไม่สามารถอ่าน texture PNG ได้');};
    image.src=spec.data;return t;
  }
  reset(){
    this.pending=[];
    this.generation++;
    for(const t of this.customTextures.values())t.dispose();this.customTextures.clear();
    for(const [mesh,material] of this.originals)mesh.material=material;
    for(const m of this.materials)m.dispose();this.materials.clear();
    this.revision=null;
  }
  dispose(){this.reset();for(const t of this.textures.values())t.dispose();this.textures.clear();}
}
