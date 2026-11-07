import {applyWallPieces,pieceAlignment,piecePoint,SKELETON_WALLS,wallAnchor} from './office-skeleton-parts.js';
import * as THREE from 'three';
import {groundToWorld,worldToGround} from './office-projection.js';
import {blueprintLayout,isOfficeBlueprint} from './office-blueprints.js';
import {isBlueprintInput} from './office-blueprint-state.js';

// @tested tests/office-architecture.test.mjs — produces the visible cutaway room used by the Office Idle renderer

const WORK_POLYGON=[[58,24],[90,42],[66,63],[41,43]];
const CORRIDOR_POLYGON=[[54,44],[55,47],[50,51],[44,55],[40,58],[34,59],[30,56],[33,52],[38,48],[43,44],[48,42]];
const LOUNGE_POLYGON=[[31,49],[43,57],[59,74],[38,93],[8,72],[10,62]];
const FRONT_WALLS=[
  [[23.7,37.5],[31.2,44.8]],
  [[39.5,55],[44.8,60.5]],
  [[44.8,60.5],[66.4,81]],
  [[66.4,81],[98,52]],
];
const REAR_WALL_LAYOUT={
  workRear:{id:'work-rear',start:[58,24],end:[90,42]},
  workSide:{id:'work-left',start:[58,24],end:[41,43]},
  loungeRear:{id:'lounge-rear',start:[31,49],end:[10,62]},
};
const FIXED_FIXTURE_LAYOUT={
  bookcase:{id:'bookcase',wall:'workSide',x:.55,z:.28,width:1.48,depth:.435,centerOffsetZ:.1725},
  cabinet:{id:'cabinet',wall:'loungeRear',x:-.4,z:.25,width:1.58,depth:.63,centerOffsetZ:.03},
  plants:[
    {id:'plant-lounge',ground:[13,67],scale:1,radius:.32},
  ],
};

function wallTransform(start,end){
  const a=groundToWorld({x:start[0],y:start[1]}),b=groundToWorld({x:end[0],y:end[1]});
  const dx=b.x-a.x,dz=b.z-a.z;
  return {
    a,b,length:Math.hypot(dx,dz),
    centerX:(a.x+b.x)/2,centerZ:(a.z+b.z)/2,
    rotationY:-Math.atan2(dz,dx),
  };
}

function wallLocalToWorld(transform,x,z){
  const cosine=Math.cos(transform.rotationY),sine=Math.sin(transform.rotationY);
  return {
    x:transform.centerX+x*cosine+z*sine,
    z:transform.centerZ-x*sine+z*cosine,
  };
}

function worldToGroundPoint(x,z){
  const point=worldToGround(new THREE.Vector3(x,0,z));
  return [point.x,point.y];
}

function boundsFootprint(id,worldCorners,clearance){
  const minX=Math.min(...worldCorners.map(point=>point.x)),maxX=Math.max(...worldCorners.map(point=>point.x));
  const minZ=Math.min(...worldCorners.map(point=>point.z)),maxZ=Math.max(...worldCorners.map(point=>point.z));
  const left=minX-clearance,right=maxX+clearance,back=minZ-clearance,front=maxZ+clearance;
  const center=worldToGroundPoint((left+right)/2,(back+front)/2);
  return {
    id,kind:'architecture',center:{x:center[0],y:center[1]},
    polygon:[[left,back],[right,back],[right,front],[left,front]].map(([x,z])=>worldToGroundPoint(x,z)),
  };
}

function wallFixtureFootprint(placement,wall,clearance){
  const transform=wallTransform(wall.start,wall.end),centerZ=placement.z+placement.centerOffsetZ;
  const corners=[
    [-placement.width/2,-placement.depth/2],[-placement.width/2,placement.depth/2],
    [placement.width/2,placement.depth/2],[placement.width/2,-placement.depth/2],
  ].map(([x,z])=>wallLocalToWorld(transform,placement.x+x,centerZ+z));
  return boundsFootprint(placement.id,corners,clearance);
}

function polygonShape(polygon){
  const points=polygon.map(([x,y])=>groundToWorld({x,y}));
  const shape=new THREE.Shape();
  shape.moveTo(points[0].x,-points[0].z);
  for(const point of points.slice(1))shape.lineTo(point.x,-point.z);
  shape.closePath();
  return shape;
}

