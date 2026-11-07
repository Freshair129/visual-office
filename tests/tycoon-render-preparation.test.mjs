import test from 'node:test';
import assert from 'node:assert/strict';
import {TycoonScene,TycoonAssembly} from '../web/tycoon-scene.js';
const THREE=await import('three');
const module=await import('../web/tycoon-render-preparation.js').catch(()=>null);
const prepare=(...args)=>{assert.equal(typeof module?.prepareTycoonPrograms,'function','shader preparation must yield and cancel safely before readiness');return module.prepareTycoonPrograms(...args);};
const prepareScene=(...args)=>{assert.equal(typeof module?.prepareTycoonProbePrograms,'function','scene preparation must cover both color and directional shadow programs');return module.prepareTycoonProbePrograms(...args);};
function fixture(programs){
 const materials=programs.map(()=>({}));return {compile:()=>new Set(materials),properties:{get:material=>({currentProgram:programs[materials.indexOf(material)]})},extensions:{has:()=>true},getContext:()=>({isContextLost:()=>false})};
}
test('program preparation yields until every captured program is ready',async()=>{
 let turns=0;const renderer=fixture([{isReady:()=>turns>=2},{isReady:()=>turns>=1}]);
 const result=await prepare(renderer,{}, {},{yieldTurn:async()=>{turns++;}});
 assert.equal(result.completed,true);assert.equal(result.cancelled,false);assert.equal(result.programCount,2);assert.equal(turns,2);
});
test('program preparation waits for all pinned Three variants stored on one material',async()=>{
 let turns=0;const material={},current={isReady:()=>true},other={isReady:()=>turns>=1};
 const renderer={compile:()=>[material],properties:{get:()=>({currentProgram:current,programs:new Map([['current',current],['other',other]])})},
  extensions:{has:()=>true},getContext:()=>({isContextLost:()=>false})};
 const result=await prepare(renderer,{}, {},{yieldTurn:async()=>{turns++;}});
 assert.equal(result.completed,true);assert.equal(result.programCount,2,'all variants from the pinned material property map are counted');assert.equal(turns,1,'a ready current program cannot hide a pending variant');
});
test('probe reflection waits for every color variant and reports load and color costs',async()=>{
 let ready=false,clock=0,earlyReflections=0;const timeline=[],material={};
 const first={isReady:()=>true,getUniforms(){timeline.push('reflect-first');if(!ready)earlyReflections++;clock+=3;return {};}};
 const second={isReady:()=>ready,getUniforms(){timeline.push('reflect-second');if(!ready)earlyReflections++;clock+=5;return {};}};
 const renderer={compile:()=>[material],properties:{get:()=>({currentProgram:first,programs:new Map([['first',first],['second',second]])})},
  extensions:{has:()=>true},getContext:()=>({isContextLost:()=>false}),shadowMap:{enabled:false}};
 const result=await prepareScene(renderer,new THREE.Scene(),new THREE.PerspectiveCamera(),{now:()=>clock,yieldTurn:async()=>{timeline.push('yield');ready=true;}});
 assert.equal(result.completed,true);assert.equal(earlyReflections,0,'no program is reflected before every variant reports ready');
 assert.equal(timeline.indexOf('yield')<timeline.indexOf('reflect-first'),true);
 assert.equal(timeline.indexOf('reflect-first')<timeline.indexOf('yield',timeline.indexOf('reflect-first')),true,'reflection yields between variants');
 assert.equal(timeline.indexOf('yield',timeline.indexOf('reflect-first'))<timeline.indexOf('reflect-second'),true);
 assert.equal(result.reflectedPrograms,2);assert.equal(result.color.reflectedPrograms,2);assert.equal(result.shadow.reflectedPrograms,0);
 assert.equal(result.color.reflectionDurationMs,8);assert.equal(result.color.maxReflectionProgramMs,5);
 assert.equal(result.color.durationMs>=result.color.reflectionDurationMs,true);assert.equal(result.durationMs>=result.color.reflectionDurationMs,true);
});
test('probe reflection cancellation after a yield never touches the next program',async()=>{
 let current=true,firstCalls=0,nextCalls=0;const material={},first={isReady:()=>true,getUniforms(){firstCalls++;return {};}};
 const next={isReady:()=>true,getUniforms(){nextCalls++;return {};}};
 const renderer={compile:()=>[material],properties:{get:()=>({currentProgram:first,programs:new Map([['first',first],['next',next]])})},
  extensions:{has:()=>true},getContext:()=>({isContextLost:()=>false}),shadowMap:{enabled:false}};
 const result=await prepareScene(renderer,new THREE.Scene(),new THREE.PerspectiveCamera(),{isCurrent:()=>current,yieldTurn:async()=>{current=false;}});
 assert.equal(result.completed,false);assert.equal(result.cancelled,true);assert.equal(result.reason,'superseded');
 assert.equal(firstCalls,1);assert.equal(nextCalls,0);assert.equal(result.reflectedPrograms,1);
});
test('a reentrant getUniforms hook cancels before touching the next program',async()=>{
 let current=true,firstCalls=0,nextCalls=0,yields=0;const material={};
 const first={isReady:()=>true,getUniforms(){firstCalls++;current=false;return {};}};
 const next={isReady:()=>true,getUniforms(){nextCalls++;return {};}};
 const renderer={compile:()=>[material],properties:{get:()=>({currentProgram:first,programs:new Map([['first',first],['next',next]])})},
  extensions:{has:()=>true},getContext:()=>({isContextLost:()=>false}),shadowMap:{enabled:false}};
 const result=await prepareScene(renderer,new THREE.Scene(),new THREE.PerspectiveCamera(),{isCurrent:()=>current,yieldTurn:async()=>{yields++;}});
 assert.equal(result.cancelled,true);assert.equal(result.reason,'superseded');assert.equal(firstCalls,1);assert.equal(nextCalls,0);assert.equal(yields,0);
});
test('context loss during probe reflection cancels before touching the next program',async()=>{
 const canvas=new EventTarget();let firstCalls=0,nextCalls=0;const material={},first={isReady:()=>true,getUniforms(){firstCalls++;return {};}};
 const next={isReady:()=>true,getUniforms(){nextCalls++;return {};}};
 const renderer={domElement:canvas,compile:()=>[material],properties:{get:()=>({currentProgram:first,programs:new Map([['first',first],['next',next]])})},
  extensions:{has:()=>true},getContext:()=>({isContextLost:()=>false}),shadowMap:{enabled:false}};
 const result=await prepareScene(renderer,new THREE.Scene(),new THREE.PerspectiveCamera(),{yieldTurn:async()=>{canvas.dispatchEvent(new Event('webglcontextlost'));canvas.dispatchEvent(new Event('webglcontextrestored'));}});
 assert.equal(result.completed,false);assert.equal(result.cancelled,true);assert.equal(result.reason,'context-lost');
 assert.equal(firstCalls,1);assert.equal(nextCalls,0);
});
test('probe reflection reports a missing getUniforms API as incomplete',async()=>{
 const material={},program={isReady:()=>true};
 const renderer={compile:()=>[material],properties:{get:()=>({currentProgram:program})},extensions:{has:()=>true},
  getContext:()=>({isContextLost:()=>false}),shadowMap:{enabled:false}};
 const result=await prepareScene(renderer,new THREE.Scene(),new THREE.PerspectiveCamera());
 assert.equal(result.completed,false);assert.equal(result.cancelled,false);assert.equal(result.reason,'program-reflection-unavailable');
 assert.equal(result.reflectedPrograms,0);assert.equal(result.color.reflectedPrograms,0);
});
test('probe reflection rejects programs with failed shader diagnostics',async()=>{
 const material={},program={isReady:()=>true,getUniforms(){this.diagnostics={runnable:false};return {};}};
 const renderer={compile:()=>[material],properties:{get:()=>({currentProgram:program})},extensions:{has:()=>true},
  getContext:()=>({isContextLost:()=>false}),shadowMap:{enabled:false}};
 const result=await prepareScene(renderer,new THREE.Scene(),new THREE.PerspectiveCamera());
 assert.equal(result.completed,false);assert.equal(result.cancelled,false);assert.equal(result.reason,'shader-program-unusable');
 assert.equal(result.reflectedPrograms,1);assert.equal(result.color.reflectedPrograms,1);
});
test('a missing readiness API on any mapped variant keeps preparation incomplete',async()=>{
 const material={},current={isReady:()=>true};
 const renderer={compile:()=>[material],properties:{get:()=>({currentProgram:current,programs:new Map([['current',current],['missing',{}]])})},
  extensions:{has:()=>true},getContext:()=>({isContextLost:()=>false})};
 const result=await prepare(renderer,{},{});
 assert.equal(result.completed,false);assert.equal(result.cancelled,false);assert.equal(result.reason,'program-readiness-unavailable');
});
test('a reentrant readiness hook cancels before polling a following variant',async()=>{
 let current=true,followingPolls=0;const material={},first={isReady(){current=false;return true;}},second={isReady(){followingPolls++;return true;}};
 const renderer={compile:()=>[material],properties:{get:()=>({currentProgram:first,programs:new Map([['first',first],['second',second]])})},
  extensions:{has:()=>true},getContext:()=>({isContextLost:()=>false})};
 const result=await prepare(renderer,{}, {},{isCurrent:()=>current});
 assert.equal(result.completed,false);assert.equal(result.cancelled,true);assert.equal(result.reason,'superseded');assert.equal(followingPolls,0);
});
test('a stale generation never reads material program properties after renderer lookup',async()=>{
 let current=true,programPropertyReads=0;const material={},program={isReady:()=>true};
 const properties={get(){current=false;return {get programs(){programPropertyReads++;return new Map([['program',program]]);},get currentProgram(){programPropertyReads++;return program;}};}};
 const renderer={compile:()=>[material],properties,extensions:{has:()=>true},getContext:()=>({isContextLost:()=>false})};
 const result=await prepare(renderer,{}, {},{isCurrent:()=>current});
 assert.equal(result.cancelled,true);assert.equal(result.reason,'superseded');assert.equal(programPropertyReads,0);
});
test('cancelled preparation never polls a disposed program after yielding',async()=>{
 let current=true,calls=0;const renderer=fixture([{isReady:()=>{assert.equal(current,true,'a disposed/stale program must never be polled');calls++;return false;}}]);
 const result=await prepare(renderer,{}, {},{isCurrent:()=>current,yieldTurn:async()=>{current=false;}});
 assert.equal(result.cancelled,true);assert.equal(result.completed,false);assert.equal(calls,1);
});
test('context loss and unavailable preparation are explicit non-completions',async()=>{
 const renderer=fixture([{isReady:()=>false}]);renderer.getContext=()=>({isContextLost:()=>true});
 const lost=await prepare(renderer,{},{});assert.equal(lost.completed,false);assert.equal(lost.reason,'context-lost');
 const missing=await prepare({}, {},{});assert.equal(missing.completed,false);assert.equal(missing.reason,'renderer-program-preparation-unavailable');
});
test('a driver that never finishes preparation times out instead of publishing readiness',async()=>{
 let clock=0;const renderer=fixture([{isReady:()=>false}]);
 await assert.rejects(()=>prepare(renderer,{}, {},{now:()=>clock++,maxWaitMs:3,yieldTurn:async()=>{}}),/timed out/);
});

