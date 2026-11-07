import * as T from 'three';
import {createZuriHead} from './zuri-head.js';

// Authored brand-study meshes. Metres, +Z facing. No roster or business state.
const TAU=Math.PI*2,clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
const smooth=(x,a,b)=>T.MathUtils.smoothstep(x,a,b);
const SKIN=0xffd0b5,HAIR=0x482b22;
const material=(name,color,roughness=.75,extra={})=>new T.MeshStandardMaterial({name,color,roughness,...extra});
const V=(x,y,z)=>new T.Vector3(x,y,z);

function mesh(parent,name,g,m,p=[0,0,0],scale=[1,1,1]){
  const n=new T.Mesh(g,m);n.name=name;n.position.set(...p);n.scale.set(...scale);n.castShadow=true;parent.add(n);return n;
}
function ellipsoid(parent,name,m,p,scale,segments=32){return mesh(parent,name,new T.SphereGeometry(1,segments,24),m,p,scale);}
function curve(parent,name,points,r,m,segments=28){return mesh(parent,name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>V(...p))),segments,r,7,false),m);}

// UV-connected parametric surface with smooth normals. Winding faces outward
// when u is circumference and v travels from bottom to top.
function surface(fn,nu=48,nv=32,reverse=false){
  const p=[],uv=[],idx=[];
  for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){p.push(...fn(i/nu,j/nv));uv.push(i/nu,j/nv);}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;idx.push(...(reverse?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
function profile(rows,y){
  let i=0;while(i<rows.length-2&&rows[i+1][0]<y)i++;
  const a=rows[i],b=rows[i+1],t=clamp((y-a[0])/(b[0]-a[0]),0,1),t2=t*t,t3=t2*t;
  return a.slice(1).map((_,k)=>{const p0=rows[Math.max(0,i-1)][k+1],p1=a[k+1],p2=b[k+1],p3=rows[Math.min(rows.length-1,i+2)][k+1];return .5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);});
}
function loft(rows,nu=48,nv=36,{start=0,end=TAU,fold=0}={}){
  return surface((u,v)=>{const y=lerp(rows[0][0],rows.at(-1)[0],v),[rx,rz,cx=0,cz=0]=profile(rows,y),a=lerp(start,end,u),f=1+fold*Math.sin(a*7+v*2)*Math.sin(Math.PI*v);return [cx+Math.sin(a)*rx*f,y,cz+Math.cos(a)*rz*f];},nu,nv);
}
function clothFolds(g,rows,{cuff,hem,pleat=false,amplitude=.003,refined=false}={}){
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const y=p.getY(i),[rx,rz,cx=0,cz=0]=profile(rows,y),x=p.getX(i)-cx,z=p.getZ(i)-cz,a=Math.atan2(x/rx,z/rz);
    let d=amplitude*Math.sin(a*5+y*31)*.3;
    if(cuff!==undefined)d+=amplitude*1.8*Math.exp(-(((y-cuff-.045)/.065)**2))*Math.sin(y*155+a*2.3);
    if(hem!==undefined)d+=amplitude*Math.exp(-(((y-hem-.028)/.055)**2))*Math.sin(a*8+y*110);
    if(pleat)d+=.007*Math.cos(a*5+.3*Math.sin(y*8))*(.5+.5*Math.sin(Math.PI*smooth(y,.10,.9)));
    if(refined){
      // Compression at cuffs/hems, biased away from a uniform corrugated tube.
      // Broad drape remains smooth; smaller folds only cluster at contact points.
      const near=cuff??hem??rows[0][0],end=Math.exp(-(((y-near-.065)/.07)**2));
      d+=.0035*end*Math.sin((y-near)*76+a*1.6)*(.55+.45*Math.cos(a-.7));
      if(pleat)d+=.0025*Math.cos(a*3+y*4)*(1-smooth(y,.72,.88));
      else d+=.0017*Math.sin(a*3+y*12)*Math.sin(Math.PI*smooth(y,rows[0][0],rows.at(-1)[0]));
    }
    p.setX(i,cx+x*(1+d/Math.max(rx,.01)));p.setZ(i,cz+z*(1+d/Math.max(rz,.01)));
  }
  g.computeVertexNormals();return g;
}
function bind(root,name,g,m,weights,rig){
  const ids=[],ws=[],pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){
    const w=weights(pos.getX(i),pos.getY(i),pos.getZ(i)),sum=w.reduce((s,x)=>s+x[1],0);
    for(let k=0;k<4;k++){ids.push(w[k]?rig.bones.indexOf(rig[w[k][0]]):0);ws.push(w[k]?w[k][1]/sum:0);}
  }
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(ws,4));
  const n=new T.SkinnedMesh(g,m);n.name=name;n.castShadow=true;n.frustumCulled=false;root.add(n);n.bind(rig.skeleton);return n;
}
function createRig(root,male=false){
  const r={bones:[]},bone=(name,parent,p)=>{const b=new T.Bone();b.name=name;b.position.set(...p);parent.add(b);r[name]=b;r.bones.push(b);return b;};
  bone('hips',root,[0,.83,0]);bone('spine',r.hips,[0,.105,0]);bone('chest',r.spine,[0,.275,0]);bone('neck',r.chest,[0,.16,0]);bone('head',r.neck,[0,.115,0]);
  for(const side of ['left','right']){const s=side==='left'?1:-1;
    bone(`${side}-hip`,r.hips,[s*.088,0,0]);bone(`${side}-knee`,r[`${side}-hip`],[0,-.38,0]);bone(`${side}-ankle`,r[`${side}-knee`],[0,-.37,0]);
    bone(`${side}-shoulder`,r.chest,[s*(male?.185:.16),.10,0]);bone(`${side}-elbow`,r[`${side}-shoulder`],[s*.044,-.255,0]);bone(`${side}-hand`,r[`${side}-elbow`],[s*.031,-.235,0]);
  }
  root.updateMatrixWorld(true);r.skeleton=new T.Skeleton(r.bones);return r;
}
const torsoWeights=(_x,y)=>{const t=smooth(y,.99,1.22);return [['spine',1-t],['chest',t]];};
function makeFace(r,m,kind){
  const male=kind==='staff-b',zuri=kind==='zuri',head=r.head;
  // A continuous oval replaces the old row-interpolated jaw, whose changes of
  // curvature read as cheek wedges. These dimensions are local to the head.
  const cy=male?.021:.027,ry=male?.130:.119,rx=male?.092:zuri?.095:.090;
  const section=y=>{
    const t=clamp((y-cy)/ry,-1,1),ring=Math.sqrt(Math.max(0,1-t*t));
    const jaw=lerp(male?.91:.78,1,smooth(y,cy-ry,-.006));
    return [rx*ring*jaw,.083*ring,lerp(.018,-.008,smooth(y,-.09,.065))];
  };
  const nose=(x,y)=>.005*Math.exp(-((x/.012)**2)-(((y-.002)/.032)**2))
    +(male?.012:.0085)*Math.exp(-((x/.010)**2)-(((y+.023)/.013)**2))
    +.002*Math.exp(-((x/.020)**2)-(((y+.031)/.009)**2));
  const faceZ=(x,y)=>{const [w,d,z]=section(y);return z+d*Math.sqrt(Math.max(0,1-(x/Math.max(w,.0001))**2))+nose(x,y);};
  const face=surface((u,v)=>{
    const t=.001+v*(Math.PI-.002),y=cy-Math.cos(t)*ry,[w,d,z]=section(y),a=u*TAU,x=Math.sin(a)*w;
    return [x,y,z+Math.cos(a)*d+smooth(Math.cos(a),.15,.7)*nose(x,y)];
  },80,64);
  const p=face.attributes.position,colors=[],base=new T.Color(0xffceb1),blush=new T.Color(0xf28d83),warm=new T.Color(0xf2b29a);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),front=smooth(p.getZ(i),.012,.065);
    const cheek=front*(male?.22:.48)*Math.exp(-(((Math.abs(x)-.053)/.027)**2)-(((y+.028)/.022)**2));
    const mouth=front*.10*Math.exp(-((x/.022)**2)-(((y+.061)/.014)**2));
    const socket=front*.12*Math.exp(-(((Math.abs(x)-.040)/.026)**2)-(((y-.019)/.023)**2));
    colors.push(...base.clone().lerp(blush,cheek+mouth).lerp(warm,socket).toArray());
  }
  face.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const skin=mesh(head,'sculpted-face',face,m.face);
  // Exported as extras; the Lab must not re-enable coarse self-shadow bands.
  skin.userData.receiveShadow=false;
  for(const side of [-1,1]){
    ellipsoid(head,`ear-${side}`,m.skin,[side*.085,-.012,-.006],[.013,.025,.011]);
    ellipsoid(head,`ear-fold-${side}`,m.skinShadow,[side*.092,-.011,.001],[.004,.014,.003]);
    const ex=side*.040,ey=zuri?.004:.005,ew=male?.0255:zuri?.029:.027,eh=male?.0115:zuri?.018:.0155;
    // A lens-shaped eye lies on the face, with a convex cornea. The same
    // aperture defines whites, iris clipping and lid edges, including blink.
    const aperture=q=>Math.pow(Math.max(0,1-q*q),.72),tilt=x=>side*(x-ex)*.09;
    const upper=x=>ey+eh*aperture((x-ex)/ew)+tilt(x);
    const lower=x=>ey-eh*.75*aperture((x-ex)/ew)+tilt(x);
    const eyeZ=(x,y)=>faceZ(x,y)+.001+.006*Math.max(0,1-((x-ex)/ew)**2-((y-ey)/eh)**2);
    const eye=surface((u,v)=>{const x=ex+lerp(-ew,ew,u),y=lerp(lower(x),upper(x),v);return[x,y,eyeZ(x,y)];},40,16);
    mesh(head,`eye-white-${side}`,eye,m.white);
    const ir=male?.0118:zuri?.0165:.0145,ih=eh*1.12;
    const iris=surface((u,v)=>{
      const a=u*TAU,x=ex+Math.cos(a)*ir*v,y=clamp(ey+Math.sin(a)*ih*v,lower(x)+.0003,upper(x)-.0003);
      return [x,y,eyeZ(x,y)+.00055];
    },48,14,true),c=[];
    const ip=iris.attributes.position;
    for(let i=0;i<ip.count;i++){
      const dx=(ip.getX(i)-ex)/ir,dy=(ip.getY(i)-ey)/ih,rad=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
      const col=new T.Color(0x281710).lerp(new T.Color(0xb47738),smooth(-dy,-.7,.65)*(.65+.14*Math.cos(a*19)));
      if(rad>.88)col.lerp(new T.Color(0x291b16),smooth(rad,.88,1));
      if(rad<.43)col.lerp(new T.Color(0x1c1312),1-smooth(rad,.29,.43));
      c.push(...col.toArray());
    }
    iris.setAttribute('color',new T.Float32BufferAttribute(c,3));mesh(head,`iris-${side}`,iris,m.iris);
    ellipsoid(head,`pupil-${side}`,m.pupil,[ex,ey+.001,eyeZ(ex,ey)+.0012],[ir*.43,ir*.47,.00065],20);
    ellipsoid(head,`catchlight-${side}`,m.glint,[ex-.004,ey+.006,eyeZ(ex-.004,ey+.006)+.0014],[.0032,.004,.0005],16);
    ellipsoid(head,`catchlight-small-${side}`,m.glint,[ex+.004,ey-.006,eyeZ(ex+.004,ey-.006)+.0012],[.0012,.0016,.0004],10);
    // Tapered lid ribbons replace thick round tubing across the upper eye.
    const lash=surface((u,v)=>{
      const x=ex+lerp(-ew,ew,u),weight=Math.pow(Math.sin(Math.PI*u),.55),y=upper(x)+v*(male?.0015:.0024)*weight;
      return [x,y,eyeZ(x,upper(x))+.001];
    },36,4);
    mesh(head,`upper-lash-${side}`,lash,m.lash);
    const low=[],fold=[];
    for(let i=0;i<=16;i++){const x=ex+lerp(-ew*.94,ew*.94,i/16),y=lower(x);low.push([x,y,eyeZ(x,y)+.0006]);const fy=upper(x)+.004;fold.push([x,fy,faceZ(x,fy)+.0006]);}
    curve(head,`lower-lid-${side}`,low,.00045,m.skinShadow,20);
    curve(head,`eyelid-fold-${side}`,fold,.00022,m.lid,20);
    if(!male){const x=ex+side*ew,y=upper(x);curve(head,`outer-lash-${side}`,[[x-side*.006,y+.005,faceZ(x-side*.006,y+.005)+.002],[x,y,eyeZ(x,y)+.001],[x+side*.003,y+.003,faceZ(x,y)+.001]],.0008,m.lash,12);}
    const brow=surface((u,v)=>{
      const x=ex+lerp(-.024,.024,u),y=.034+.005*Math.sin(Math.PI*u)+side*(x-ex)*.02+v*(male?.0035:.0015)*Math.sin(Math.PI*u);
      return [x,y,faceZ(x,y)+.001];
    },28,4);mesh(head,`brow-${side}`,brow,m.hair);
    // Tiny warm nostril creases sit underneath the tip, not two black dots.
    const nx=side*.0058,ny=-.030;
    curve(head,`nostril-${side}`,[[nx-side*.0012,ny,faceZ(nx-side*.0012,ny)+.0003],[nx,ny-.001,faceZ(nx,ny-.001)+.0003],[nx+side*.0012,ny,faceZ(nx+side*.0012,ny)+.0003]],.00035,m.lip,8);
    const eyelid=new T.Group();eyelid.name=`eyelid-rig-${side}`;eyelid.position.set(ex,ey,0);head.add(eyelid);
    for(const name of ['eye-white','iris','pupil','catchlight','catchlight-small','upper-lash','lower-lid','eyelid-fold','outer-lash']){
      const n=head.getObjectByName(`${name}-${side}`);if(n){n.position.x-=ex;n.position.y-=ey;eyelid.add(n);}
    }
  }
  const mw=male?.020:.017,my=male?-.054:-.049;
  const mouthY=x=>my+.0025*(x/mw)**2;
  const lips=surface((u,v)=>{
    const x=lerp(-mw,mw,u),edge=Math.pow(Math.sin(Math.PI*u),.7),y=mouthY(x)+lerp(-.0032,.0024,v)*edge;
    return [x,y,faceZ(x,y)+.0006+.0014*Math.sin(v*Math.PI)*edge];
  },36,10);
  const lipColors=[],lp=lips.attributes.uv;
  for(let i=0;i<lp.count;i++)lipColors.push(...new T.Color(0xf0b09d).lerp(new T.Color(0xd9877c),Math.sin(Math.PI*lp.getY(i))*.40).toArray());
  lips.setAttribute('color',new T.Float32BufferAttribute(lipColors,3));mesh(head,'soft-lip-surface',lips,m.lipSurface);
  const smile=[];for(let i=0;i<=16;i++){const x=lerp(-mw,mw,i/16),y=mouthY(x);smile.push([x,y,faceZ(x,y)+.0022]);}
  curve(head,'closed-smile',smile,.00030,m.lip,24);
  // Do not let eyelash/eyeglass shadow-map texels become dark face wedges.
  head.traverse(n=>{if(n.isMesh){n.userData.receiveShadow=false;if(n!==skin)n.userData.castShadow=false;}});
}

