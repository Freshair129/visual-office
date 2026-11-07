import * as THREE from 'three';

// Approved Wangjai sheet / Character Kit v0.9.4. Metres here are preview
// calibration only: the brand does not yet assign Wangjai a canonical height.
const signedPower=(v,p)=>Math.sign(v)*Math.abs(v)**p;
const shellRadius=y=>{const c=THREE.MathUtils.clamp((y-.55)/.35,-1,1);return Math.sqrt(1-c*c)*(.235+.035*c);};
const shellFront=(x,y)=>.81*Math.sqrt(Math.max(0,shellRadius(y)**2-x*x));

function surface(fn,uSteps=64,vSteps=32,reverse=false){
 const positions=[],uvs=[],indices=[];
 for(let v=0;v<=vSteps;v++)for(let u=0;u<=uSteps;u++){positions.push(...fn(u/uSteps,v/vSteps));uvs.push(u/uSteps,v/vSteps);}
 for(let v=0;v<vSteps;v++)for(let u=0;u<uSteps;u++){const a=v*(uSteps+1)+u,b=a+1,c=a+uSteps+1,d=c+1;indices.push(...(reverse?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
const bodyGeometry=()=>surface((u,v)=>{const y=.55+.35*Math.cos(v*Math.PI),r=shellRadius(y),a=u*Math.PI*2;return [r*Math.cos(a),y,.81*r*Math.sin(a)];},80,56);
const visorOutline=a=>[.211*signedPower(Math.cos(a),.75),.694+.137*signedPower(Math.sin(a),.82)];
function facePatch(outline,offset,steps=64){
 return surface((u,v)=>{const [x,y]=outline(u*2*Math.PI),px=x*v,py=.694+(y-.694)*v;return [px,py,shellFront(px,py)+offset];},steps,20,true);
}
function lineTube(points,r=.0015){return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),points.length*2,r,8,true);}

export function createWangjai(){
 const root=new THREE.Group();root.name='wangjai';root.userData.character='Wangjai';root.userData.previewHeightMetres=.9;
 const mat=(color,roughness,extra={})=>new THREE.MeshPhysicalMaterial({color,roughness,metalness:0,...extra});
 const orange=mat('#FF8A00',.25,{clearcoat:.65,clearcoatRoughness:.18}),edge=mat('#DB6500',.30,{clearcoat:.4}),rim=mat('#FFB33C',.26,{clearcoat:.55}),dark=mat('#23262D',.43),visor=mat('#1B2431',.22,{clearcoat:.7,clearcoatRoughness:.18}),white=mat('#FFFDF7',.25,{emissive:'#FFF9E9',emissiveIntensity:.28});
 const node=(parent,name,x=0,y=0,z=0)=>{const n=new THREE.Group();n.name='wangjai-'+name;n.position.set(x,y,z);parent.add(n);return n;};
 const mesh=(parent,name,g,m,x=0,y=0,z=0)=>{const n=new THREE.Mesh(g,m);n.name='wangjai-'+name;n.position.set(x,y,z);n.castShadow=true;n.receiveShadow=true;parent.add(n);return n;};
 const oval=(parent,name,m,x,y,z,sx,sy,sz)=>{const g=new THREE.SphereGeometry(1,40,28);g.scale(sx,sy,sz);return mesh(parent,name,g,m,x,y,z);};
 const body=node(root,'body');mesh(body,'shell',bodyGeometry(),orange);
 mesh(body,'visor',facePatch(visorOutline,.0035),visor);
 const outline=Array.from({length:96},(_,i)=>{const [x,y]=visorOutline(i/96*Math.PI*2);return new THREE.Vector3(x,y,shellFront(x,y)+.0045);});mesh(body,'visor-bezel',lineTube(outline,.0022),rim);
 for(const [side,x]of [['left',-.079],['right',.079]]){
  const y=.705,z=shellFront(x,y)+.006;const eye=oval(body,'eye-'+side,white,x,y,z,.019,.034,.0045);eye.rotation.y=x>0?.36:-.36;
 }
 // A shallow smile surface follows the curved visor instead of floating on an
 // opaque rectangle. Its top is flat, with a rounded orange lower lip.
 const smile=new THREE.Shape();smile.moveTo(-.023,0);smile.quadraticCurveTo(0,-.036,.023,0);smile.quadraticCurveTo(0,.003,-.023,0);
 const smileGeometry=new THREE.ShapeGeometry(smile,24),sp=smileGeometry.attributes.position;
 for(let i=0;i<sp.count;i++){const x=sp.getX(i),y=sp.getY(i)+.662;sp.setXYZ(i,x,y,shellFront(x,y)+.009);}smileGeometry.computeVertexNormals();mesh(body,'smile',smileGeometry,orange);
 // Rear service seam is a fine inset line following the shell curvature.
 const rear=Array.from({length:96},(_,i)=>{const a=i/96*Math.PI*2,x=.151*Math.cos(a),y=.414+.164*Math.sin(a);return new THREE.Vector3(x,y,-shellFront(x,y)-.0005);});mesh(body,'rear-service-seam',lineTube(rear,.0009),edge);
 for(const [side,sign]of [['left',-1],['right',1]]){
  const ear=node(body,'ear-'+side,sign*.236,.693,0);ear.rotation.z=-sign*Math.PI/2;
  const disk=(name,r,h,y,material)=>{const g=new THREE.CylinderGeometry(r,r,h,64,1,false);return mesh(ear,'ear-'+side+'-'+name,g,material,0,y,0);};
  disk('gasket',.086,.012,0,edge);disk('shell',.082,.039,.022,orange);disk('bevel',.070,.009,.045,rim);disk('recess',.061,.006,.052,edge);disk('face',.056,.008,.057,orange);
 }
 const rig={body};
 for(const [side,sign]of [['left',-1],['right',1]]){
  const shoulder=node(body,side+'-arm',sign*.224,.439,0);rig[side+'Arm']=shoulder;
  oval(shoulder,side+'-shoulder',dark,0,0,0,.052,.059,.052);
  const armShell=new THREE.LatheGeometry([new THREE.Vector2(0,-.126),new THREE.Vector2(.038,-.122),new THREE.Vector2(.051,-.096),new THREE.Vector2(.053,-.059),new THREE.Vector2(.043,-.023),new THREE.Vector2(.025,-.014),new THREE.Vector2(0,-.012)],48);mesh(shoulder,side+'-sleeve',armShell,orange);
  const elbow=node(shoulder,side+'-elbow',0,-.112,0);rig[side+'Elbow']=elbow;
  oval(elbow,side+'-cuff',dark,0,-.008,0,.039,.018,.038);
  const hand=node(elbow,side+'-hand',0,-.033,.003);rig[side+'Hand']=hand;
  oval(hand,side+'-mitten',dark,0,-.009,.002,.043,.049,.036);
  oval(hand,side+'-thumb',dark,-sign*.031,.004,.024,.019,.027,.018);
  const finger=oval(hand,side+'-point-finger',dark,0,-.026,.013,.018,.057,.018);rig[side+'Finger']=finger;
  const hip=node(root,side+'-leg',sign*.102,.247,0);rig[side+'Leg']=hip;
  oval(hip,side+'-hip-joint',dark,0,-.014,0,.046,.044,.045);
  const leg=new THREE.LatheGeometry([new THREE.Vector2(0,-.116),new THREE.Vector2(.037,-.115),new THREE.Vector2(.045,-.092),new THREE.Vector2(.046,-.04),new THREE.Vector2(.038,-.025),new THREE.Vector2(0,-.022)],48);mesh(hip,side+'-shin',leg,orange);
  const ankle=node(hip,side+'-ankle',0,-.142,0);rig[side+'Ankle']=ankle;
  oval(ankle,side+'-ankle-joint',dark,0,.012,0,.035,.031,.035);
  // Sculpted shoe dome, closed flat sole, with a rounded forward toe.
  const shoe=surface((u,v)=>{const a=u*2*Math.PI,t=v*Math.PI/2,r=Math.sin(t);return [.068*r*Math.cos(a),.105*Math.cos(t),.018+.09*r*Math.sin(a)];},48,24);mesh(ankle,side+'-shoe',shoe,dark,0,-.105,0);
  const sole=new THREE.CircleGeometry(1,48);sole.scale(.068,.09,1);sole.rotateX(-Math.PI/2);mesh(ankle,side+'-sole',sole,dark,0,-.105,.018);
 }
 Object.defineProperty(root.userData,'rig',{value:rig,enumerable:false});
 poseWangjai(root,{action:'idle',time:0});return root;
}

/** Presentation poses only; never claims a business task or agent state. */
export function poseWangjai(root,{action='idle',time=0}={}){
 const r=root?.userData?.rig;if(!r)return root;const t=Number.isFinite(time)?time:0,p=t*2*Math.PI/1.12,idlePhase=t*2*Math.PI/4;
 for(const n of Object.values(r))n.rotation.set(0,0,0);
 r.body.position.y=0;
 for(const side of ['left','right']){const sign=side==='left'?-1:1;r[side+'Arm'].rotation.z=sign*.16;r[side+'Elbow'].rotation.x=-.10;r[side+'Finger'].scale.y=.18;}
 if(action==='walking'){
  for(const [side,sign]of [['left',1],['right',-1]]){r[side+'Leg'].rotation.x=sign*.32*Math.sin(p);r[side+'Ankle'].rotation.x=-r[side+'Leg'].rotation.x*.65;r[side+'Arm'].rotation.x=-sign*.30*Math.sin(p);}
  r.body.position.y=.006*(1-Math.cos(p*2));r.body.rotation.z=.025*Math.sin(p);
 }else if(action==='wave'){
  r.rightArm.rotation.z=2.45+.12*Math.sin(t*5);r.rightArm.rotation.x=-.18;r.rightElbow.rotation.x=-.32;r.rightHand.rotation.z=.2*Math.sin(t*10);
 }else if(action==='point'){
  r.rightArm.rotation.x=-Math.PI/2;r.rightArm.rotation.z=.3;r.rightElbow.rotation.x=-.06;r.rightFinger.scale.y=1;r.body.rotation.y=-.08;
 }else if(action==='seated'){
  for(const side of ['left','right']){r[side+'Leg'].rotation.x=-Math.PI/2;r[side+'Ankle'].rotation.x=Math.PI/2;r[side+'Arm'].rotation.x=-.48;r[side+'Elbow'].rotation.x=-.45;}
 }else{r.body.rotation.z=.012*Math.sin(idlePhase);r.rightArm.rotation.x=.035*Math.sin(idlePhase);}
 root.updateMatrixWorld(true);return root;
}
