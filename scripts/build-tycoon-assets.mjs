import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createTycoonModel,TYCOON_ASSETS} from '../web/tycoon-models.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}};
const dir='web/assets/models/tycoon';await mkdir(dir,{recursive:true});
const manifest={schemaVersion:'tycoon-assets/v1',revision:'tycoon-kit/1',quality:'prototype',units:'metres',source:'web/tycoon-models.js',license:'Original procedural geometry for Visual Office',assets:[]};
for(const [kind,meta]of Object.entries(TYCOON_ASSETS)){
  const model=createTycoonModel(kind);let triangles=0;
  model.traverse(n=>{if(n.isMesh)triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;});
  const bytes=Buffer.from(await new GLTFExporter().parseAsync(model,{binary:true,animations:model.animations}));
  await writeFile(`${dir}/${kind}.glb`,bytes);
  manifest.assets.push({kind,...meta,file:`${kind}.glb`,bytes:bytes.length,triangles,sha256:createHash('sha256').update(bytes).digest('hex')});
  const gs=new Set(),ms=new Set();model.traverse(n=>{if(n.geometry)gs.add(n.geometry);if(n.material)ms.add(n.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());
}
await writeFile(`${dir}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.log(`Tycoon prototype kit: ${manifest.assets.length} GLB, ${manifest.assets.reduce((n,a)=>n+a.bytes,0)} bytes`);
