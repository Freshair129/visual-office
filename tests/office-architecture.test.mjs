import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createOfficeArchitecture,disposeOfficeArchitecture,officeArchitectureFootprints} from '../web/office-architecture.js';
import {groundToWorld,worldToGround} from '../web/office-projection.js';

const triangleCount=group=>{
  let total=0;
  group.traverse(object=>{
    if(!object.isMesh)return;
    const geometry=object.geometry;
    total+=geometry.index?geometry.index.count/3:(geometry.getAttribute('position')?.count??0)/3;
  });
  return total;
};

const pointInPolygon=(point,polygon)=>{
  let inside=false;
  for(let index=0,previous=polygon.length-1;index<polygon.length;previous=index++){
    const [x,y]=polygon[index],[px,py]=polygon[previous];
    const crosses=(y>point.y)!==(py>point.y)&&point.x<(px-x)*(point.y-y)/(py-y)+x;
    if(crosses)inside=!inside;
  }
  return inside;
};

test('builds real Three.js floors from the work, corridor and lounge ground polygons',()=>{
  const group=createOfficeArchitecture(),architecture=group.userData.officeArchitecture;
  try{
    assert.equal(architecture.rendererType,'threejs-geometry');
    assert.deepEqual(architecture.zones.work.polygon,[[58,24],[90,42],[66,63],[41,43]]);
    assert.deepEqual(architecture.zones.corridor.polygon,[[54,44],[55,47],[50,51],[44,55],[40,58],[34,59],[30,56],[33,52],[38,48],[43,44],[48,42]]);
    assert.deepEqual(architecture.zones.lounge.polygon,[[31,49],[43,57],[59,74],[38,93],[8,72],[10,62]]);
    for(const name of ['work','corridor','lounge']){
      const floor=architecture.floorMeshes[name];
      assert.ok(floor?.isMesh,`${name} floor should be a mesh`);
      assert.notEqual(floor.geometry.type,'PlaneGeometry');
      assert.equal(floor.userData.zone,name);
    }
    assert.ok(architecture.floorMeshes.outerBoundary.isMesh);
  }finally{disposeOfficeArchitecture(group);}
});

test('builds all four visible foreground wall spans at collision height and preserves the doorway gap',()=>{
  const group=createOfficeArchitecture(),architecture=group.userData.officeArchitecture;
  const expected=[
    [[23.7,37.5],[31.2,44.8]],[[39.5,55],[44.8,60.5]],
    [[44.8,60.5],[66.4,81]],[[66.4,81],[98,52]],
  ];
  try{
    assert.deepEqual(architecture.frontWallSegments.map(({start,end})=>[start,end]),expected);
    assert.ok(architecture.frontWallSegments.every(wall=>wall.collisionHeight===2.05));
    assert.ok(architecture.frontWallSegments.every(wall=>wall.group.userData.officeWall===true));
    assert.ok(architecture.frontWallSegments.every(wall=>wall.visibleHeight===wall.collisionHeight));
    for(const wall of architecture.frontWallSegments){
      assert.ok(wall.mesh?.isMesh,'each navigation wall span needs an actual visible mesh');
      assert.equal(wall.mesh.userData.officeWall,true);
      assert.equal(wall.mesh.visible,true);
      assert.equal(wall.mesh.geometry.parameters.height,2.05);
      for(const material of Array.isArray(wall.mesh.material)?wall.mesh.material:[wall.mesh.material])
        assert.notEqual(material.colorWrite,false,'wall visibility must come from rendered wall geometry');
      assert.ok(architecture.wallMeshes.includes(wall.mesh));
      const actualStart=wall.mesh.localToWorld(new THREE.Vector3(-wall.length/2,-wall.visibleHeight/2,0));
      const expectedStart=groundToWorld({x:wall.start[0],y:wall.start[1]});
      assert.ok(actualStart.distanceTo(expectedStart)<1e-6,'wall begins at its exact navigation endpoint');
    }
    assert.deepEqual(architecture.doorwayOpening.start,[31.2,44.8]);
    assert.deepEqual(architecture.doorwayOpening.end,[39.5,55]);
    assert.ok(architecture.doorwayOpening.widthMeters>1);
    assert.equal(architecture.frontWallSegments.length,4,'the doorway span must remain unbuilt');
    assert.equal(group.userData.wallMeshes,architecture.wallMeshes);
    const floorBounds=new THREE.Box3().setFromObject(architecture.floorMeshes.outerBoundary);
    for(const point of expected.flat()){
      const world=groundToWorld({x:point[0],y:point[1]});
      assert.ok(floorBounds.min.x<=world.x+.001&&floorBounds.max.x>=world.x-.001);
      assert.ok(floorBounds.min.z<=world.z+.001&&floorBounds.max.z>=world.z-.001);
    }
  }finally{disposeOfficeArchitecture(group);}
});

