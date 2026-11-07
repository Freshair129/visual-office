import * as THREE from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

import {STUDIO_LEVELS,DESK_ANCHORS} from './studio-models.js';
// @tested tests/tycoon-assets.test.mjs, tests/office-object-skins.test.mjs
// Accepted Tycoon geometry variants are isolated from the legacy Studio source
// pinned by the painted artwork registration. Keep that source byte-stable.
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

export function makeTycoonFactoryDesk(level='starter',{chair=true}={}) {
  const tier=STUDIO_LEVELS.includes(level)?level:'starter';
  const c=colors[tier], b=builder(`desk-${tier}`);
  b.rounded(1.8,.095,.85,0,.79,0,c.top);
  for(const x of [-.73,.73]){
    b.box(.08,.71,.61,x,.38,0,c.leg);
    b.rounded(.28,.05,.68,x,.045,0,c.leg,.025);
  }
  if(tier!=='starter'){
    b.rounded(.38,.6,.65,.6,.4,0,c.top,.03);
    for(const y of [.3,.49]) b.box(.29,.012,.02,.6,y,.335,'#8b7556');
    b.box(.3,.06,.2,-.57,.8675,-.17,c.accent);
    b.box(.27,.045,.19,-.55,.92,-.17,'#edf1df');
  }
  // Monitor, keyboard and mug share the same functional positions in every tier.
  b.rounded(.4,.035,.24,0,.855,-.17,'#3a5155',.035);
  b.box(.055,.2,.05,0,.96,-.22,'#3a5155');
  // Vertical screen, with a simple non-status wallpaper.
  b.box(.87,.51,.045,0,1.23,-.23,'#3a5155');
  // Keep the screen surface clear of the monitor body at the target scale.
  b.box(.79,.43,.012,0,1.23,-.195,'#aad9e1');
  b.box(.48,.035,.015,-.09,1.27,-.18,'#f2f1d6');
  b.box(.28,.025,.015,-.19,1.19,-.18,'#79a9ba');
  b.rounded(.63,.025,.22,-.04,.85,.25,'#e6e9df',.025);
  for(let i=0;i<3;i++)b.box(.53,.007,.015,-.04,.866,.19+i*.05,'#b5bdb4');
  b.rounded(.1,.03,.15,.43,.8525,.25,'#3a5155',.035);
  b.cylinder(.065,.055,.14,-.64,.9075,.23,'#fff4de');
  b.cylinder(.047,.047,.005,-.64,.98,.23,'#7b5540');
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

export function makeTycoonFactoryChair({armPadWidth=.30}={}) {
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
  b.softBox(armPadWidth,.075,.48,-.37,.88,.045,trim,.035);
  b.softBox(armPadWidth,.075,.48,.37,.88,.045,trim,.035);
  return b.finish({footprint:[.9,.95],anchors:{ground:[0,0,0],seat:[0,.66,-.02],back:[0,1.36,.21]}});
}
