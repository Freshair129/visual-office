import {build} from 'esbuild';
import {readdir,mkdir,writeFile,access,readFile} from 'node:fs/promises';
import {OFFICE_API_ROUTES} from '../shared/office-api-routes.js';
import {browserModuleEntries} from './browser-entrypoints.mjs';
async function publicFiles(directory){
 const files=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=directory+'/'+entry.name;
  if(entry.isDirectory()){if(path!=='web/vendor')files.push(...await publicFiles(path));}
  else if(entry.isFile())files.push(path);
 }
 return files;
}
const publicPaths=await publicFiles('web'),htmlFiles=publicPaths.filter(path=>path.endsWith('.html'));
const entryPoints=browserModuleEntries(await Promise.all(htmlFiles.map(async path=>({path,html:await readFile(path,'utf8')}))));
const result=await build({entryPoints,bundle:true,write:false,outdir:'browser-audit',metafile:true,format:'esm',platform:'browser',logLevel:'silent'});
const reachable=new Set(Object.keys(result.metafile.inputs).map(p=>p.replaceAll('\\','/')));
const files=publicPaths.filter(path=>path.endsWith('.js'));
// Procedural meshes are authoring inputs to package.json's asset builders,
// not dead browser code. Trace them statically without running any builder.
const pkg=JSON.parse(await readFile('package.json','utf8'));
const buildEntries=[...pkg.scripts.assets.matchAll(/\bnode\s+(scripts\/[\w-]+\.mjs)/g)].map(match=>match[1]);
const producers=await build({entryPoints:buildEntries,bundle:true,packages:'external',write:false,outdir:'authoring-audit',metafile:true,format:'esm',platform:'node',logLevel:'silent'});
const buildReachable=new Set(Object.keys(producers.metafile.inputs).map(p=>p.replaceAll('\\','/')));
const buildOnlyModules=files.filter(file=>!reachable.has(file)&&buildReachable.has(file));
const orphanModules=files.filter(file=>!reachable.has(file)&&!buildReachable.has(file));
const endpoints=OFFICE_API_ROUTES.map(({pattern,...route})=>route);
for(const route of endpoints)for(const path of [route.owner,...route.consumers])await access(path);
const report={entry:'web/app.js',htmlFiles,entryPoints,buildEntries,buildOnlyModules,reachableModules:reachable.size,orphanModules,endpoints,
 limitations:['Static reachability and route policy are not live Zuri acceptance.','Payload/auth behavior is verified by owning handler tests.','Studio GLB and Native renderers are active dependencies, not unused legacy code.']};
await mkdir('reports/runtime-cleanup',{recursive:true});await writeFile('reports/runtime-cleanup/runtime-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({routes:endpoints.length,reachableModules:reachable.size,orphanModules}));