function convexHull(points){
  const sorted=[...new Map(points.map(point=>[`${point[0]},${point[1]}`,point])).values()]
    .sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  if(sorted.length<3)return sorted;
  const cross=(origin,a,b)=>(a[0]-origin[0])*(b[1]-origin[1])-(a[1]-origin[1])*(b[0]-origin[0]);
  const lower=[];
  for(const point of sorted){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),point)<=0)lower.pop();lower.push(point);}
  const upper=[];
  for(const point of [...sorted].reverse()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),point)<=0)upper.pop();upper.push(point);}
  lower.pop();upper.pop();return [...lower,...upper];
}

function addFloorGrid(parent,polygon,y,material){
  const minY=Math.min(...polygon.map(point=>point[1])),maxY=Math.max(...polygon.map(point=>point[1]));
  const positions=[];
  for(let line=minY+3.2;line<maxY;line+=3.2){
    const crossings=[];
    for(let index=0;index<polygon.length;index++){
      const a=polygon[index],b=polygon[(index+1)%polygon.length];
      if((a[1]<=line&&b[1]>line)||(b[1]<=line&&a[1]>line)){
        const ratio=(line-a[1])/(b[1]-a[1]);
        crossings.push(a[0]+(b[0]-a[0])*ratio);
      }
    }
    crossings.sort((a,b)=>a-b);
    for(let index=0;index+1<crossings.length;index+=2){
      for(const x of [crossings[index],crossings[index+1]]){
        const point=groundToWorld({x,y:line});positions.push(point.x,y+.002,point.z);
      }
    }
  }
  if(!positions.length)return null;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const lines=new THREE.LineSegments(geometry,material);lines.name='subtle-floor-joints';lines.userData.role='floor-joints';
  parent.add(lines);return lines;
}

