import test from 'node:test';
import assert from 'node:assert/strict';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {tycoonWorld,tycoonGround} from '../web/tycoon-blueprint.js';

test('standing may use its existing clear nav corridor instead of an unrelated fixed desk margin',()=>{
  const room=createTycoonRoom('projects');room.objects.find(o=>o.id==='chair-1').scale=1.25;
  const activity=new TycoonActivity(room),station=activity.nav.stations.find(s=>s.objectId==='desk-1');
  assert.ok(station);
  const seat=tycoonWorld(station.seat),front=tycoonWorld(station.footAnchor).sub(seat).setY(0).normalize();
  station.seatRoot=tycoonGround(seat.clone().addScaledVector(front,.31));
  station.footAnchor=tycoonGround(seat.clone().addScaledVector(front,.74));
  const origin=tycoonWorld(station.seatRoot);
  activity.station=station;activity.snapshot={position:{...station.seatRoot},heading:station.heading,clip:'stand_up'};
  activity.transition('standing','stand_up','local test');activity.poseReady=false;
  const traversed=[];let previous={...activity.snapshot.position};
  for(let frame=0;frame<30;frame++){
    activity.tick(1/30);const next={...activity.snapshot.position};
    assert.ok(activity.nav.isSegmentWalkable(previous,next,{ignoreIds:[station.seatObjectId]}),'desk remains a navigation obstacle');
    traversed.push(tycoonWorld(next).distanceTo(tycoonWorld(previous)));previous=next;
  }
  const advance=tycoonWorld(activity.snapshot.position).sub(origin).dot(front);
  assert.ok(Math.abs(advance-.08)<1e-8,`allowed standing advance was ${advance}`);
  assert.ok(Math.max(...traversed)<=.35/30+1e-8,'standing moves continuously at the existing speed');
  assert.equal(activity.phase,'standing','this kinematic test does not certify physical pose readiness');
});
