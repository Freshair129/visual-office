import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TycoonScene} from '../web/tycoon-scene.js';

function setup(){
 let clock=0,cost=6;const samples=[],actor=new THREE.Object3D(),snapshot={position:{x:0,y:0},heading:0,clip:'idle'};
 const activity={snapshot,phase:'walking',elapsed:0,tick(dt){this.elapsed+=dt;}};
 actor.userData.probeSnapshot=snapshot;
 actor.userData.contact={restore(){},reset(){},update(state,phase,dt){samples.push({dt,elapsed:activity.elapsed});clock+=cost;return {ok:true,ready:true,feetReady:true,collision:{ok:true}};}};
 const scene={ready:true,activity,play(){},probeStepBudgetMs:8,probeNow:()=>clock};
 return {scene,actor,samples,setCost:value=>cost=value,step:dt=>TycoonScene.prototype.updateProbe.call(scene,actor,dt)};
}

test('render budget stops only after checked fixed steps and retains every pending second',()=>{
 const f=setup();f.step(.1);
 assert.equal(f.samples.length,2,'a catch-up frame must stop after complete checks exhaust its soft budget');
 assert.ok(Math.abs(f.scene.probeClock.remainder-4/60)<1e-12,'unprocessed time remains owed');
 assert.equal(f.scene.lastProbeStepMetrics.budgetYielded,true);
 f.setCost(0);f.step(0);
 assert.equal(f.samples.length,6);assert.ok(Math.abs(f.scene.activity.elapsed-.1)<1e-12);
 assert.ok(f.scene.probeClock.remainder<1e-12);assert.ok(f.samples.every(sample=>sample.dt===1/60));
});

test('new elapsed time joins the backlog and checked logical-step ordering matches an unbudgeted run',()=>{
 const f=setup();f.step(.1);assert.equal(f.samples.length,2);f.setCost(0);f.step(1/30);
 assert.equal(f.samples.length,8);assert.ok(Math.abs(f.scene.activity.elapsed-(.1+1/30))<1e-12);
 assert.ok(f.samples.every((sample,index)=>Math.abs(sample.elapsed-(index+1)/60)<1e-12),'no fixed step is skipped or reordered');
});

test('one indivisible expensive pose can exceed the soft budget without exposing a partial update',()=>{
 const f=setup();f.setCost(50);f.step(1/30);
 assert.equal(f.samples.length,1);assert.equal(f.scene.lastProbeStepMetrics.workMs,50);
 assert.ok(Math.abs(f.scene.probeClock.remainder-1/60)<1e-12);
});

test('a replacement activity drops only the old activity backlog and still checks its new steps',()=>{
 const f=setup();f.step(.1);f.scene.activity.snapshot={...f.scene.activity.snapshot};f.setCost(0);f.step(1/60);
 assert.equal(f.samples.length,3,'old activity debt must not advance the replacement');
 assert.ok(f.scene.probeClock.remainder<1e-12);
});