function makeBox(parent,name,width,height,depth,material,position){
  const geometry=new THREE.BoxGeometry(width,height,depth);
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.copy(position);
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

function addWallPanel(parent,wallId,x,width,y,height,depth,material,wallMeshes){
  if(width<=.001||height<=.001)return null;
  const mesh=makeBox(parent,`${wallId}-plaster`,width,height,depth,material,new THREE.Vector3(x,y,0));
  mesh.userData.officeWall=true;mesh.userData.wallId=wallId;wallMeshes.push(mesh);return mesh;
}

function addWindow(parent,wallId,{center,width=1.55,sill=.98,top=2.05,frameMaterial,glassMaterial}){
  const height=top-sill,windowGroup=new THREE.Group();windowGroup.name=`${wallId}-window`;
  windowGroup.userData.role='window';windowGroup.position.x=center;parent.add(windowGroup);
  const glass=new THREE.Mesh(new THREE.BoxGeometry(width-.12,height-.12,.025),glassMaterial);
  glass.name='window-glass';glass.userData.role='window-glass';glass.position.set(0,(sill+top)/2,.008);
  glass.receiveShadow=true;windowGroup.add(glass);
  const frameWidth=.075,frameDepth=.115;
  const frame=(name,w,h,x,y,z=0)=>{
    const mesh=makeBox(windowGroup,name,w,h,frameDepth,frameMaterial,new THREE.Vector3(x,y,z));
    mesh.userData.role='window-frame';return mesh;
  };
  frame('window-frame-left',frameWidth,height+.11,-width/2,(sill+top)/2);
  frame('window-frame-right',frameWidth,height+.11,width/2,(sill+top)/2);
  frame('window-frame-sill',width+.08,.09,0,sill-.015,.015);
  frame('window-frame-header',width+.08,.075,0,top+.012,.015);
  frame('window-frame-mullion',.045,height-.06,0,(sill+top)/2,.02);
  windowGroup.userData.wallId=wallId;
  return {group:windowGroup,center,width,height,sill,top};
}

function makeWall(parent,start,end,{id,height=2.55,depth=.16,wallMaterial,trimMaterial,glassMaterial,wallMeshes,windowSpecs=[]}={}){
  const transform=wallTransform(start,end),{a,b,length}=transform;
  const wallGroup=new THREE.Group();wallGroup.name=`wall-${id}`;
  wallGroup.position.set(transform.centerX,0,transform.centerZ);
  wallGroup.rotation.y=transform.rotationY;
  wallGroup.userData.officeWall=true;wallGroup.userData.wallId=id;parent.add(wallGroup);
  const wallWindowRecords=[];
  const normalizedWindows=windowSpecs.map(definition=>({...definition,
    center:(definition.fraction-.5)*length,
  })).sort((left,right)=>left.center-right.center);
  let cursor=-length/2;
  for(const window of normalizedWindows){
    const left=window.center-window.width/2,right=window.center+window.width/2;
    addWallPanel(wallGroup,id,(cursor+left)/2,left-cursor,height/2,height,depth,wallMaterial,wallMeshes);
    addWallPanel(wallGroup,id,window.center,window.width,window.sill/2,window.sill,depth,wallMaterial,wallMeshes);
    addWallPanel(wallGroup,id,window.center,window.width,(window.top+height)/2,height-window.top,depth,wallMaterial,wallMeshes);
    wallWindowRecords.push(addWindow(wallGroup,id,{...window,frameMaterial:trimMaterial,glassMaterial}));
    cursor=right;
  }
  addWallPanel(wallGroup,id,(cursor+length/2)/2,length/2-cursor,height/2,height,depth,wallMaterial,wallMeshes);
  const cap=makeBox(wallGroup,`${id}-oak-cap`,length+.08,.07,depth+.04,trimMaterial,new THREE.Vector3(0,height-.025,0));
  cap.userData.role='oak-trim';
  const base=makeBox(wallGroup,`${id}-oak-baseboard`,length,.13,depth+.025,trimMaterial,new THREE.Vector3(0,.065,0));
  base.userData.role='oak-trim';
  return {
    id,start:[...start],end:[...end],length,height,collisionHeight:height,visibleHeight:height,
    group:wallGroup,mesh:wallMeshes.find(mesh=>mesh.userData.wallId===id)||null,
    windows:wallWindowRecords,
  };
}

function addBookcase(parent,fixtures,materials,placement){
  const fixture=new THREE.Group();fixture.name='built-in-bookcase';fixture.userData.fixtureRole='bookcase';fixture.userData.fixtureId=placement.id;
  fixture.position.set(placement.x,0,placement.z);parent.add(fixture);
  const {oak,woodEdge,bookColors}=materials;
  makeBox(fixture,'bookcase-back',1.45,1.72,.09,oak,new THREE.Vector3(0,.86,0));
  for(const x of [-.69,.69])makeBox(fixture,'bookcase-side',.09,1.78,.38,woodEdge,new THREE.Vector3(x,.89,.17));
  for(const y of [.08,.55,1.02,1.49,1.78])makeBox(fixture,'bookcase-shelf',1.48,.07,.42,woodEdge,new THREE.Vector3(0,y,.18));
  for(let shelf=0;shelf<3;shelf++){
    let x=-.57;
    for(let book=0;book<7;book++){
      const height=.27+((book+shelf)%3)*.035;
      const material=bookColors[(book+shelf*2)%bookColors.length];
      const volume=new THREE.Mesh(new THREE.BoxGeometry(.10,height,.19),material);
      volume.name='book-spine';volume.position.set(x,.15+shelf*.47+height/2,.22);volume.castShadow=true;fixture.add(volume);x+=.17;
    }
  }
  fixtures.push(fixture);return fixture;
}

function addCabinet(parent,fixtures,materials,placement){
  const fixture=new THREE.Group();fixture.name='built-in-cabinet';fixture.userData.fixtureRole='cabinet';fixture.userData.fixtureId=placement.id;
  fixture.position.set(placement.x,0,placement.z);parent.add(fixture);
  const {oak,woodEdge,brass}=materials;
  makeBox(fixture,'cabinet-body',1.5,.66,.52,oak,new THREE.Vector3(0,.35,0));
  makeBox(fixture,'cabinet-top',1.58,.07,.57,woodEdge,new THREE.Vector3(0,.72,0));
  for(const x of [-.38,.38]){
    makeBox(fixture,'cabinet-door',.69,.52,.025,woodEdge,new THREE.Vector3(x,.36,.274));
    const knob=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8),brass);
    knob.name='cabinet-knob';knob.position.set(x+(x<0?.24:-.24),.37,.31);fixture.add(knob);
  }
  fixtures.push(fixture);return fixture;
}

