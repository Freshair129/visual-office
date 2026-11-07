import test from 'node:test';
import assert from 'node:assert/strict';
import {FramePacer} from '../web/tycoon-frame-pacer.js';

test('30 FPS mode schedules half the frames without halving simulation time',()=>{
  const pacer=new FramePacer(30);let frames=0,elapsed=0;
  for(let i=0;i<=60;i++){const dt=pacer.sample(i*1000/60);if(dt!==null){frames++;elapsed+=dt;}}
  assert.ok(frames>=30&&frames<=31,`rendered ${frames}`);assert.ok(Math.abs(elapsed-1)<.02,`elapsed ${elapsed}`);
});

test('mode changes reset pacing and long gaps do not cause an unbounded simulation step',()=>{
  const pacer=new FramePacer(0);assert.equal(pacer.sample(0),0);assert.equal(pacer.sample(16),.016);
  pacer.setRate(30);assert.equal(pacer.sample(100),0);assert.equal(pacer.sample(110),null);assert.ok(pacer.sample(140)>0);
  assert.equal(pacer.sample(5000),.1);assert.throws(()=>pacer.setRate(24));
});

test('30 FPS remains approximately paced on a 144 Hz display with irregular callbacks',()=>{
  const pacer=new FramePacer(30);let frames=0;
  for(let i=0;i<=288;i++){const jitter=i%3===0?.7:0; if(pacer.sample(i*1000/144+jitter)!==null)frames++;}
  assert.ok(frames>=59&&frames<=62,`rendered ${frames} frames in two seconds`);
});

for(const hz of [60,120])test(`30 FPS cadence tolerates quantized ${hz} Hz RAF timestamps`,()=>{
  const pacer=new FramePacer(30),renderTimes=[];let elapsed=0;
  for(let frame=0;frame<=hz*4;frame++){
    const time=Math.round(frame*1000/hz*10)/10,dt=pacer.sample(time);
    if(dt!==null){renderTimes.push(time);elapsed+=dt;}
  }
  const intervals=renderTimes.slice(1).map((time,index)=>time-renderTimes[index]);
  assert.ok(intervals.every(ms=>ms>=33.2&&ms<=33.5),`unexpected intervals: ${JSON.stringify([...new Set(intervals.map(ms=>Math.round(ms*10)/10))])}`);
  assert.equal(renderTimes.length,121);
  assert.ok(Math.abs(elapsed-4)<.001,`actual elapsed=${elapsed}`);
});