function hairLock(parent,name,points,width,depth,m){
  const c=new T.CatmullRomCurve3(points.map(p=>V(...p))),g=surface((u,v)=>{const p=c.getPoint(v),a=u*TAU,taper=Math.pow(Math.sin(Math.PI*(.08+.91*v)),.35)*(1-.65*Math.pow(v,8));return [p.x+Math.cos(a)*width*taper,p.y,p.z+Math.sin(a)*depth*taper];},10,24);
  return mesh(parent,name,g,m);
}
function ribbonLock(parent,name,points,width,depth,m){
  const path=new T.CatmullRomCurve3(points.map(p=>V(...p)));
  const g=surface((u,v)=>{
    const p=path.getPoint(v),t=path.getTangent(v).normalize(),normal=p.clone().sub(V(0,.025,-.015)).normalize();
    const across=new T.Vector3().crossVectors(normal,t).normalize();if(across.lengthSq()<.1)across.set(1,0,0);
    const out=new T.Vector3().crossVectors(t,across).normalize(),a=u*TAU;
    // Rounded, tucked ends: no triangular spikes hanging below the jaw.
    const taper=(.60+.40*Math.sin(Math.PI*v))*(1-.97*smooth(v,.72,1));
    const ridge=1+.035*Math.cos(a*8+v);
    return p.addScaledVector(across,Math.cos(a)*width*taper).addScaledVector(out,Math.sin(a)*depth*taper*ridge).toArray();
  },16,24);
  const colors=[];for(let i=0;i<g.attributes.uv.count;i++){const u=g.attributes.uv.getX(i),v=g.attributes.uv.getY(i),shade=.88+.075*Math.sin(u*TAU*9+v)+.025*Math.sin(u*TAU*4);colors.push(shade,shade,shade);}
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const n=mesh(parent,name,g,m);n.userData.castShadow=false;n.userData.receiveShadow=false;return n;
}
function makeHair(r,m,kind){
  const h=r.head,zuri=kind==='zuri',male=kind==='staff-b';
  const cap=surface((u,v)=>{
    const a=u*TAU,front=Math.cos(a),end=lerp(male?1.84:zuri?2.48:2.44,male?1.27:1.18,smooth(front,.15,.68)),t=.005+v*end;
    const flare=zuri?1+.09*Math.sin(v*Math.PI):1;
    return [Math.sin(t)*Math.sin(a)*.108*flare,.018+Math.cos(t)*.148,Math.sin(t)*Math.cos(a)*.111-.010];
  },64,32,true);
  const capMesh=mesh(h,'hair-volume',cap,m.hair);capMesh.userData.receiveShadow=false;
  if(zuri){
    // The sheet's bob has a soft continuous silhouette, a lifted off-centre
    // part and inward curls at jaw height, rather than separated long spikes.
    for(let i=0;i<18;i++){
      const a=.79+(TAU-1.58)*i/17,sn=Math.sin(a),cs=Math.cos(a),bottom=-.101+.007*Math.sin(i*1.9),wave=.004*Math.sin(i*1.7);
      const pts=[[sn*.024+.008,.164,cs*.022-.018],[sn*.080,.123,cs*.077-.014],[sn*.110+wave,.029,cs*.109-.010],[sn*.116+wave,-.055,cs*.113-.002],[sn*.106,bottom+.008,cs*.107+.002],[sn*.099,bottom,cs*.098+.008]];
      ribbonLock(h,`bob-lock-${i}`,pts,.022,.003,m.hairVariants[i%3]);
    }
    // A continuous swept fringe gives the sheet's soft hair curtain. Fine
    // fibres are in the embedded albedo, not nine sausage-shaped cylinders.
    const fringe=surface((u,v)=>{
      const endX=lerp(-.083,.083,u),part=.021;
      const tip=.042+.005*Math.sin(u*Math.PI)
        -.010*Math.exp(-(((u-.16)/.12)**2))
        -.012*Math.exp(-(((u-.46)/.15)**2))
        -.008*Math.exp(-(((u-.81)/.11)**2));
      const x=lerp(part+(u-.5)*.025,endX,Math.pow(v,.78));
      const y=lerp(.160-.009*(u-.5)**2,tip,Math.pow(v,1.44));
      const z=.019+.089*Math.sin(v*Math.PI*.49)-.013*(endX/.083)**2*smooth(v,.5,1);
      return [x,y,z+.0006*Math.sin(u*TAU*24)*Math.sin(v*Math.PI)];
    },96,28,true);
    const bang=mesh(h,'swept-fringe-surface',fringe,m.hair);bang.userData.castShadow=false;bang.userData.receiveShadow=false;
    for(const [i,x]of [-.075,-.041,.011,.064].entries())ribbonLock(h,`fringe-wisp-${i}`,[[x*.35+.012,.148,.058],[x,.075,.108],[x-.007,.032+i*.003,.103]],.003,.0008,m.hairVariants[1]);

  }else if(!male){
    for(const side of [-1,1])ribbonLock(h,`temple-lock-${side}`,[[side*.052,.144,.028],[side*.095,.065,.059],[side*.096,-.015,.046],[side*.081,-.077,.058],[side*.074,-.069,.063]],.011,.004,m.hairVariants[1]);
    for(let i=0;i<7;i++){const a=i/7*TAU;ribbonLock(h,`ponytail-lock-${i}`,[[Math.sin(a)*.012,-.04,-.104],[Math.sin(a)*.035,-.12,-.138+Math.cos(a)*.024],[Math.sin(a)*.038+.015,-.21,-.135+Math.cos(a)*.025],[Math.sin(a)*.016+.021,-.28,-.105]],.018,.008,m.hairVariants[i%3]);}
    const sweep=surface((u,v)=>{
      const xEnd=lerp(-.088,.063,u),tip=.021+.074*u;
      const x=lerp(.031+(u-.5)*.020,xEnd,Math.pow(v,.82));
      const y=lerp(.159-.009*(u-.5)**2,tip,Math.pow(v,1.30));
      const z=.015+.094*Math.sin(v*Math.PI*.52)-.018*(xEnd/.09)**2*smooth(v,.5,1);
      return [x,y,z];
    },72,24,true);
    const swept=mesh(h,'side-part-fringe',sweep,m.hair);swept.userData.castShadow=false;swept.userData.receiveShadow=false;
    for(let i=0;i<4;i++){const x=-.076+i*.023;ribbonLock(h,`swept-fringe-wisp-${i}`,[[.022,.151,.036],[x+.014,.098,.099],[x,.034+i*.012,.093]],.004,.001,m.hairVariants[1]);}
    for(let i=0;i<7;i++){const a=1.5+i*.50;ribbonLock(h,`gathered-hair-${i}`,[[Math.sin(a)*.025,.160,Math.cos(a)*.025-.015],[Math.sin(a)*.095,.077,Math.cos(a)*.103-.012],[Math.sin(a)*.070,-.026,Math.cos(a)*.092-.022],[0,-.075,-.114]],.020,.003,m.hairVariants[i%3]);}
    ellipsoid(h,'hair-tie',m.dark,[0,-.09,-.113],[.033,.012,.027]);
  }else{
    for(let i=0;i<10;i++){
      const x=(i-4.5)*.018,crown=.022+Math.sqrt(1-(x*.65/.104)**2)*.148;
      ribbonLock(h,`layered-short-lock-${i}`,[[x*.65+.020,crown,-.045],[x*.8+.028,crown+.006,.025],[x+.009,.115+.011*Math.cos(i),.098],[x-.020,.065+.015*Math.sin(i*.8),.104],[x-.027,.063+.015*Math.sin(i*.8),.096]],.021,.005,m.hairVariants[i%3]);
    }
    for(let i=0;i<9;i++){const a=1.2+i*.48;ribbonLock(h,`short-side-layer-${i}`,[[Math.sin(a)*.05,.14,Math.cos(a)*.05],[Math.sin(a)*.106,.064,Math.cos(a)*.106-.01],[Math.sin(a)*.096,.0,Math.cos(a)*.103-.01]],.021,.004,m.hairVariants[(i+1)%3]);}
    for(const side of [-1,1])ribbonLock(h,`sideburn-${side}`,[[side*.089,.07,-.006],[side*.092,-.025,.005]],.008,.004,m.hair);
  }
}

