import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createHumanCharacter,poseHumanCharacter} from '../web/characters/human.js';
import {createWangjai,poseWangjai} from '../web/characters/wangjai.js';

globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}readAsDataURL(b){b.arrayBuffer().then(r=>{this.result=`data:${b.type};base64,${Buffer.from(r).toString('base64')}`;this.onloadend?.();});}};
const sha=b=>createHash('sha256').update(b).digest('hex');
const dir='web/assets/models/characters';await mkdir(dir,{recursive:true});
await mkdir(`${dir}/references`,{recursive:true});
for(const name of ['zuri','wangjai','office-staff']){
  const file=`${name}-sheet-v1.png`;
  await writeFile(`${dir}/references/${file}`,await readFile(`docs/game-design/characters/2026-10-25-brand-study/${file}`));
}
for(const name of ['tripo-front-preview.jpg','tripo-face-preview.jpg'])await writeFile(`${dir}/references/${name}`,await readFile(`docs/game-design/characters/2026-10-25-brand-study/local-refinement/${name}`));
function clips(root,pose){
  const nodes=[];root.traverse(n=>{if(n!==root&&n.name)nodes.push(n);});
  return ['idle','walking','seated','wave','point'].map(action=>{
    const duration=action==='walking'?1.12:action==='wave'?Math.PI*2/5:4,frames=Math.ceil(duration*24),times=Array.from({length:frames+1},(_,i)=>i/frames*duration);
    const sample=nodes.map(n=>({n,p:[],q:[],s:[]}));
    for(const time of times){pose(root,{action,time});for(const f of sample){f.p.push(...f.n.position);f.q.push(...f.n.quaternion);f.s.push(...f.n.scale);}}
    const tracks=[];for(const {n,p,q,s}of sample){for(const [key,data,size,Track]of [['position',p,3,T.VectorKeyframeTrack],['quaternion',q,4,T.QuaternionKeyframeTrack],['scale',s,3,T.VectorKeyframeTrack]]){
      // Constant tracks also restore each clip's different rest transform.
      const constant=data.every((value,i)=>Math.abs(value-data[i%size])<1e-7);
      tracks.push(new Track(`${n.name}.${key}`,constant?[0,duration]:times,constant?[...data.slice(0,size),...data.slice(0,size)]:data));
    }}
    return new T.AnimationClip(action,duration,tracks);
  });
}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(name,data){const t=Buffer.from(name),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
// Original procedural textile source. Knit flecks and windowpane grid are
// embedded into the GLB; no browser canvas or external image dependency.
function knitPng(){
  const w=512,h=512,raw=Buffer.alloc(h*(w*4+1));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*(w*4+1)+1+x*4,grid=x%128<2||y%128<2,fiber=Math.sin(x*2.1+y*.12)*1.5+Math.cos(y*3.2+x*.4),base=grid?[215,172,111]:[255,244,226];for(let c=0;c<3;c++)raw[i+c]=Math.max(0,Math.min(255,Math.round(base[c]+fiber)));raw[i+3]=255;}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
// Authored strand albedo. Longitudinal fibres follow each lock's UVs. This is
// embedded diffuse detail, not a replacement render or reference-sheet crop.
function hairPng(refined=false){
  const w=256,h=512,raw=Buffer.alloc(h*(w*4+1));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/w,v=y/h,flow=u+.006*Math.sin(v*5+u*17);
    const fine=Math.sin(flow*TAU*79+Math.sin(v*7+u*23))*Math.sin(flow*TAU*31);
    const band=.5+.5*Math.cos(flow*TAU*7+v*1.7),light=refined?.90+.045*band+.035*fine:.73+.20*band+.055*fine;
    const i=y*(w*4+1)+1+x*4;for(let c=0;c<3;c++)raw[i+c]=Math.round(255*light);raw[i+3]=255;
  }
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const TAU=Math.PI*2;
function embedTexture(bytes,png,name,materialNames,replaceColor=false){
  const jsonLen=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+jsonLen)),binStart=28+jsonLen,bin=bytes.subarray(binStart),offset=(bin.length+3)&~3;
  const payload=Buffer.concat([bin,Buffer.alloc(offset-bin.length),png,Buffer.alloc((4-png.length%4)%4)]);
  const bv=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:offset,byteLength:png.length});
  j.images||=[];j.samplers||=[];j.textures||=[];
  const imageIndex=j.images.length,sampler=j.samplers.length,texture=j.textures.length;
  j.images.push({mimeType:'image/png',bufferView:bv,name});j.samplers.push({magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497});j.textures.push({sampler,source:imageIndex});
  for(const m of j.materials)if(materialNames.includes(m.name)){if(replaceColor)m.pbrMetallicRoughness.baseColorFactor=[1,1,1,1];m.pbrMetallicRoughness.baseColorTexture={index:texture};}
  j.buffers[0].byteLength=payload.length;const jt=Buffer.from(JSON.stringify(j)),jl=(jt.length+3)&~3,header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+jl+payload.length,8);header.writeUInt32LE(jl,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(payload.length);bh.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,jt,Buffer.alloc(jl-jt.length,32),bh,payload]);
}
const manifest={schemaVersion:'brand-characters/v1',quality:'model-review',units:'metres',license:'Original authored geometry, procedural textiles and an original ImageGen Zuri face albedo for Visual Office; brand identities remain Zuri-owned.',sourceKit:'Zuri Character Kit v0.9.4',approvedSheets:'docs/game-design/characters/2026-10-25-brand-study',assets:[]};
for(const id of ['zuri','wangjai','staff-a','staff-b']){
  const robot=id==='wangjai',pose=robot?poseWangjai:poseHumanCharacter,root=robot?createWangjai():createHumanCharacter(id),animations=clips(root,pose);pose(root,{action:'idle',time:0});
  let triangles=0,meshes=0;root.traverse(n=>{if(n.isMesh){triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;meshes++;}});
  let bytes=Buffer.from(await new GLTFExporter().parseAsync(root,{binary:true,animations,trs:true}));
  if(id==='zuri')bytes=embedTexture(bytes,knitPng(),'original-windowpane-knit',['windowpane-knit'],true);
  if(!robot)bytes=embedTexture(bytes,hairPng(id==='zuri'),'original-hair-fibres',['brown-hair','hair-dark','hair-mid','hair-light']);
  if(id==='zuri')bytes=embedTexture(bytes,await readFile('docs/game-design/characters/2026-10-25-brand-study/local-rebuild/zuri-face-albedo-v1.png'),'original-zuri-face-albedo',['zuri-painted-face'],true);
  if(bytes.length>5*1024*1024||triangles>=120000||meshes>150)throw Error(`${id} exceeds budget: ${bytes.length} bytes / ${triangles} triangles / ${meshes} meshes`);
  await writeFile(`${dir}/${id}.glb`,bytes);const source=`docs/game-design/characters/2026-10-25-brand-study/${robot?'wangjai':id==='zuri'?'zuri':'office-staff'}-sheet-v1.png`;
  manifest.assets.push({id,file:`${id}.glb`,bytes:bytes.length,sha256:sha(bytes),triangles,meshes,clips:animations.map(c=>c.name),sheet:source,sheetSha256:sha(await readFile(source)),scaleNote:robot?'0.90 m local preview proposal; no canonical physical height':id==='zuri'?'1.60 m body; hair and shoes additional':'Local generic adult art; no role assignment'});
  if(id==='zuri')manifest.assets.at(-1).production={method:'original-local-sculpt',revision:'surface-refinement-v2',source:'web/characters/zuri-head.js',albedoSource:'docs/game-design/characters/2026-10-25-brand-study/local-rebuild/zuri-face-albedo-v1.png',albedoSha256:sha(await readFile('docs/game-design/characters/2026-10-25-brand-study/local-rebuild/zuri-face-albedo-v1.png')),providerModelImported:false};
  console.log(`${id}: ${triangles} triangles; ${(bytes.length/1024/1024).toFixed(2)} MiB; 5 clips`);
}
await writeFile(`${dir}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