test('loss followed by restoration during one yield never polls pre-loss programs',async()=>{
 let calls=0;const canvas=new EventTarget(),renderer=fixture([{isReady:()=>{calls++;assert.equal(calls,1,'a restored context must not poll old program objects');return false;}}]);
 renderer.domElement=canvas;
 const result=await prepare(renderer,{}, {},{yieldTurn:async()=>{canvas.dispatchEvent(new Event('webglcontextlost'));canvas.dispatchEvent(new Event('webglcontextrestored'));}});
 assert.equal(result.completed,false);assert.equal(result.cancelled,true);assert.equal(result.reason,'context-lost');
});

function sceneFixture(scene,{ready=()=>true}={}){
 const canvas=new EventTarget(),records=[];let target=null;
 const renderer={domElement:canvas,shadowMap:{type:THREE.PCFSoftShadowMap},extensions:{has:name=>name==='KHR_parallel_shader_compile'},getContext:()=>({isContextLost:()=>false}),
  properties:{get:material=>({currentProgram:material.__program})},getRenderTarget:()=>target,setRenderTarget:value=>{target=value},
  compile(root,camera,targetScene){const materials=new Set();root.traverse(node=>{if(node.isMesh||node.isLine||node.isPoints)for(const m of [].concat(node.material||[]))if(m)materials.add(m);});for(const material of materials){const program={isReady:()=>ready(material),getUniforms:()=>({})};material.__program=program;records.push({material,map:material.map,target,program});}return materials;}};
 return {renderer,records,canvas,get target(){return target;}};
}

