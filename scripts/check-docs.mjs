import {execFileSync} from 'node:child_process';
import {readFile,stat} from 'node:fs/promises';
import {dirname,resolve,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {marked} from 'marked';
import {JSDOM} from 'jsdom';

const plain=text=>marked.parseInline(text).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&(?:quot|#34);/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
function anchors(markdown){
 const result=new Set(),counts=new Map();
 marked.walkTokens(marked.lexer(markdown),token=>{
  if(token.type==='html')for(const node of JSDOM.fragment(token.text).querySelectorAll('[id],a[name]')){
   const id=node.getAttribute('id'),name=node.matches('a[name]')?node.getAttribute('name'):null;
   if(id)result.add(id);if(name)result.add(name);
  }
  if(token.type!=='heading')return;
  const slug=plain(token.text).toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu,'').replace(/\s/g,'-');
  let candidate=slug,n=counts.get(slug)||0;while(result.has(candidate))candidate=`${slug}-${++n}`;
  counts.set(slug,n);result.add(candidate);
 });
 return result;
}

// Portable targets come from Git's tracked + nonignored working-file inventory,
// never from arbitrary files left on this machine. No external requests are made.
export function auditDocumentation({documents,paths,externalAssets=[],indexes={},entrypoints}){
 const errors=[],external=[],machineLocal=[],references=[],markdownLinks=[],known=new Set(paths),stored=new Set(externalAssets),sections=new Map();let links=0;
 const exists=target=>known.has(target)||stored.has(target)||[...known].some(path=>path.startsWith(`${target.replace(/\/$/,'')}/`));
 const fail=(code,source,target)=>errors.push({code,source,target});
 for(const [source,markdown]of Object.entries(documents)){
  marked.walkTokens(marked.lexer(markdown),token=>{
   if(!['link','image'].includes(token.type))return;links++;const href=token.href;
   if(/^[A-Za-z]:[\\/]|^file:/i.test(href)){machineLocal.push({source,target:href});return;}
   if(/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)){external.push({source,target:href});return;}
   let url,fragment;
   try{const at=href.indexOf('#');url=decodeURIComponent((at<0?href:href.slice(0,at)).split('?')[0]);fragment=at<0?'':decodeURIComponent(href.slice(at+1));}
   catch{fail('INVALID_ENCODING',source,href);return;}
   const target=url?posix.normalize(url.startsWith('/')?url.slice(1):posix.join(posix.dirname(source),url.replace(/\\/g,'/'))):source;
   if(target==='..'||target.startsWith('../')){fail('OUTSIDE_REPOSITORY',source,href);return;}
   if(!exists(target)){
    const candidate=[...paths,...externalAssets].find(path=>path.toLowerCase()===target.toLowerCase());
    fail(candidate?'PATH_CASE':'MISSING_TARGET',source,href);return;
   }
   references.push({source,target,fragment});
   if(token.type==='link')markdownLinks.push({source,target});
   if(fragment&&documents[target]!==undefined){
    if(!sections.has(target))sections.set(target,anchors(documents[target]));
    if(!sections.get(target).has(fragment))fail('MISSING_ANCHOR',source,href);
   }
  });
 }
 for(const [index,members]of Object.entries(indexes)){
  if(documents[index]===undefined){fail('MISSING_INDEX',index,index);continue;}
  const linked=new Set(references.filter(ref=>ref.source===index).map(ref=>ref.target));
  for(const member of members)if(!linked.has(member))fail('NOT_INDEXED',index,member);
 }
 const result={documents:Object.keys(documents).length,links,errors,external,machineLocal,references};
 if(entrypoints===undefined)return result;
 const unreachable=new Set(),reachable=new Set(),queue=entrypoints.filter(path=>documents[path]!==undefined);
 const documentFor=target=>{
  if(documents[target]!==undefined)return target;
  const index=`${target.replace(/\/$/,'')}/README.md`;
  return documents[index]!==undefined?index:null;
 };
 for(let cursor=0;cursor<queue.length;cursor++){
  const source=queue[cursor];if(reachable.has(source))continue;reachable.add(source);
  for(const reference of markdownLinks){
   if(reference.source!==source)continue;
   const target=documentFor(reference.target);if(target&&!reachable.has(target))queue.push(target);
  }
 }
 for(const path of Object.keys(documents))if(!reachable.has(path))unreachable.add(path);
 for(const path of unreachable){
  let directory=posix.dirname(path),nearest=null;
  while(directory!=='.'){
   const candidate=`${directory}/README.md`;
   if(candidate!==path&&documents[candidate]!==undefined){nearest=candidate;break;}
   const parent=posix.dirname(directory);if(parent===directory)break;directory=parent;
  }
  nearest??=documents['README.md']!==undefined?'README.md':documents['AGENTS.md']!==undefined?'AGENTS.md':'docs/README.md';
  fail('UNREACHABLE_DOCUMENT',nearest,path);
 }
 return {...result,unreachableDocuments:unreachable.size};
}

export async function checkDocumentation(root,options={}){
 const {inventorySource,entrypoints}=Array.isArray(options)?{inventorySource:options}:options;
 let externalAssets=Array.isArray(options?.externalAssets)?options.externalAssets:[];
 try{const manifest=JSON.parse(await readFile(resolve(root,'asset-store/manifest.json'),'utf8'));if(Array.isArray(manifest.assets))externalAssets=manifest.assets.map(asset=>asset.path);}
 catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
 const source=inventorySource??execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
 const inventory=[...new Set(source)].sort();
 const present=await Promise.all(inventory.map(async path=>{try{return (await stat(resolve(root,path))).isFile()?path:null;}catch(error){if(error.code==='ENOENT')return null;throw error;}}));
 const paths=present.filter(Boolean);
 const documents=Object.fromEntries(await Promise.all(paths.filter(path=>path.endsWith('.md')).map(async path=>[path,await readFile(resolve(root,path),'utf8')])));
 const directories=new Set();
 for(const path of paths.filter(path=>path.startsWith('docs/'))){let directory=posix.dirname(path);while(directory==='docs'||directory.startsWith('docs/')){directories.add(directory);directory=posix.dirname(directory);}}
 const indexes={};
 for(const directory of [...directories].sort())indexes[`${directory}/README.md`]=[
  ...paths.filter(path=>posix.dirname(path)===directory&&path!==`${directory}/README.md`),
  ...[...directories].filter(child=>posix.dirname(child)===directory).map(child=>`${child}/README.md`),
 ];
 if(indexes['docs/README.md'])indexes['docs/README.md'].push(...paths.filter(path=>!path.includes('/')&&path.endsWith('.md')));
 return auditDocumentation({documents,paths,indexes,externalAssets,...(entrypoints===undefined?{}:{entrypoints})});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await checkDocumentation(resolve(dirname(fileURLToPath(import.meta.url)),'..'),{entrypoints:['README.md','AGENTS.md']});
 if(process.argv.includes('--json'))process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
 else{
  for(const error of result.errors){
   if(error.code==='UNREACHABLE_DOCUMENT')console.error(`${error.code}: ${error.target} is unreachable; link it from the nearest index (${error.source}).`);
   else console.error(`${error.code}: ${error.source} → ${error.target}`);
  }
  console.log(JSON.stringify({documents:result.documents,links:result.links,errors:result.errors.length,unreachableDocuments:result.unreachableDocuments,externalNotFetched:result.external.length,machineLocal:result.machineLocal.length}));
 }
 if(result.errors.length)process.exitCode=1;
}
