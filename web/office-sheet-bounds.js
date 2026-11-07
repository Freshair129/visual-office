import {makeOfficeProp,officePropScale} from './office-prop-models.js';
import {disposeStudioObject} from './studio-models.js';
import {sheetYaw} from './office-scene-sheet.js';
import {groundToWorld} from './office-projection.js';
import * as THREE from 'three';
import {worldToGround} from './office-projection.js';
const types={'work-desk':'desk','task-chair':'chair','team-sofa':'sofa','water-cooler':'water-cooler',whiteboard:'whiteboard',plant:'plant'};
// Derive collision from the meshes actually rendered, in the planning group's space.
export function sheetModelBlockers(models,physicalGroup,padding=.3){
 physicalGroup.updateWorldMatrix(true,true);const inverse=physicalGroup.matrixWorld.clone().invert(),result=[];
 for(const [id,model]of models){const kind=model.userData.officeKind,type=types[kind];if(!type)continue;model.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(model),local=new THREE.Box3();
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])local.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(inverse));
 const minX=local.min.x-padding,maxX=local.max.x+padding,minZ=local.min.z-padding,maxZ=local.max.z+padding,center=worldToGround(new THREE.Vector3((minX+maxX)/2,0,(minZ+maxZ)/2));
 result.push({id,objectId:id,kind,type,center,scale:1,flip:false,halfWidth:(maxX-minX)/2,halfDepth:(maxZ-minZ)/2,polygon:[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]].map(([x,z])=>{const p=worldToGround(new THREE.Vector3(x,0,z));return [p.x,p.y];})});
 }return result;
}

// Editor/default planning calls the exact asset factory used by the live renderer.
export function deriveSheetBlockers(room,padding=.3){const group=new THREE.Group(),models=new Map();try{for(const o of room.objects){if(!types[o.kind])continue;const model=makeOfficeProp(o.kind,'signature');model.userData.officeKind=o.kind;model.position.copy(groundToWorld(o));model.rotation.y=sheetYaw(o);model.scale.setScalar(officePropScale(o));models.set(o.id,model);group.add(model);}return sheetModelBlockers(models,group,padding);}finally{for(const model of models.values())disposeStudioObject(model);}}