test('shadow programs compile with production depth flags and restore visible bindings before yielding',async()=>{
 const scene=new THREE.Scene(),geometry=new THREE.BoxGeometry(1,1,1),map=new THREE.Texture(),alphaMap=new THREE.Texture(),displacementMap=new THREE.Texture();
 const material=new THREE.MeshStandardMaterial({map,alphaMap,alphaTest:.25,side:THREE.FrontSide,wireframe:true,wireframeLinewidth:2,displacementMap,displacementScale:3,displacementBias:.125});
 material.alphaToCoverage=true;material.clipShadows=true;material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,1,0),0)];material.clipIntersection=true;material.linewidth=7;
 const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;scene.add(mesh);const light=new THREE.DirectionalLight();light.castShadow=true;scene.add(light);
 let shadowReady=false;const rendererState=sceneFixture(scene,{ready:material=>!material.isMeshDepthMaterial||shadowReady});const previous={name:'previous target'};rendererState.renderer.setRenderTarget(previous);
 let yielded=false;
 const result=await prepareScene(rendererState.renderer,scene,new THREE.PerspectiveCamera(),{yieldTurn:async()=>{yielded=true;assert.equal(mesh.material,material,'visible material must be restored before yielding');assert.equal(rendererState.target,previous,'render target must be restored before yielding');const depth=mesh.customDepthMaterial;assert.ok(depth?.isMeshDepthMaterial,'the actual shadow pass must retain the prepared depth material');assert.equal(depth.map,map);assert.equal(depth.alphaMap,alphaMap);assert.equal(depth.alphaTest,.5);assert.equal(depth.side,THREE.BackSide);assert.equal(depth.wireframe,true);assert.equal(depth.wireframeLinewidth,2);assert.equal(depth.linewidth,7);assert.equal(depth.clipShadows,true);assert.equal(depth.clippingPlanes,material.clippingPlanes);assert.equal(depth.clipIntersection,true);assert.equal(depth.displacementMap,displacementMap);assert.equal(depth.displacementScale,3);assert.equal(depth.displacementBias,.125);shadowReady=true;}});
 assert.equal(yielded,true);assert.equal(mesh.material,material);assert.equal(rendererState.target,previous);
 assert.equal(rendererState.records.some(record=>record.target?.width===1&&record.target?.height===1),true,'depth programs must use a 1x1 render target');
 assert.equal(rendererState.records.some(record=>record.material.isMeshDepthMaterial),true);
 assert.equal(result.completed,true);assert.equal(result.color.completed,true);assert.equal(result.shadow.completed,true);assert.equal(result.shadow.programCount,1);
 assert.equal(result.reflectedPrograms,2);assert.equal(result.color.reflectedPrograms,1);assert.equal(result.shadow.reflectedPrograms,1);
 assert.equal(result.reflectionDurationMs,result.color.reflectionDurationMs+result.shadow.reflectionDurationMs);
 assert.equal(result.maxReflectionProgramMs,Math.max(result.color.maxReflectionProgramMs,result.shadow.maxReflectionProgramMs));
});

