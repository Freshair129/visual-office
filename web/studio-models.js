import * as THREE from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Original procedural assets in metres, Y up. These identifiers are art assets,
// not business entities or canonical agent roles.
export const STUDIO_LEVELS = ['starter', 'studio', 'signature'];
export const DESK_ANCHORS = Object.freeze({
  seat: Object.freeze([0, .48, .91]),
  name: Object.freeze([0, 1.65, 0]),
  footprint: Object.freeze([2.1, 2.05]),
});
export const STUDIO_SLOTS = Object.freeze([
  Object.freeze([-1.65, 0, -1.55]), Object.freeze([1.2, 0, -1.55]),
  Object.freeze([-1.65, 0, 1.05]), Object.freeze([1.2, 0, 1.05]),
]);
const colors = {
  starter: {top:'#eee5d5', leg:'#a8b3b0', chair:'#c3cec1', accent:'#dca66b'},
  studio: {top:'#c99463', leg:'#e4d8bb', chair:'#809d85', accent:'#df9b49'},
  signature: {top:'#e7c69b', leg:'#ba9257', chair:'#477467', accent:'#d58a37'},
};

function builder(name) {
  const group = new THREE.Group(); group.name = name;
  const materials = new Map();
  const material = color => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({color, roughness:.8}));
    return materials.get(color);
  };
  const add = (geometry, color, x=0,y=0,z=0, rotation=0) => {
    const mesh = new THREE.Mesh(geometry, material(color));
    mesh.position.set(x,y,z); mesh.rotation.y = rotation; group.add(mesh); return mesh;
  };
  const box = (w,h,d,x,y,z,color,rotation=0) => add(new THREE.BoxGeometry(w,h,d),color,x,y,z,rotation);
  const cylinder = (r1,r2,h,x,y,z,color,segments=12) => add(new THREE.CylinderGeometry(r1,r2,h,segments),color,x,y,z);
  const ball = (r,x,y,z,color) => add(new THREE.IcosahedronGeometry(r,1),color,x,y,z);
  const softBox = (w,h,d,x,y,z,color,r=.06,rotation=0) => {
    const radius=Math.max(.001,Math.min(r,Math.min(w,h,d)/2-.001));
    return add(new RoundedBoxGeometry(w,h,d,2,radius),color,x,y,z,rotation);
  };
  const rounded = (w,h,d,x,y,z,color,r=.08) => {
    const s = new THREE.Shape(), a=-w/2,b=-d/2;
    s.moveTo(a+r,b); s.lineTo(a+w-r,b); s.quadraticCurveTo(a+w,b,a+w,b+r);
    s.lineTo(a+w,b+d-r); s.quadraticCurveTo(a+w,b+d,a+w-r,b+d);
    s.lineTo(a+r,b+d); s.quadraticCurveTo(a,b+d,a,b+d-r);
    s.lineTo(a,b+r); s.quadraticCurveTo(a,b,a+r,b);
    const geo = new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:3});
    geo.rotateX(-Math.PI/2); geo.translate(0,-h/2,0);
    return add(geo,color,x,y,z);
  };
  const plant = (x,y,z,size=1,pot='#eee4cf') => {
    cylinder(.2*size,.15*size,.32*size,x,y+.16*size,z,pot);
    cylinder(.17*size,.17*size,.02*size,x,y+.325*size,z,'#66533e');
    cylinder(.025*size,.035*size,.5*size,x,y+.55*size,z,'#8d7751',6);
    for(let i=0;i<5;i++){
      const a=i*2.4;
      const leaf=ball(.21*size,x+Math.sin(a)*.14*size,y+(.62+i*.055)*size,z+Math.cos(a)*.13*size,i%2?'#8dba7d':'#568866');
      leaf.scale.set(.7,1.3,.85);
    }
  };
  const finish = (metadata={}) => {
    group.updateMatrixWorld(true);
    const batches = new Map();
    for(const mesh of [...group.children]){
      let geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
      // Retain each primitive's normalized UVs so native Studio texture uploads
      // can target generated GLBs as well as the legacy room meshes.
      geometry.applyMatrix4(mesh.matrix);
      if(!batches.has(mesh.material))batches.set(mesh.material,[]);
      batches.get(mesh.material).push(geometry);
      mesh.geometry.dispose(); group.remove(mesh);
    }
    for(const [mat,geometries] of batches){
      const merged=mergeGeometries(geometries,false);
      geometries.forEach(g=>g.dispose());
      const indexed=mergeVertices(merged);merged.dispose();
      const mesh=new THREE.Mesh(indexed,mat);
      mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    }
    group.userData={assetVersion:1,units:'metres',...metadata}; return group;
  };
  return {box,cylinder,ball,rounded,softBox,plant,finish};
}

