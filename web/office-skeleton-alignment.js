// Presentation calibration uses fixed original-image pixels, never viewport pixels.
import {groundToWorld} from './office-projection.js';
export const ALIGNMENT_REFERENCE={width:1536,height:1024};
export const defaultSkeletonAlignment=()=>({x:0,y:0,scale:1});
export function validateSkeletonAlignment(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['x','y','scale'].includes(k))||!Number.isFinite(value.x)||!Number.isFinite(value.y)||Math.abs(value.x)>400||Math.abs(value.y)>400||!Number.isFinite(value.scale)||value.scale<.5||value.scale>1.5)throw Error('Skeleton alignment: X/Y must be within 400 reference px and scale 50–150%');
 return {x:value.x,y:value.y,scale:value.scale};
}
export function skeletonAlignment(room){try{return validateSkeletonAlignment(room?.skeletonAlignment);}catch{return defaultSkeletonAlignment();}}
export function alignmentPoint(p,a){return {x:50+(p.x-50)*a.scale+a.x/ALIGNMENT_REFERENCE.width*100,y:65+(p.y-65)*a.scale+a.y/ALIGNMENT_REFERENCE.height*100};}
export function inverseAlignmentPoint(p,a){return {x:50+(p.x-50-a.x/15.36)/a.scale,y:65+(p.y-65-a.y/10.24)/a.scale};}
export function alignmentSvgTransform(a){return `translate(${50+a.x/15.36} ${65+a.y/10.24}) scale(${a.scale}) translate(-50 -65)`;}
export function applySkeletonAlignment(group,a){
 const origin=groundToWorld({x:50+a.x/15.36,y:65+a.y/10.24});group.position.copy(origin);group.scale.setScalar(a.scale);group.updateMatrixWorld(true);
}
