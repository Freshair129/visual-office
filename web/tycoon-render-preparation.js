import * as THREE from 'three';

// @tested tests/tycoon-render-preparation.test.mjs
const ownedDepthMaterials=new WeakMap();
const SHADOW_SIDES=new Map([[THREE.FrontSide,THREE.BackSide],[THREE.BackSide,THREE.FrontSide],[THREE.DoubleSide,THREE.DoubleSide]]);

function createMonitor(renderer,isCurrent){
 const context=renderer?.getContext?.(),canvas=renderer?.domElement;let contextInvalidated=false;
 const onLost=()=>{contextInvalidated=true;};canvas?.addEventListener?.('webglcontextlost',onLost);
 return {reason(){if(!isCurrent())return 'superseded';if(contextInvalidated||context?.isContextLost?.())return 'context-lost';return null;},dispose(){canvas?.removeEventListener?.('webglcontextlost',onLost);}};
}

function addProgram(program,programs,monitor){
 const invalid=monitor.reason();if(invalid)return invalid;
 if(!program)return false;
 const isReady=program.isReady,afterRead=monitor.reason();if(afterRead)return afterRead;
 if(typeof isReady!=='function')return false;
 programs.add(program);return null;
}

function collectPrograms(renderer,materials,programs,monitor){
 for(const material of materials||[]){
  const beforeRead=monitor.reason();if(beforeRead)return beforeRead;
  const properties=renderer.properties.get(material),afterRead=monitor.reason();if(afterRead)return afterRead;
  const variants=properties?.programs,afterMapRead=monitor.reason();if(afterMapRead)return afterMapRead;
  let found=false;
  if(variants instanceof Map){
   const values=variants.values(),afterValuesRead=monitor.reason();if(afterValuesRead)return afterValuesRead;
   for(const program of values){const status=addProgram(program,programs,monitor);if(status!==null)return status;found=true;}
  }else if(variants!==undefined&&variants!==null)return false;
  const beforeCurrentRead=monitor.reason();if(beforeCurrentRead)return beforeCurrentRead;
  const currentProgram=properties?.currentProgram,afterCurrentRead=monitor.reason();if(afterCurrentRead)return afterCurrentRead;
  if(currentProgram!==undefined&&currentProgram!==null){const status=addProgram(currentProgram,programs,monitor);if(status!==null)return status;found=true;}
  if(!found)return false;
 }
 return null;
}

async function waitForPrograms(renderer,programs,monitor,{started,now,yieldTurn,maxWaitMs}){
 const parallelCompile=renderer.extensions?.has?.('KHR_parallel_shader_compile')===true;
 const result=(completed,cancelled,reason)=>({completed,cancelled,programCount:programs.size,parallelCompile,durationMs:now()-started,...(reason?{reason}:{})});
 if(!parallelCompile)return result(false,false,'parallel-compile-unavailable');
 while(true){
  const invalid=monitor.reason();if(invalid)return result(false,true,invalid);
  let allReady=true;
  for(const program of programs){
   const beforePoll=monitor.reason();if(beforePoll)return result(false,true,beforePoll);
   const isReady=program?.isReady,afterRead=monitor.reason();if(afterRead)return result(false,true,afterRead);
   if(typeof isReady!=='function')return result(false,false,'program-readiness-unavailable');
   const ready=isReady.call(program),afterPoll=monitor.reason();if(afterPoll)return result(false,true,afterPoll);
   if(!ready){allReady=false;break;}
  }
  if(allReady){const beforeComplete=monitor.reason();if(beforeComplete)return result(false,true,beforeComplete);return result(true,false);}
  if(now()-started>=maxWaitMs)throw Error('GPU program preparation timed out');
  await yieldTurn();
 }
}