function addPlant(parent,placement,fixtures,materials){
  const position=groundPoint(placement.ground[0],placement.ground[1]);
  const fixture=new THREE.Group();fixture.name='leafy-office-plant';fixture.userData.fixtureRole='plant';fixture.userData.fixtureId=placement.id;
  fixture.position.copy(position);fixture.scale.setScalar(placement.scale);parent.add(fixture);
  const profile=[new THREE.Vector2(.13,0),new THREE.Vector2(.21,.025),new THREE.Vector2(.24,.08),new THREE.Vector2(.205,.32),new THREE.Vector2(.14,.36)];
  const pot=new THREE.Mesh(new THREE.LatheGeometry(profile,18),materials.planter);
  pot.name='rounded-planter';pot.position.y=.02;pot.castShadow=true;pot.receiveShadow=true;fixture.add(pot);
  const soil=new THREE.Mesh(new THREE.CylinderGeometry(.145,.145,.025,18),materials.soil);
  soil.name='planter-soil';soil.position.y=.35;fixture.add(soil);
  const leafGeometry=new THREE.SphereGeometry(1,12,8);
  for(let index=0;index<9;index++){
    const angle=index*Math.PI*2/9,rise=.55+(index%3)*.09;
    const leaf=new THREE.Mesh(leafGeometry,materials.leaves[index%materials.leaves.length]);
    leaf.name='rounded-plant-leaf';leaf.position.set(Math.cos(angle)*.16,.47+rise/2,Math.sin(angle)*.16);
    leaf.scale.set(.12,rise*.78,.16);leaf.rotation.z=-Math.cos(angle)*.36;leaf.rotation.x=Math.sin(angle)*.32;
    leaf.castShadow=true;fixture.add(leaf);
  }
  fixtures.push(fixture);return fixture;
}

function groundPoint(x,y){return groundToWorld({x,y});}

export function officeArchitectureFootprints(clearance=.3,blueprint,parts=[]){
  if(isBlueprintInput(blueprint))return [];
  const padding=Number.isFinite(clearance)?Math.max(0,clearance):.3;
  const bookcase=wallFixtureFootprint(FIXED_FIXTURE_LAYOUT.bookcase,REAR_WALL_LAYOUT.workSide,padding/pieceAlignment({skeletonParts:parts},'wall:work-left').scale);
  const cabinet=wallFixtureFootprint(FIXED_FIXTURE_LAYOUT.cabinet,REAR_WALL_LAYOUT.loungeRear,padding/pieceAlignment({skeletonParts:parts},'wall:lounge-rear').scale);
  const plants=FIXED_FIXTURE_LAYOUT.plants.map(placement=>{
    const anchor=groundToWorld({x:placement.ground[0],y:placement.ground[1]}),radius=placement.radius*placement.scale;
    return boundsFootprint(placement.id,[
      {x:anchor.x-radius,z:anchor.z-radius},{x:anchor.x+radius,z:anchor.z-radius},
      {x:anchor.x+radius,z:anchor.z+radius},{x:anchor.x-radius,z:anchor.z+radius},
    ],padding);
  });
  const moveFixture=(footprint,wallId)=>{const w=SKELETON_WALLS.find(w=>w.id===wallId),a=pieceAlignment({skeletonParts:parts},`wall:${wallId}`);if(a.x===0&&a.y===0&&a.scale===1)return footprint;const points=footprint.polygon.map(([x,y])=>piecePoint({x,y},wallAnchor(w),a));return {...footprint,center:piecePoint(footprint.center,wallAnchor(w),a),polygon:points.map(p=>[p.x,p.y])};};
  return [moveFixture(bookcase,'work-left'),moveFixture(cabinet,'lounge-rear'),...plants];
}

