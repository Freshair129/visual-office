import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {createOfficeCharacter,updateOfficeCharacter,disposeOfficeCharacter} from '../office-characters.js';
import {characterAppearance,characterAsset,characterClip,characterLegs} from './runtime-catalog.js';
import {fitLeg} from './seat-fit.js';

function release(root,{source=false}={}){
 const geometry=new Set(),materials=new Set(),textures=new Set(),skeletons=new Set();
 root?.traverse(n=>{if(n.skeleton)skeletons.add(n.skeleton);if(n.geometry)geometry.add(n.geometry);for(const m of [].concat(n.material||[])){materials.add(m);if(source)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
 for(const s of skeletons)s.dispose();for(const m of materials)m.dispose();
 if(source){for(const g of geometry)g.dispose();for(const t of textures)t.dispose();}root?.removeFromParent();
}
export class CharacterLibrary{
 constructor({load,fetcher=globalThis.fetch?.bind(globalThis),parse}={}){
  this.cache=new Map();this.manifests=new Map();this.actors=new Set();this.disposed=false;this.fetcher=fetcher;
  this.parse=parse||((bytes)=>{const loader=new GLTFLoader();loader.register(parser=>{parser.textureLoader=new T.TextureLoader(parser.options.manager);return {name:'character-local-image-decoder'};});return loader.parseAsync(bytes,'');});
  this.load=load||this.loadAsset.bind(this);
 }
 json(path){
  if(!this.manifests.has(path)){
   const p=Promise.resolve().then(async()=>{const r=await this.fetcher(path);if(!r.ok)throw Error('Character metadata unavailable');return r.json();});
   this.manifests.set(path,p);p.catch(()=>{if(this.manifests.get(path)===p)this.manifests.delete(path);});
  }
  return this.manifests.get(path);
 }
 async loadAsset(id){
  const info=characterAsset(id);if(!info)throw Error('Unknown character appearance');
  const manifest=this.json(info.manifest);
  try{
   const meta=(await manifest).assets?.find(a=>a.id===id);
   if(!meta||meta.file!==info.path.split('/').at(-1)||meta.lod!==1)throw Error('Invalid character LOD metadata');
   if(!meta||!Number.isSafeInteger(meta.bytes)||meta.bytes<=0||meta.bytes>24*1024*1024||!/^[a-f0-9]{64}$/.test(meta.sha256))throw Error('Invalid character metadata');
   const response=await this.fetcher(info.path);if(!response.ok)throw Error('Character unavailable');const bytes=await response.arrayBuffer();
   if(bytes.byteLength!==meta.bytes)throw Error('Character size mismatch');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==meta.sha256)throw Error('Character hash mismatch');
   return await this.parse(bytes);
  }catch(error){if(this.manifests.get(info.manifest)===manifest)this.manifests.delete(info.manifest);throw error;}
 }
 source(id){
  if(this.disposed)return Promise.reject(Error('Character library disposed'));
  if(!this.cache.has(id)){const p=Promise.resolve().then(()=>this.load(id));this.cache.set(id,p);p.catch(()=>{if(this.cache.get(id)===p)this.cache.delete(id);});}
  return this.cache.get(id);
 }
 create(id,{index=0,onReady}={}){
  if(!characterAppearance(id)||this.disposed)throw Error('Unknown or unavailable character appearance');
  const root=new T.Group();root.name='runtime-character-'+id;
  const state={id,library:this,info:characterAppearance(id),status:'loading',disposed:false,pose:{action:'idle',time:0,dt:0},fitted:[]};root.userData.runtimeCharacter=state;
  state.fallback=createOfficeCharacter(index);root.add(state.fallback);this.actors.add(root);
  state.ready=this.source(id).then(source=>{
   if(state.disposed||this.disposed)return;
   const model=cloneSkeleton(source.scene);model.traverse(n=>{if(n.isMesh){n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone();n.castShadow=true;n.receiveShadow=true;n.frustumCulled=false;}});
   state.model=model;state.clips=source.animations||[];state.mixer=new T.AnimationMixer(model);
   state.legs=characterLegs(state.info.family).map(names=>names.map(name=>model.getObjectByName(name))).filter(leg=>leg.every(Boolean));
   disposeOfficeCharacter(state.fallback);state.fallback=null;root.add(model);state.status='ready';
   updateCharacter(root,{...state.pose,dt:0});onReady?.(root);
  }).catch(error=>{if(!state.disposed){state.status='fallback';state.error=String(error?.message||error);onReady?.(root);}});
  return root;
 }
 async dispose(){
  if(this.disposed)return;this.disposed=true;for(const actor of [...this.actors])disposeCharacter(actor);
  await Promise.allSettled([...this.cache.values()].map(p=>p.then(source=>release(source.scene,{source:true}))));this.cache.clear();this.manifests.clear();
 }
}
export function updateCharacter(root,pose={}){
 const s=root?.userData?.runtimeCharacter;if(!s||s.disposed)return;
 s.pose={...pose};const {action='idle',time=0,heading=0,seatHeight,dt=0,speed=.9}=pose;root.rotation.y=Number.isFinite(heading)?heading:0;
 if(s.fallback){updateOfficeCharacter(s.fallback,{...pose,heading:0,seatHeight:Number.isFinite(seatHeight)?seatHeight+.10:undefined});return;}
 // Restore the previous post-animation IK edits before the mixer's cached values
 // are evaluated again (including paused/reduced-motion frames).
 for(const [bone,q]of s.fitted)bone.quaternion.copy(q);s.fitted=[];s.model.position.y=0;
 const name=characterClip(action,s.clips.map(c=>c.name));const changed=name!==s.clip;
 if(changed){const next=s.clips.find(c=>c.name===name);if(s.active){if(dt>0)s.active.fadeOut(.16);else s.active.stop();}s.active=next?s.mixer.clipAction(next):null;s.active?.reset();if(dt>0)s.active?.fadeIn(.16);s.active?.play();s.clip=name;}
 if(s.active){s.active.timeScale=name==='walking'?T.MathUtils.clamp(speed/.9,.05,2):1;if(!dt)s.active.time=Number.isFinite(time)?Math.max(0,time)%s.active.getClip().duration:0;}
 s.mixer.update(Math.max(0,Math.min(.05,dt||0)));s.model.updateWorldMatrix(true,true);
 if(name==='seated'&&Number.isFinite(seatHeight)){
  const targets=s.legs.map(leg=>({leg,target:leg[2].getWorldPosition(new T.Vector3()),orientation:leg[2].getWorldQuaternion(new T.Quaternion())}));
  // Wangjai's short rigid legs naturally dangle from a human-height seat.
  // Align its shell to the actual (actor-local) cushion height; the human IK
  // correction limit would otherwise sink the mascot when scaled down.
  const offset=seatHeight-s.info.seatHeight;
  s.model.position.y=s.info.family==='robot'?offset:T.MathUtils.clamp(offset,-.18,.35);s.model.updateWorldMatrix(true,true);
  for(const {leg,target,orientation}of targets){for(const bone of leg)s.fitted.push([bone,bone.quaternion.clone()]);fitLeg(...leg,target,orientation);}s.model.updateWorldMatrix(true,true);
 }
 if(changed||s.lastSeatHeight!==seatHeight){s.model.traverse(n=>{if(n.isSkinnedMesh){n.computeBoundingBox();n.computeBoundingSphere();}});s.lastSeatHeight=seatHeight;}
}
export function presentedAction(root,requested='idle'){
 const s=root?.userData?.runtimeCharacter;if(!s||s.status!=='ready')return requested;
 if(s.clip==='seated')return ['sitting','resting'].includes(requested)?requested:'seated';
 return s.clip==='walking'?'walking':s.clip==='idle'?'idle':requested;
}
export function disposeCharacter(root){
 const s=root?.userData?.runtimeCharacter;if(!s||s.disposed)return;s.disposed=true;s.library.actors.delete(root);
 if(s.fallback)disposeOfficeCharacter(s.fallback);s.mixer?.stopAllAction();if(s.model){s.mixer?.uncacheRoot(s.model);release(s.model);}
 root.removeFromParent();root.clear();
}