async function reflectPrograms(programs,monitor,{now,yieldTurn}){
 const reflectionStarted=now();let reflectedPrograms=0,maxReflectionProgramMs=0;
 const result=(completed,cancelled,reason)=>({completed,cancelled,reflectedPrograms,reflectionDurationMs:now()-reflectionStarted,maxReflectionProgramMs,...(reason?{reason}:{})});
 // In the pinned Three build, isReady only polls COMPLETION_STATUS_KHR. getUniforms
 // runs onFirstUse, checking shader diagnostics and building both uniform/attribute caches.
 const captured=[...programs];
 for(let index=0;index<captured.length;index++){
  const beforeRead=monitor.reason();if(beforeRead)return result(false,true,beforeRead);
  const program=captured[index];
  const getUniforms=program?.getUniforms,afterRead=monitor.reason();if(afterRead)return result(false,true,afterRead);
  if(typeof getUniforms!=='function')return result(false,false,'program-reflection-unavailable');
  const programStarted=now();let callFailed=false,thrown;
  try{getUniforms.call(program);}catch(error){callFailed=true;thrown=error;}
  const programMs=Math.max(0,now()-programStarted);maxReflectionProgramMs=Math.max(maxReflectionProgramMs,programMs);
  if(!callFailed)reflectedPrograms++;
  const afterCall=monitor.reason();if(afterCall)return result(false,true,afterCall);
  if(callFailed)throw thrown;
  const diagnostics=program.diagnostics,afterDiagnostics=monitor.reason();if(afterDiagnostics)return result(false,true,afterDiagnostics);
  const runnable=diagnostics?.runnable,afterRunnable=monitor.reason();if(afterRunnable)return result(false,true,afterRunnable);
  if(runnable===false)return result(false,false,'shader-program-unusable');
  if(index+1<captured.length){
   await yieldTurn();
   const afterYield=monitor.reason();if(afterYield)return result(false,true,afterYield);
  }
 }
 const beforeComplete=monitor.reason();if(beforeComplete)return result(false,true,beforeComplete);
 return result(true,false);
}

async function waitAndReflect(renderer,programs,monitor,{started,now,yieldTurn,maxWaitMs,reflect}){
 const readiness=await waitForPrograms(renderer,programs,monitor,{started,now,yieldTurn,maxWaitMs});
 if(!reflect||!readiness.completed)return readiness;
 const reflection=await reflectPrograms(programs,monitor,{now,yieldTurn});
 return {...readiness,...reflection,durationMs:now()-started};
}

async function compileColorPrograms(renderer,scene,camera,monitor,{now,yieldTurn,maxWaitMs,reflect=false}){
 const started=now(),result=(completed,cancelled,programCount,parallelCompile,reason)=>({completed,cancelled,programCount,parallelCompile,durationMs:now()-started,...(reason?{reason}:{})});
 const invalid=monitor.reason();if(invalid)return result(false,true,0,false,invalid);
 if(typeof renderer?.compile!=='function'||typeof renderer.properties?.get!=='function')return result(false,false,0,false,'renderer-program-preparation-unavailable');
 const context=monitor.reason();if(context)return result(false,true,0,false,context);
 const materials=renderer.compile(scene,camera);
 const stale=monitor.reason();if(stale)return result(false,true,0,false,stale);
 const programs=new Set(),collection=collectPrograms(renderer,materials,programs,monitor);
 if(collection!==null){const cancelled=collection!==false;return result(false,cancelled,programs.size,false,cancelled?collection:'program-readiness-unavailable');}
 return waitAndReflect(renderer,programs,monitor,{started,now,yieldTurn,maxWaitMs,reflect});
}

function setShadowMaterialFlags(depth,material,shadowType){
 depth.visible=material.visible;depth.wireframe=material.wireframe;
 depth.linewidth=material.linewidth;
 depth.side=material.shadowSide!==null?material.shadowSide:(shadowType===THREE.VSMShadowMap?material.side:SHADOW_SIDES.get(material.side));
 depth.alphaMap=material.alphaMap;depth.alphaTest=material.alphaToCoverage===true?.5:material.alphaTest;depth.map=material.map;
 depth.clipShadows=material.clipShadows;depth.clippingPlanes=material.clippingPlanes;depth.clipIntersection=material.clipIntersection;
 depth.displacementMap=material.displacementMap;depth.displacementScale=material.displacementScale;depth.displacementBias=material.displacementBias;
 depth.wireframeLinewidth=material.wireframeLinewidth;
}

