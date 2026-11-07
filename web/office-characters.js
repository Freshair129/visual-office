import * as THREE from 'three';

// Generic local presentation characters. Palette indexes and hair silhouettes are
// art variations only; they never encode a business, role, identity or capability.
const PALETTES=[
  {skin:0xe2b797,shirt:0x41637a,pants:0x344554,hair:0x382a24,accent:0xe8820c},
  {skin:0xc58c69,shirt:0x678477,pants:0x48514d,hair:0x211d1b,accent:0xe6bd79},
  {skin:0xf0c9a7,shirt:0x786b86,pants:0x494451,hair:0x573b2d,accent:0xd6ecfa},
  {skin:0xa86e50,shirt:0xc47b53,pants:0x49464a,hair:0x29201e,accent:0xf4d6a1},
  {skin:0xd9a985,shirt:0x59758d,pants:0x3d4c5a,hair:0x704c35,accent:0xe0a85d},
  {skin:0xe7bc9b,shirt:0x9c7960,pants:0x56504a,hair:0x3a3028,accent:0xd6e4cf},
  {skin:0xbb825f,shirt:0x778b76,pants:0x454b47,hair:0x30231f,accent:0xe5bd82},
  {skin:0xf1c9a9,shirt:0x596d83,pants:0x3f4a55,hair:0x8a6040,accent:0xf1d3ad},
  {skin:0xd4a07d,shirt:0x9b695f,pants:0x4c4545,hair:0x292522,accent:0xd6ecfa},
  {skin:0x996449,shirt:0x897d61,pants:0x494941,hair:0x33251f,accent:0xe6ba72},
  {skin:0xe7b995,shirt:0x527f82,pants:0x394c4d,hair:0x5d402d,accent:0xf0d7b2},
  {skin:0xc99270,shirt:0x806d91,pants:0x4a4651,hair:0x282522,accent:0xd2dfd0},
];
const HAIR_STYLES=['short-sweep','side-part','soft-curls','rounded-bob','wavy','tied-back'];
const ACTIONS=new Set(['walking','sitting','seated','thinking','idle','drinking','resting']);
const TAU=Math.PI*2;
const safeNumber=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const positiveIndex=value=>{const integer=Number.isFinite(Number(value))?Math.trunc(Number(value)):0;return ((integer%PALETTES.length)+PALETTES.length)%PALETTES.length;};

