import * as THREE from 'three';

export const palette={ink:'#1F2937',muted:'#6B7280',white:'#FFFFFF',cream:'#F5EFE4',floor:'#e9e7e1',brand:'#E8820C',blue:'#D6ECFA',mustard:'#C6A052'};
const mats=new Map();
export function material(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.86,metalness:0,flatShading:true}));return mats.get(color)}
export function box(parent,w,h,d,x,y,z,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
export function cylinder(parent,r1,r2,h,x,y,z,color,n=12){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,n),material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function sphere(parent,r,x,y,z,color){const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),material(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m}
export function makeFloorTile(){const g=new THREE.Group();g.name='zuri-floor-tile';g.userData.surfaceId='floor';box(g,1.97,.14,1.97,0,-.07,0,palette.floor);return g}
export function makeDesk(){const g=new THREE.Group();g.name='zuri-desk-slot';box(g,2.6,.13,1.3,0,1.24,0,palette.cream);for(const x of [-1.1,1.1]){box(g,.075,1.2,.95,x,.6,0,'#b6b9b8');box(g,.6,.035,.98,x,.03,0,'#b6b9b8')}box(g,.48,.94,1.03,.84,.68,0,'#f7f8fa');for(let i=0;i<3;i++){box(g,.43,.012,.012,.84,.44+i*.25,.52,'#b6b9b8');box(g,.16,.023,.024,.84,.52+i*.25,.53,'#9ca3af')}box(g,.55,.045,.33,-.15,1.33,-.14,palette.ink);box(g,.075,.26,.06,-.15,1.44,-.22,palette.ink);box(g,1.03,.64,.066,-.15,1.79,-.22,palette.ink);box(g,.95,.54,.014,-.15,1.79,-.18,'#dde9e9');for(let i=0;i<4;i++)box(g,.4+(i%2)*.26,.024,.017,-.30+(i%2)*.1,1.91-i*.08,-.166,['#6B7280','#3D7A9E','#C6A052','#6B7280'][i]);box(g,.78,.035,.25,-.15,1.33,.35,'#babfbe');for(let i=0;i<3;i++)box(g,.67,.007,.018,-.15,1.351,.28+i*.06,'#e8eae8');box(g,.12,.045,.19,.49,1.34,.35,'#a7aeae');cylinder(g,.09,.075,.19,-1,1.4,.22,'#fff');cylinder(g,.072,.072,.009,-1,1.499,.22,palette.ink);box(g,.31,.035,.4,1.01,1.33,.24,'#D6ECFA');return g}
export function makeChair(){const g=new THREE.Group();cylinder(g,.28,.28,.055,0,.11,0,palette.ink,5);cylinder(g,.055,.055,.57,0,.40,0,'#798185');box(g,.61,.14,.57,0,.72,0,'#b1beb9');box(g,.61,.58,.12,0,1.06,.29,'#b1beb9');for(const x of [-.37,.37]){box(g,.06,.22,.06,x,.83,0,'#6B7280');box(g,.08,.05,.42,x,.96,0,'#6B7280')}return g}
export function makePlant(size=1){const g=new THREE.Group();cylinder(g,.28,.22,.5,0,.25,0,palette.cream);cylinder(g,.245,.245,.03,0,.51,0,'#6B7280');cylinder(g,.045,.07,1.15,0,1.05,0,'#8a8b75',7);for(let i=0;i<8;i++){const a=i*2.4;const leaf=new THREE.Mesh(new THREE.IcosahedronGeometry(.34,0),material(i%2?'#a0b09a':'#7e947e'));leaf.scale.set(.8,1.5,.52);leaf.rotation.set(.2, a, Math.sin(a)*.7);leaf.position.set(Math.sin(a)*.29,1.02+i*.11,Math.cos(a)*.29);leaf.castShadow=true;g.add(leaf)}g.scale.setScalar(size);return g}
// Movable copies of the existing room's decor vocabulary. No agent/seat metadata.
export function makeDecoration(kind){
  if(kind==='plant')return makePlant();
  const g=new THREE.Group();
  if(kind==='coffee-table'){
    cylinder(g,.65,.65,.1,0,.68,0,palette.cream,32);
    cylinder(g,.09,.24,.63,0,.315,0,'#a3a7a3',24);
    box(g,.3,.035,.39,0,.75,0,palette.blue);
  }else if(kind==='cabinet'){
    box(g,1.35,1.18,.65,0,.6,0,'#d8dcd5');box(g,1.4,.10,.69,0,1.23,0,palette.cream);
    for(const x of [-.33,.33]){box(g,.62,1.04,.03,x,.62,.34,palette.cream);box(g,.04,.18,.04,x+(x<0?.22:-.22),.68,.37,'#798185');}
  }else throw Error('Unknown decoration');
  return g;
}
function surfaceGroup(parent,id){const g=new THREE.Group();g.name=id;g.userData.surfaceId=id;parent.add(g);return g;}
export function makeRoom(){
 const g=new THREE.Group();g.name='zuri-room-shell';
 const base=surfaceGroup(g,'floor');box(base,14.35,.34,10.35,0,-.28,0,'#d3d5d1');
 const left=surfaceGroup(g,'wall-left');box(left,.17,2.9,10.15,-7.05,1.37,0,'#e4e5df');box(left,.05,.14,10.05,-6.93,.10,0,'#c6cac4');
 const back=surfaceGroup(g,'wall-back');box(back,14.2,2.9,.17,0,1.37,-5.05,'#e9ebe6');box(back,14.1,.14,.05,0,.10,-4.94,'#c6cac4');
 [-3.4,.4,4.2].forEach((x,i)=>{
  const frame=surfaceGroup(g,`window-${i+1}-frame`),glass=surfaceGroup(g,`window-${i+1}-glass`);
  box(frame,3.1,1.75,.06,x,1.86,-4.94,'#b5c8cc');box(glass,2.97,1.61,.07,x,1.86,-4.90,'#e4f0f2');
  box(frame,.045,1.66,.1,x,1.86,-4.83,'#b5c8cc');box(frame,3.25,.09,.23,x,.99,-4.82,palette.white);box(frame,3.1,.11,.18,x,2.72,-4.84,palette.white);
 });
 const sofa=surfaceGroup(g,'lounge-sofa');
box(sofa,1.7,.25,2.45,-5.87,.45,2.8,'#a6b9b3');box(sofa,.32,.8,2.45,-6.5,.9,2.8,'#a6b9b3');for(const z of [1.62,3.98])box(sofa,1.7,.53,.19,-5.87,.77,z,'#97aba3');for(const z of [2.22,3.34])box(sofa,1.23,.18,1.06,-5.73,.66,z,'#bbc9bd');box(sofa,.36,.43,.6,-6.07,1.01,2.2,palette.cream);box(sofa,.36,.43,.6,-6.07,1.01,3.35,palette.mustard);
 const table=surfaceGroup(g,'lounge-table');
cylinder(table,.58,.58,.09,-4.66,.68,3.3,palette.cream);cylinder(table,.08,.17,.65,-4.66,.32,3.3,'#a3a7a3');box(table,.3,.035,.39,-4.68,.75,3.3,palette.ink);

 const storage=surfaceGroup(g,'storage');
box(storage,.65,1.18,2.6,-6.58,.6,-2.84,'#d8dcd5');box(storage,.69,.10,2.65,-6.56,1.23,-2.84,palette.cream);
 const coffee=surfaceGroup(g,'coffee-kit');
box(coffee,.25,.45,.48,-6.48,1.51,-3.37,palette.ink);cylinder(coffee,.095,.095,.18,-6.42,1.38,-2.75,palette.white);
 const board=surfaceGroup(g,'pinboard');
box(board,.07,1.04,1.68,-6.93,2.05,-.20,palette.cream);for(let i=0;i<5;i++)box(board,.03,.26,.28,-6.87,2.17-(i%2)*.37,-.72+i*.24,i%2?palette.blue:palette.mustard);
 [[6.1,-4.08,1.15],[-6.05,4.35,.85],[-6.24,-4.27,1]].forEach(([x,z,size],i)=>{const holder=surfaceGroup(g,`room-plant-${i+1}`),p=makePlant(size);p.position.set(x,0,z);holder.add(p)});
 return g;
}
export function makeAvatar(options={}){const o={outfit:'#F5EFE4',skin:'#dfaf8c',hair:'short',glasses:false,...options};const g=new THREE.Group();g.name='custom-agent-avatar';const body=new THREE.Group();g.add(body);body.name='body';box(body,.39,.53,.27,0,1.02,0,o.outfit);box(body,.26,.38,.287,0,1.04,.005,palette.ink);box(body,.08,.52,.3,-.17,1.02,.01,o.outfit);box(body,.08,.52,.3,.17,1.02,.01,o.outfit);cylinder(body,.075,.08,.11,0,1.35,0,o.skin,8);const head=new THREE.Group();head.position.y=1.58;body.add(head);box(head,.35,.39,.33,0,0,0,o.skin);box(head,.38,.12,.37,0,.19,-.01,'#403b37');box(head,.38,.30,.08,0,.06,-.17,'#403b37');box(head,.11,.12,.36,-.14,.11,0,'#403b37');if(o.hair==='bob'){box(head,.09,.35,.35,-.19,-.015,-.03,'#403b37');box(head,.09,.35,.35,.19,-.015,-.03,'#403b37')}if(o.hair==='bun')sphere(head,.13,0,.22,-.21,'#403b37');for(const x of [-.075,.075])box(head,.034,.043,.018,x,.005,.176,palette.ink);box(head,.075,.016,.015,0,-.10,.18,'#a56a55');if(o.glasses){for(const x of [-.08,.08]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.072,.011,4,12),material(palette.ink));ring.position.set(x,.005,.192);head.add(ring)}box(head,.032,.013,.012,0,.005,.2,palette.ink)}const limbs={};for(const [name,x] of [['left',-.28],['right',.28]]){const arm=new THREE.Group();arm.position.set(x,1.23,0);box(arm,.13,.38,.15,0,-.17,0,o.outfit);box(arm,.11,.16,.13,0,-.40,0,o.skin);body.add(arm);limbs[name+'Arm']=arm;const leg=new THREE.Group();leg.position.set(x*.43,.77,0);box(leg,.15,.57,.19,0,-.285,0,palette.ink);box(leg,.17,.10,.29,0,-.595,.047,palette.cream);g.add(leg);limbs[name+'Leg']=leg}g.userData={...limbs,body,head,options:o};return g}