test('adds window frames, daylight and warm fixed fixtures without printer or elevator objects',()=>{
  const group=createOfficeArchitecture(),architecture=group.userData.officeArchitecture,roles=new Set();
  try{
    assert.ok(architecture.windows.length>=2);
    for(const window of architecture.windows){
      assert.equal(window.group.userData.role,'window');
      let glass=false,frame=false;
      window.group.traverse(object=>{
        if(object.userData.role==='window-glass')glass=true;
        if(object.userData.role==='window-frame')frame=true;
      });
      assert.ok(glass,'window needs a glass mesh');assert.ok(frame,'window needs real frame geometry');
    }
    group.traverse(object=>{
      if(object.userData.fixtureRole)roles.add(object.userData.fixtureRole);
      assert.doesNotMatch(`${object.name} ${object.userData.role||''}`,/printer|elevator/i);
    });
    assert.ok(roles.has('bookcase'));assert.ok(roles.has('cabinet'));assert.ok(roles.has('plant'));
    assert.ok(architecture.daylight.isLight);
    assert.ok(architecture.backplane);
  }finally{disposeOfficeArchitecture(group);}
});

test('all architecture geometry is finite, bounded and below 40k triangles',()=>{
  const group=createOfficeArchitecture();
  try{
    group.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(group);
    assert.ok(bounds.min.y>=-0.05&&bounds.min.y<=0.02);
    assert.ok(bounds.max.y>=2.05&&bounds.max.y<3.2);
    assert.ok(bounds.max.x-bounds.min.x<40&&bounds.max.z-bounds.min.z<40);
    assert.ok(triangleCount(group)<40_000,`${triangleCount(group)} triangles`);
    group.traverse(object=>{
      for(const vector of [object.position,object.rotation,object.scale])
        assert.ok([vector.x,vector.y,vector.z].every(Number.isFinite),`${object.name} transform must be finite`);
      if(object.isMesh){
        const position=object.geometry.getAttribute('position');
        for(let index=0;index<position.count;index++)
          assert.ok(Number.isFinite(position.getX(index))&&Number.isFinite(position.getY(index))&&Number.isFinite(position.getZ(index)));
      }
    });
  }finally{disposeOfficeArchitecture(group);}
});

test('dispose releases each owned geometry and material once and detaches the room',()=>{
  const scene=new THREE.Group(),group=createOfficeArchitecture();scene.add(group);
  const geometries=new Set(),materials=new Set(),counts=new Map();
  group.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    if(object.material)for(const surface of Array.isArray(object.material)?object.material:[object.material])if(surface)materials.add(surface);
  });
  for(const resource of [...geometries,...materials]){
    const dispose=resource.dispose.bind(resource);
    resource.dispose=()=>{counts.set(resource,(counts.get(resource)??0)+1);dispose();};
  }
  disposeOfficeArchitecture(group);disposeOfficeArchitecture(group);
  assert.equal(scene.children.includes(group),false);
  assert.equal(group.children.length,0);
  assert.equal(counts.size,geometries.size+materials.size);
  assert.ok([...counts.values()].every(count=>count===1));
});

test('provides stable math-only collision footprints for fixed architecture fixtures',()=>{
  const footprints=officeArchitectureFootprints();
  assert.deepEqual(footprints,officeArchitectureFootprints());
  assert.deepEqual(footprints.map(item=>item.id),['bookcase','cabinet','plant-lounge']);
  assert.ok(footprints.every(item=>item.kind==='architecture'&&item.polygon.length>=4));
  for(const footprint of footprints){
    assert.ok(Number.isFinite(footprint.center.x)&&Number.isFinite(footprint.center.y));
    assert.ok(footprint.polygon.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&x>-10&&x<110&&y>-10&&y<110));
  }
  const clearanceFree=officeArchitectureFootprints(0);
  assert.deepEqual(clearanceFree.map(item=>item.id),footprints.map(item=>item.id));
  assert.notDeepEqual(clearanceFree[0].polygon,footprints[0].polygon,'clearance expands physical obstacles');

  const group=createOfficeArchitecture();
  try{
    group.updateMatrixWorld(true);
    const fixtures=new Map();
    group.traverse(object=>{if(object.userData.fixtureId)fixtures.set(object.userData.fixtureId,object);});
    for(const footprint of footprints){
      const fixture=fixtures.get(footprint.id);
      assert.ok(fixture,`${footprint.id} fixture should share its footprint id`);
      const bounds=new THREE.Box3().setFromObject(fixture);
      for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.z,bounds.max.z]){
        const projected=worldToGround(new THREE.Vector3(x,0,z));
        assert.ok(pointInPolygon(projected,footprint.polygon),`${footprint.id} footprint must cover projected fixture bounds`);
      }
    }
  }finally{disposeOfficeArchitecture(group);}
});