function glasses(r,m){
  for(const s of [-1,1]){
    const n=mesh(r.head,`round-glasses-${s<0?'right':'left'}`,new T.TorusGeometry(.032,.00085,8,56),m.metal,[s*.040,.004,.105]);n.scale.y=.96;n.rotation.y=s*.12;
    curve(r.head,`glasses-temple-${s}`,[[s*.072,.012,.097],[s*.089,.014,.057],[s*.094,.008,-.006]],.0013,m.metal,18);
  }
  curve(r.head,'glasses-bridge',[[-.009,.008,.109],[0,.012,.112],[.009,.008,.109]],.0009,m.metal,12);
  // +Z facing means the character's anatomical right is negative X.
  const clip=mesh(r.head,'anatomical-right-orange-clip',new T.CapsuleGeometry(.004,.025,4,12),m.orange,[-.081,.071,.103]);clip.rotation.z=1.75;clip.rotation.y=-.5;
}
function limbs(root,r,m,kind){
  const male=kind==='staff-b',zuri=kind==='zuri';
  for(const side of ['left','right']){
    const s=side==='left'?1:-1,sx=male?.185:.16,armTop=1.34,armBottom=zuri?.80:.91;
    const rows=[[armBottom,.031,.031,s*(sx+.075),0],[armBottom+.035,zuri?.051:.039,zuri?.044:.039,s*(sx+.071),0],[1.015,zuri?.070:.046,zuri?.055:.046,s*(sx+.044),0],[1.12,zuri?.065:.049,zuri?.054:.05,s*(sx+.030),0],[1.25,zuri?.062:.052,.052,s*(sx+.008),0],[1.296,.040,.037,s*(sx-.008),0],[1.316,.017,.016,s*(sx-.035),0],[1.320,.001,.001,s*(sx-.042),0]];
    bind(root,`${side}-sleeve`,clothFolds(loft(rows,32,38),rows,{cuff:armBottom,amplitude:zuri?.003:.0025,refined:zuri}),zuri?m.cardigan:m.shirt,(_x,y)=>{const t=smooth(y,1.0,1.12),attachment=smooth(y,1.26,1.32);return [[`${side}-elbow`,1-t],[`${side}-shoulder`,t*(1-attachment)],['chest',t*attachment]];},r);
    const cuffY=armBottom+.012,cuff=loft([[cuffY-.02,.030,.030,s*(sx+.075),0],[cuffY-.017,.035,.035,s*(sx+.075),0],[cuffY+.017,.036,.035,s*(sx+.074),0],[cuffY+.023,.033,.033,s*(sx+.074),0]],48,8,{fold:zuri?.024:.012});
    bind(root,`${side}-ribbed-cuff`,cuff,zuri?m.rib:m.shirt,()=>[[`${side}-elbow`,1]],r);
    if(!zuri)bind(root,`${side}-forearm`,loft([[.807,.026,.026,s*(sx+.075),0],[.86,.030,.028,s*(sx+.065),0],[.93,.035,.032,s*(sx+.056),0]],32,24),m.skin,()=>[[`${side}-elbow`,1]],r);
    // Palm with four individually tapered fingers and a curved opposed thumb.
    const hand=r[`${side}-hand`];mesh(hand,`${side}-palm`,loft([[-.067,.024,.014,s*.004,.003],[-.045,.030,.017,0,0],[-.008,.026,.019,0,0],[.015,.025,.024,0,0]],32,24),m.skin);
    for(let i=0;i<4;i++){
      const x=(i-1.5)*.0135,len=[.051,.062,.059,.046][i];
      mesh(hand,`${side}-finger-${i}`,loft([[-.053-len,.002,.003,x,.009],[-.046-len,.0055,.006,x,.009],[-.073,.0067,.007,x,.005],[-.049,.0075,.009,x,0]],12,14),m.skin);
      ellipsoid(hand,`${side}-nail-${i}`,m.nail,[x,-.045-len,.015],[.004,.007,.0012],12);
    }
    hairLock(hand,`${side}-thumb`,[[s*.025,-.021,0],[s*.04,-.045,.009],[s*.042,-.067,.016]],.009,.009,m.skin);
    // Wide tailored legs with longitudinal cloth folds, blended through knees.
    const legRows=[[.09,male?.064:zuri?.084:.077,.071,s*.088,.010],[.14,male?.071:zuri?.086:.080,.075,s*.088,.003],[.30,zuri?.079:.073,.075,s*.088,0],[.45,zuri?.076:.070,.074,s*.088,0],[.62,.080,.083,s*.088,0],[.77,.089,.091,s*.084,0],[.89,.082,.091,s*.084,0]];
    const leg=clothFolds(loft(legRows,36,42),legRows,{hem:.09,pleat:true,amplitude:.003,refined:zuri});
    bind(root,`${side}-trouser-leg`,leg,m.pants,(_x,y)=>{const knee=smooth(y,.39,.53),hip=smooth(y,.79,.89);return [[`${side}-knee`,1-knee],[`${side}-hip`,knee*(1-hip)],['hips',knee*hip]];},r);
    const ankle=r[`${side}-ankle`];
    const sole=loft([[-.08,.054,.115,0,.037],[-.071,.058,.120,0,.037],[-.056,.058,.120,0,.037],[-.051,.053,.113,0,.037]],32,12);
    mesh(ankle,`${side}-shoe-sole`,sole,zuri||kind==='staff-a'?m.cream:m.sole);
    const shoeRows=[[-.054,.055,.112,0,.035],[-.033,.053,.107,0,.035],[.006,.041,.071,0,.006],[.025,.031,.040,0,-.011]];
    mesh(ankle,`${side}-shoe-upper`,loft(shoeRows,32,20),zuri||kind==='staff-a'?m.cream:m.leather);
    const shoeTop=(x,z)=>{let y=.025;for(;y>-.054;y-=.0005){const [rx,rz,,cz]=profile(shoeRows,y);if((x/rx)**2+((z-cz)/rz)**2<=1)break;}return y+.001;};
    if(zuri){
      const accent=mesh(ankle,`${side}-shoe-orange-toe`,new T.SphereGeometry(1,24,12),m.orange,[0,-.055,.143],[.031,.019,.009]);
      for(const d of [-1,1])curve(ankle,`${side}-shoe-side-stripe-${d}`,[[-.025,-.01],[-.023,.025],[-.014,.052]].map(([y,z])=>{const [rx,rz,,cz]=profile(shoeRows,y);return [d*(rx*Math.sqrt(Math.max(0,1-((z-cz)/rz)**2))+.001),y,z];}),.0025,m.orange,12);
    }
    for(let i=0;i<5;i++)curve(ankle,`${side}-lace-${i}`,[-.025,0,.025].map(x=>{const z=.024+i*.012+(x===0?.004:0);return [x,shoeTop(x,z),z];}),.0017,m.laces,10);
  }
  bind(root,'trouser-waist',loft([[.79,.16,.103],[.85,.16,.099],[.93,.138,.085]],64,32),m.pants,()=>[['hips',1]],r);
  bind(root,'waistband',loft([[.905,.141,.089],[.936,.139,.088]],48,8),m.dark,()=>[['hips',1]],r);
  ellipsoid(r.hips,'waist-button',m.button,[0,.091,.09],[.006,.006,.002],16);
  for(const s of [-1,1]){
    curve(r.hips,`tailored-pocket-${s}`,[[s*.076,.071,.089],[s*.104,.025,.081],[s*.126,-.008,.064]],.001,m.seam,12);
    const loop=mesh(r.hips,`belt-loop-${s}`,new T.BoxGeometry(.010,.037,.005),m.pants,[s*.09,.091,.080]);loop.rotation.y=s*.15;
  }
  curve(r.hips,'trouser-fly',[[.007,.071,.105],[.009,.008,.108],[.002,-.016,.107]],.0009,m.seam,12);
}
function clothing(root,r,m,kind){
  const zuri=kind==='zuri',male=kind==='staff-b';
  bind(root,'neck-surface',loft([[1.26,.048,.073],[1.30,.048,.059],[1.325,.042,.048],[1.35,.033,.032],[1.40,.032,.030],[1.455,.038,.035]],32,30),m.skin,(_x,y)=>{const t=smooth(y,1.32,1.38);return [['chest',1-t],['neck',t]];},r);
  const bodyRows=[[.9,.137,.084],[.97,.134,.083],[1.04,.130,.081],[1.12,.142,.091],[1.22,male?.169:.151,.094],[1.285,male?.180:.166,.077],[1.313,male?.160:.143,.065],[1.345,.041,.034]];
  let body=surface((u,v)=>{const nominal=lerp(.9,1.345,v),gap=zuri?0:.42*smooth(nominal,1.255,1.345),a=lerp(gap,TAU-gap,u),y=zuri?lerp(.9,1.345-.038*Math.max(0,Math.cos(a))**6,v):nominal,[rx,rz]=profile(bodyRows,y);return [Math.sin(a)*rx,y,Math.cos(a)*rz];},48,42);
  bind(root,'undershirt',clothFolds(body,bodyRows,{hem:.9,amplitude:.0028}),zuri?m.dark:m.shirt,torsoWeights,r);
  if(zuri){
    const rows=[[.878,.160,.105],[.920,.173,.111],[1.05,.166,.110],[1.16,.173,.115],[1.25,.177,.10],[1.31,.159,.078],[1.35,.049,.044]],gap=y=>.34+.33*smooth(y,1.08,1.35);
    const g=clothFolds(surface((u,v)=>{const y=lerp(.878,1.35,v),[rx,rz]=profile(rows,y),a=lerp(gap(y),TAU-gap(y),u);return [Math.sin(a)*rx,y,Math.cos(a)*rz];},48,44),rows,{hem:.878,amplitude:.0028,refined:true});
    bind(root,'cardigan',g,m.cardigan,torsoWeights,r);
    for(const s of [-1,1]){
      const trim=surface((u,v)=>{const y=lerp(.88,1.35,v),[rx,rz]=profile(rows,y),a=gap(y)+u*.13;return [s*Math.sin(a)*rx,y,Math.cos(a)*rz+.0035+Math.sin(u*Math.PI*12)*.00045];},24,42,s>0);
      bind(root,`cardigan-placket-${s}`,trim,m.rib,torsoWeights,r);
      const pocket=surface((u,v)=>{
        const y=lerp(.925,1.015,v),[rx,rz]=profile(rows,y),a=lerp(.50,.91,u),puff=.005*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);
        return [s*Math.sin(a)*(rx+puff),y,Math.cos(a)*(rz+puff)+.006];
      },12,12,s>0);
      bind(root,`cardigan-patch-pocket-${s}`,pocket,m.cardigan,torsoWeights,r);
    }
    const hem=surface((u,v)=>{const y=lerp(.876,.905,v),[rx,rz]=profile(rows,y),a=lerp(.34,TAU-.34,u),rib=.001*Math.sin(u*TAU*65);return [Math.sin(a)*(rx+.002+rib),y,Math.cos(a)*(rz+.003+rib)];},128,5);
    bind(root,'cardigan-ribbed-hem',hem,m.rib,torsoWeights,r);
    for(let i=0;i<5;i++){const y=.924+i*.072,[rx,rz]=profile(rows,y),a=gap(y)+.06;ellipsoid(r.spine,`cardigan-button-${i}`,m.button,[Math.sin(a)*rx,y-.935,Math.cos(a)*rz+.007],[.0055,.0055,.0018],12);}
  }else{
    for(const s of [-1,1]){
      const collar=surface((u,v)=>{const a=V(s*.017,1.345,.040).lerp(V(s*.063,1.327,.056),u),b=V(s*.027,1.289,.094).lerp(V(s*.079,1.264,.087),u),p=a.lerp(b,v);p.z+=.004*Math.sin(Math.PI*v);return p.toArray();},12,12,s>0);
      bind(root,`shirt-collar-${s}`,collar,m.shirt,torsoWeights,r);
    }
    const placket=surface((u,v)=>{const y=lerp(.938,1.287,v),[,rz]=profile(bodyRows,y);return [lerp(-.006,.006,u),y,rz+.004];},4,28,true);
    bind(root,'shirt-button-placket',placket,m.shirt,torsoWeights,r);
    for(let i=0;i<6;i++){const y=.97+i*.054,[,rz]=profile(bodyRows,y);ellipsoid(r.spine,`shirt-button-${i}`,m.button,[0,y-.935,rz+.006],[.0027,.0027,.0015],10);}
  }
}