export function makeStudioDesk(level='starter',{chair=true}={}) {
  const tier=STUDIO_LEVELS.includes(level)?level:'starter';
  const c=colors[tier], b=builder(`desk-${tier}`);
  b.rounded(1.8,.095,.85,0,.79,0,c.top);
  for(const x of [-.73,.73]){
    b.box(.08,.71,.61,x,.38,0,c.leg);
    b.rounded(.28,.05,.68,x,.045,0,c.leg,.025);
  }
  if(tier!=='starter'){
    b.rounded(.38,.6,.65,.6,.4,0,c.top,.03);
    for(const y of [.3,.49]) b.box(.29,.012,.02,.6,y,.34,'#8b7556');
    b.box(.3,.06,.2,-.57,.87,-.17,c.accent);
    b.box(.27,.045,.19,-.55,.925,-.17,'#edf1df');
  }
  // Monitor, keyboard and mug share the same functional positions in every tier.
  b.rounded(.4,.035,.24,0,.86,-.17,'#3a5155',.035);
  b.box(.055,.2,.05,0,.96,-.22,'#3a5155');
  // Vertical screen, with a simple non-status wallpaper.
  b.box(.87,.51,.045,0,1.23,-.23,'#3a5155');
  b.box(.79,.43,.012,0,1.23,-.2,'#aad9e1');
  b.box(.48,.035,.015,-.09,1.27,-.19,'#f2f1d6');
  b.box(.28,.025,.015,-.19,1.19,-.19,'#79a9ba');
  b.rounded(.63,.025,.22,-.04,.858,.25,'#e6e9df',.025);
  for(let i=0;i<3;i++)b.box(.53,.007,.015,-.04,.875,.19+i*.05,'#b5bdb4');
  b.rounded(.1,.03,.15,.43,.87,.25,'#3a5155',.035);
  b.cylinder(.065,.055,.14,-.64,.91,.23,'#fff4de');
  b.cylinder(.047,.047,.005,-.64,.982,.23,'#7b5540');
  // Identical chair seat height / anchor for all three furniture variants.
  if(chair){
  b.cylinder(.22,.26,.045,0,.1,.91,c.leg,5);
  b.cylinder(.045,.045,.33,0,.275,.91,c.leg);
  b.rounded(.56,.095,.52,0,.48,.91,c.chair);
  b.box(.56,.42,.085,0,.72,1.14,c.chair);
  if(tier!=='starter')for(const x of [-.32,.32]){
    b.box(.035,.2,.035,x,.55,.95,c.leg);
    b.rounded(.07,.045,.35,x,.66,.96,c.chair,.025);
  }
  }
  if(tier==='signature'){
    if(chair)b.box(.44,.15,.09,0,.98,1.14,c.chair);
    b.box(1.72,.25,.055,0,.99,-.42,'#a7bfa5');
    b.cylinder(.025,.025,.48,.7,1.1,-.25,c.leg);
    b.cylinder(.15,.09,.12,.7,1.37,-.25,'#e9bc70');
  }
  return b.finish({tier,anchors:DESK_ANCHORS});
}

