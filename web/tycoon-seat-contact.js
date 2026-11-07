// Validate the local probe's seat against the assembled world geometry.
import * as THREE from 'three';
export function measureSeatContact(model,point,expected){
 const fail=message=>({ok:false,message});
 if(!model||!Number.isFinite(expected))return fail('ไม่พบความสูงเบาะสำหรับทดสอบ');
 model.updateWorldMatrix(true,true);
 const ray=new THREE.Raycaster(new THREE.Vector3(point.x,expected+.08,point.z),new THREE.Vector3(0,-1,0),0,.16);
 const hits=ray.intersectObject(model,true).filter(h=>h.face&&h.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(h.object.matrixWorld)).y>.95);
 const hit=hits.sort((a,b)=>Math.abs(a.point.y-expected)-Math.abs(b.point.y-expected))[0];
 if(!hit)return fail('จุดนั่งไม่ตรงกับผิวเบาะแนวราบ · ตรวจจุดและความสูงเบาะ');
 if(hit.point.y<.35||hit.point.y>.8)return fail('ตัวละครทดลองรองรับเบาะสูง 0.35–0.80 ม. · ปรับสเกลหรือจุดนั่ง');
 return {ok:true,height:hit.point.y};
}

export function measurePelvisSeatSupport(actor,model,expected,{verticalTolerance=.003,band=.001}={}){
 const fail=(reason,diagnostic={})=>({ok:false,reason,...diagnostic});
 const pelvis=actor?.getObjectByName?.('office-pelvis');
 if(!pelvis?.isSkinnedMesh||!model||!Number.isFinite(expected))return fail('missing-seat-support-geometry');
 actor.updateMatrixWorld(true);model.updateMatrixWorld(true,true);pelvis.skeleton.update();
 const position=pelvis.geometry.attributes.position,points=[];let lowest=Infinity;
 for(let i=0;i<position.count;i++){
  const point=pelvis.getVertexPosition(i,new THREE.Vector3());pelvis.localToWorld(point);points.push(point);lowest=Math.min(lowest,point.y);
 }
 const lowerBand=points.filter(point=>point.y<=lowest+band);if(!lowerBand.length)return fail('missing-pelvis-support-point');
 const support=new THREE.Vector3();for(const point of lowerBand)support.add(point);support.multiplyScalar(1/lowerBand.length);
 const ray=new THREE.Raycaster(new THREE.Vector3(support.x,expected+.08,support.z),new THREE.Vector3(0,-1,0),0,.16);
 const hit=ray.intersectObject(model,true).filter(item=>item.face&&item.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(item.object.matrixWorld)).y>.95&&Math.abs(item.point.y-expected)<=.025).sort((a,b)=>Math.abs(a.point.y-expected)-Math.abs(b.point.y-expected))[0];
 if(!hit)return fail('pelvis-support-point-outside-seat-top',{pelvisSupportPoint:support.toArray(),pelvisLowestY:lowest,seatHeightM:expected});
 const gap=support.y-hit.point.y;
 return {ok:Math.abs(gap)<=verticalTolerance,reason:Math.abs(gap)<=verticalTolerance?null:'pelvis-seat-height-gap',pelvisSupportPoint:support.toArray(),pelvisLowestY:lowest,surfacePoint:hit.point.toArray(),surfaceNormal:hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).toArray(),surfaceMesh:hit.object.name||'mesh',verticalGapM:gap,seatHeightM:expected,lowerBandVertexCount:lowerBand.length};
}
