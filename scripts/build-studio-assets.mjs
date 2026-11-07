import {mkdir,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {makeStudioDesk,makeStudioRoom,makeStudioPlant,makeStudioMannequin,makeStudioChair,makeStudioMeetingTable,makeStudioSofa,makeStudioCoffeeTable,makeStudioCabinet,makeStudioReceptionCounter,makeStudioBookcase,makeStudioFloorLamp,makeStudioWhiteboard,makeStudioCoffeeStation,makeStudioElevator,disposeStudioObject,STUDIO_LEVELS} from '../web/studio-models.js';
import {STUDIO_MODEL_METADATA} from '../web/office-assets.js';

globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}
};
const output='web/assets/models/studio';
await mkdir(output,{recursive:true});
const exporter=new GLTFExporter();
const manifest={version:1,revision:'office-models/v1',units:'metres',upAxis:'Y',source:'web/studio-models.js',
  renderProfile:{camera:'native-floor orthographic three-quarter view; no camera is baked into GLBs',lighting:'shared soft warm key from upper-left; shadows are runtime-cast, not baked',palette:['#E8820C','#FDE8D0','#FFF8F0','#D6ECFA','#c99463','#849e8c']},
  provenance:'Original procedural geometry created for Visual Office. No external art or textures.',assets:[]};
const officeModels=[
  ['chair-ergonomic',makeStudioChair],['meeting-table',makeStudioMeetingTable],['lounge-sofa',makeStudioSofa],
  ['coffee-table',makeStudioCoffeeTable],['storage-cabinet',makeStudioCabinet],['reception-counter',makeStudioReceptionCounter],
  ['bookcase',makeStudioBookcase],['floor-lamp',makeStudioFloorLamp],['whiteboard',makeStudioWhiteboard],
  ['coffee-station',makeStudioCoffeeStation],['elevator-bay',makeStudioElevator],
];
const entries=[
  ...STUDIO_LEVELS.map(tier=>[`desk-${tier}`,()=>makeStudioDesk(tier)]),
  ...STUDIO_LEVELS.map(tier=>[`room-${tier}`,()=>makeStudioRoom(tier)]),
  ['room-signature-wing',()=>makeStudioRoom('signature',true)],
  ['plant-movable',makeStudioPlant],['mannequin-seated',makeStudioMannequin],...officeModels,
];
for(const [name,create] of entries){
  const model=create();
  const metadata=STUDIO_MODEL_METADATA[name];
  if(!metadata)throw new Error(`Missing stable Asset ID for ${name}`);
  let triangles=0,meshes=0;
  model.traverse(node=>{if(node.isMesh){meshes++;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;}});
  const data=await exporter.parseAsync(model,{binary:true});
  await writeFile(`${output}/${name}.glb`,Buffer.from(data));
  manifest.assets.push({assetId:metadata.assetId,name:metadata.name,category:metadata.category,placeable:metadata.placeable,sceneKind:metadata.sceneKind,...(metadata.presentationOnly?{presentationOnly:true}:{}),file:`${name}.glb`,bytes:data.byteLength,triangles,meshes,...model.userData});
  disposeStudioObject(model);
  console.log(`Studio ${name}.glb · ${Math.round(data.byteLength/1024)} KB · ${triangles} triangles`);
}
await writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
