import * as T from 'three';

// Neutral softbox reflections for art inspection only. No external HDRI or
// baked highlight is needed; both local revisions share this same environment.
export function createLabEnvironment(renderer){
  const room=new T.Scene();room.background=new T.Color(.18,.18,.18);
  for(const [x,y,z,w,h,power]of [[-3,3,4,2,4,4],[4,2,1,1.5,3,2],[0,4,-3,3,2,3]]){
    const panel=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color(power,power*.98,power*.95),side:T.DoubleSide}));
    panel.position.set(x,y,z);panel.lookAt(0,1,0);room.add(panel);
  }
  const pmrem=new T.PMREMGenerator(renderer),target=pmrem.fromScene(room,.04,.1,30);
  room.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});pmrem.dispose();
  return {texture:target.texture,dispose:()=>target.dispose()};
}
