// Hardware renderer + production scene update path; deterministic simulation dt.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('C:/Users/suanr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Supply a new output directory');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
 try{const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4197/profile-blank');await page.setContent('<script type="importmap">{"imports":{"three":"/vendor/three.module.js","three/addons/":"/vendor/addons/"}}</script><div id="root" style="width:1280px;height:800px"></div>');
 const result=await page.evaluate(async()=>{
  const THREE=await import('three'),{TycoonScene}=await import('/tycoon-scene.js'),{createTycoonRoom}=await import('/tycoon-state.js'),{tycoonGround}=await import('/tycoon-blueprint.js'),{inspectCustomGLB,describeCustomAsset,customModels}=await import('/custom-assets.js');
  const bytes=new Uint8Array(await(await fetch('/assets/models/tycoon/chair.glb')).arrayBuffer()),info=await inspectCustomGLB(bytes);await customModels.putMany([{id:info.id,bytes}]);
  const scene=new TycoonScene(document.querySelector('#root'));scene.renderer.setAnimationLoop(null);const gl=scene.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),gpu=gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);if(!/NVIDIA.*RTX 3060/i.test(gpu))throw Error('Hardware not admitted '+gpu);
  const cases=[],shots=[];
  for(const hz of [30,60])for(const kind of ['route','bundled-small','bundled-large','custom-small','custom-large']){
   const room=createTycoonRoom('projects'),scale=kind.endsWith('small')?.75:1.25,c=room.objects.find(o=>o.id==='chair-1');
   if(kind!=='route'){c.scale=scale;if(kind.startsWith('custom')){c.kind='custom';c.asset=describeCustomAsset(info,{name:'Measured custom chair',category:'chair',height:1.15,interaction:{mode:'seat',approach:[0,1.8],seat:[0,0],height:.551132,heading:Math.PI}});}}
   await scene.setScene('projects',room);if(!scene.ready)throw Error('Scene failed');const actor=scene.assembly.owned.find(o=>o.userData.instanceId==='demo-agent');let result;
   if(kind==='route'){let route;for(let x=-4;x<=3&&!route;x+=.5)for(let z=-3;z<=2&&!route;z+=.5){const p=[[x,z],[x+1,z],[x+1,z+1],[x,z+1]].map(([x,z])=>tycoonGround({x,z}));if(p.every(a=>scene.activity.nav.isWalkable(a))&&p.slice(1).every((a,i)=>scene.activity.nav.isSegmentWalkable(p[i],a)))route=p;}if(!route)throw Error('No route');result=scene.startWalk(route);}else result=scene.startStation('desk-1');
   if(!result?.ok)throw Error(kind+': '+result?.message);
   const seatHeight=scene.activity.station?.seatHeight;let previous,done=0,count=0,min=Infinity,maxSlide=0,pelvisError=0,groundGap=0,shot=false;const phases=new Set();
   function points(name){const m=actor.getObjectByName(name);m.skeleton.update();const p=[];for(let i=0;i<m.geometry.attributes.position.count;i++){const v=m.getVertexPosition(i,new THREE.Vector3());p.push(m.localToWorld(v));}return p;}
   for(let i=0;i<45*hz;i++){
    scene.updateProbe(actor,1/hz);if(!scene.activity.snapshot)throw Error('Probe stopped unexpectedly '+kind);scene.renderer.render(scene.scene,scene.camera);const phase=scene.activity.phase;phases.add(phase);
    const f=['left','right'].map(side=>{const p=points(`office-${side}-shoe`);return {bottom:Math.min(...p.map(v=>v.y)),center:p.reduce((sum,v)=>sum.add(v),new THREE.Vector3()).multiplyScalar(1/p.length)};});
    for(let j=0;j<2;j++){min=Math.min(min,f[j].bottom);if(previous&&f[j].bottom<.001&&previous[j].bottom<.001){count++;maxSlide=Math.max(maxSlide,previous[j].center.distanceTo(f[j].center));}}
    if(phase==='working'){pelvisError=Math.max(pelvisError,Math.abs(Math.min(...points('office-pelvis').map(p=>p.y))-seatHeight));groundGap=Math.max(groundGap,...f.map(p=>Math.abs(p.bottom)));}
    if(hz===30&&!shot&&(phase==='working'||kind==='route'&&i===30)){scene.focusProbe();scene.scale=1.8;scene.fit();scene.renderer.render(scene.scene,scene.camera);shots.push({name:kind,png:scene.renderer.domElement.toDataURL()});shot=true;}
    previous=f;if(phase==='done')done++;if(done>hz*2){groundGap=Math.max(groundGap,...f.map(p=>Math.abs(p.bottom)));break;}
    if(i%60===0)await new Promise(r=>setTimeout(r,0));
   }
   cases.push({kind,hz,seatHeight,phases:[...phases],doneFrames:done,plantedPairs:count,minFootM:min,maxPlantShiftM:maxSlide,maxWorkingPelvisErrorM:pelvisError,maxWorkingOrSettledFootGapM:groundGap});
  }
  scene.dispose();await scene.disposal;return {gpu,cases,shots};
 });
 const shots=result.shots;delete result.shots;for(const s of shots)fs.writeFileSync(path.join(output,s.name+'.png'),Buffer.from(s.png.split(',')[1],'base64'));
 const files=['web/tycoon-contact.js','web/tycoon-seat-contact.js','web/tycoon-scene.js','web/tycoon-activity.js','web/tycoon-blueprint.js','web/assets/models/tycoon-factory/actor-rig-v3.glb','web/assets/models/tycoon/chair.glb'];
 const report={method:'Production TycoonScene, deterministic 30/60 Hz updates with every frame rendered on hardware WebGL, not a real-time FPS benchmark',browser:browser.version(),errors,...result,sha256:Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))};
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(errors.length||result.cases.some(c=>c.doneFrames<=c.hz*2||c.plantedPairs<30||c.minFootM<-.003||c.maxPlantShiftM>.004||c.maxWorkingPelvisErrorM>.005||c.maxWorkingOrSettledFootGapM>.003))throw Error('Contact acceptance thresholds failed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
