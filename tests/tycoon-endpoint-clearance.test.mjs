import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {TycoonActivity} from '../web/tycoon-activity.js';
import {TycoonScene} from '../web/tycoon-scene.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {tycoonStructure, tycoonWorld} from '../web/tycoon-blueprint.js';
import {TycoonCollisionWorld} from '../web/tycoon-limb-collision.js';

const WALL_ID = 'wall:partition-inventory-reservation-return-0:end';
const DESK_ID = 'inventory-reservation-desk';
const CHAIR_ID = 'inventory-reservation-chair';

async function loadGlb(path) {
  const bytes = await readFile(path);
  return GLTFLoader.prototype.parseAsync.call(
    new GLTFLoader(),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
}

function place(model, data) {
  model.userData.instanceId = data.id;
  model.position.set(data.x || 0, data.y || 0, data.z || 0);
  model.rotation.y = data.rotation || 0;
  if (Array.isArray(data.size)) model.scale.set(...data.size);
  else model.scale.setScalar(data.scale || 1);
  return model;
}

function skinnedShoeBottoms(actor) {
  actor.updateMatrixWorld(true);
  return ['left', 'right'].map(side => {
    const shoe = actor.getObjectByName(`office-${side}-shoe`);
    assert.ok(shoe, `the actual rig contains its ${side} skinned shoe`);
    shoe.skeleton.update();
    let bottom = Infinity;
    for (let index = 0; index < shoe.geometry.attributes.position.count; index++) {
      bottom = Math.min(bottom, shoe.localToWorld(shoe.getVertexPosition(index, new THREE.Vector3())).y);
    }
    return {side, bottom};
  });
}

async function inventoryScene() {
  const room = createTycoonRoom('inventory');
  const station = new TycoonActivity(room).nav.stations.find(item => item.objectId === DESK_ID);
  assert.ok(station, 'the Inventory reservation desk is a real navigation station');

  const wallData = tycoonStructure(room).find(item => item.id === WALL_ID);
  assert.ok(wallData, `the assembled room includes ${WALL_ID}`);
  const deskData = room.objects.find(item => item.id === DESK_ID);
  const chairData = room.objects.find(item => item.id === CHAIR_ID);
  assert.ok(deskData && chairData, 'the reservation desk has its paired chair');

  const [actorGltf, chairGltf, deskGltf, wallGltf] = await Promise.all([
    loadGlb('web/assets/models/tycoon-factory/actor-rig-v3.glb'),
    loadGlb('web/assets/models/tycoon/chair.glb'),
    loadGlb('web/assets/models/tycoon-factory/desk-v3.glb'),
    loadGlb('web/assets/models/tycoon/wall.glb'),
  ]);
  const actor = actorGltf.scene;
  actor.userData = {
    instanceId: 'demo-agent',
    clips: actorGltf.animations,
    mixer: new THREE.AnimationMixer(actor),
  };
  const chair = place(chairGltf.scene, chairData);
  const desk = place(deskGltf.scene, deskData);
  const wall = place(wallGltf.scene, wallData);
  const activity = new TycoonActivity(room);
  const scene = {
    ready: true,
    assembly: {owned: [actor, chair, desk, wall]},
    activity,
    collisionWorld: new TycoonCollisionWorld([chair, desk, wall]),
    play: TycoonScene.prototype.play,
    onStatus() {},
  };
  const admission = TycoonScene.prototype.startStation.call(scene, DESK_ID);
  assert.equal(admission.ok, true, JSON.stringify(admission));
  return {actor, activity, scene, station, wallData};
}

for (const hz of [30, 60]) {
  test(`Inventory reservation exit stays clear through two seconds of settling at ${hz} Hz`, async () => {
    const {actor, activity, scene, station, wallData} = await inventoryScene();
    const seen = new Set();
    const phases = [];
    let previous = null;
    let doneFrames = 0;

    for (let frame = 0; frame < hz * 90; frame++) {
      TycoonScene.prototype.updateProbe.call(scene, actor, 1 / hz);
      seen.add(activity.phase);
      const rootWorld = activity.snapshot && tycoonWorld(activity.snapshot.position);
      if (activity.phase !== previous) {
        phases.push({
          phase: activity.phase,
          frame,
          root: rootWorld?.toArray(),
          heading: activity.snapshot?.heading,
          hit: actor.userData.limbCollisionDiagnostics?.hit || null,
        });
        previous = activity.phase;
      }

      const diagnostic = actor.userData.limbCollisionDiagnostics;
      assert.ok(diagnostic?.ok !== false, JSON.stringify({
        hz,
        phase: activity.phase,
        frame,
        root: rootWorld?.toArray(),
        station: {
          position: tycoonWorld(station.position).toArray(),
          seatRoot: tycoonWorld(station.seatRoot).toArray(),
          footAnchor: tycoonWorld(station.footAnchor).toArray(),
        },
        wall: wallData,
        phases,
        collision: diagnostic && {
          phase: diagnostic.phase,
          checkedCapsules: diagnostic.checkedCapsules,
          testedTriangles: diagnostic.testedTriangles,
          hit: diagnostic.hit && {
            objectId: diagnostic.hit.objectId,
            mesh: diagnostic.hit.mesh,
            limb: diagnostic.hit.limb,
            clearanceM: diagnostic.hit.clearanceM,
            distanceM: diagnostic.hit.distanceM,
            radiusM: diagnostic.hit.radiusM,
            segmentStart: diagnostic.hit.segmentStart,
            segmentEnd: diagnostic.hit.segmentEnd,
            surfaceCenter: diagnostic.hit.surfaceCenter,
            surfaceBounds: diagnostic.hit.surfaceBounds,
            sweepT: diagnostic.hit.sweepT,
            sampleIndex: diagnostic.hit.sampleIndex,
          },
        },
      }));

      if (activity.phase === 'done') {
        doneFrames++;
        const shoes = skinnedShoeBottoms(actor);
        assert.ok(shoes.every(shoe => Math.abs(shoe.bottom) <= .003), JSON.stringify({
          hz,
          frame,
          phase: activity.phase,
          shoes,
          phases,
        }));
        if (doneFrames > hz * 2) break;
      }
      if (activity.phase === 'blocked') break;
    }

    for (const phase of ['walking', 'entering', 'sit', 'working', 'standing', 'leaving', 'settling', 'done']) {
      assert.ok(seen.has(phase), `missing ${phase}; ended at ${activity.phase}; ${JSON.stringify(phases)}`);
    }
    const settlingIndex = phases.findIndex(event => event.phase === 'settling');
    const doneIndex = phases.findIndex(event => event.phase === 'done');
    assert.ok(settlingIndex >= 0 && doneIndex > settlingIndex, `settling must precede done: ${JSON.stringify(phases)}`);
    assert.ok(doneFrames > hz * 2, `only settled for ${doneFrames} frames at ${hz} Hz`);
  });
}