function material(color,roughness=0.82){return new THREE.MeshStandardMaterial({color,roughness,metalness:0});}
function mesh(parent,geometry,surface,name,position,scale){
  const object=new THREE.Mesh(geometry,surface);object.name=name;
  if(position)object.position.set(position[0],position[1],position[2]);
  if(scale)object.scale.set(scale[0],scale[1],scale[2]);
  object.castShadow=true;object.receiveShadow=false;parent.add(object);return object;
}
// Indexed surfaces share vertices across sewn junctions. These are deforming
// garments, not a stack of rigid primitives covering a mechanical skeleton.
function surfaceBuilder(){
  const positions=[],indices=[],skinIndices=[],skinWeights=[];
  const vertex=(p,weights=[[0,1]])=>{const id=positions.length/3;positions.push(...p);const sum=weights.reduce((n,w)=>n+w[1],0);for(let i=0;i<4;i++){skinIndices.push(weights[i]?.[0]||0);skinWeights.push((weights[i]?.[1]||0)/sum);}return id;};
  const join=(a,b)=>{for(let i=0;i<a.length;i++){const j=(i+1)%a.length;indices.push(a[i],a[j],b[i],b[i],a[j],b[j]);}};
  const cap=(ring,p,weights,reverse=false)=>{const c=vertex(p,weights);for(let i=0;i<ring.length;i++){const j=(i+1)%ring.length;indices.push(c,ring[reverse?j:i],ring[reverse?i:j]);}};
  const finish=()=>{const used=[...new Set(indices)].sort((a,b)=>a-b),map=new Map(used.map((id,i)=>[id,i])),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(used.flatMap(i=>positions.slice(i*3,i*3+3)),3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(used.flatMap(i=>skinIndices.slice(i*4,i*4+4)),4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(used.flatMap(i=>skinWeights.slice(i*4,i*4+4)),4));g.setIndex(indices.map(i=>map.get(i)));g.computeVertexNormals();return {geometry:g,map};};
  return {vertex,join,cap,finish,positions,indices};
}
function profileGeometry(rows,sides=16){
  const b=surfaceBuilder(),rings=rows.map(([y,rx,rz,z=0])=>Array.from({length:sides},(_,i)=>{const a=i/sides*TAU;return b.vertex([Math.cos(a)*rx,y,z+Math.sin(a)*rz]);}));
  for(let i=1;i<rings.length;i++)b.join(rings[i],rings[i-1]);
  b.cap(rings[0],[0,rows[0][0],rows[0][3]||0],undefined);b.cap(rings.at(-1),[0,rows.at(-1)[0],rows.at(-1)[3]||0],undefined,true);
  return b.finish().geometry;
}
function scalpGeometry(){
  const b=surfaceBuilder(),rings=[];
  for(let row=0;row<=8;row++)rings.push(Array.from({length:24},(_,i)=>{const a=i/24*TAU,front=Math.sin(a),limit=Math.PI*(.62-.26*Math.max(0,front)+.10*Math.max(0,-front)),t=.015+(limit-.015)*row/8;return b.vertex([Math.sin(t)*Math.cos(a),Math.cos(t),Math.sin(t)*Math.sin(a)]);}));
  for(let i=1;i<rings.length;i++)b.join(rings[i-1],rings[i]);b.cap(rings[0],[0,1,0],undefined,true);return b.finish().geometry;
}
const blend=(a,b,t)=>[[a,1-THREE.MathUtils.smoothstep(t,0,1)],[b,THREE.MathUtils.smoothstep(t,0,1)]];
function makeGarments(group,rig,surfaces){
  const bones=[rig.body,rig.torso,...['left','right'].flatMap(side=>[rig.legs[side].hip,rig.legs[side].knee,rig.legs[side].ankle,rig.arms[side].shoulder,rig.arms[side].elbow,rig.arms[side].hand])];
  const boneId=node=>bones.indexOf(node),shirt=surfaceBuilder(),levels=[[-.015,.145,.09],[.04,.15,.095],[.14,.155,.105],[.25,.165,.11],[.32,.17,.105],[.37,.17,.10],[.425,.165,.09],[.46,.052,.052]];
  const torsoY=.97;
  const rings=levels.map(([y,rx,rz])=>Array.from({length:16},(_,i)=>{const a=i/16*TAU;return shirt.vertex([rx*Math.cos(a),torsoY+y,rz*Math.sin(a)],[[1,1]]);}));
  for(let row=1;row<rings.length;row++)for(let i=0;i<16;i++){
    if([5,6].includes(row)&&[14,15,0,1,6,7,8,9].includes(i))continue;
    const j=(i+1)%16;shirt.indices.push(rings[row][i],rings[row][j],rings[row-1][i],rings[row-1][i],rings[row][j],rings[row-1][j]);
  }
  const angles=[225,210,180,150,135,90,45,30,0,-30,-45,-90].map(a=>a*Math.PI/180);
  for(const side of ['left','right']){
    const sign=side==='left'?-1:1,start=side==='left'?6:14,at=(row,j)=>rings[row][(start+j)%16];
    let previous=[...Array.from({length:5},(_,j)=>at(6,j)),at(5,4),...Array.from({length:5},(_,j)=>at(4,4-j)),at(5,0)];
    const arm=rig.arms[side],upper=boneId(arm.shoulder),lower=boneId(arm.elbow);
    // Turn the sewn side opening outward, then down, across rounded cap rings.
    for(const [x,y,r,tilt]of [[.172,.377,.063,0],[.19,.348,.059,Math.PI/4],[.185,.308,.055,Math.PI/2]]){
      const ring=angles.map(a=>shirt.vertex([sign*(x-Math.cos(a)*r*Math.sin(tilt)),torsoY+y-Math.cos(a)*r*Math.cos(tilt),sign*Math.sin(a)*r*.95],[[upper,1]]));
      shirt.join(previous,ring);previous=ring;
    }
    for(const [d,r]of [[.18,.054],[.23,.052],[.27,.05],[.30,.049],[.32,.048],[.35,.047],[.39,.046],[.45,.042],[.51,.037],[.55,.033],[.58,.031]]){
      const weights=blend(upper,lower,(d-.23)/.16),ring=angles.map(a=>shirt.vertex([sign*(.175-Math.cos(a)*r),torsoY+.455-d,sign*Math.sin(a)*r*.92],weights));
      shirt.join(previous,ring);previous=ring;
    }
  }
  const pants=surfaceBuilder(),hipY=.94;
  const waist=Array.from({length:16},(_,i)=>{const a=i/16*TAU;return pants.vertex([.155*Math.cos(a),hipY+.105,.105*Math.sin(a)]);});
  const hip=Array.from({length:16},(_,i)=>{const a=i/16*TAU;return pants.vertex([.177*Math.cos(a),hipY+.015,.12*Math.sin(a)]);});
  const lower=Array.from({length:16},(_,i)=>{const a=i/16*TAU,y=-.035-.075*Math.max(0,-Math.sin(a))-.035*Math.max(0,Math.sin(a));const flex=.4*Math.max(0,Math.sin(a))+.25*Math.abs(Math.cos(a)),leg=boneId(rig.legs[Math.cos(a)<0?'left':'right'].hip);return pants.vertex([.171*Math.cos(a),hipY+y,.11*Math.sin(a)],[[0,1-flex],[leg,flex]]);});
  pants.join(waist,hip);pants.join(hip,lower);pants.cap(waist,[0,hipY+.105,0],undefined,true);
  const crotchWeights=[[0,.25],[boneId(rig.legs.left.hip),.375],[boneId(rig.legs.right.hip),.375]],crotch=[pants.vertex([0,hipY-.11,.06],crotchWeights),pants.vertex([0,hipY-.11,0],crotchWeights),pants.vertex([0,hipY-.11,-.06],crotchWeights)];
  for(const side of ['left','right']){
    const sign=side==='left'?-1:1,start=side==='left'?4:12;
    let previous=[...Array.from({length:9},(_,i)=>lower[(start+i)%16]),...(side==='left'?[...crotch].reverse():crotch)];
    const leg=rig.legs[side],upper=boneId(leg.hip),knee=boneId(leg.knee);
    for(const [d,rx,rz]of [[.18,.084,.08],[.24,.081,.081],[.31,.075,.078],[.37,.07,.076],[.41,.067,.071],[.44,.066,.069],[.47,.065,.068],[.51,.064,.068],[.59,.065,.071],[.68,.06,.064],[.77,.052,.055],[.85,.047,.048]]){
      const ring=Array.from({length:12},(_,j)=>{const a=(side==='left'?Math.PI/2:-Math.PI/2)+(j<=8?Math.PI*j/8:Math.PI+Math.PI*(j-8)/4);return pants.vertex([sign*.102+Math.cos(a)*rx,hipY-d,Math.sin(a)*rz],blend(upper,knee,(d-.35)/.18));});
      pants.join(previous,ring);previous=ring;
    }
  }
  group.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);
  const make=(builder,surface,name)=>{const data=builder.finish(),m=new THREE.SkinnedMesh(data.geometry,surface);m.name=name;m.castShadow=true;group.add(m);m.bind(skeleton);const p=data.geometry.attributes.position,ids=data.geometry.attributes.skinIndex,weights=data.geometry.attributes.skinWeight;m.userData.influenceBounds=bones.map(()=>new THREE.Box3());for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);for(let j=0;j<4;j++)if(weights.getComponent(i,j)>0)m.userData.influenceBounds[ids.getComponent(i,j)].expandByPoint(v);}m.boundingBox=new THREE.Box3();m.boundingSphere=new THREE.Sphere();return {mesh:m,map:data.map};};
  surfaces.shirt.side=surfaces.pants.side=THREE.DoubleSide;
  const top=make(shirt,surfaces.shirt,'office-shirt'),bottom=make(pants,surfaces.pants,'office-pelvis');
  bottom.mesh.userData.seatContactVertices=[bottom.map.get(lower[12])];
  return {meshes:[top.mesh,bottom.mesh],skeleton};
}
function makeHand(hand,skin,side){
  mesh(hand,profileGeometry([[-.105,.012,.012,.008],[-.093,.033,.019,.008],[-.065,.042,.025,.006],[-.028,.034,.024,0],[.006,.027,.022,0]],12),skin,`office-${side}-hand-surface`);
  const thumb=mesh(hand,profileGeometry([[-.055,.008,.011],[-.035,.016,.016],[0,.018,.018]],10),skin,`office-${side}-thumb`,[side==='left'?-.035:.035,-.025,.01]);thumb.rotation.z=side==='left'?-.5:.5;
}
function collar(parent,surface){
  for(const sign of [-1,1]){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([sign*.012,.465,.056,sign*.057,.442,.081,sign*.032,.402,.105],3));g.setIndex(sign<0?[0,1,2]:[0,2,1]);g.computeVertexNormals();const m=mesh(parent,g,surface,`office-collar-${sign<0?'left':'right'}`);m.material.side=THREE.DoubleSide;
  }
}