export function makeStudioRoom(level='starter',wing=false) {
  const tier=STUDIO_LEVELS.includes(level)?level:'starter', b=builder(`room-${tier}${wing?'-wing':''}`);
  const warm=tier!=='starter';
  b.rounded(9.3,.3,7.35,0,-.19,0,'#cbbd9f',.16);
  b.rounded(9.08,.09,7.13,0,-.025,0,warm?'#e4caa6':'#e6e0cb',.12);
  for(let i=0;i<14;i++)b.box(8.98,.006,.018,0,.025,-3.3+i*.5,warm?'#d6bb96':'#d9d3c0');
  b.box(.15,2.65,7.1,-4.48,1.32,0,'#e7e0ca');
  b.box(9.1,2.65,.15,0,1.32,-3.48,'#f3ebd5');
  b.box(9.1,.13,.24,0,2.65,-3.48,'#d3bb8c');
  b.box(.24,.13,7.1,-4.48,2.65,0,'#d3bb8c');
  b.box(8.8,.12,.05,0,.09,-3.37,'#c6ac7a');
  // Lift stays in the same place when the lounge wing is attached.
  b.box(1.25,2.18,.16,-3.25,1.1,-3.34,'#a9b2ac');
  for(const x of [-3.52,-2.97])b.box(.52,1.99,.04,x,1.05,-3.24,'#ced6d0');
  b.box(.045,1.99,.025,-3.245,1.05,-3.2,'#91a19f');
  b.box(.32,.16,.05,-3.25,2.3,-3.29,'#dfaa55');
  b.box(.12,.22,.08,-2.46,1.22,-3.25,'#e7bd72');
  for(const x of [-.85,1.65]){
    b.box(2.1,1.5,.07,x,1.72,-3.36,'#8eb5be');
    b.box(1.92,1.31,.07,x,1.72,-3.31,'#badfeb');
    b.box(.06,1.36,.08,x,1.72,-3.24,'#f6f2de');
    b.box(2.16,.1,.27,x,.98,-3.24,'#fff4dc');
    b.box(2.16,.14,.15,x,2.5,-3.24,'#f0d8ae');
  }
  b.rounded(2.35,.018,5.1,-.15,.03,.15,warm?'#d49b67':'#cec7ae',.15);
  // Coffee storage and shelf against the left wall.
  b.box(.65,.8,1.5,-4.02,.4,-1.7,warm?'#bc926c':'#d5cbb1');
  b.box(.73,.07,1.6,-4.02,.84,-1.7,'#f2e9d5');
  b.box(.29,.33,.32,-4.01,1.04,-2,'#435c59');
  b.cylinder(.06,.05,.13,-3.89,.96,-1.49,'#fff5df');
  if(warm){
    b.box(.5,.065,1.65,-4.14,1.72,-1.7,'#bc926c');
    for(let i=0;i<7;i++)b.box(.27,.28+(i%2)*.08,.09,-4.05,1.9,-2.25+i*.16,['#819d8c','#dca560','#e8dcb5'][i%3]);
    b.box(.045,.75,1.18,-4.37,1.85,.28,'#b29468');
    b.box(.05,.62,1.05,-4.33,1.85,.28,'#f9efdb');
    b.box(.06,.34,.6,-4.29,1.88,.28,'#8aa68a');
  }
  b.plant(3.72,0,-2.78,1.35);
  b.plant(-3.9,0,2.78,1.1);
  b.rounded(1.5,.36,.8,3.52,.32,.2,warm?'#80a28c':'#bbc8af');
  b.box(1.5,.37,.15,3.52,.66,-.15,warm?'#6d937d':'#a9b8a0');
  b.cylinder(.36,.36,.06,3.45,.55,1.18,'#f0dfb9');
  b.cylinder(.055,.1,.5,3.45,.27,1.18,'#b99d71');
  b.plant(3.46,.59,1.18,.32);
  if(tier==='signature'){
    for(const x of [-1.65,1.2]){
      b.cylinder(.018,.018,.6,x,2.4,-1.55,'#bb9c6e');
      b.cylinder(.4,.27,.12,x,2.06,-1.55,'#ecc58c');
      b.cylinder(.32,.32,.012,x,1.995,-1.55,'#fff0c0');
    }
    b.box(.035,.08,5.9,-4.36,2.4,0,'#f6ce87');
  }
  if(wing){
    b.rounded(2.7,.3,7.35,5.9,-.19,0,'#cbbd9f',.16);
    b.rounded(2.5,.09,7.13,5.9,-.025,0,'#b5c49a',.12);
    for(let i=0;i<8;i++)b.box(.13,.6,.13,7.05,.35,-3.1+i*.88,'#ede2bf');
    b.box(.12,.09,6.4,7.05,.69,0,'#d0b584');
    b.box(2.6,.09,.12,5.84,.69,-3.22,'#d0b584');
    b.rounded(1.3,.18,2,5.85,.31,-.5,'#819f86');
    b.box(.2,.5,2,6.42,.55,-.5,'#73967e');
    b.rounded(.8,.07,.9,5.05,.53,.2,'#f1dfb8');
    b.cylinder(.07,.1,.47,5.05,.27,.2,'#b59b72');
    b.plant(6.1,0,-2.7,1.4);
    b.plant(6.25,0,2.8,1.1);
    for(let i=0;i<3;i++)b.rounded(.9,.03,.4,5.6,.04,1.4+i*.5,'#e9dfc1');
  }
  return b.finish({anchors:{door:[-3.25,0,-3.15]},tier,loungeWing:wing});
}

