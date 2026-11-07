import * as T from 'three';

// Original local sculpture. The Tripo viewer supplies visual proportions only;
// no provider geometry/texture/cache bytes are consumed. See local-rebuild/README.
const TAU=Math.PI*2,lerp=T.MathUtils.lerp,clamp=T.MathUtils.clamp;
const smooth=T.MathUtils.smoothstep;
export const ZURI_FACE_MAP=Object.freeze({width:.218,top:.161,height:.272,eyeX:.044,eyeY:.038});

function smoothClosedSeam(geometry,columns){
  const normal=geometry.attributes.normal;
  for(let a=0;a<normal.count;a+=columns){
    const b=a+columns-1,n=new T.Vector3().fromBufferAttribute(normal,a).add(new T.Vector3().fromBufferAttribute(normal,b)).normalize();
    normal.setXYZ(a,n.x,n.y,n.z);normal.setXYZ(b,n.x,n.y,n.z);
  }
  return geometry;
}

export function createZuriHead(r,m,{surface,mesh,ellipsoid,curve}){
  const head=r.head;
  const skin=new T.MeshPhysicalMaterial({name:'zuri-painted-face',color:0xffffff,roughness:.54,metalness:0,ior:1.42,specularIntensity:.6,clearcoat:.035,clearcoatRoughness:.5,sheen:.08,sheenColor:0xffc4ad,sheenRoughness:.7});
  const lidSkin=new T.MeshPhysicalMaterial({name:'zuri-lid-skin',color:0xffd2b5,roughness:.57,metalness:0,ior:1.42,specularIntensity:.6});
  const section=y=>{
    const t=clamp((y-.026)/.119,-1,1),ring=Math.sqrt(Math.max(.000001,1-t*t));
    const jaw=lerp(.71,1,smooth(y,-.093,-.003));
    return [.096*ring*jaw,.084*ring,lerp(.026,-.012,smooth(y,-.09,.07))];
  };
  const relief=(x,y)=>{
    const nose=.009*Math.exp(-((x/.010)**2)-(((y-.018)/.035)**2))
      +.019*Math.exp(-((x/.011)**2)-(((y+.011)/.012)**2))
      +.004*Math.exp(-((x/.019)**2)-(((y+.019)/.008)**2));
    const cheeks=.007*Math.exp(-(((Math.abs(x)-.052)/.026)**2)-(((y+.012)/.024)**2));
    const lips=.0045*Math.exp(-((x/.027)**4)-(((y+.043)/.008)**2))
      -.0013*Math.exp(-((x/.024)**4)-(((y+.042)/.0017)**2));
    const sockets=-.003*Math.exp(-(((Math.abs(x)-.044)/.025)**2)-(((y-.038)/.019)**2));
    const brow=.002*Math.exp(-(((Math.abs(x)-.044)/.029)**2)-(((y-.061)/.012)**2));
    const chin=.004*Math.exp(-((x/.031)**2)-(((y+.069)/.019)**2));
    return nose+cheeks+lips+sockets+brow+chin;
  };
  const faceZ=(x,y)=>{const[w,d,z]=section(y);return z+d*Math.sqrt(Math.max(0,1-(x/Math.max(w,.0001))**2))+relief(x,y);};
  const g=surface((u,v)=>{
    const t=.001+v*(Math.PI-.002),y=.026-Math.cos(t)*.119,[w,d,z]=section(y),a=u*TAU,x=Math.sin(a)*w;
    return [x,y,z+Math.cos(a)*d+smooth(Math.cos(a),.15,.7)*relief(x,y)];
  },72,56);
  const p=g.attributes.position,uv=g.attributes.uv;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),[,d,z]=section(y),front=(p.getZ(i)-z)/Math.max(d,.0001);
    // Front projection is continuous on the facial sculpture. The back uses a
    // blank albedo corner so a second face can never appear behind the hair.
    if(front>.1){
      // Keep the same original painted source while reducing the doll-like eye
      // aperture. Smooth UV falloff preserves cheek/nose continuity around it.
      const ex=Math.sign(x)*ZURI_FACE_MAP.eyeX,dx=x-ex,dy=y-ZURI_FACE_MAP.eyeY;
      const eyeFalloff=Math.exp(-((dx/.031)**2)-((dy/.038)**2));
      const mappedX=x+.34*dx*eyeFalloff,mappedY=y+.30*dy*eyeFalloff;
      uv.setXY(i,clamp(.5+mappedX/ZURI_FACE_MAP.width,.002,.998),clamp((ZURI_FACE_MAP.top-mappedY)/ZURI_FACE_MAP.height,.002,.998));
    }
    else uv.setXY(i,.015,.015);
  }
  const face=mesh(head,'sculpted-face',smoothClosedSeam(g,73),skin);face.userData.receiveShadow=false;
  face.userData.authorship='local-zuri-sculpt-v1';face.userData.faceTexture='zuri-face-albedo-v1.png';
  for(const s of [-1,1]){
    ellipsoid(head,`ear-${s}`,m.skin,[s*.087,.003,-.003],[.013,.026,.012],24);
    ellipsoid(head,`ear-fold-${s}`,m.skinShadow,[s*.094,.004,.005],[.0035,.015,.0035],16);
    const ex=s*ZURI_FACE_MAP.eyeX,ey=ZURI_FACE_MAP.eyeY,ew=.0308,eh=.026;
    const rig=new T.Group();rig.name=`eyelid-rig-${s}`;rig.position.y=ey;head.add(rig);
    // The opposite scale drives a real upper/lower skin cover. The face map
    // remains attached to the head; only the lid closes over its eye aperture.
    const cover=surface((u,v)=>{
      const q=lerp(-1,1,u),x=ex+q*ew,h=eh*Math.pow(Math.max(.0001,1-q*q),.5),y=ey+lerp(-h,h,v);
      return [x,y-ey,faceZ(x,y)+.0025];
    },32,16);
    const lid=mesh(head,`blink-cover-${s}`,cover,lidSkin,[0,ey,0]);lid.scale.y=0;
    const line=[];
    for(let i=0;i<=20;i++){const x=ex+lerp(-ew*.94,ew*.94,i/20),y=ey+.018*Math.sqrt(Math.max(0,1-((x-ex)/ew)**2));line.push([x,y-ey,faceZ(x,y)+.0008]);}
    const lash=curve(rig,`upper-lash-${s}`,line,.00025,m.lash,20);lash.userData.castShadow=false;
  }

  // A broad crown, a curved under-bob and individually swept locks make the
  // silhouette. None is a cylinder; each has a stable swept elliptical section.
  const hairMaterial=(name,color,vertexColors=false)=>new T.MeshPhysicalMaterial({name,color,vertexColors,roughness:.43,metalness:0,clearcoat:.045,clearcoatRoughness:.5,anisotropy:.28,anisotropyRotation:Math.PI/2,side:T.FrontSide});
  m.hair=hairMaterial('brown-hair',0x684431);
  m.hairVariants=[0x61412f,0x6c4733,0x754e38].map((c,i)=>hairMaterial(['hair-dark','hair-mid','hair-light'][i],c,true));
  const capPoint=(u,v)=>{
    const a=u*TAU+.028*Math.sin(v*4+u*TAU*2)*v,front=smooth(Math.cos(a),.60,.90);
    const end=lerp(-.105+.008*Math.cos(a*6),.090,front);
    const y=lerp(.174,end,v),t=(y-.027)/.147;
    let radial=y>.027?Math.sqrt(Math.max(.00001,1-t*t)):1+.16*Math.sin(smooth(y,-.115,.027)*Math.PI);
    radial-=.10*smooth(v,.84,1)*(1-front);
    const groove=.0006*Math.cos(a*18+v*3.4)*Math.sin(Math.PI*v);
    return [Math.sin(a)*(.121*radial+groove)+.014*(1-v)**1.5,y,Math.cos(a)*(.109*radial+groove)-.010+.016*v*v*(1-front)];
  };
  const cap=smoothClosedSeam(surface(capPoint,80,40,true),81);
  mesh(head,'hair-volume',cap,m.hair);
  const innerMaterial=hairMaterial('bob-inner-shadow',0x36251c);innerMaterial.roughness=.68;innerMaterial.anisotropy=0;
  mesh(head,'bob-inner-volume',smoothClosedSeam(surface((u,v)=>{const p=capPoint(u,v);return[p[0]*.86,p[1]+.005*v,(p[2]+.01)*.86-.01];},48,24),49),innerMaterial);
  mesh(head,'bob-turned-under-edge',smoothClosedSeam(surface((u,v)=>{const p=capPoint(u,1),s=lerp(1,.86,v);return[p[0]*s,p[1]+.005*v-.003*Math.sin(Math.PI*v),(p[2]+.01)*s-.01];},80,4,true),81),m.hair);
  // Broad overlapping sheets turn from the crown toward rounded fringe tips.
  // Their tangent-continuous depth catches moving light instead of a saw-tooth rim.
  const fringe=surface((u,v)=>{
    const tipX=lerp(-.100,.100,u),part=.026;
    const tipY=.051+.023*(tipX/.100)**2+.0028*Math.cos(u*TAU*7);
    const x=lerp(part+(u-.5)*.026,tipX,Math.pow(v,.78));
    const y=lerp(.171-.008*(u-.5)**2,tipY,Math.pow(v,1.38));
    const z=.014+.102*Math.sin(v*Math.PI*.49)-.020*(tipX/.100)**2*smooth(v,.35,1)
      +.00018*Math.cos(u*TAU*22+v*.7)*Math.sin(Math.PI*v)-.004*smooth(v,.90,1);
    return [x,y,z];
  },96,24,true);
  mesh(head,'swept-fringe-surface',fringe,m.hair);
  const hairProbe=new T.Mesh(cap,m.hair),fringeProbe=new T.Mesh(fringe,m.hair);hairProbe.updateMatrixWorld(true);fringeProbe.updateMatrixWorld(true);
  const hairZ=(x,y)=>{
    const hit=new T.Raycaster(new T.Vector3(x,y,1),new T.Vector3(0,0,-1)).intersectObjects([hairProbe,fringeProbe],false)[0];
    if(!hit)throw new Error('Zuri clip anchor must intersect authored hair surface');
    return hit.point.z;
  };
  function lock(name,points,width,depth,mat){
    const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    const geo=surface((u,v)=>{
      const p=path.getPoint(v),t=path.getTangent(v),n=p.clone().sub(new T.Vector3(0,.025,-.015)).normalize();
      const across=new T.Vector3().crossVectors(n,t).normalize();
      if(across.lengthSq()<.1)across.set(1,0,0);
      const out=new T.Vector3().crossVectors(t,across).normalize(),a=u*TAU;
      const taper=Math.pow(Math.max(.00001,Math.sin(Math.PI*v)),.48)*(1-.97*smooth(v,.78,1));
      return p.addScaledVector(across,Math.cos(a)*width*taper).addScaledVector(out,Math.sin(a)*depth*taper).toArray();
    },10,18);
    const colors=[];for(let i=0;i<geo.attributes.uv.count;i++){const u=geo.attributes.uv.getX(i),v=geo.attributes.uv.getY(i),k=.89+.10*Math.sin(u*TAU*3+v*1.5);colors.push(k,k,k);}
    geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    return mesh(head,name,geo,mat);
  }
  // Thin strand tips sit on the continuous shell; they never supply the main
  // silhouette or leave gaps around the cheeks and crown.
  for(let i=0;i<14;i++){
    const center=1.05+(TAU-2.1)*i/13;
    const strand=surface((u,v)=>{
      const a=center+lerp(-.095,.095,u),p=capPoint(a/TAU,.08+.92*v);
      const lift=.0007+.0016*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
      p[0]+=Math.sin(a)*lift;p[2]+=Math.cos(a)*lift;return p;
    },8,20,true);
    mesh(head,`bob-lock-${i}`,strand,m.hairVariants[i%3]);
  }
  for(const s of [-1,1]){
    lock(`face-framing-lock-${s}`,[[s*.063,.132,.054],[s*.105,.054,.055],[s*.120,-.010,.036],[s*.112,-.087,.032],[s*.105,-.080,.047]],.008,.0015,m.hairVariants[1]);
    const frame=new T.TorusGeometry(.034,.00075,8,56),fp=frame.attributes.position;
    for(let i=0;i<fp.count;i++){const x=fp.getX(i),y=fp.getY(i)*.98,z=fp.getZ(i);fp.setXYZ(i,x,y,faceZ(x+s*.044,y+.034)+.006+z);}
    frame.computeVertexNormals();
    mesh(head,`round-glasses-${s<0?'right':'left'}`,frame,m.metal,[s*.044,.034,0]);
    curve(head,`glasses-temple-${s}`,[[s*.077,.040,faceZ(s*.077,.04)+.007],[s*.091,.035,.020],[s*.094,.026,-.003]],.0011,m.metal,18);
  }
  curve(head,'glasses-bridge',[[-.010,.037,faceZ(-.010,.037)+.006],[0,.042,faceZ(0,.042)+.006],[.010,.037,faceZ(.010,.037)+.006]],.00085,m.metal,12);
  const cx=-.085,cy=.080;
  const clipGeometry=new T.CapsuleGeometry(.0032,.024,4,12);clipGeometry.rotateZ(1.80);
  const cp=clipGeometry.attributes.position;
  for(let i=0;i<cp.count;i++){const x=cp.getX(i),y=cp.getY(i);cp.setZ(i,hairZ(cx+x,cy+y)+.004+cp.getZ(i));}
  clipGeometry.computeVertexNormals();
  mesh(head,'anatomical-right-orange-clip',clipGeometry,m.orange,[cx,cy,0]);
  head.traverse(n=>{if(n.isMesh){n.userData.receiveShadow=false;n.userData.castShadow=false;}});
  face.userData.castShadow=true;
}
