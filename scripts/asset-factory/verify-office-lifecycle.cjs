// Local production renderer with real WebGL; deterministic time, not an FPS benchmark.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('C:/Users/suanr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Supply a new evidence directory');fs.mkdirSync(output,{recursive:true});
 const fixtureRoot='tests/fixtures/external-chairs',catalog=JSON.parse(fs.readFileSync(path.join(fixtureRoot,'fixtures.json')));
 const modelRoot='web/assets/models/tycoon',modelManifest=JSON.parse(fs.readFileSync(modelRoot+'/manifest.json'));
 const files=['scripts/asset-factory/verify-office-lifecycle.cjs',...fs.readdirSync('web').filter(f=>/^(tycoon-|office-blueprint|office-navigation|custom-assets)/.test(f)&&f.endsWith('.js')).map(f=>'web/'+f),'web/assets/models/tycoon-factory/actor-rig-v3.glb','web/assets/models/tycoon-factory/desk-v3.glb',modelRoot+'/manifest.json',...modelManifest.assets.map(a=>modelRoot+'/'+a.file),...catalog.fixtures.map(f=>path.join(fixtureRoot,f.file))];
 const hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),before=hashes();
 const fixtures=catalog.fixtures.map(f=>({...f,bytes:Array.from(fs.readFileSync(path.join(fixtureRoot,f.file)))}));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
 try{const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+(process.env.PREVIEW_PORT||4197)+'/profile-blank');
 await page.setContent('<script type="importmap">{"imports":{"three":"/vendor/three.module.js","three/addons/":"/vendor/addons/"}}</script><div id="root" style="width:1440px;height:1000px"></div>');
 const result=await page.evaluate(async fixtures=>{
  const THREE=await import('three'),{TycoonScene}=await import('/tycoon-scene.js'),{createTycoonRoom}=await import('/tycoon-state.js'),{inspectCustomGLB,describeCustomAsset,customModels}=await import('/custom-assets.js');
  const scene=new TycoonScene(document.querySelector('#root'));scene.renderer.setAnimationLoop(null);let statuses=[];scene.onStatus=m=>statuses.push(m);
  const gl=scene.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),gpu=ext&&gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);if(!/NVIDIA.*RTX 3060/i.test(gpu))throw Error('Hardware renderer not admitted: '+gpu);
  const assets=[];for(const f of fixtures){const info=await inspectCustomGLB(new Uint8Array(f.bytes));await customModels.putMany([{id:info.id,bytes:info.bytes}]);assets.push({...f,asset:describeCustomAsset(info,{name:f.id,category:'chair',height:f.height,interaction:f.interaction})});}
  const cases=[],shots=[];const photo=name=>{scene.renderer.render(scene.scene,scene.camera);shots.push({name,png:scene.renderer.domElement.toDataURL()});};
  for(const floor of ['lobby','projects','growth']){await scene.setScene(floor,createTycoonRoom(floor));if(!scene.ready)throw Error('Scene not ready '+floor);photo('floor-'+floor);}
  const jobs=[...['lobby','projects','growth'].map(floor=>({kind:'route-'+floor,floor})),...assets.flatMap(f=>[.9,1.1].map(scale=>({kind:f.id+'-'+scale,floor:'projects',f,scale}))),...[.75,1,1.25].map(scale=>({kind:'bundled-'+scale,floor:'projects',scale}))];
  for(const hz of [30,60])for(const job of jobs){
   statuses=[];const room=createTycoonRoom(job.floor);if(job.scale)room.objects.find(o=>o.id==='chair-1').scale=job.scale;if(job.f){const c=room.objects.find(o=>o.id==='chair-1'),heading=c.rotation+Math.PI;c.kind='custom';c.asset=job.f.asset;c.rotation=heading-job.f.interaction.heading;}
   await scene.setScene(job.floor,room);if(!scene.ready)throw Error('Scene not ready');const actor=scene.assembly.owned.find(n=>n.userData.instanceId==='demo-agent');
   const started=job.kind.startsWith('route')?scene.startWalk(scene.activity.nav.suggestRoute()):scene.startStation('desk-1');
   let done=0,minFoot=Infinity,maxGap=0,maxPlantShift=0,previous,workingFrames=0,plantedPairs=0,frames=0;const phases=new Set(),phaseShots=new Set();let shot=false;
   const collision={framesChecked:0,capsulesChecked:0,trianglesTested:0,sweepSamples:0,minClearanceM:null,refusals:0};
   function feet(){actor.updateMatrixWorld(true);return ['left','right'].map(side=>{const m=actor.getObjectByName('office-'+side+'-shoe');m.skeleton.update();let low=Infinity;const center=new THREE.Vector3();for(let i=0;i<m.geometry.attributes.position.count;i++){const p=m.localToWorld(m.getVertexPosition(i,new THREE.Vector3()));low=Math.min(low,p.y);center.add(p);}return {bottom:low,center:center.multiplyScalar(1/m.geometry.attributes.position.count)};});}
   if(started?.ok)for(let i=0;i<90*hz;i++){
    scene.updateProbe(actor,1/hz);scene.renderer.render(scene.scene,scene.camera);frames++;
    const check=scene.collisionDiagnostics;if(check){collision.framesChecked++;collision.capsulesChecked+=check.checkedCapsules||0;collision.trianglesTested+=check.testedTriangles||0;collision.sweepSamples+=check.sampleCount||0;if(Number.isFinite(check.minClearanceM))collision.minClearanceM=Math.min(collision.minClearanceM??Infinity,check.minClearanceM);if(check.ok===false)collision.refusals++;}
    if(!scene.activity.snapshot)break;const phase=scene.activity.phase;phases.add(phase);
    if(hz===30&&!phaseShots.has(phase)&&(['blocked','done'].includes(phase)||(['entering','sit','standing','leaving'].includes(phase)&&scene.activity.elapsed>.25))){scene.focusProbe();scene.scale=1.8;scene.fit();photo(job.kind+'-'+phase);phaseShots.add(phase);}
    if(phase==='blocked')break;const f=feet();
    for(let j=0;j<2;j++){minFoot=Math.min(minFoot,f[j].bottom);if(previous&&f[j].bottom<.001&&previous[j].bottom<.001){plantedPairs++;maxPlantShift=Math.max(maxPlantShift,f[j].center.distanceTo(previous[j].center));}}
    if(phase==='working'){workingFrames++;maxGap=Math.max(maxGap,...f.map(x=>Math.abs(x.bottom)));if(hz===30&&!shot){scene.focusProbe();scene.scale=1.8;scene.fit();photo(job.kind);shot=true;}}
    previous=f;if(phase==='done'&&++done>hz*2){maxGap=Math.max(maxGap,...f.map(x=>Math.abs(x.bottom)));break;}if(i%60===0)await new Promise(r=>setTimeout(r,0));
   }
   const diagnostic=scene.collisionDiagnostics||actor.userData.limbCollisionDiagnostics||actor.userData.contact?.lastCollision||null;
   cases.push({kind:job.kind,floor:job.floor,hz,started,phases:[...phases],frames,doneFrames:done,workingFrames,plantedPairs,minFootM:Number.isFinite(minFoot)?minFoot:null,maxFootGapM:maxGap,maxPlantShiftM:maxPlantShift,collision,statuses,diagnostic});
  }
  scene.dispose();await scene.disposal;return {gpu,cases,shots};
 },fixtures);
 const shots=result.shots;delete result.shots;for(const s of shots)fs.writeFileSync(path.join(output,s.name+'.png'),Buffer.from(s.png.split(',')[1],'base64'));
 const after=hashes(),sourceUnchanged=JSON.stringify(before)===JSON.stringify(after);
 const report={method:'Production TycoonScene; deterministic 30/60Hz with each simulated frame rendered on real GPU; external fixtures via production IndexedDB import; no live business backend',browser:browser.version(),errors,sourceUnchanged,...result,sha256:before,...(!sourceUnchanged?{sha256After:after}:{})};
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(!sourceUnchanged||errors.length||result.cases.some(c=>!c.started?.ok||c.doneFrames<=c.hz*2||c.minFootM<-.003||c.maxFootGapM>.003||c.maxPlantShiftM>.004||!c.kind.startsWith('route')&&!['walking','entering','sit','working','standing','leaving','done'].every(p=>c.phases.includes(p))))throw Error('Lifecycle acceptance failed; inspect report');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