export function makeStudioPlant() {
  const b=builder('plant-movable');b.plant(0,0,0,1.2,'#d99055');return b.finish();
}

export function makeStudioMannequin() {
  const b=builder('mannequin-seated');
  b.rounded(.33,.39,.25,0,.22,0,'#cc9367',.05);
  b.ball(.15,0,.59,0,'#e7c9a5');
  for(const x of [-.1,.1]){
    b.box(.13,.12,.37,x,.025,-.12,'#607b78');
    b.box(.12,.35,.12,x,-.18,-.27,'#607b78');
    b.rounded(.13,.07,.22,x,-.37,-.31,'#f3e5c7',.025);
    b.box(.1,.29,.1,x*1.9,.22,-.04,'#cc9367');
    b.box(.1,.1,.26,x*1.9,.12,-.19,'#e7c9a5');
  }
  return b.finish({pose:'seated',presentationOnly:true});
}

export function makeStudioChair() {
  const b=builder('chair-ergonomic');
  const metal='#7b8582',fabric='#7f9b89',trim='#d9c9ab';
  b.cylinder(.25,.25,.07,0,.10,0,'#88765e',20);
  for(let i=0;i<5;i++){
    const angle=i*Math.PI*2/5,x=Math.cos(angle)*.23,z=Math.sin(angle)*.23;
    b.softBox(.42,.075,.09,x,.115,z,metal,.03,angle);
    b.cylinder(.067,.067,.09,x*1.85,.07,z*1.85,'#4f5d5a',12);
  }
  b.cylinder(.075,.075,.37,0,.34,0,'#a8aaa0',16);
  b.softBox(.62,.14,.56,0,.59,-.015,fabric,.09);
  b.softBox(.58,.68,.15,0,1.01,.21,fabric,.075);
  b.softBox(.45,.13,.14,0,.85,.13,'#91ab98',.055);
  b.softBox(.065,.28,.44,-.37,.73,.02,metal,.028);
  b.softBox(.065,.28,.44,.37,.73,.02,metal,.028);
  b.softBox(.30,.075,.48,-.37,.88,.045,trim,.035);
  b.softBox(.30,.075,.48,.37,.88,.045,trim,.035);
  return b.finish({footprint:[.9,.95],anchors:{ground:[0,0,0],seat:[0,.66,-.02],back:[0,1.36,.21]}});
}

export function makeStudioMeetingTable() {
  const b=builder('meeting-table');
  b.softBox(2.55,.13,1.28,0,.79,0,'#c99463',.085);
  b.softBox(2.34,.035,1.08,0,.875,0,'#e6c99f',.06);
  for(const x of [-.92,.92])for(const z of [-.43,.43]){
    b.softBox(.14,.68,.14,x,.39,z,'#8d7556',.045);
    b.softBox(.29,.055,.30,x,.055,z,'#a48c6a',.025);
  }
  b.softBox(.32,.025,.55,0,.90,0,'#f4eee0',.045);
  return b.finish({footprint:[2.7,1.45],anchors:{ground:[0,0,0],top:[0,.9,0]}});
}

export function makeStudioSofa() {
  const b=builder('lounge-sofa');
  const sage='#849e8c',light='#a9b9a9',wood='#9b805e';
  for(const x of [-.72,.72])b.softBox(.12,.22,.66,x,.12,0,wood,.035);
  b.softBox(1.84,.38,.84,0,.39,0,sage,.11);
  b.softBox(1.82,.72,.22,0,.85,.34,sage,.09);
  for(const x of [-.86,.86])b.softBox(.28,.68,.84,x,.66,0,light,.09);
  for(const x of [-.51,.51]){
    b.softBox(.78,.17,.66,x,.64,-.035,'#b4c2b3',.085);
    b.softBox(.78,.42,.16,x,.91,.20,'#9caf9e',.075);
  }
  b.softBox(.32,.35,.08,-.57,.84,.06,'#f0dfc2',.065,-.14);
  b.softBox(.32,.35,.08,.57,.84,.06,'#dfaa62',.065,.14);
  return b.finish({footprint:[2.05,1.05],anchors:{ground:[0,0,0],seat:[0,.64,-.05]}});
}

