import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {makeRoom,makeDesk,makeFloorTile} from '../web/models.js';

// GLTFExporter uses the browser FileReader interface to embed geometry buffers.
globalThis.FileReader=class {readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.()})}readAsDataURL(blob){blob.arrayBuffer().then(v=>{this.result=`data:${blob.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.()})}};
await mkdir('web/assets/models',{recursive:true});
await mkdir('web/vendor/addons/loaders',{recursive:true});
await mkdir('web/vendor/addons/utils',{recursive:true});
await mkdir('web/vendor/addons/controls',{recursive:true});
await mkdir('web/vendor/addons/geometries',{recursive:true});
for(const file of ['three.module.js','three.core.js'])await copyFile(`node_modules/three/build/${file}`,`web/vendor/${file}`);
for(const file of ['loaders/GLTFLoader.js','utils/BufferGeometryUtils.js','utils/SkeletonUtils.js','controls/OrbitControls.js','geometries/RoundedBoxGeometry.js']){
  const source=await readFile(`node_modules/three/examples/jsm/${file}`,'utf8');
  const browserSource=source.replace(/from (['"])three\1/g,"from '../../three.module.js'");
  await writeFile(`web/vendor/addons/${file}`,browserSource);
}
await copyFile('node_modules/three/LICENSE','web/vendor/THREE-LICENSE.txt');
const exporter=new GLTFExporter();
for(const [name,scene] of [['room',makeRoom()],['desk',makeDesk()],['floor-tile',makeFloorTile()]]){const data=await exporter.parseAsync(scene,{binary:false});await writeFile(`web/assets/models/${name}.gltf`,JSON.stringify(data));console.log(`Generated ${name}.gltf (${Math.round(JSON.stringify(data).length/1024)} KB)`)}
