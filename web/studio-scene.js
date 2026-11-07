import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeStudioDesk,makeStudioRoom,makeStudioPlant,makeStudioMannequin,disposeStudioObject,batchStudioScene,STUDIO_SLOTS,DESK_ANCHORS} from './studio-models.js';

export class StudioScene {
  constructor(container,{onSelect,onMetrics,onUnavailable}={}) {
    this.container=container;this.onSelect=onSelect;this.onMetrics=onMetrics;this.onUnavailable=onUnavailable;this.disposed=false;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#e8eddd');
    this.camera=new THREE.OrthographicCamera(-8,8,6,-6,.1,100);
    this.camera.position.set(12,11,15);
    try {
      this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
      this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.75));
      this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      this.renderer.outputColorSpace=THREE.SRGBColorSpace;
      this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
      this.renderer.domElement.setAttribute('aria-label','ห้องทดลอง 3D ลากเพื่อหมุนหรือเลือกโต๊ะจากปุ่มด้านข้าง');
      this.container.append(this.renderer.domElement);
      this.controls=new OrbitControls(this.camera,this.renderer.domElement);
      this.controls.enablePan=false;this.controls.enableDamping=false;
      this.controls.minPolarAngle=.42;this.controls.maxPolarAngle=1.35;
      this.controls.minZoom=.65;this.controls.maxZoom=1.8;
      this.controls.target.set(0,.65,0);
      this.controls.update();
      this.scene.add(new THREE.HemisphereLight('#fffbeb','#829177',2));
      const sun=new THREE.DirectionalLight('#fff0d0',2.5);sun.position.set(2,13,9);sun.castShadow=true;
      sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;
      sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.normalBias=.04;this.scene.add(sun);
      this.selection=new THREE.Mesh(new THREE.RingGeometry(.94,1.01,48),new THREE.MeshBasicMaterial({color:'#d18a26',side:THREE.DoubleSide}));
      this.selection.rotation.x=-Math.PI/2;this.selection.position.y=.055;this.selection.visible=false;this.scene.add(this.selection);
      this.onChange=()=>this.invalidate();this.controls.addEventListener('change',this.onChange);
      this.onDown=event=>{this.down=[event.clientX,event.clientY];};
      this.onUp=event=>{
        if(!this.down||Math.hypot(event.clientX-this.down[0],event.clientY-this.down[1])>5)return;
        const r=this.renderer.domElement.getBoundingClientRect();
        const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),this.camera);
        const point=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.84),new THREE.Vector3());
        if(point){const slot=STUDIO_SLOTS.findIndex(([x,,z])=>Math.abs(point.x-x)<.95&&Math.abs(point.z-z)<.5);if(slot>=0)this.onSelect?.(slot);}
      };
      this.onLost=event=>{event.preventDefault();this.unavailable=true;if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;this.onUnavailable?.();};
      this.onVisibility=()=>{if(document.hidden){if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;}else this.invalidate();};
      this.renderer.domElement.addEventListener('pointerdown',this.onDown);
      this.renderer.domElement.addEventListener('pointerup',this.onUp);
      this.renderer.domElement.addEventListener('webglcontextlost',this.onLost);
      document.addEventListener('visibilitychange',this.onVisibility);
      this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);
      this.resize();
    } catch(error) {this.dispose();throw error;}
  }
  setState(state) {
    if(this.disposed)return;
    if(this.content){this.scene.remove(this.content);disposeStudioObject(this.content);}
    this.content=new THREE.Group();this.content.add(makeStudioRoom(state.room,state.wing));
    state.desks.forEach((level,index)=>{
      const desk=makeStudioDesk(level);desk.position.fromArray(STUDIO_SLOTS[index]);this.content.add(desk);
    });
    const plant=makeStudioPlant();plant.position.fromArray([[-2.9,0,.1],[2.6,0,2.9],[3.65,0,-1.4]][state.plant]);this.content.add(plant);
    if(state.mannequin){
      const person=makeStudioMannequin();person.position.fromArray(STUDIO_SLOTS[0]).add(new THREE.Vector3(...DESK_ANCHORS.seat));this.content.add(person);
    }
    this.content=batchStudioScene(this.content);this.scene.add(this.content);
    const refit=this.wing!==state.wing;this.wing=state.wing;
    if(refit)this.resetCamera();else this.invalidate();
  }
  select(index) {
    this.selection.visible=Number.isInteger(index)&&index>=0&&index<4;
    if(this.selection.visible){this.selection.position.x=STUDIO_SLOTS[index][0];this.selection.position.z=STUDIO_SLOTS[index][2]+.3;}
    this.invalidate();
  }
  resize() {
    if(this.disposed)return;
    const {width,height}=this.container.getBoundingClientRect();if(!width||!height)return;
    const aspect=width/height, span=Math.max(6.3,(this.wing?9.1:7.3)/aspect);
    this.camera.left=-span*aspect;this.camera.right=span*aspect;this.camera.top=span;this.camera.bottom=-span;
    this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);this.invalidate();
  }
  resetCamera() {
    if(this.disposed)return;
    const x=this.wing?1:0;this.controls.target.set(x,.65,0);this.camera.position.set(x+12,11,15);this.camera.zoom=1;
    this.controls.update();this.resize();
  }
  zoom(delta){this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom+delta,.65,1.8);this.camera.updateProjectionMatrix();this.invalidate();}
  rotate(){const offset=this.camera.position.clone().sub(this.controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),Math.PI/8);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();this.invalidate();}
  invalidate() {
    if(this.disposed||this.unavailable||document.hidden||this.frame)return;
    this.frame=requestAnimationFrame(()=>{
      this.frame=null;if(this.disposed||this.unavailable||document.hidden)return;
      this.renderer.render(this.scene,this.camera);
      const {render,memory}=this.renderer.info;
      this.onMetrics?.({triangles:render.triangles,calls:render.calls,geometries:memory.geometries});
    });
  }
  dispose() {
    if(this.disposed)return;this.disposed=true;
    if(this.frame)cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    if(this.onVisibility)document.removeEventListener('visibilitychange',this.onVisibility);
    if(this.controls){this.controls.removeEventListener('change',this.onChange);this.controls.dispose();}
    if(this.renderer){
      this.renderer.domElement.removeEventListener('pointerdown',this.onDown);
      this.renderer.domElement.removeEventListener('pointerup',this.onUp);
      this.renderer.domElement.removeEventListener('webglcontextlost',this.onLost);
      this.scene.traverse(node=>node.shadow?.dispose());
      disposeStudioObject(this.scene);this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();
    }
  }
}
