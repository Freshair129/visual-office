import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.gltf':'model/gltf+json','.glb':'model/gltf-binary','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
const assets={};
async function collect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await collect(file);else{const key='/'+path.relative('web',file).split(path.sep).join('/');assets[key]={type:types[path.extname(file)]??'application/octet-stream',body:(await readFile(file)).toString('base64')};}}}
await collect('web');
const bundled=await build({entryPoints:['worker/index.js'],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',legalComments:'inline'});
const source=bundled.outputFiles[0].text;
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',`const ASSETS=${JSON.stringify(assets)};\n${source}`);
await writeFile('dist/.openai/hosting.json',await readFile('.openai/hosting.json'));
console.log('Built Worker with '+Object.keys(assets).length+' embedded assets');