export function createOfficeArchitecture(blueprint,parts=[]){
  if(isBlueprintInput(blueprint))return createBlueprintArchitecture(blueprint);
  const room=new THREE.Group();room.name='office-architecture';
  const material={
    outerFloor:new THREE.MeshStandardMaterial({color:'#DCCDB8',roughness:.96}),
    workFloor:new THREE.MeshStandardMaterial({color:'#EADBC3',roughness:.94}),
    corridorFloor:new THREE.MeshStandardMaterial({color:'#F1E7D7',roughness:.97}),
    loungeFloor:new THREE.MeshStandardMaterial({color:'#DDE1D1',roughness:.96}),
    workJoints:new THREE.LineBasicMaterial({color:'#D9C9B0',transparent:true,opacity:.5,depthWrite:false}),
    loungeJoints:new THREE.LineBasicMaterial({color:'#C9D1C0',transparent:true,opacity:.5,depthWrite:false}),
    plaster:new THREE.MeshStandardMaterial({color:'#FFF8F0',roughness:.9}),
    plasterShadow:new THREE.MeshStandardMaterial({color:'#F4E7D4',roughness:.93}),
    oak:new THREE.MeshStandardMaterial({color:'#B77D48',roughness:.76}),
    oakLight:new THREE.MeshStandardMaterial({color:'#D7AD79',roughness:.78}),
    glass:new THREE.MeshPhysicalMaterial({color:'#BBDDE2',transparent:true,opacity:.43,roughness:.18,metalness:.04,side:THREE.DoubleSide,depthWrite:false}),
    backplane:new THREE.MeshStandardMaterial({color:'#F8EBD7',roughness:1,side:THREE.DoubleSide}),
    woodEdge:new THREE.MeshStandardMaterial({color:'#93633F',roughness:.8}),
    brass:new THREE.MeshStandardMaterial({color:'#CBA563',metalness:.38,roughness:.4}),
    bookColors:['#7B9A80','#D58C53','#62859A','#B86B58','#D6B770'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.86})),
    planter:new THREE.MeshStandardMaterial({color:'#C87558',roughness:.87}),
    soil:new THREE.MeshStandardMaterial({color:'#735B43',roughness:1}),
    leaves:['#6F8B67','#819A70','#90A77A'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.9})),
  };
  const allPoints=[
    ...WORK_POLYGON,...CORRIDOR_POLYGON,...LOUNGE_POLYGON,
    ...FRONT_WALLS.flat(),
  ];
  const floorMeshes={};
  const outerBoundary=convexHull(allPoints);
  const outerFloor=new THREE.Mesh(new THREE.ShapeGeometry(polygonShape(outerBoundary)),material.outerFloor);
  outerFloor.name='outer-room-floor';outerFloor.rotation.x=-Math.PI/2;outerFloor.position.y=0;
  outerFloor.receiveShadow=true;outerFloor.userData.zone='outerBoundary';room.add(outerFloor);floorMeshes.outerBoundary=outerFloor;
  const zones=[
    ['work',WORK_POLYGON,material.workFloor,.012],
    ['corridor',CORRIDOR_POLYGON,material.corridorFloor,.019],
    ['lounge',LOUNGE_POLYGON,material.loungeFloor,.026],
  ];
  const zoneMetadata={};
  for(const [name,polygon,surface,y] of zones){
    const floor=new THREE.Mesh(new THREE.ShapeGeometry(polygonShape(polygon)),surface);
    floor.name=`${name}-floor`;floor.rotation.x=-Math.PI/2;floor.position.y=y;floor.receiveShadow=true;floor.userData.zone=name;
    room.add(floor);floorMeshes[name]=floor;
    zoneMetadata[name]={polygon:polygon.map(point=>[...point]),worldPolygon:polygon.map(([x,y])=>groundPoint(x,y).toArray())};
    if(name==='work')addFloorGrid(room,polygon,y+.003,material.workJoints);
    if(name==='lounge')addFloorGrid(room,polygon,y+.003,material.loungeJoints);
  }

  const backplane=new THREE.Mesh(new THREE.PlaneGeometry(16,3),material.backplane);
  backplane.name='warm-room-backplane';backplane.position.set(-7,1.62,-12);backplane.rotation.y=Math.PI/4;
  backplane.userData.role='backplane';room.add(backplane);

  const daylight=new THREE.DirectionalLight('#FFF2D7',1.12);
  daylight.name='office-daylight';daylight.position.set(-5,9,-6);daylight.target.position.set(0,0,0);
  daylight.userData.role='daylight';daylight.castShadow=false;room.add(daylight,daylight.target);
  const ambient=new THREE.HemisphereLight('#FFF8EA','#A7A18C',.7);ambient.name='room-ambient';room.add(ambient);

  const wallMeshes=[],windows=[],frontWallSegments=[],rearWallSegments=[],fixtures=[];
  const wallOptions={wallMaterial:material.plaster,trimMaterial:material.oakLight,glassMaterial:material.glass,wallMeshes};
  for(let index=0;index<FRONT_WALLS.length;index++){
    const [start,end]=FRONT_WALLS[index];
    const wall=makeWall(room,start,end,{...wallOptions,id:`front-${index+1}`,height:2.05,depth:.17});
    wall.group.userData.wallKind='foreground';frontWallSegments.push(wall);
  }
  // The deep work wall carries real windows; its two connected wings establish the far corner.
  rearWallSegments.push(makeWall(room,REAR_WALL_LAYOUT.workRear.start,REAR_WALL_LAYOUT.workRear.end,{
    ...wallOptions,id:REAR_WALL_LAYOUT.workRear.id,height:2.62,depth:.19,
    windowSpecs:[{fraction:.31,width:1.5,sill:1.0,top:2.12},{fraction:.70,width:1.5,sill:1.0,top:2.12}],
  }));
  windows.push(...rearWallSegments.at(-1).windows);
  const workSide=makeWall(room,REAR_WALL_LAYOUT.workSide.start,REAR_WALL_LAYOUT.workSide.end,{
    ...wallOptions,id:REAR_WALL_LAYOUT.workSide.id,height:2.62,depth:.19,
  });
  rearWallSegments.push(workSide);
  const loungeSide=makeWall(room,REAR_WALL_LAYOUT.loungeRear.start,REAR_WALL_LAYOUT.loungeRear.end,{
    ...wallOptions,id:REAR_WALL_LAYOUT.loungeRear.id,height:2.46,depth:.17,
    windowSpecs:[{fraction:.5,width:1.45,sill:.96,top:1.98}],
  });
  windows.push(...loungeSide.windows);
  rearWallSegments.push(loungeSide);
  addBookcase(workSide.group,fixtures,{oak:material.oakLight,woodEdge:material.woodEdge,bookColors:material.bookColors},FIXED_FIXTURE_LAYOUT.bookcase);
  addCabinet(loungeSide.group,fixtures,{oak:material.oakLight,woodEdge:material.woodEdge,brass:material.brass},FIXED_FIXTURE_LAYOUT.cabinet);
  for(const placement of FIXED_FIXTURE_LAYOUT.plants)addPlant(room,placement,fixtures,material);

  const firstGapEnd=groundPoint(31.2,44.8),secondGapStart=groundPoint(39.5,55);
  const doorwayOpening={
    start:[31.2,44.8],end:[39.5,55],widthMeters:firstGapEnd.distanceTo(secondGapStart),
    worldStart:firstGapEnd.toArray(),worldEnd:secondGapStart.toArray(),
  };
  const allWalls=[...frontWallSegments,...rearWallSegments];
  const architecture={
    rendererType:'threejs-geometry',
    zones:zoneMetadata,
    floorMeshes,
    frontWallSegments,
    rearWallSegments,
    doorwayOpening,
    windows,
    wallMeshes,
    walls:allWalls,
    fixtures,
    daylight,
    ambient,
    backplane,
  };
  room.userData.wallMeshes=wallMeshes;
  room.userData.officeArchitecture=architecture;
  room.userData.rendererType='threejs-geometry';
  applyWallPieces(room,parts);room.updateMatrixWorld(true);
  return room;
}