function makeHair(head,geometries,surfaces,style){
  const cap=mesh(head,geometries.hairCap,surfaces.hair,`office-hair-${style}`,[0,0.075,-0.004],[0.142,0.145,0.14]);
  cap.material=surfaces.hair;
  const lock=(name,x,y,z,sx,sy,sz,rotationZ=0)=>{
    const part=mesh(head,geometries.sphere,surfaces.hair,name,[x,y,z],[sx,sy,sz]);part.rotation.z=rotationZ;return part;
  };
  const addBack=(name='office-hair-back',y=-0.015,z=-0.055,sy=0.12)=>lock(name,0,y,z,0.125,sy,0.09);
  if(style==='short-sweep'){
    lock('office-hair-swept-fringe',-0.035,0.145,0.086,0.09,0.032,0.052,-0.2);
    lock('office-hair-temple-left',-0.126,0.025,-0.004,0.029,0.075,0.046,-0.1);
    lock('office-hair-temple-right',0.126,0.025,-0.004,0.029,0.075,0.046,0.1);
  }else if(style==='side-part'){
    lock('office-hair-parted-fringe',0.045,0.145,0.086,0.075,0.032,0.052,0.22);
    lock('office-hair-parted-lock',0.092,0.105,0.059,0.043,0.064,0.053,0.32);
    lock('office-hair-temple-left',-0.126,0.012,-0.006,0.029,0.09,0.046,-0.1);
  }else if(style==='soft-curls'){
    for(const [index,[x,y,z]] of [[-0.09,0.13,0.064],[0,0.158,0.073],[0.09,0.13,0.064],[-0.125,0.065,0.035],[0.125,0.065,0.035]].entries())
      lock(`office-hair-curl-${index+1}`,x,y,z,0.052,0.05,0.052);
    addBack('office-hair-curl-back',-0.025,-0.045,0.11);
  }else if(style==='rounded-bob'){
    addBack('office-hair-rounded-back',-0.035,-0.04,0.145);
    lock('office-hair-bob-left',-0.123,-0.01,-0.005,0.038,0.125,0.061,-0.08);
    lock('office-hair-bob-right',0.123,-0.01,-0.005,0.038,0.125,0.061,0.08);
    lock('office-hair-bob-fringe',-0.018,0.14,0.087,0.082,0.035,0.05,-0.1);
  }else if(style==='wavy'){
    addBack('office-hair-wave-back',-0.035,-0.055,0.16);
    for(const [index,[x,y,z]] of [[-0.125,0.065,0.026],[0.125,0.065,0.026],[-0.12,-0.035,0.015],[0.12,-0.035,0.015]].entries())
      lock(`office-hair-wave-${index+1}`,x,y,z,0.036,0.075,0.05,index%2?0.14:-0.14);
    lock('office-hair-wave-fringe',0.025,0.145,0.086,0.085,0.032,0.05,0.12);
  }else{
    lock('office-hair-tied-back-knot',0,0.09,-0.113,0.09,0.09,0.075);
    lock('office-hair-tied-back-tail',0,-0.075,-0.12,0.046,0.12,0.05);
    lock('office-hair-tied-fringe',-0.035,0.145,0.085,0.075,0.031,0.05,-0.18);
    lock('office-hair-tied-temple',0.124,0.014,-0.006,0.029,0.09,0.045,0.08);
  }
}