function materialVariants(mesh){
 const material=mesh.material;
 if(Array.isArray(material)){
  const groups=mesh.geometry?.groups||[];return [...new Set(groups.map(group=>material[group.materialIndex]).filter(candidate=>candidate?.visible))];
 }
 return material?.visible?[material]:[];
}

function ensureDepthMaterial(mesh){
 if(mesh.customDepthMaterial!==undefined)return mesh.customDepthMaterial;
 const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});mesh.customDepthMaterial=depth;ownedDepthMaterials.set(mesh,depth);return depth;
}

function collectShadowLights(scene){const lights=[];scene.traverseVisible?.(node=>{if(node.isLight&&node.castShadow)lights.push(node);});return lights;}

async function compileShadowPrograms(renderer,scene,camera,monitor,{now,yieldTurn,maxWaitMs,reflect=false}){
 const started=now(),programs=new Set(),parallelCompile=renderer.extensions?.has?.('KHR_parallel_shader_compile')===true;
 const result=(completed,cancelled,reason)=>({completed,cancelled,programCount:programs.size,parallelCompile,durationMs:now()-started,...(reason?{reason}:{})});
 const invalid=monitor.reason();if(invalid)return result(false,true,invalid);
 if(!parallelCompile)return result(false,false,'parallel-compile-unavailable');
 if(!scene)return result(true,false);
 if(renderer.shadowMap?.enabled===false)return result(true,false);
 const lights=collectShadowLights(scene);
 if(!lights.length)return result(true,false);
 if(lights.some(light=>!light.isDirectionalLight)||![THREE.PCFShadowMap,THREE.PCFSoftShadowMap].includes(renderer.shadowMap?.type))return result(false,false,'unsupported-shadow-program-configuration');
 const casters=[];let unsupportedMaterial=false;
 scene.traverse?.(mesh=>{
  if(!(mesh.isMesh||mesh.isLine||mesh.isPoints)||mesh.castShadow!==true)return;
  const variants=materialVariants(mesh);if(!variants.length)return;
  const depth=ensureDepthMaterial(mesh);if(!depth||typeof depth!=='object'){unsupportedMaterial=true;return;}
  casters.push({mesh,depth,variants});
 });
 if(unsupportedMaterial)return result(false,false,'unsupported-custom-depth-material');
 if(!casters.length)return result(true,false);
 const seenDepthMaterials=new Set();
 for(const {depth} of casters){if(seenDepthMaterials.has(depth))return result(false,false,'shared-custom-depth-material');seenDepthMaterials.add(depth);}
 const target=new THREE.WebGLRenderTarget(1,1),previousTarget=renderer.getRenderTarget?.()??null,saved=[];
 try{
  renderer.setRenderTarget(target);
  for(const entry of casters){saved.push([entry.mesh,entry.mesh.material]);entry.mesh.material=entry.depth;setShadowMaterialFlags(entry.depth,entry.variants[0],renderer.shadowMap.type);}
  renderer.compile(scene,camera);const afterCompile=monitor.reason();if(afterCompile)return result(false,true,afterCompile);
  const initialCollection=collectPrograms(renderer,new Set(casters.map(entry=>entry.depth)),programs,monitor);
  if(initialCollection!==null)return initialCollection===false?result(false,false,'program-readiness-unavailable'):result(false,true,initialCollection);
  for(const entry of casters){
   for(const variant of entry.variants.slice(1)){
    const stale=monitor.reason();if(stale)return result(false,true,stale);
    setShadowMaterialFlags(entry.depth,variant,renderer.shadowMap.type);
    const compiled=renderer.compile(entry.mesh,camera,scene),afterVariant=monitor.reason();if(afterVariant)return result(false,true,afterVariant);
    const variantCollection=collectPrograms(renderer,new Set([entry.depth]),programs,monitor);
    if(variantCollection!==null)return variantCollection===false?result(false,false,'program-readiness-unavailable'):result(false,true,variantCollection);
   }
  }
 }finally{
  for(const [mesh,material] of saved)mesh.material=material;
  renderer.setRenderTarget(previousTarget);target.dispose();
 }
 return waitAndReflect(renderer,programs,monitor,{started,now,yieldTurn,maxWaitMs,reflect});
}