export function makeStudioCoffeeTable() {
  const b=builder('coffee-table');
  b.cylinder(.77,.69,.12,0,.63,0,'#d9b783',32);
  b.cylinder(.57,.65,.055,0,.715,0,'#f1e6d2',32);
  b.cylinder(.11,.22,.53,0,.32,0,'#a58a67',20);
  b.softBox(.82,.06,.12,0,.12,0,'#9b805e',.035);
  b.softBox(.22,.035,.32,-.34,.76,-.04,'#d6ecfa',.025);
  b.cylinder(.075,.06,.10,.36,.79,-.02,'#f8f1e4',14);
  return b.finish({footprint:[1.65,1.35],anchors:{ground:[0,0,0],top:[0,.75,0]}});
}

export function makeStudioCabinet() {
  const b=builder('storage-cabinet');
  const wood='#d6c4a4',cream='#f2ead9',metal='#8a918c';
  b.softBox(1.38,1.28,.64,0,.66,0,wood,.065);
  b.softBox(1.48,.11,.72,0,1.32,0,cream,.045);
  for(const x of [-.34,.34]){
    b.softBox(.61,1.05,.045,x,.68,.34,'#eee5d4',.035);
    b.softBox(.035,.17,.05,x+(x<0?.22:-.22),.67,.385,metal,.016);
  }
  b.softBox(1.21,.035,.035,0,.68,.375,'#baa98b',.012);
  for(const x of [-.51,.51])b.softBox(.12,.07,.12,x,.055,-.23,'#89785f',.025);
  return b.finish({footprint:[1.55,.85],anchors:{ground:[0,0,0],front:[0,.65,.36]}});
}

export function makeStudioReceptionCounter() {
  const b=builder('reception-counter');
  b.softBox(2.35,.91,.78,0,.50,0,'#d9c6a5',.09);
  b.softBox(2.47,.13,.91,0,1.00,0,'#f2ead9',.06);
  b.softBox(2.13,.35,.055,0,.57,.405,'#bd8d5d',.027);
  b.softBox(1.94,.075,.07,0,.29,.428,'#e8820c',.025);
  b.softBox(.62,.045,.38,-.48,1.10,-.04,'#536b68',.025);
  b.softBox(.055,.20,.045,-.48,1.22,-.13,'#536b68',.018);
  b.softBox(.53,.36,.045,-.48,1.39,-.13,'#d6ecfa',.035);
  b.softBox(.44,.19,.012,-.48,1.39,-.10,'#eff6e9',.018);
  b.cylinder(.08,.07,.13,.72,1.14,.01,'#f8f1e4',14);
  b.cylinder(.05,.05,.006,.72,1.21,.01,'#795b43',14);
  return b.finish({footprint:[2.55,1.1],anchors:{ground:[0,0,0],worktop:[0,1.07,0]}});
}

export function makeStudioBookcase() {
  const b=builder('bookcase');
  const wood='#c4aa81';
  b.softBox(1.28,1.88,.42,0,.94,0,wood,.055);
  b.softBox(1.12,1.69,.035,0,.98,.225,'#eee6d5',.015);
  for(const y of [.18,.65,1.12,1.59])b.softBox(1.18,.07,.46,0,y,0,'#b38f63',.025);
  const colors=['#78978b','#dba35f','#7f9db0','#dfd2b6','#bd7960','#718776'];
  for(let shelf=0;shelf<3;shelf++){
    let x=-.46;
    for(let i=0;i<5;i++){
      const w=.10+(i%2)*.035,h=.23+(i%3)*.045;
      b.softBox(w,h,.27,x+w/2,.25+shelf*.47+h/2,.035,colors[(shelf*2+i)%colors.length],.015,(i%2?.045:-.035));x+=w+.055;
    }
  }
  b.softBox(.55,.035,.22,.05,1.69,.02,'#efe4cb',.035);
  b.cylinder(.07,.09,.32,.05,1.88,.02,'#b79c70',8);
  b.ball(.16,.05,2.08,.02,'#86a17e').scale.set(.75,1.1,.75);
  return b.finish({footprint:[1.5,.75],anchors:{ground:[0,0,0],shelf:[0,.95,.23]}});
}

export function makeStudioFloorLamp() {
  const b=builder('floor-lamp');
  b.cylinder(.34,.28,.10,0,.06,0,'#a78d65',24);
  b.cylinder(.045,.045,1.42,0,.82,0,'#95876e',14);
  b.cylinder(.12,.31,.34,0,1.67,0,'#e7d2ad',24);
  b.cylinder(.29,.29,.025,0,1.49,0,'#fff1cf',24);
  b.cylinder(.07,.07,.035,0,1.43,0,'#dfaa62',14);
  return b.finish({footprint:[.72,.72],anchors:{ground:[0,0,0],light:[0,1.72,0]}});
}