function makeMug(hand,geometries,surfaces){
  const mug=new THREE.Group();mug.name='office-drinking-mug';mug.visible=false;hand.add(mug);
  mesh(mug,geometries.mug,surfaces.ceramic,'office-mug-body',[0,-0.028,0.07],[1,1,1]);
  mesh(mug,geometries.coffee,surfaces.coffee,'office-mug-coffee',[0,0.008,0.07],[1,1,1]);
  mesh(mug,geometries.handle,surfaces.ceramic,'office-mug-handle',[0.035,-0.028,0.07],[1,1,1]);
  return mug;
}

/** Create a rounded, adult-proportioned local Office Idle character in metres. */
export function createOfficeCharacter(index=0){
  const variant=positiveIndex(index),palette=PALETTES[variant],hairStyle=HAIR_STYLES[variant%HAIR_STYLES.length];
  const group=new THREE.Group();group.name=`office-character-${variant+1}`;
  const surfaces={
    skin:material(palette.skin),skinShadow:material(new THREE.Color(palette.skin).multiplyScalar(0.84)),
    shirt:material(palette.shirt),shirtTrim:material(palette.accent),pants:material(palette.pants),
    shoes:material(0x30373c),hair:material(palette.hair),eye:material(0x352b26,0.54),eyeWhite:material(0xfff8ef,0.55),
    mouth:material(0x7a4541,0.65),cheek:material(new THREE.Color(palette.skin).lerp(new THREE.Color(0xd47769),0.24)),
    ceramic:material(0xf5efe3,0.42),coffee:material(0x795234,0.35),
  };
  const geometries={
    sphere:new THREE.SphereGeometry(1,14,10),
    hairCap:scalpGeometry(),
    mug:new THREE.CylinderGeometry(0.028,0.032,0.07,12,1,false),
    coffee:new THREE.CircleGeometry(0.026,12),
    handle:new THREE.TorusGeometry(0.021,0.004,6,12),
  };
  geometries.coffee.rotateX(-Math.PI/2);

  const body=new THREE.Bone();body.name='office-body';body.position.y=0.94;group.add(body);
  const torso=new THREE.Bone();torso.name='office-torso-pivot';torso.position.y=0.03;body.add(torso);
  collar(torso,surfaces.shirtTrim);
  const neck=mesh(torso,profileGeometry([[.455,.045,.044],[.5,.048,.045],[.55,.046,.044]],16),surfaces.skin,'office-neck');
  const head=new THREE.Bone();head.name='office-head-pivot';head.position.y=0.57;head.scale.setScalar(.82);torso.add(head);
  mesh(head,profileGeometry([[-.085,.035,.045,.025],[-.06,.072,.074,.018],[0,.109,.103,.006],[.075,.12,.115,0],[.14,.11,.105,-.004],[.19,.071,.07,-.005],[.208,.018,.018,0]],24),surfaces.skin,'office-head');
  mesh(head,geometries.sphere,surfaces.skin,'office-ear-left',[-0.126,0.055,0],[0.018,0.034,0.02]);
  mesh(head,geometries.sphere,surfaces.skin,'office-ear-right',[0.126,0.055,0],[0.018,0.034,0.02]);
  mesh(head,geometries.sphere,surfaces.skinShadow,'office-ear-inner-left',[-0.137,0.056,0.011],[0.008,0.022,0.009]);
  mesh(head,geometries.sphere,surfaces.skinShadow,'office-ear-inner-right',[0.137,0.056,0.011],[0.008,0.022,0.009]);
  for(const side of ['left','right']){
    const x=side==='left'?-0.043:0.043;
    mesh(head,geometries.sphere,surfaces.eyeWhite,`office-eye-white-${side}`,[x,0.087,0.106],[0.014,0.016,0.01]);
    mesh(head,geometries.sphere,surfaces.eye,`office-eye-${side}`,[x,0.087,0.117],[0.007,0.010,0.006]);
    const brow=mesh(head,geometries.sphere,surfaces.hair,`office-brow-${side}`,[x,0.125,0.108],[0.025,0.005,0.007]);
    brow.rotation.z=side==='left'?0.08:-0.08;
  }
  mesh(head,geometries.sphere,surfaces.skinShadow,'office-nose',[0,0.053,0.128],[0.016,0.024,0.018]);
  mesh(head,geometries.sphere,surfaces.cheek,'office-cheek-left',[-0.071,0.024,0.091],[0.022,0.012,0.008]);
  mesh(head,geometries.sphere,surfaces.cheek,'office-cheek-right',[0.071,0.024,0.091],[0.022,0.012,0.008]);
  const smileCurve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.021,0.012,0.113),new THREE.Vector3(0,-0.001,0.116),new THREE.Vector3(0.021,0.012,0.113),
  ]);
  const smile=new THREE.Mesh(new THREE.TubeGeometry(smileCurve,8,0.0045,5,false),surfaces.mouth);smile.name='office-smile';head.add(smile);
  makeHair(head,geometries,surfaces,hairStyle);

  const legs={};
  for(const side of ['left','right']){
    const sign=side==='left'?-1:1,hip=new THREE.Bone();hip.name=`office-${side}-hip`;hip.position.set(sign*0.102,-0.01,0);body.add(hip);
    const knee=new THREE.Bone();knee.name=`office-${side}-knee`;knee.position.y=-0.43;hip.add(knee);
    const ankle=new THREE.Bone();ankle.name=`office-${side}-ankle`;ankle.position.y=-0.44;knee.add(ankle);
    const shoe=mesh(ankle,profileGeometry([[-.06,.067,.14,.045],[-.043,.071,.145,.045],[.006,.063,.125,.04],[.036,.043,.074,-.003]],16),surfaces.shoes,`office-${side}-shoe`);
    shoe.castShadow=true;
    legs[side]={hip,knee,ankle,shoe};
  }

  const arms={};
  for(const side of ['left','right']){
    const sign=side==='left'?-1:1,shoulder=new THREE.Bone();shoulder.name=`office-${side}-shoulder`;shoulder.position.set(sign*0.175,0.455,0);torso.add(shoulder);
    const elbow=new THREE.Bone();elbow.name=`office-${side}-elbow`;elbow.position.y=-0.31;shoulder.add(elbow);
    const hand=new THREE.Bone();hand.name=`office-${side}-hand`;hand.position.y=-0.27;elbow.add(hand);
    makeHand(hand,surfaces.skin,side);
    const arm={shoulder,elbow,hand};
    if(side==='right')arm.mug=makeMug(hand,geometries,surfaces);
    arms[side]=arm;
  }
  const rig={body,torso,head,neck,legs,arms,standingHipHeight:.94,seatedHipHeight:.66,restingHipHeight:.62,torsoBaseY:.03};
  const garments=makeGarments(group,rig,surfaces);
  group.userData.officeCharacter={version:2,variant,hairStyle,disposed:false,rig,garments};
  updateOfficeCharacter(group,{action:'idle',time:0,heading:0});
  return group;
}