function probeResult(color,shadow,started,now){
 const withMetrics=result=>({...result,reflectedPrograms:result.reflectedPrograms||0,reflectionDurationMs:result.reflectionDurationMs||0,maxReflectionProgramMs:result.maxReflectionProgramMs||0});
 color=withMetrics(color);shadow=withMetrics(shadow);
 const reason=!color.completed?color.reason:!shadow.completed?shadow.reason:undefined;
 return {completed:color.completed&&shadow.completed,cancelled:color.cancelled||shadow.cancelled,
  ...(reason?{reason}:{}),reflectedPrograms:color.reflectedPrograms+shadow.reflectedPrograms,
  reflectionDurationMs:color.reflectionDurationMs+shadow.reflectionDurationMs,
  maxReflectionProgramMs:Math.max(color.maxReflectionProgramMs,shadow.maxReflectionProgramMs),color,shadow,durationMs:now()-started};
}

// Compile color and real directional-PCF shadow variants before the scene is revealed.
// Temporary bindings and target changes end synchronously before readiness polling yields.
export async function prepareTycoonProbePrograms(renderer,scene,camera,{isCurrent=()=>true,yieldTurn=()=>new Promise(resolve=>setTimeout(resolve,10)),now=()=>performance.now(),maxWaitMs=10000}={}){
 const started=now(),monitor=createMonitor(renderer,isCurrent);let color,shadow;
 try{
  color=await compileColorPrograms(renderer,scene,camera,monitor,{now,yieldTurn,maxWaitMs,reflect:true});
  if(!color.completed){shadow={completed:false,cancelled:color.cancelled,programCount:0,parallelCompile:color.parallelCompile,durationMs:0,...(color.reason?{reason:color.reason}:{})};return probeResult(color,shadow,started,now);}
  const invalid=monitor.reason();if(invalid){shadow={completed:false,cancelled:true,programCount:0,parallelCompile:false,durationMs:0,reason:invalid};return probeResult(color,shadow,started,now);}
  shadow=await compileShadowPrograms(renderer,scene,camera,monitor,{now,yieldTurn,maxWaitMs,reflect:true});
  return probeResult(color,shadow,started,now);
 }finally{monitor.dispose();}
}

export function releaseTycoonDepthMaterials(root){
 let released=0;root?.traverse?.(node=>{const depth=ownedDepthMaterials.get(node);if(!depth)return;ownedDepthMaterials.delete(node);if(node.customDepthMaterial===depth)delete node.customDepthMaterial;depth.dispose();released++;});return released;
}

// Prepare the pinned Three.js renderer's programs while scene readiness is gated.
// Unlike an uncancellable compileAsync poll, stale/disposed programs are never read.
export async function prepareTycoonPrograms(renderer,scene,camera,{isCurrent=()=>true,yieldTurn=()=>new Promise(resolve=>setTimeout(resolve,10)),now=()=>performance.now(),maxWaitMs=10000}={}){
 const started=now(),monitor=createMonitor(renderer,isCurrent);
 try{return await compileColorPrograms(renderer,scene,camera,monitor,{now,yieldTurn,maxWaitMs});}
 finally{monitor.dispose();}
}
