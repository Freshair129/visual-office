import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createTycoonModel} from '../../web/tycoon-models.js';

if (!process.argv[2]) throw Error('Supply a separate output GLB path');
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
const output=resolve(process.argv[2]);
await mkdir(dirname(output),{recursive:true});
const model=createTycoonModel('desk');
const bytes=Buffer.from(await new GLTFExporter().parseAsync(model,{binary:true}));
await writeFile(output,bytes);
console.log(`Exported desk candidate: ${bytes.length} bytes to ${output}`);