/** Update a character pose using deterministic local time; the root position is caller-owned. */
export function updateOfficeCharacter(group,{action='idle',time=0,heading=0,seatHeight,walkDistance,speed=.9,dt}={}){
  const state=group?.userData?.officeCharacter;if(!state||state.disposed)return group;
  const previous=new Map();if(Number.isFinite(dt)&&dt>0)group.traverse(n=>{if(n.isGroup||n.isBone)previous.set(n,n.quaternion.clone());});
  const rig=state.rig,pose=ACTIONS.has(action)?action:'idle';
  const t=safeNumber(time),yaw=safeNumber(heading),phase=(Number.isFinite(walkDistance)?walkDistance/1.1:t*.82)*TAU;
  const seated=pose==='seated'||pose==='sitting'||pose==='resting';
  const defaultSeatHeight=pose==='resting'?rig.restingHipHeight:rig.seatedHipHeight;
  const requestedSeatHeight=Number.isFinite(Number(seatHeight))?THREE.MathUtils.clamp(Number(seatHeight),0.3,0.95):defaultSeatHeight;
  const walkBlend=pose==='walking'?Math.min(1,Math.max(0,speed)/.9):0;
  const hipHeight=seated?requestedSeatHeight:rig.standingHipHeight-.045*walkBlend;
  rig.body.position.y=Number.isFinite(dt)&&dt>0?THREE.MathUtils.lerp(rig.body.position.y,hipHeight,1-Math.exp(-dt*12)):hipHeight;
  rig.torso.position.set(0,rig.torsoBaseY,0);
  rig.torso.rotation.set(0,0,0);rig.head.rotation.set(0,0,0);
  group.rotation.y=yaw;

  for(const side of ['left','right']){
    const sign=side==='left'?1:-1,leg=rig.legs[side],arm=rig.arms[side];
    leg.hip.rotation.set(0,0,0);leg.knee.rotation.set(0,0,0);leg.ankle.rotation.set(0,0,0);
    leg.knee.scale.set(1,1,1);
    arm.shoulder.rotation.set(0,0,0);arm.elbow.rotation.set(0,0,0);arm.hand.rotation.set(0,0,0);
    if(arm.mug)arm.mug.visible=pose==='drinking';
    if(pose==='walking'){
      const cycle=((phase+(side==='right'?Math.PI:0))%TAU+TAU)%TAU;
      const stance=cycle<Math.PI,u=stance?cycle/Math.PI:(cycle-Math.PI)/Math.PI;
      const ankleZ=(stance?1-2*u:-1+2*u)*.275*walkBlend;
      const ankleY=.06+(stance?0:Math.sin(u*Math.PI)*.075*walkBlend);
      const drop=rig.body.position.y-.01-ankleY;
      const reach=THREE.MathUtils.clamp(Math.hypot(drop,ankleZ),.02,.87);
      // Two-bone inverse kinematics: the planted sole is level; the swing sole
      // clears the ground. Phase follows travelled metres, not a free-running clock.
      const hipBend=Math.acos(THREE.MathUtils.clamp((.43**2+reach**2-.44**2)/(2*.43*reach),-1,1));
      leg.hip.rotation.x=-Math.atan2(ankleZ,drop)-hipBend;
      leg.knee.rotation.x=Math.PI-Math.acos(THREE.MathUtils.clamp((.43**2+.44**2-reach**2)/(2*.43*.44),-1,1));
      leg.ankle.rotation.x=-leg.hip.rotation.x-leg.knee.rotation.x;
      arm.shoulder.rotation.x=Math.cos(cycle)*.22*walkBlend;
      arm.elbow.rotation.x=-.14-Math.max(0,-Math.sin(phase)*sign)*.16;
    }else if(seated){
      // Fixed bone lengths: choose the thigh angle that keeps the ankle at .06 m.
      // Counter-rotate the knee and ankle so each sole remains flat on the floor.
      const thighAngle=Math.acos(THREE.MathUtils.clamp((rig.body.position.y-.01-.44-.06)/.43,-1,1));
      leg.hip.rotation.x=-thighAngle;
      leg.knee.rotation.x=thighAngle;
      arm.shoulder.rotation.x=pose==='seated'?-.18:-.06;
      arm.elbow.rotation.x=pose==='seated'?-1.45:-.85;
      arm.hand.rotation.y=Math.PI;
      if(pose==='seated')arm.hand.rotation.z=sign*.018*Math.sin(t*4+sign);
      if(pose==='resting')rig.torso.rotation.x=-.025;
    }else if(pose==='thinking'){
      if(side==='right'){
        arm.shoulder.rotation.x=-0.9;
        arm.elbow.rotation.x=-2.65;
      }else{
        arm.shoulder.rotation.x=0.08;
        arm.elbow.rotation.x=-.18;
      }
      rig.torso.rotation.x=0.025;
      rig.head.rotation.x=0.08;
    }else if(pose==='drinking'){
      if(side==='right'){
        arm.shoulder.rotation.x=-0.9-0.025*Math.sin(t*2.1);
        arm.elbow.rotation.x=-2.8;
        // Keep the mug upright as the forearm turns toward the face.
        arm.hand.rotation.x=3.7;
      }else{
        arm.shoulder.rotation.x=0.05;
        arm.elbow.rotation.x=-.14;
      }
      rig.head.rotation.x=0.035;
    }else{
      arm.shoulder.rotation.x=0.04*sign+0.025*Math.sin(phase*0.35+sign);
      arm.elbow.rotation.x=-.14+.015*Math.sin(phase*.3+sign);
      rig.head.rotation.y=0.035*Math.sin(phase*0.2);
    }
    arm.shoulder.rotation.z=(side==='left'?-1:1)*.045;
    if(!seated&&pose!=='walking'&&rig.body.position.y<rig.standingHipHeight){
      const bend=Math.acos(THREE.MathUtils.clamp((rig.body.position.y-.51)/.43,-1,1));
      leg.hip.rotation.x=-bend;leg.knee.rotation.x=bend;
    }
  }
  const breathe=pose==='walking'?0.004*(1-Math.cos(phase*2)):pose==='seated'?0.004*Math.sin(t*2):pose==='resting'?0.006*Math.sin(t*1.4):0.003*Math.sin(t*1.7);
  rig.torso.position.y=rig.torsoBaseY+breathe;
  if(pose==='seated')rig.head.rotation.x+=0.1;
  if(pose==='resting')rig.head.rotation.x=-0.025;
  if(pose==='thinking')rig.head.rotation.y=0.035*Math.sin(t*0.6);
  if(previous.size){const blend=1-Math.exp(-dt*12);for(const [node,q]of previous){if(node===group||node.name.includes('hip')||node.name.includes('knee')||node.name.includes('ankle'))continue;const target=node.quaternion.clone();node.quaternion.copy(q).slerp(target,blend);}}
  group.updateMatrixWorld(true);state.garments.skeleton.update();
  for(const garment of state.garments.meshes){garment.boundingBox.makeEmpty();const transform=new THREE.Matrix4(),box=new THREE.Box3();for(const [i,bounds]of garment.userData.influenceBounds.entries()){if(bounds.isEmpty())continue;transform.fromArray(state.garments.skeleton.boneMatrices,i*16).premultiply(garment.bindMatrixInverse).multiply(garment.bindMatrix);garment.boundingBox.union(box.copy(bounds).applyMatrix4(transform));}garment.boundingBox.getBoundingSphere(garment.boundingSphere);}
  return group;
}

/** Release all model-owned GPU resources and detach the group from its scene. */
export function disposeOfficeCharacter(group){
  const state=group?.userData?.officeCharacter;if(!group||!state||state.disposed)return;
  state.disposed=true;state.garments?.skeleton.dispose();
  const geometries=new Set(),materials=new Set();
  group.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    if(object.material)for(const surface of Array.isArray(object.material)?object.material:[object.material])if(surface)materials.add(surface);
  });
  for(const geometry of geometries)geometry.dispose();
  for(const surface of materials)surface.dispose();
  group.parent?.remove(group);group.clear();
  group.userData.officeCharacter=null;
}
