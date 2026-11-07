import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonScene,TycoonAssembly,tycoonSceneObjects} from '../web/tycoon-scene.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {TYCOON_FACTORY_ASSETS} from '../web/tycoon-factory-assets.js';
import {inspectCustomGLB,describeCustomAsset,normalizeCustomModel,disposeCustomModel} from '../web/custom-assets.js';

const manifest=JSON.parse(await readFile('web/assets/models/tycoon/manifest.json','utf8'));
const models=new Map();
const fixtures=JSON.parse(await readFile('tests/fixtures/external-chairs/fixtures.json','utf8')).fixtures;
async function load(kind,asset){
  const key=asset?'custom:'+asset.id:kind;
  if(!models.has(key))models.set(key,(async()=>{
    if(asset){const fixture=fixtures.find(item=>item.provenance.glb.sha256===asset.id),info=await inspectCustomGLB(await readFile('tests/fixtures/external-chairs/'+fixture.file));return normalizeCustomModel(info.model,asset);}
    const factory=TYCOON_FACTORY_ASSETS[kind],meta=factory||manifest.assets.find(asset=>asset.kind===kind);
    assert.ok(meta,`actual GLB metadata for ${kind}`);
    const bytes=await readFile(`web/assets/models/${factory?'tycoon-factory':'tycoon'}/${meta.file}`);
    const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    gltf.scene.animations=gltf.animations;return gltf.scene;
  })());
  return models.get(key);
}
async function setup({scale,fixture}){
  const room=createTycoonRoom('projects'),chair=room.objects.find(object=>object.id==='chair-1');chair.scale=scale;
  if(fixture){const heading=chair.rotation+Math.PI,info=await inspectCustomGLB(await readFile('tests/fixtures/external-chairs/'+fixture.file));chair.kind='custom';chair.asset=describeCustomAsset(info,{name:fixture.id,category:'chair',height:fixture.height,interaction:fixture.interaction});chair.rotation=heading-fixture.interaction.heading;disposeCustomModel(info.model);}
  const assembly=new TycoonAssembly(new THREE.Group(),load);
  await assembly.replace([...tycoonSceneObjects('projects',room),{id:'demo-agent',kind:'actor',clip:'idle',optional:false}]);
  const activity=new TycoonActivity(room),scene={ready:true,room,assembly,activity,collisionWorld:new TycoonCollisionWorld(assembly.owned),play:TycoonScene.prototype.play,onStatus(){}};
  const actor=assembly.owned.find(model=>model.userData.instanceId==='demo-agent');
  return {scene,actor,activity,assembly};
}
function checkPose(actor,activity,label){
  const diagnostic=actor.userData.limbCollisionDiagnostics;
  assert.notEqual(activity.phase,'blocked',`${label}: ${JSON.stringify({phase:diagnostic?.phase,reason:diagnostic?.reason,hit:diagnostic?.hit})}`);
  assert.notEqual(diagnostic?.ok,false,`${label}: collision refused`);
  actor.updateMatrixWorld(true);
  for(const side of ['left','right']){
    const shoe=actor.getObjectByName(`office-${side}-shoe`);shoe.skeleton.update();let bottom=Infinity;
    for(let index=0;index<shoe.geometry.attributes.position.count;index++)bottom=Math.min(bottom,shoe.localToWorld(shoe.getVertexPosition(index,new THREE.Vector3())).y);
    assert.ok(bottom>=-.003,`${label}: ${side} shoe floor penetration ${bottom}`);
    if(['working','done'].includes(activity.phase))assert.ok(Math.abs(bottom)<=.003,`${label}: ${side} resting shoe gap ${bottom}`);
  }
  if(activity.phase==='working'){
    assert.equal(diagnostic?.armContact?.status,'contact',`${label}: measured palm contact`);
    assert.ok(diagnostic?.seatSupport?.ok&&Math.abs(diagnostic.seatSupport.verticalGapM)<=.003,`${label}: measured pelvis support`);
    for(const side of ['left','right']){
      const support=diagnostic.armContact.contacts[side],palm=actor.getObjectByName(`office-${side}-palm`),normal=new THREE.Vector3().fromArray(support.surfaceNormal),point=new THREE.Vector3().fromArray(support.surfacePoint);palm.skeleton.update();let gap=Infinity;
      for(let index=0;index<palm.geometry.attributes.position.count;index++)gap=Math.min(gap,palm.localToWorld(palm.getVertexPosition(index,new THREE.Vector3())).sub(point).dot(normal));
      assert.ok(gap>=-.001&&gap<=.005,`${label}: ${side} actual palm gap ${gap}`);
    }
  }
}
const irregular=[.0354,.0352,.0356,.0177,.0353,.0351,.0358,.0352];
async function runRepeated(spec,pattern,{stopDuringDeparture=false}={}){
  const {scene,actor,activity,assembly}=await setup(spec);
  try{
    const started=TycoonScene.prototype.startWalk.call(scene,activity.nav.suggestRoute());assert.equal(started.ok,true);
    let stationStarts=0,finished=0,workingFrames=0,terminalTime=0,stopped=false,heldFrames=0;const seen=new Set();
    for(let frame=0;frame<12000;frame++){
      const dt=pattern==='30Hz'?1/30:irregular[frame%irregular.length];
      const wasPreparing=activity.phase==='leaving'&&activity.departureFeetReady===false,wasReleased=activity.phase==='leaving'&&activity.departureFeetReady===true,previousRoot=actor.position.clone();
      TycoonScene.prototype.updateProbe.call(scene,actor,dt);checkPose(actor,activity,`${spec.name}, ${pattern}, station ${stationStarts}`);
      if(wasPreparing&&activity.phase==='leaving'&&activity.departureFeetReady===false){assert.ok(actor.position.distanceTo(previousRoot)<1e-9,'root waits for checked foot transfer');heldFrames++;}
      if(wasReleased&&activity.phase==='leaving')assert.equal(activity.departureFeetReady,true,'departure readiness remains latched during route motion');
      if(stationStarts){seen.add(activity.phase);if(activity.phase==='working')workingFrames++;}
      if(stopDuringDeparture&&!stopped&&activity.phase==='leaving'&&activity.departureFeetReady===false){
        activity.stop();TycoonScene.prototype.updateProbe.call(scene,actor,dt);
        assert.equal(actor.userData.contact.departureTargets,null,'Stop clears departure targets');assert.equal(activity.departureFeetReady,undefined,'Stop clears departure latch');assert.equal(scene.probeClock,null,'Stop clears fixed-step clock');
        assert.equal(TycoonScene.prototype.startStation.call(scene,'desk-1').ok,true);stationStarts++;seen.clear();workingFrames=0;stopped=true;continue;
      }
      if(activity.phase==='done'){
        if(!stationStarts||finished<2){
          if(stationStarts){
            for(const phase of ['walking','entering','sit','working','standing','leaving','settling','done'])assert.ok(seen.has(phase),`${pattern}: missing ${phase}`);
            assert.ok(workingFrames>=25,`${pattern}: sustained working contact`);finished++;
          }
          const admitted=TycoonScene.prototype.startStation.call(scene,'desk-1');assert.equal(admitted.ok,true);
          stationStarts++;seen.clear();workingFrames=0;
        }else{terminalTime+=dt;if(terminalTime>2)break;}
      }
    }
    assert.equal(finished,2,'two complete desk lifecycles after the initial route');
    assert.ok(terminalTime>2,'the subsequent lifecycle also reaches grounded done');
    if(stopDuringDeparture)assert.equal(stopped,true,'Stop/restart ran during checked departure preparation');
    else if(spec.scale===1.25)assert.ok(heldFrames>0,'large chair exercised root hold while transferring feet');
  }finally{assembly.dispose();}
}
const specs=[{name:'bundled-.75',scale:.75},{name:'bundled-1.25',scale:1.25},...fixtures.map(fixture=>({name:fixture.id,fixture,scale:1.1}))];
for(const spec of specs)for(const pattern of ['30Hz','irregular'])test(`${spec.name} keeps full-scene route → repeated desk lifecycles with ${pattern} outer updates`,async()=>runRepeated(spec,pattern));
test('large chair Stop/restart clears in-progress departure transfer',async()=>runRepeated({name:'bundled-1.25',scale:1.25},'30Hz',{stopDuringDeparture:true}));
