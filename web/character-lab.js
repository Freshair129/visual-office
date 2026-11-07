import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {setCharacterDownload,characterModelPath,availableCharacterActions,selectedCharacterAction,isImportedCharacter,importedCharacterIds,initialCharacterSelection,characterReviewScope,isZuriAdaptation} from './characters/lab-state.js';
import {createLabEnvironment} from './characters/lab-lighting.js';
import {characterReference} from './characters/sheet-reference.js';
import {HUMAN_DESK} from './characters/lab-furniture.js';
import {createOfficeCharacter,updateOfficeCharacter,disposeOfficeCharacter} from './office-characters.js';
import {optionalAssetPlaceholder,watchOptionalAssetImages} from './optional-assets.js';
import {visibleAnimation,pauseOnReducedMotion} from './visible-animation.js';

const $=s=>document.querySelector(s),canvas=$('#stage'),status=$('#status'),loader=new GLTFLoader();
watchOptionalAssetImages(document);
// The parent dialog owns the return action; keep the Studio draft mounted.
if(window.self!==window.top)$('header .brand').remove();
// Embedded GLB images use the browser's image decoder directly. The synthetic
// harness deliberately prohibits fetch(blob:) through its connect-src policy.
// TextureLoader needs no network request beyond the already loaded GLB bytes.
loader.register(parser=>{parser.textureLoader=new T.TextureLoader(parser.options.manager);return {name:'character-local-image-decoder'};});
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();scene.background=new T.Color(0xeeeae0);scene.fog=new T.Fog(0xeeeae0,10,24);
const studioEnvironment=createLabEnvironment(renderer);scene.environment=studioEnvironment.texture;scene.environmentIntensity=.32;
const camera=new T.PerspectiveCamera(32,1,.01,50),controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=.28;controls.maxDistance=8;controls.maxPolarAngle=Math.PI*.49;
scene.add(new T.HemisphereLight(0xfff9f0,0xb0bbc2,1.45));
const key=new T.DirectionalLight(0xfffaf3,2);key.position.set(-3,5,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-2;key.shadow.bias=-.0001;scene.add(key);
key.shadow.normalBias=.003;key.shadow.camera.near=.1;key.shadow.camera.far=14;
const fill=new T.DirectionalLight(0xddeaff,.65);fill.position.set(4,2,3);scene.add(fill);const rim=new T.DirectionalLight(0xffe7c9,1.3);rim.position.set(2,4,-3);scene.add(rim);
const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0xe4dfd3,roughness:.95}));ground.rotation.x=-Math.PI/2;ground.position.y=-.004;ground.receiveShadow=true;scene.add(ground);
const context=new T.Group();scene.add(context);context.visible=false;
function box(name,w,h,d,x,y,z,color,parent=context){const n=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color,roughness:.85}));n.name=name;n.position.set(x,y,z);n.castShadow=n.receiveShadow=true;parent.add(n);return n;}
box('reference-seat',.42,.07,.4,0,.375,-.035,0xa3b3a4);box('reference-back',.42,.42,.06,0,.62,-.25,0xa3b3a4);for(const x of [-.16,.16])for(const z of [-.18,.10])box('chair-leg',.028,.34,.028,x,.17,z,0x706c61);
box('work-surface',HUMAN_DESK.width,HUMAN_DESK.thickness,HUMAN_DESK.depth,0,HUMAN_DESK.y,HUMAN_DESK.z,0xc9ae7b);for(const x of [-.36,.36])for(const z of [.48,.81])box('desk-leg',.028,.73,.028,x,.365,z,0x777d78);
const humanContext=new T.Group(),robotContext=new T.Group();for(const n of [...context.children])humanContext.add(n);context.add(humanContext,robotContext);
box('robot-seat',.33,.05,.30,0,.175,-.03,0xa3b3a4,robotContext);box('robot-seat-base',.20,.15,.20,0,.075,-.03,0x706c61,robotContext);box('robot-work-surface',.52,.025,.28,0,.32,.31,0xc9ae7b,robotContext);
for(const x of [-.21,.21])box('robot-desk-leg',.025,.31,.025,x,.155,.32,0x777d78,robotContext);
const candidateMeta=new Map();
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');let actor=null,mixer=null,clips=[],current='zuri',version='current',action='idle',generation=0,paused=motionPreference.matches,spin=false,manifest=null,beforeMeta=null,pilotMeta=null,headMeta=null,activeAction=null;
$('#pause').setAttribute('aria-pressed',String(paused));$('#pause').textContent=paused?'เล่นแอนิเมชัน':'หยุดแอนิเมชัน';
const stopPreference=pauseOnReducedMotion(motionPreference,()=>{paused=true;$('#pause').setAttribute('aria-pressed','true');$('#pause').textContent='เล่นแอนิเมชัน';});
function dispose(root){if(root?.userData?.officeCharacter){disposeOfficeCharacter(root);return;}const gs=new Set(),ms=new Set(),ts=new Set(),sk=new Set();root?.traverse(n=>{if(n.geometry)gs.add(n.geometry);for(const m of(Array.isArray(n.material)?n.material:[n.material]))if(m){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}if(n.skeleton)sk.add(n.skeleton);});for(const set of [sk,ts,ms,gs])set.forEach(x=>x.dispose());root?.removeFromParent();}
function setView(view){
  const robot=current==='wangjai',h=robot?.9:isImportedCharacter(current)?1.65:current==='staff-b'?1.73:1.6;
  const faceView=view.startsWith('face');
  const imported=candidateMeta.get(current);
  const point=faceView&&imported?.facePoint?new T.Vector3(...imported.facePoint):faceView?new T.Vector3(0,version==='blender'?1.455:h*(robot?.76:.935),0):new T.Vector3(0,h*.51,0);
  const distance=faceView?(imported?.faceDistance||h*(version==='blender'?.38:.48)):h*2.1;
  const direction={front:[0,.035,1],side:[1,.04,0],back:[0,.04,-1],office:[1,.73,1],face:[0,.015,1],'face-quarter':[.6,.03,1],'face-side':[1,.015,0]}[view]||[0,.035,1];
  controls.target.copy(point);camera.position.copy(point).add(new T.Vector3(...direction).normalize().multiplyScalar(distance));controls.update();
}
function refreshActions(){const available=availableCharacterActions(clips);document.querySelectorAll('[data-action]').forEach(b=>{b.disabled=!available.includes(b.dataset.action);if(b.disabled)b.setAttribute('aria-pressed','false');});$('#context').disabled=!available.includes('seated');$('#pause').disabled=!available.length;context.visible=false;return available;}
function play(name){const clip=clips.find(c=>c.name===name);document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(Boolean(clip)&&b.dataset.action===name)));if(!mixer||!clip){context.visible=false;return;}action=name;mixer.stopAllAction();activeAction=mixer.clipAction(clip);activeAction.reset().play();mixer.update(0);context.visible=$('#context').checked&&name==='seated';humanContext.visible=current!=='wangjai';robotContext.visible=current==='wangjai';context.scale.setScalar(current==='staff-b'?1.08125:1);}
function updateReference(){
  const select=$('#reference-view');for(const option of select.options)if(option.value.startsWith('tripo-'))option.disabled=current!=='zuri';
  if(current!=='zuri'&&select.value.startsWith('tripo-'))select.value='front';
  const ref=characterReference(isImportedCharacter(current)?'zuri':current,select.value);if(!ref)return;
  const sheetImage=$('#sheet-image');sheetImage.onerror=()=>{if(!sheetImage.getAttribute('href')?.startsWith('data:image/svg+xml,'))sheetImage.setAttribute('href',optionalAssetPlaceholder('Character reference'));};
  sheetImage.setAttribute('href',ref.src);$('#sheet-image').setAttribute('width',ref.width||1536);$('#sheet-image').setAttribute('height',ref.height||1024);
  $('#sheet-crop').setAttribute('viewBox',ref.box.join(' '));for(const [i,key]of ['x','y','width','height'].entries())$('#reference-clip-rect').setAttribute(key,ref.box[i]);
  $('#reference-caption').textContent=isZuriAdaptation(current)?'ชีต Zuri ที่อนุมัติ · ใช้เทียบโมเดลปรับจาก Anime Girl':isImportedCharacter(current)?'ชีตเป้าหมาย Zuri · โมเดลสำเร็จรูปนี้ยังไม่ได้ปรับเป็น Zuri':ref.caption||'ภาพต้นฉบับจากชีตที่อนุมัติ';
}
async function load(id,nextVersion='current',preserveView=false){
  const modelPath=characterModelPath(id,nextVersion);if(!modelPath)return;
  current=id;version=nextVersion;$('#model-version').value=version;$('#model-version').disabled=id!=='zuri';
  $('#revision-control').hidden=id!=='zuri';
  const poseTime=preserveView?(mixer?.time||0):0;
  const request=++generation;status.textContent='กำลังโหลดไฟล์ GLB…';setCharacterDownload($('#download'),id,false,version);clips=[];refreshActions();activeAction=null;
  $('#candidate-credit').hidden=true;$('#candidate-credit').replaceChildren();
  $('#details').textContent='';updateReference();
  document.querySelectorAll('[data-character]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.character===id)));
  if(mixer){mixer.stopAllAction();mixer.uncacheRoot(actor);mixer=null;}dispose(actor);actor=null;
  try{
    const gltf=await loader.loadAsync(modelPath);
    if(request!==generation){dispose(gltf.scene);return;}actor=gltf.scene;scene.add(actor);actor.traverse(n=>{if(n.isMesh){n.castShadow=n.userData.castShadow!==false;n.receiveShadow=n.userData.receiveShadow!==false;n.frustumCulled=false;const mats=Array.isArray(n.material)?n.material:[n.material];mats.forEach(m=>m.wireframe=$('#wire').checked);}});
    clips=gltf.animations;mixer=new T.AnimationMixer(actor);refreshActions();play(selectedCharacterAction(clips,action));if(preserveView)mixer.setTime(poseTime);else setView(version==='blender'||isImportedCharacter(id)?'face':'front');status.textContent=`${{zuri:'Zuri · ซูริ',wangjai:'Wangjai · น้องวางใจ','staff-a':'Staff A','staff-b':'Staff B'}[id]} · ${id==='zuri'?({before:'ก่อนปรับ',blender:'แก้ใบหน้า · ตรวจงานภาพ · ยังไม่มีแอนิเมชัน',rejected:'MPFB เดิม · ไม่ผ่านรีวิว',current:'รุ่นปรับรายละเอียด'}[version]):'GLB พร้อมทดสอบ'}`;
    const meta=version==='blender'?headMeta:version==='rejected'?pilotMeta:version==='before'?beforeMeta:manifest?.assets.find(a=>a.id===id);$('#details').textContent=meta?`${meta.triangles.toLocaleString()} triangles · ${(meta.bytes/1024/1024).toFixed(2)} MiB · ${clips.length} animations · ${version==='blender'?'หัว / ตา / ผม / แว่นใหม่ · ใช้ลำตัวเดิมเทียบสเกล · รอตรวจงานภาพ':version==='rejected'?'รุ่นที่ไม่ผ่านรีวิว เก็บไว้เปรียบเทียบ':id==='wangjai'?'สูง 0.90 ม. เป็นสเกลทดลอง':id==='zuri'?'สเกลตัว 1.60 ม. + ผมและรองเท้า':'พนักงานตัวอย่าง ไม่ผูก role'}`:'';
    setCharacterDownload($('#download'),id,true,version);
    if(isImportedCharacter(id)){
      const meta=candidateMeta.get(id),adapted=isZuriAdaptation(id),name=adapted?(id==='zuri-face-r4'?'Zuri · แก้ใบหน้า':'Zuri · รุ่นก่อนแก้หน้า'):id==='anime'?'Rigged Anime Girl':'Rain';
      status.textContent=adapted?`${name} · รุ่น ${meta?.revision||1} · ${id==='zuri-face-r4'?'สันจมูก / ปาก / คางแบบ 3D':'เก็บหน้า / ผม / ชุดตามชีต'} · รอตรวจงานภาพ`:`${name} · โมเดลสำเร็จรูปทดลอง · ยังไม่มีคลิปเดิน / นั่ง`;
      $('#details').textContent=meta?`${meta.triangles.toLocaleString()} triangles · ${(meta.bytes/1048576).toFixed(2)} MiB · ${meta.skins?'มี skin ใน GLB':'GLB ภาพนิ่ง · rig อยู่ในไฟล์ Blender ต้นฉบับ'} · สูงแสดงผล 1.65 ม. · ${adapted?`${clips.length} คลิปทดลอง · ${characterReviewScope(id)}`:'ยังไม่ปรับเป็น Zuri'}`:'โมเดลทดลอง · ไม่ใช้ในชั้นจริง';
      const credit=$('#candidate-credit');credit.hidden=false;
      credit.append(document.createTextNode(`${meta?.attribution||name} · ${meta?.license||'ดูสิทธิ์ในไฟล์ชุดโมเดล'} · `));
      const link=document.createElement('a');link.textContent='ที่มาและสิทธิ์ใช้งาน';link.href=id!=='rain'?'https://www.blendkit.com/asset-gallery-detail/1d63f553-863b-41d4-b3bd-d92222700fee/':'https://studio.blender.org/characters/rain/v3/';link.target='_blank';link.rel='noopener noreferrer';credit.append(link);
    }
  }catch(e){if(request===generation){
    const fallback=createOfficeCharacter(0),bounds=new T.Box3().setFromObject(fallback),height=bounds.getSize(new T.Vector3()).y;
    if(height>0)fallback.scale.setScalar(1.6/height);fallback.userData.proceduralPreview=true;actor=fallback;scene.add(actor);clips=[];mixer=null;activeAction=null;
    refreshActions();setView('front');status.textContent='ไฟล์ตัวละครภายนอกยังไม่มี · แสดงตัวละครตัวอย่างแบบ procedural';
    $('#details').textContent='โมเดลตัวอย่างนี้เป็นรูปทรงที่สร้างจากโค้ดในเครื่อง';setCharacterDownload($('#download'),id,false,version);
  }}
}
document.querySelectorAll('[data-character]').forEach(b=>b.addEventListener('click',()=>load(b.dataset.character,'current',isZuriAdaptation(current)&&isZuriAdaptation(b.dataset.character))));
$('#model-version').onchange=()=>load(current,$('#model-version').value,true);
$('#light-angle').oninput=()=>{const degrees=Number($('#light-angle').value),a=degrees*Math.PI/180;key.position.set(Math.sin(a)*5,3.5,Math.cos(a)*5);scene.environmentRotation.y=a;$('#light-value').textContent=`${degrees}°`;};
$('#light-angle').oninput();
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>play(b.dataset.action)));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
$('#pause').onclick=()=>{paused=!paused;$('#pause').setAttribute('aria-pressed',String(paused));$('#pause').textContent=paused?'เล่นแอนิเมชัน':'หยุดแอนิเมชัน';};
$('#spin').onclick=()=>{spin=!spin;$('#spin').setAttribute('aria-pressed',String(spin));};
$('#context').onchange=()=>{context.visible=$('#context').checked&&action==='seated';};
$('#wire').onchange=()=>actor?.traverse(n=>{for(const m of(Array.isArray(n.material)?n.material:[n.material]))if(m)m.wireframe=$('#wire').checked;});
$('#compare').onclick=()=>{const show=$('#reference').hidden;$('#reference').hidden=!show;$('.review-layout').classList.toggle('is-comparing',show);$('#compare').setAttribute('aria-pressed',String(show));};
$('#reference-view').onchange=updateReference;
const resize=new ResizeObserver(()=>{const {width,height}=canvas.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();});resize.observe(canvas);
let animationTime=0;const stopRender=visibleAnimation(document,cb=>requestAnimationFrame(cb),id=>cancelAnimationFrame(id),dt=>{if(!paused){animationTime+=dt;mixer?.update(dt);if(actor?.userData?.officeCharacter)updateOfficeCharacter(actor,{action:'idle',time:animationTime,dt});}controls.autoRotate=spin&&!paused;controls.autoRotateSpeed=1;controls.update();renderer.render(scene,camera);});
const selection=initialCharacterSelection(new URLSearchParams(location.search).get('model'));
const requestedModel=selection.version==='blender'?'blender':selection.id;
const reviewHead=requestedModel==='blender'||isImportedCharacter(requestedModel);
if(reviewHead){$('#reference-view').value='face';$('#reference').hidden=false;$('.review-layout').classList.add('is-comparing');$('#compare').setAttribute('aria-pressed','true');}
Promise.all([...importedCharacterIds.map(id=>fetch(`./assets/models/characters/candidates/${id}.json`).then(r=>{if(!r.ok)throw Error('candidate metadata');return r.json();}).then(m=>candidateMeta.set(id,m)).catch(()=>{})),fetch('./assets/models/characters/reviews/zuri-head-revision.json').then(r=>{if(!r.ok)throw Error('head metadata');return r.json();}).then(m=>{headMeta=m;}).catch(()=>{}),fetch('./assets/models/characters/manifest.json').then(r=>{if(!r.ok)throw Error('manifest');return r.json();}).then(m=>{manifest=m;}).catch(()=>{}),fetch('./assets/models/characters/reviews/zuri-before-refinement.json').then(r=>{if(!r.ok)throw Error('before metadata');return r.json();}).then(m=>{beforeMeta=m;}).catch(()=>{}),fetch('./assets/models/characters/reviews/zuri-blender-pilot.json').then(r=>{if(!r.ok)throw Error('pilot metadata');return r.json();}).then(m=>{pilotMeta=m;}).catch(()=>{})]).finally(()=>load(selection.id,selection.version));
window.addEventListener('pagehide',()=>{generation++;stopRender();stopPreference();resize.disconnect();controls.dispose();mixer?.stopAllAction();if(actor)mixer?.uncacheRoot(actor);dispose(actor);dispose(context);dispose(ground);studioEnvironment.dispose();renderer.dispose();},{once:true});
