import {build} from 'esbuild';
import {mkdir,writeFile,readdir,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
// This directory contains only generated JS/license chunks. Build first, then
// replace the generated inventory so old sanitizer chunks cannot survive a rebuild.
const outdir=resolve('web/vendor/rich');
const result=await build({entryPoints:{'rich-libs':'scripts/rich-vendor-entry.mjs',mermaid:'node_modules/mermaid/dist/mermaid.esm.mjs'},bundle:true,splitting:true,format:'esm',outdir,write:false,minify:true,target:'es2022',legalComments:'linked',logLevel:'warning'});
await mkdir(outdir,{recursive:true});
for(const file of await readdir(outdir,{withFileTypes:true}))if(file.isFile()&&(file.name.endsWith('.js')||file.name.endsWith('.LEGAL.txt')))await unlink(resolve(outdir,file.name));
for(const file of result.outputFiles)await writeFile(file.path,file.contents);
console.log('Built local Markdown, sanitizer and Mermaid assets');