export function createHumanCharacter(kind='zuri'){
  if(!['zuri','staff-a','staff-b'].includes(kind))throw Error(`Unknown character: ${kind}`);
  const root=new T.Group();root.name=kind;root.userData={characterId:kind,source:'approved-brand-study/2026-10-25',units:'metres',bodyHeight:kind==='zuri'?1.6:kind==='staff-a'?1.6:1.73,quality:'model-review'};
  const r=createRig(root,kind==='staff-b');Object.defineProperty(root.userData,'rig',{value:r,enumerable:false});
  const m={skin:material('skin',SKIN,.72),face:material('face',0xffffff,.80,{vertexColors:true,emissive:0xe8a580,emissiveIntensity:.045}),skinShadow:material('ear-fold',0xdfa98e,.8),lid:material('soft-lid-fold',0xe8bba4,.8),nail:material('natural-nail',0xf3d3c3,.46),
    hair:material('brown-hair',HAIR,.55),hairShine:material('hair-strand',0x684532,.47),hairVariants:[material('hair-dark',0x43291f,.55,{vertexColors:true}),material('hair-mid',0x553326,.53,{vertexColors:true}),material('hair-light',0x604030,.56,{vertexColors:true})],
    white:material('eye-white',0xfff8ed,.29),iris:material('brown-iris',0xffffff,.35,{vertexColors:true}),pupil:material('pupil',0x16100e,.22),glint:material('eye-catchlight',0xffffff,.12,{emissive:0x77736d}),
    lipSurface:material('soft-lip-surface',0xffffff,.7,{vertexColors:true}),lip:material('lip-line',0xa7625c,.8),lipLight:material('lip-soft',0xe6a291,.67),lash:material('eyelash',0x392522,.8),metal:material('warm-glasses-metal',0x978270,.35,{metalness:.35}),
    dark:material('charcoal-cotton',0x303139,.89),cardigan:material('windowpane-knit',0xfff4e6,.91,{side:T.DoubleSide}),rib:material('ribbed-cream',0xf6e8d2,.94,{side:T.DoubleSide}),
    shirt:material('staff-shirt',kind==='staff-a'?0xf5e5d3:0x536989,.88,{side:T.DoubleSide}),pants:material('tailored-trousers',kind==='staff-a'?0xb8684b:0x36363c,.9),seam:material('tailoring-seam',kind==='staff-a'?0x8c4732:0x25262c,.9),
    orange:material('amber-citrus',0xe8820c,.4),cream:material('cream-sneaker',0xf3eadb,.64),sole:material('shoe-sole',0x3c3028,.88),laces:material('shoe-laces',0xf5eddd,.86),leather:material('brown-shoe',0x76513b,.55),button:material('button',0xbd9c70,.5)};
  if(kind==='zuri'){
    m.skin.color.setHex(0xffd2b5);m.skin.roughness=.58;
    m.cardigan=new T.MeshPhysicalMaterial({name:'windowpane-knit',color:0xfff4e6,roughness:.88,sheen:.35,sheenColor:0xddd0be,sheenRoughness:.85,side:T.DoubleSide});
    m.pants=new T.MeshPhysicalMaterial({name:'tailored-trousers',color:0x36363c,roughness:.77,sheen:.18,sheenColor:0x66616a,sheenRoughness:.8});
    createZuriHead(r,m,{surface,mesh,ellipsoid,curve});
    root.userData.authorship='local-zuri-sculpt-v1';
  }else{makeFace(r,m,kind);makeHair(r,m,kind);}
  r.head.traverse(n=>{if(n.isMesh){n.userData.receiveShadow=false;if(/glasses|clip/.test(n.name))n.userData.castShadow=false;}});clothing(root,r,m,kind);limbs(root,r,m,kind);
  r.head.scale.setScalar(kind==='zuri'?1.12:kind==='staff-a'?1.06:1.02);
  r.fingers=[];root.traverse(n=>{if(n.isMesh&&n.name.includes('-finger-'))r.fingers.push(n);});
  root.traverse(n=>{if(n.isMesh&&n.material.name==='windowpane-knit'){const uv=n.geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*(n.name==='cardigan'?4:1.3),uv.getY(i)*2);}});
  if(kind==='staff-b')root.scale.setScalar(1.08125);
  poseHumanCharacter(root,{action:'idle',time:0});return root;
}