test('material-array shadow groups each prepare their own exact depth variant',async()=>{
 const scene=new THREE.Scene(),geometry=new THREE.BufferGeometry();geometry.addGroup(0,3,0);geometry.addGroup(3,3,1);
 const firstMap=new THREE.Texture(),secondMap=new THREE.Texture(),a=new THREE.MeshStandardMaterial({map:firstMap,side:THREE.FrontSide}),b=new THREE.MeshStandardMaterial({map:secondMap,side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(geometry,[a,b]);mesh.castShadow=true;scene.add(mesh);const light=new THREE.DirectionalLight();light.castShadow=true;scene.add(light);const state=sceneFixture(scene);
 const result=await prepareScene(state.renderer,scene,new THREE.PerspectiveCamera(),{yieldTurn:async()=>{}});
 assert.equal(result.shadow.completed,true);assert.equal(mesh.material[0],a);assert.equal(mesh.material[1],b);
 assert.deepEqual(state.records.filter(record=>record.material.isMeshDepthMaterial).map(record=>record.map),[firstMap,secondMap]);assert.ok(mesh.customDepthMaterial?.isMeshDepthMaterial);
});

test('shared caller-owned depth materials with differing caster flags stay on the explicit fallback path',async()=>{
 const scene=new THREE.Scene(),sharedDepth=new THREE.MeshDepthMaterial(),firstMap=new THREE.Texture(),secondMap=new THREE.Texture();sharedDepth.map=new THREE.Texture();sharedDepth.side=THREE.DoubleSide;
 const first=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({map:firstMap,side:THREE.FrontSide}));first.castShadow=true;first.customDepthMaterial=sharedDepth;
 const second=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({map:secondMap,side:THREE.BackSide}));second.castShadow=true;second.customDepthMaterial=sharedDepth;
 scene.add(first,second);const light=new THREE.DirectionalLight();light.castShadow=true;scene.add(light);const state=sceneFixture(scene);
 const originalMap=sharedDepth.map,originalSide=sharedDepth.side,result=await prepareScene(state.renderer,scene,new THREE.PerspectiveCamera(),{yieldTurn:async()=>{}});
 assert.equal(result.completed,false);assert.equal(result.shadow.completed,false);assert.equal(result.reason,'shared-custom-depth-material');
 assert.equal(first.customDepthMaterial,sharedDepth);assert.equal(second.customDepthMaterial,sharedDepth);assert.equal(sharedDepth.map,originalMap);assert.equal(sharedDepth.side,originalSide);
 assert.equal(state.records.some(record=>record.material===sharedDepth),false,'a shared program must not be reported as prepared from only the final caster flags');
});

