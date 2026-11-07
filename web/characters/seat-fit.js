import * as T from 'three';
const v=()=>new T.Vector3();
function aimBone(bone,target){
 const parent=bone.parent?.getWorldQuaternion(new T.Quaternion())||new T.Quaternion();
 const child=bone.children.find(n=>n.isBone);if(!child)return;
 const origin=bone.getWorldPosition(v()),from=child.getWorldPosition(v()).sub(origin),to=target.clone().sub(origin);
 if(from.lengthSq()<1e-10||to.lengthSq()<1e-10)return;
 const world=new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()).multiply(bone.getWorldQuaternion(new T.Quaternion()));
 bone.quaternion.copy(parent.normalize().invert().multiply(world.normalize())).normalize();bone.updateWorldMatrix(false,true);
}
/** Fit the leg with fixed segment lengths; preserve the source sole orientation. */
export function fitLeg(hip,knee,ankle,target,orientation){
 const h=hip.getWorldPosition(v()),k=knee.getWorldPosition(v()),a=ankle.getWorldPosition(v());
 const upper=h.distanceTo(k),lower=k.distanceTo(a),direction=target.clone().sub(h);
 if(!upper||!lower||direction.length()<1e-7)return;
 const distance=T.MathUtils.clamp(direction.length(),Math.abs(upper-lower)+1e-5,upper+lower-1e-5);direction.normalize();
 const pole=k.clone().sub(h).addScaledVector(direction,-k.clone().sub(h).dot(direction));
 if(pole.lengthSq()<1e-8){pole.set(0,0,1).applyQuaternion(hip.getWorldQuaternion(new T.Quaternion()));pole.addScaledVector(direction,-pole.dot(direction));}
 if(pole.lengthSq()<1e-8)pole.set(1,0,0);pole.normalize();
 const along=(upper*upper-lower*lower+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));
 aimBone(hip,h.clone().addScaledVector(direction,along).addScaledVector(pole,height));aimBone(knee,target);
 const parent=ankle.parent.getWorldQuaternion(new T.Quaternion());ankle.quaternion.copy(parent.normalize().invert().multiply(orientation.clone().normalize())).normalize();ankle.updateWorldMatrix(false,true);
}