export function poseHumanCharacter(root,{action='idle',time=0}={}){
  const r=root.userData.rig;if(!r)return;const t=Number.isFinite(time)?time:0;
  for(const b of r.bones)b.rotation.set(0,0,0);r.hips.position.set(0,.83,0);
  for(const side of ['left','right'])r[`${side}-ankle`].position.y=-.37;
  for(const finger of r.fingers)finger.rotation.set(0,0,0);
  const walk=action==='walking',sit=action==='seated',loop=t*TAU/(walk?1.12:action==='wave'?TAU/5:4);
  const blink=action==='idle'||sit?Math.exp(-((Math.sin((loop-5.1)/2)/.09)**2)):0;
  for(const s of [-1,1])root.getObjectByName(`eyelid-rig-${s}`).scale.y=1-.98*blink;
  for(const s of [-1,1]){
    const lid=root.getObjectByName(`blink-cover-${s}`);
    if(lid){const closing=blink>.025?blink:0;lid.scale.y=closing;lid.position.y=.038+.026*(1-closing);root.getObjectByName(`eyelid-rig-${s}`).position.y=.038-.026*closing;}
  }
  r.chest.rotation.x=.008*Math.sin(loop);r.head.rotation.y=.016*Math.sin(loop);r.head.rotation.z=.018;
  if(walk){
    const phase=t*TAU/1.12,s=Math.sin(phase);r.hips.position.y=.83+.008*(1-Math.cos(phase*2));r.hips.position.x=.008*s;r.hips.rotation.y=.035*Math.cos(phase);r.hips.rotation.z=.014*s;r.chest.rotation.y=-r.hips.rotation.y*.75;r.chest.rotation.z=-r.hips.rotation.z*.6;r.head.rotation.z=-r.hips.rotation.z*.3;
    for(const [side,offset]of [['left',0],['right',Math.PI]]){
      const p=phase+offset,swing=Math.max(0,Math.sin(p)),hip=.30*Math.cos(p),knee=.025+.59*swing*swing;
      r[`${side}-hip`].rotation.x=hip;r[`${side}-knee`].rotation.x=knee;
      r[`${side}-ankle`].rotation.x=-hip-knee+.10*swing;
      r[`${side}-shoulder`].rotation.x=-.19*Math.cos(p);r[`${side}-shoulder`].rotation.z=side==='left'?.025:-.025;
      r[`${side}-elbow`].rotation.x=-.16-.08*swing;r[`${side}-hand`].rotation.x=.06;
    }
  }else if(sit){
    r.hips.position.y=.45;r.chest.rotation.x=.065+.003*Math.sin(loop);r.head.rotation.x=.07;r.head.rotation.z=.012;
    for(const [side,phase]of [['left',0],['right',1]]){
      const hip=side==='left'?-1.54:-1.57;
      r[`${side}-hip`].rotation.x=hip;r[`${side}-knee`].rotation.x=-hip;
      r[`${side}-shoulder`].rotation.x=-.72;r[`${side}-elbow`].rotation.x=-1.21;
      // A relaxed wrist levels the hand above the 0.7675 m tabletop. Contact
      // tests measure palm/finger surfaces, not only the wrist bone origin.
      r[`${side}-hand`].rotation.x=.294+.012*Math.sin(loop*3+phase);
    }
    r.fingers.forEach((finger,i)=>{finger.rotation.x=.025*Math.sin(loop*3+i*.8);});
  }else{
    for(const side of ['left','right'])r[`${side}-elbow`].rotation.x=-.06;
    r['left-shoulder'].rotation.z=.045;r['right-shoulder'].rotation.z=-.045;
    if(action==='wave'){r['right-shoulder'].rotation.z=-1.05;r['right-shoulder'].rotation.x=-.05;r['right-elbow'].rotation.z=-1.75;r['right-elbow'].rotation.x=-.15;r['right-hand'].rotation.z=.20*Math.sin(t*5);}
    if(action==='point'){r['left-shoulder'].rotation.x=-1.03;r['left-shoulder'].rotation.z=.28;r['left-elbow'].rotation.x=-.30;r.head.rotation.y=.10;}
  }
  root.updateMatrixWorld(true);
  if(sit){
    // Feet rest on the floor independently; no floating heel from an asymmetric
    // thigh angle. The tiny correction belongs to the ankle, not scene motion.
    const inverse=root.matrixWorld.clone().invert(),point=new T.Vector3();
    for(const side of ['left','right']){const sole=root.getObjectByName(`${side}-shoe-sole`),p=sole.geometry.attributes.position;let y=Infinity;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(sole.matrixWorld).applyMatrix4(inverse);y=Math.min(y,point.y);}r[`${side}-ankle`].position.y-=y;}
    root.updateMatrixWorld(true);
  }
  if(walk){
    // Keep the supporting sole planted; this correction stays inside the rig,
    // leaving scene translation and navigation entirely with the caller.
    const inverse=root.matrixWorld.clone().invert(),point=new T.Vector3();let floor=Infinity;
    for(const side of ['left','right']){const sole=root.getObjectByName(`${side}-shoe-sole`),p=sole.geometry.attributes.position;for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i).applyMatrix4(sole.matrixWorld).applyMatrix4(inverse);floor=Math.min(floor,point.y);}}
    r.hips.position.y-=floor;root.updateMatrixWorld(true);
  }
  r.skeleton.update();
}