export function makeStudioWhiteboard() {
  const b=builder('whiteboard');
  b.softBox(1.72,1.12,.10,0,1.23,0,'#a78c63',.045);
  b.softBox(1.58,.98,.04,0,1.24,.075,'#f5f3e9',.025);
  b.softBox(1.50,.055,.12,0,.64,.045,'#c6b18e',.025);
  b.softBox(.64,.045,.055,-.30,1.34,.104,'#d6ecfa',.018);
  b.softBox(.46,.035,.055,.28,1.20,.104,'#9bb49c',.016);
  for(const x of [-.62,.62]){
    b.softBox(.075,1.28,.075,x,.64,0,'#a28a69',.025);
    b.softBox(.12,.07,.47,x,.07,.02,'#89795f',.025);
    b.cylinder(.045,.045,.055,x,.07,.24,'#5f6d69',12);
  }
  return b.finish({footprint:[1.95,.58],anchors:{ground:[0,0,0],board:[0,1.23,.1]}});
}

export function makeStudioCoffeeStation() {
  const b=builder('coffee-station');
  b.softBox(1.32,.90,.64,0,.46,0,'#b89368',.055);
  b.softBox(1.42,.105,.72,0,.93,0,'#f1e6d2',.04);
  for(const x of [-.34,.34]){
    b.softBox(.60,.72,.035,x,.46,.335,'#e9dfcc',.025);
    b.softBox(.035,.12,.035,x+(x<0?.20:-.20),.49,.36,'#858d87',.012);
  }
  b.softBox(.62,.55,.42,-.28,1.26,-.01,'#394d4b',.055);
  b.softBox(.48,.22,.34,-.28,1.58,-.02,'#526b67',.035);
  b.cylinder(.12,.12,.19,-.28,1.72,-.02,'#f4ead8',16);
  b.cylinder(.08,.08,.008,-.28,1.82,-.02,'#7b6048',16);
  b.softBox(.26,.07,.30,.45,1.02,.02,'#d6ecfa',.025);
  b.cylinder(.07,.055,.10,.45,1.11,.02,'#f9f2e5',14);
  return b.finish({footprint:[1.55,.88],anchors:{ground:[0,0,0],worktop:[0,.99,0]}});
}

export function makeStudioElevator() {
  const b=builder('elevator-bay');
  b.softBox(2.15,2.84,.25,0,1.42,0,'#b9beb4',.065);
  b.softBox(1.88,2.56,.10,0,1.35,.17,'#e9e5d8',.035);
  b.softBox(.91,2.34,.045,-.46,1.30,.245,'#a9c3c7',.025);
  b.softBox(.91,2.34,.045,.46,1.30,.245,'#b5cbd0',.025);
  b.softBox(.035,2.35,.055,0,1.30,.28,'#839895',.012);
  b.softBox(2.03,.12,.31,0,2.79,.03,'#e8820c',.04);
  b.softBox(.10,.36,.085,1.25,1.22,.20,'#536763',.025);
  b.softBox(.045,.06,.025,1.25,1.30,.25,'#d6ecfa',.01);
  b.softBox(.045,.06,.025,1.25,1.15,.25,'#e8c27c',.01);
  b.softBox(2.30,.10,.54,0,.05,0,'#c9b99a',.045);
  return b.finish({footprint:[2.55,.85],anchors:{ground:[0,0,0],interaction:[1.25,1.2,.3]}});
}

export function disposeStudioObject(root) {
  const geometries=new Set(),materials=new Set();
  root?.traverse(node=>{if(node.geometry)geometries.add(node.geometry);if(node.material)for(const m of [node.material].flat())materials.add(m);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}

// All sandbox meshes use the same opaque StandardMaterial settings. Batch by
// colour after placement, retaining editable source assets separately.
export function batchStudioScene(source) {
  source.updateMatrixWorld(true);
  const batches=new Map(),result=new THREE.Group();result.name='studio-render-batch';
  source.traverse(node=>{
    if(!node.isMesh)return;
    const key=node.material.color.getHexString();
    if(!batches.has(key))batches.set(key,{material:node.material.clone(),geometries:[]});
    const geometry=node.geometry.clone();geometry.applyMatrix4(node.matrixWorld);
    batches.get(key).geometries.push(geometry);
  });
  for(const {material,geometries} of batches.values()){
    const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;result.add(mesh);
  }
  disposeStudioObject(source);return result;
}