export function disposeOfficeArchitecture(room){
  if(!room?.isObject3D||room.userData.officeArchitectureDisposed)return;
  const geometries=new Set(),materials=new Set();
  room.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    if(object.material){
      const list=Array.isArray(object.material)?object.material:[object.material];
      for(const surface of list)if(surface)materials.add(surface);
    }
  });
  for(const geometry of geometries)geometry.dispose();
  for(const surface of materials)surface.dispose();
  room.removeFromParent();room.clear();
  for(const texture of room.userData.ownedTextures||[])texture.dispose();room.userData.ownedTextures?.clear();
  room.userData.officeArchitectureDisposed=true;
}

function createBlueprintArchitecture(id){
  const layout=blueprintLayout(id),b=layout.blueprint,room=new THREE.Group();room.name=`office-blueprint-${id}`;
  const floorMeshes={},zones={},wallMeshes=[],walls=[],windows=[],doors=[];
  const materials={
    plaster:new THREE.MeshStandardMaterial({color:'#fff8f0',roughness:.9}),
    oak:new THREE.MeshStandardMaterial({color:'#d7ad79',roughness:.8}),
    glass:new THREE.MeshPhysicalMaterial({color:'#bbdde2',transparent:true,opacity:.45,roughness:.18,side:THREE.DoubleSide,depthWrite:false}),
  };
  const floor=(name,polygon,color,y)=>{
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(polygonShape(polygon)),new THREE.MeshStandardMaterial({color,roughness:.95}));
    mesh.name=`${name}-floor`;mesh.rotation.x=-Math.PI/2;mesh.position.y=y;mesh.receiveShadow=true;mesh.userData.zone=name;room.add(mesh);floorMeshes[name]=mesh;
  };
  floor('outerBoundary',layout.boundary,'#ddcdb7',0);
  for(const zone of layout.zones){
    floor(zone.id,zone.polygon,{work:'#eadbc3',lounge:'#dce1d3',corridor:'#f2e8d8'}[zone.id],.006);
    zones[zone.id]={polygon:zone.polygon,worldPolygon:zone.polygon.map(([x,y])=>groundPoint(x,y).toArray())};
  }
  for(const area of layout.areas){floor(area.id,area.polygon,{meeting:'#d6e4ec',work:'#e8d7bd',rest:'#d4dfcd'}[area.type],.008);zones[area.id]={type:area.type,name:area.name,polygon:area.polygon};}
  // Joints follow world x/z axes at exactly 1 m, rather than screen-horizontal stripes.
  const positions=[],origin=groundPoint(...layout.boundary[0]);
  for(let x=1;x<b.width;x++)positions.push(origin.x+x,.012,origin.z,origin.x+x,.012,origin.z+b.depth);
  for(let z=1;z<b.depth;z++)positions.push(origin.x,.012,origin.z+z,origin.x+b.width,.012,origin.z+z);
  const grid=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),new THREE.LineBasicMaterial({color:'#96896f',transparent:true,opacity:.18}));grid.name='metric-grid-1m';room.add(grid);
  for(const span of layout.walls){
    const wall=makeWall(room,span.start,span.end,{id:span.id,height:span.height,depth:b.wallThickness,
      wallMaterial:materials.plaster,trimMaterial:materials.oak,glassMaterial:materials.glass,wallMeshes,
      windowSpecs:span.windows});
    wall.windows.forEach((window,i)=>{window.group.userData.openingId=span.windows[i].id;});
    walls.push(wall);windows.push(...wall.windows);
  }
  for(const door of layout.doors){
    const tr=wallTransform(door.start,door.end),group=new THREE.Group();group.name=`sliding-${door.id}`;group.position.set(tr.centerX,0,tr.centerZ);group.rotation.y=tr.rotationY;group.userData.officeDoorId=door.id;room.add(group);
    const h=door.height,width=door.widthMeters;
    for(const x of [-width/2,width/2])makeBox(group,'door-jamb',.065,h,.18,materials.oak,new THREE.Vector3(x,h/2,0));
    makeBox(group,'door-header',width+.1,.09,.19,materials.oak,new THREE.Vector3(0,h,0));
    const panels=[-1,1].map(sign=>{const panel=makeBox(group,'door-panel',width/2-.025,h-.12,.06,materials.door||(materials.door=new THREE.MeshStandardMaterial({color:'#88aaa4',roughness:.65})),new THREE.Vector3(sign*width/4,(h-.12)/2,0));panel.visible=!door.open;return panel;});
    group.traverse(mesh=>{if(mesh.isMesh&&mesh.visible){mesh.userData.officeWall=true;wallMeshes.push(mesh);}});
    doors.push({...door,group,panels});
  }
  const daylight=new THREE.DirectionalLight('#fff2d7',1),ambient=new THREE.HemisphereLight('#fff8ea','#a7a18c',.7),backplane=new THREE.Group();
  room.add(daylight,ambient,backplane);
  room.userData.wallMeshes=wallMeshes;room.userData.rendererType='threejs-geometry';
  room.userData.officeArchitecture={rendererType:'threejs-geometry',blueprintId:b.id,dimensions:{width:b.width,depth:b.depth,wallThickness:b.wallThickness},
    floorMeshes,zones,wallMeshes,walls,frontWallSegments:walls.filter(w=>w.height===b.cutawayHeight),rearWallSegments:walls.filter(w=>w.height===b.wallHeight),
    doorwayOpening:layout.door,doors,windows,fixtures:[],daylight,ambient,backplane};
  room.updateMatrixWorld(true);return room;
}