test('shadow context loss and restoration cancel before polling the captured depth program again',async()=>{
 const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);mesh.castShadow=true;scene.add(mesh);const light=new THREE.DirectionalLight();light.castShadow=true;scene.add(light);
 let depthPolls=0;const state=sceneFixture(scene,{ready:current=>{if(current.isMeshDepthMaterial){depthPolls++;return false;}return true;}});const previous={name:'existing target'};state.renderer.setRenderTarget(previous);
 const result=await prepareScene(state.renderer,scene,new THREE.PerspectiveCamera(),{yieldTurn:async()=>{state.canvas.dispatchEvent(new Event('webglcontextlost'));state.canvas.dispatchEvent(new Event('webglcontextrestored'));}});
 assert.equal(result.cancelled,true);assert.equal(result.reason,'context-lost');assert.equal(depthPolls,1);assert.equal(mesh.material,material);assert.equal(state.target,previous);
});

test('assembly cleanup disposes owned depth materials and preserves caller-owned depth materials',async()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),model=new THREE.Group(),ownedMesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()),externalMesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
 ownedMesh.castShadow=true;const externalDepth=new THREE.MeshDepthMaterial();externalMesh.customDepthMaterial=externalDepth;model.add(ownedMesh,externalMesh);root.add(model);scene.add(root);const light=new THREE.DirectionalLight();light.castShadow=true;scene.add(light);
 const state=sceneFixture(scene),prepared=await prepareScene(state.renderer,scene,new THREE.PerspectiveCamera(),{yieldTurn:async()=>{}});assert.equal(prepared.completed,true);
 const ownedDepth=ownedMesh.customDepthMaterial;let ownedDisposed=0,externalDisposed=0;ownedDepth.addEventListener('dispose',()=>ownedDisposed++);externalDepth.addEventListener('dispose',()=>externalDisposed++);
 const assembly=new TycoonAssembly(root,async()=>{});assembly.owned.push(model);assembly.clear();
 assert.equal(ownedDisposed,1);assert.equal(ownedMesh.customDepthMaterial,undefined);assert.equal(externalDisposed,0);assert.equal(externalMesh.customDepthMaterial,externalDepth);
});

test('an older overlapping scene load cannot reveal the newer pending stage',async()=>{
 const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};const loads=[deferred(),deferred()];let calls=0;
 const stage=new THREE.Group(),scene=new THREE.Scene();scene.add(stage);
 const fake={scene,stage,camera:new THREE.PerspectiveCamera(),sceneGeneration:0,disposed:false,ready:false,renderer:{domElement:new EventTarget(),shadowMap:{enabled:false},compile:()=>[],properties:{get:()=>({})},extensions:{has:()=>true},getContext:()=>({isContextLost:()=>false})},editor:{cancel(){},highlight(){}},assembly:{owned:[],replace(){return loads[calls++].promise;}},fit(){},onError(){}};
 const oldLoad=TycoonScene.prototype.setScene.call(fake,'building',null,{preserveCamera:true});const newLoad=TycoonScene.prototype.setScene.call(fake,'building',null,{preserveCamera:true});
 assert.equal(stage.visible,false);loads[0].resolve();await oldLoad;assert.equal(stage.visible,false,'the stale generation must not reveal while the newer scene is pending');
 loads[1].resolve();await newLoad;assert.equal(fake.ready,true);assert.equal(stage.visible,true,'only the current completed generation reveals the stage');
});

test('unsupported parallel compilation keeps legacy rendering available without claiming preparation',async()=>{
 const stage=new THREE.Group(),scene=new THREE.Scene();scene.add(stage);
 const fake={scene,stage,camera:new THREE.PerspectiveCamera(),sceneGeneration:0,disposed:false,ready:false,renderer:{domElement:new EventTarget(),shadowMap:{enabled:false},compile:()=>[],properties:{get:()=>({})},extensions:{has:()=>false},getContext:()=>({isContextLost:()=>false})},editor:{cancel(){},highlight(){}},assembly:{owned:[],replace:async()=>{}},fit(){},onError(){}};
 await TycoonScene.prototype.setScene.call(fake,'building',null,{preserveCamera:true});
 assert.equal(fake.ready,true);assert.equal(stage.visible,true);assert.equal(fake.renderPreparationDiagnostics.completed,false);assert.equal(fake.renderPreparationDiagnostics.reason,'parallel-compile-unavailable');
});
