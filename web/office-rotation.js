import {groundToWorld,worldToGround} from './office-projection.js';
export const QUARTER_ANGLES=[0,90,180,270];
export const ROTATABLE_KINDS=['work-desk','task-chair','team-sofa','water-cooler','whiteboard','plant'];
export const quarterAngle=value=>((value%360)+360)%360;
export function rotateGroundPoint(point,pivot,degrees,target=pivot,scale=1){const p=groundToWorld(point),o=groundToWorld(pivot),t=groundToWorld(target),a=degrees*Math.PI/180,x=(p.x-o.x)*scale,z=(p.z-o.z)*scale;return worldToGround({x:t.x+x*Math.cos(a)+z*Math.sin(a),z:t.z-x*Math.sin(a)+z*Math.cos(a)});}
