import {createReadStream} from 'node:fs';
import {readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {createHash, createHmac} from 'node:crypto';
import {join, resolve, dirname, posix, extname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const MANIFEST_PATH='asset-store/manifest.json';
export const IGNORE_START='# BEGIN external asset store paths';
export const IGNORE_END='# END external asset store paths';
export const ASSET_CLASSES=Object.freeze(['brand-character','imagegen','brand-mark','third-party-candidate']);
const IMAGE_EXTENSIONS=new Set(['.png','.jpg','.jpeg','.webp','.gif','.avif','.tif','.tiff']);
const CONTENT_TYPES=Object.freeze({
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif','.tif':'image/tiff','.tiff':'image/tiff',
 '.svg':'image/svg+xml','.glb':'model/gltf-binary','.blend':'application/octet-stream','.json':'application/json',
});
const CHAR_ROOT='web/assets/models/characters/';
const BRAND_MARKS=new Set(['web/assets/zuri-wordmark.svg','web/assets/zuri-icon-ink.svg']);

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const safePath=value=>value.replaceAll('\\','/').replace(/^\.\//,'');

function thirdPartyPath(path){
 return /^(?:web\/assets\/models\/characters\/candidates\/(?:anime|rain|zuri-anime)\.glb|assets-source\/characters\/candidates\/(?:anime-lab\.blend|rain-lab\.blend|zuri-anime\.blend|revisions\/zuri-anime-v\d+\/zuri-anime\.(?:blend|glb)))$/.test(path);
}

export function classifyAsset(input){
 const path=safePath(input),ext=extname(path).toLowerCase();
 if(thirdPartyPath(path)){
  const licenseNote=path.includes('rain')?'Rain v3.3 source identifies CC-BY-4.0; preserve Blender Foundation attribution when distributing.':
   path.includes('zuri-anime')?'Derivative of the CC0 Rigged Anime Girl candidate; CC0 covers only the base source, while Zuri brand identity and derivative design remain Zuri-owned.':
   'Rigged Anime Girl by 3dquads blender; CC0-1.0 per retained candidate license record.';
  return {class:'third-party-candidate',licenseNote};
 }
 if(BRAND_MARKS.has(path)||path.startsWith('web/assets/brand/'))return {class:'brand-mark',licenseNote:'Zuri brand identity artwork; Zuri-owned and has no open redistribution license.'};
 if(path.startsWith(CHAR_ROOT)&&ext==='.glb')return {class:'brand-character',licenseNote:'Zuri, Wangjai, Staff A/B or Zuri-derived character review asset; brand identity is Zuri-owned and has no open redistribution license.'};
 if(path.startsWith('assets-source/characters/')&&ext==='.blend')return {class:'brand-character',licenseNote:'Editable source for Zuri, Wangjai, Staff A/B or a Zuri brand revision; brand identity is Zuri-owned and has no open redistribution license.'};
 if(path.startsWith('assets-source/characters/')&&IMAGE_EXTENSIONS.has(ext)&&/albedo/i.test(path))return {class:'imagegen',licenseNote:'Built-in ImageGen character albedo; retain its prompt and provenance. No third-party stock license is asserted.'};
 if(path.startsWith('docs/game-design/characters/')&&IMAGE_EXTENSIONS.has(ext)){
  if(/albedo/i.test(path))return {class:'imagegen',licenseNote:'Built-in ImageGen character albedo; retain its prompt and provenance. No third-party stock license is asserted.'};
  return {class:'brand-character',licenseNote:'Zuri, Wangjai, Staff A/B character sheet, reference or review image; brand identity is Zuri-owned and has no open redistribution license.'};
 }
 if(path.startsWith(CHAR_ROOT)&&IMAGE_EXTENSIONS.has(ext))return {class:'brand-character',licenseNote:'Zuri, Wangjai, Staff A/B character reference or review image; brand identity is Zuri-owned and has no open redistribution license.'};
 if((path.startsWith('web/assets/office-world/')||path.startsWith('web/assets/studio-styles/'))&&IMAGE_EXTENSIONS.has(ext)){
  if(path.startsWith('web/assets/office-world/skins/')&&/projects-reference[^/]*\.png$/i.test(path))return null;
  return {class:'imagegen',licenseNote:'Built-in ImageGen Visual Office image; retain its prompt and provenance. No third-party stock license is asserted.'};
 }
 if(path==='docs/game-design/office-evolution-v01.png')return {class:'imagegen',licenseNote:'Built-in ImageGen concept board; its adjacent prompt is retained in the repository. No third-party stock license is asserted.'};
 return null;
}

async function walkFiles(root,relative){
 const absolute=join(root,...relative.split('/'));let entries;
 try{entries=await readdir(absolute,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return [];throw error;}
 const files=[];
 for(const entry of entries){
  const path=`${relative}/${entry.name}`;
  if(entry.isDirectory())files.push(...await walkFiles(root,path));
  else if(entry.isFile())files.push(path);
 }
 return files;
}

export async function discoveredAssetPaths(root){
 const paths=new Set(BRAND_MARKS);
 for(const path of await walkFiles(root,'web/assets/brand'))paths.add(path);
 for(const directory of ['web/assets/office-world','web/assets/studio-styles','web/assets/models/characters','assets-source/characters','docs/game-design/characters']){
  for(const path of await walkFiles(root,directory))paths.add(path);
 }
 paths.add('docs/game-design/office-evolution-v01.png');
 return [...paths].map(safePath).filter(path=>classifyAsset(path)).sort();
}

export async function hashFile(path){
 const hash=createHash('sha256');
 for await(const chunk of createReadStream(path))hash.update(chunk);
 return hash.digest('hex');
}

export function validateManifest(manifest){
 const errors=[];
 if(manifest?.schemaVersion!=='visual-office-asset-store/v1'||!Array.isArray(manifest.assets))return [{path:MANIFEST_PATH,reason:'invalid manifest schema'}];
 const seen=new Set();
 for(const asset of manifest.assets){
  const path=typeof asset?.path==='string'?asset.path:'';
  const canonical=safePath(path);
  if(!path||path!==canonical||posix.isAbsolute(canonical)||/^[a-z]:/i.test(canonical)||canonical.split('/').some(part=>!part||part==='.'||part==='..')){errors.push({path,reason:'unsafe or non-canonical path'});continue;}
  if(seen.has(path)){errors.push({path,reason:'duplicate path'});continue;}seen.add(path);
  const classification=classifyAsset(path);
  if(!ASSET_CLASSES.includes(asset.class)||!classification||classification.class!==asset.class){errors.push({path,reason:'unrecognized asset class or path'});continue;}
  if(!Number.isSafeInteger(asset.bytes)||asset.bytes<0){errors.push({path,reason:'invalid byte size'});continue;}
  if(typeof asset.sha256!=='string'||! /^[a-f0-9]{64}$/.test(asset.sha256)){errors.push({path,reason:'invalid SHA-256'});continue;}
  if(typeof asset.contentType!=='string'||!asset.contentType||typeof asset.licenseNote!=='string'||!asset.licenseNote){errors.push({path,reason:'missing content type or license note'});}
 }
 return errors;
}

export async function buildManifest(root,existing=[]){
 const prior=Array.isArray(existing)?existing:(existing?.assets||[]),previous=new Map(prior.map(asset=>[safePath(asset.path),asset]));
 const paths=new Set(await discoveredAssetPaths(root));
 for(const path of previous.keys())if(classifyAsset(path))paths.add(path);
 const assets=[];
 for(const path of [...paths].sort()){
  const classification=classifyAsset(path);if(!classification)continue;
  let bytes,sha;
  try{const info=await stat(resolve(root,path));if(!info.isFile())continue;bytes=info.size;sha=await hashFile(resolve(root,path));}
  catch(error){if(error.code!=='ENOENT')throw error;const old=previous.get(path);if(old){assets.push({...old,path});continue;}continue;}
  assets.push({path,bytes,sha256:sha,contentType:CONTENT_TYPES[extname(path).toLowerCase()]||'application/octet-stream',class:classification.class,licenseNote:classification.licenseNote});
 }
 return {schemaVersion:'visual-office-asset-store/v1',assets};
}

export async function verifyManifest(root,manifest){
 const errors=validateManifest(manifest);
 if(errors.length)return {checked:Array.isArray(manifest?.assets)?manifest.assets.length:0,errors};
 for(const asset of manifest.assets){
  const path=asset.path;
  let info;
  try{info=await stat(resolve(root,path));}catch(error){if(error.code==='ENOENT'){errors.push({path,reason:'missing'});continue;}throw error;}
  if(!info.isFile()){errors.push({path,reason:'not a file'});continue;}
  if(info.size!==asset.bytes){errors.push({path,reason:`size mismatch (expected ${asset.bytes}, found ${info.size})`});continue;}
  const hash=await hashFile(resolve(root,path));if(hash!==asset.sha256)errors.push({path,reason:'SHA-256 mismatch'});
 }
 return {checked:manifest.assets.length,errors};
}

export function updateIgnoreContent(content,paths){
 const lines=content.split(/\r?\n/),start=lines.indexOf(IGNORE_START),end=lines.indexOf(IGNORE_END);
 let before=lines,after=[];
 if(start>=0&&end>start){before=lines.slice(0,start);after=lines.slice(end+1);}
 const block=[IGNORE_START,...[...new Set(paths)].sort().map(path=>`/${safePath(path)}`),IGNORE_END];
 while(before.at(-1)==='')before.pop();while(after[0]==='')after.shift();
 return [...before,...(before.length?['']:[]),...block,...(after.length?['',...after]:[])].join('\n').replace(/\n*$/,'\n');
}

const hmac=(key,value)=>createHmac('sha256',key).update(value,'utf8').digest();
function awsEncode(value){return encodeURIComponent(value).replace(/[!'()*]/g,char=>`%${char.charCodeAt(0).toString(16).toUpperCase()}`);}
function canonicalUri(url){return url.pathname.split('/').map(part=>awsEncode(decodeURIComponent(part))).join('/')||'/';}
function canonicalQuery(url){return [...url.searchParams.entries()].map(([key,value])=>[awsEncode(key),awsEncode(value)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:0).map(([key,value])=>`${key}=${value}`).join('&');}

export function signAwsV4({method,url,headers={},payloadHash,accessKey,secretKey,date=new Date(),region='us-east-1',service='s3'}){
 const target=url instanceof URL?url:new URL(url),amzDate=typeof date==='string'?date:date.toISOString().replace(/[:-]|\.\d{3}/g,''),shortDate=amzDate.slice(0,8);
 const canonicalHeaders={host:target.host,'x-amz-content-sha256':payloadHash,'x-amz-date':amzDate};
 for(const [name,value]of Object.entries(headers))canonicalHeaders[name.toLowerCase()]=String(value).trim().replace(/\s+/g,' ');
 const names=Object.keys(canonicalHeaders).sort(),signedHeaders=names.join(';');
 const headerText=names.map(name=>`${name}:${canonicalHeaders[name]}\n`).join('');
 const canonicalRequest=[method.toUpperCase(),canonicalUri(target),canonicalQuery(target),headerText,signedHeaders,payloadHash].join('\n');
 const scope=`${shortDate}/${region}/${service}/aws4_request`;
 const stringToSign=['AWS4-HMAC-SHA256',amzDate,scope,sha256(Buffer.from(canonicalRequest))].join('\n');
 const kDate=hmac(`AWS4${secretKey}`,shortDate),kRegion=hmac(kDate,region),kService=hmac(kRegion,service),kSigning=hmac(kService,'aws4_request');
 const signature=createHmac('sha256',kSigning).update(stringToSign,'utf8').digest('hex');
 return {headers:{...headers,'x-amz-date':amzDate,'x-amz-content-sha256':payloadHash,authorization:`AWS4-HMAC-SHA256 Credential=${accessKey}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`},signature,canonicalRequest,stringToSign};
}

function parseEnvFile(text){
 const result={};
 for(const line of text.split(/\r?\n/)){
  const match=line.trim().match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!match)continue;
  let value=match[2].trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
  result[match[1]]=value;
 }
 return result;
}

async function credentials(env=process.env){
 let accessKey=env.VO_ASSET_S3_ACCESS_KEY,secretKey=env.VO_ASSET_S3_SECRET_KEY;
 if((!accessKey||!secretKey)&&env.VO_ASSET_S3_ENV_FILE){
  let parsed;
  try{parsed=parseEnvFile(await readFile(env.VO_ASSET_S3_ENV_FILE,'utf8'));}catch{throw Error('Could not read the configured object-store env file.');}
  accessKey||=parsed.RUSTFS_ACCESS_KEY;secretKey||=parsed.RUSTFS_SECRET_KEY;
 }
 if(!accessKey||!secretKey)throw Error('Set VO_ASSET_S3_ACCESS_KEY and VO_ASSET_S3_SECRET_KEY, or VO_ASSET_S3_ENV_FILE.');
 return {accessKey,secretKey};
}

function objectUrl(config,key){
 const base=new URL(config.endpoint),prefix=base.pathname.replace(/\/+$/,'');
 const suffix=[config.bucket,...(key?[key]:[])].map(part=>part.split('/').map(awsEncode).join('/')).join('/');
 base.pathname=`${prefix}/${suffix}`;base.search='';base.hash='';return base;
}

async function request(config,method,key,{body,bodyHash,headers={}}={}){
 const target=objectUrl(config,key),hash=bodyHash||sha256(Buffer.alloc(0)),signed=signAwsV4({method,url:target,headers,payloadHash:hash,...config.credentials});
 try{return await fetch(target,{method,headers:signed.headers,...(body===undefined?{}:{body,duplex:body?.pipe?'half':undefined})});}
 catch{throw Error(`Cannot reach the object store endpoint (${method} ${key||config.bucket}).`);}
}

async function loadStoreConfig(env=process.env){
 const endpoint=env.VO_ASSET_S3_ENDPOINT||'http://127.0.0.1:9100',bucket=env.VO_ASSET_S3_BUCKET||'visual-office-assets';
 let url;try{url=new URL(endpoint);}catch{throw Error('VO_ASSET_S3_ENDPOINT must be a valid URL.');}
 if(!['http:','https:'].includes(url.protocol)||!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket))throw Error('Invalid object-store endpoint or bucket name.');
 return {endpoint:url.href.replace(/\/$/,''),bucket,credentials:await credentials(env)};
}

async function loadManifest(root){return JSON.parse(await readFile(resolve(root,MANIFEST_PATH),'utf8'));}
async function updateManifestAndIgnore(root){
 let existing=[];try{existing=(await loadManifest(root)).assets||[];}catch(error){if(error.code!=='ENOENT')throw error;}
 const manifest=await buildManifest(root,existing),file=resolve(root,MANIFEST_PATH);
 await import('node:fs/promises').then(fs=>fs.mkdir(resolve(root,'asset-store'),{recursive:true}));
 await writeFile(file,JSON.stringify(manifest,null,2)+'\n');
 const ignorePath=resolve(root,'.gitignore');let ignore='';try{ignore=await readFile(ignorePath,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 await writeFile(ignorePath,updateIgnoreContent(ignore,manifest.assets.map(asset=>asset.path)));
 return manifest;
}

async function verifyLocal(root,manifest,{quiet=false}={}){
 const result=await verifyManifest(root,manifest);
 if(!quiet){for(const error of result.errors)console.error(`${error.path}: ${error.reason}`);console.log(`Verified ${result.checked-result.errors.length}/${result.checked} external assets${result.errors.length?` (${result.errors.length} issues)`:''}.`);}
 return result;
}

async function pushAssets(root,manifest){
 const local=await verifyLocal(root,manifest,{quiet:true});if(local.errors.length)throw Error(`Local manifest verification failed (${local.errors.length} issue${local.errors.length===1?'':'s'}); run npm run assets:verify.`);
 const config=await loadStoreConfig();
 let bucket=await request(config,'HEAD',null);
 if(bucket.status===404)bucket=await request(config,'PUT',null);
 if(!bucket.ok&&bucket.status!==409)throw Error(`Object-store bucket check failed (HTTP ${bucket.status}).`);
 let uploaded=0,unchanged=0;
 for(const asset of manifest.assets){
  const head=await request(config,'HEAD',asset.path);
  let same=false;
  if(head.ok){
   const size=Number(head.headers.get('content-length'));
   const remoteSha=head.headers.get('x-amz-meta-sha256');
   if(size===asset.bytes&&remoteSha===asset.sha256)same=true;
   else if(size===asset.bytes&&!remoteSha){const remote=await request(config,'GET',asset.path);if(!remote.ok)throw Error(`Object-store read failed for ${asset.path} (HTTP ${remote.status}).`);same=sha256(Buffer.from(await remote.arrayBuffer()))===asset.sha256;}
  }else if(head.status!==404)throw Error(`Object-store check failed for ${asset.path} (HTTP ${head.status}).`);
  if(same){unchanged++;continue;}
  const localPath=resolve(root,asset.path),body=createReadStream(localPath);
  const put=await request(config,'PUT',asset.path,{body,bodyHash:asset.sha256,headers:{'content-type':asset.contentType,'x-amz-meta-sha256':asset.sha256,'content-length':String(asset.bytes)}});
  if(!put.ok)throw Error(`Object-store upload failed for ${asset.path} (HTTP ${put.status}).`);
  const verify=await request(config,'GET',asset.path);if(!verify.ok)throw Error(`Object-store verification read failed for ${asset.path} (HTTP ${verify.status}).`);
  const digest=sha256(Buffer.from(await verify.arrayBuffer()));if(digest!==asset.sha256)throw Error(`Object-store verification hash mismatch for ${asset.path}.`);
  uploaded++;
 }
 console.log(`RustFS push verified ${uploaded} uploaded and ${unchanged} unchanged assets.`);
}

async function pullAssets(root,manifest){
 const invalid=validateManifest(manifest);if(invalid.length)throw Error(`Asset manifest is invalid (${invalid.length} issue${invalid.length===1?'':'s'}); no files were downloaded.`);
 const config=await loadStoreConfig();let downloaded=0,unchanged=0;
 for(const asset of manifest.assets){
  const localPath=resolve(root,asset.path);let localMatches=false;
  try{const info=await stat(localPath);localMatches=info.isFile()&&info.size===asset.bytes&&await hashFile(localPath)===asset.sha256;}catch(error){if(error.code!=='ENOENT')throw error;}
  if(localMatches){unchanged++;continue;}
  const response=await request(config,'GET',asset.path);if(!response.ok)throw Error(`Object-store download failed for ${asset.path} (HTTP ${response.status}).`);
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==asset.bytes||sha256(bytes)!==asset.sha256)throw Error(`Object-store verification failed for ${asset.path}; manifest bytes were not written.`);
  const {mkdir}=await import('node:fs/promises');await mkdir(dirname(localPath),{recursive:true});
  await writeFile(localPath,bytes);downloaded++;
 }
 console.log(`RustFS pull verified ${downloaded} downloaded and ${unchanged} unchanged assets.`);
}

export async function runAssetStore(command,root=resolve(fileURLToPath(new URL('..',import.meta.url)))){
 if(command==='manifest'){
  const manifest=await updateManifestAndIgnore(root),counts=Object.fromEntries(ASSET_CLASSES.map(name=>[name,{files:0,bytes:0}]));
  for(const asset of manifest.assets){counts[asset.class].files++;counts[asset.class].bytes+=asset.bytes;}
  console.log(`Wrote ${manifest.assets.length} external asset records to ${MANIFEST_PATH}.`);
  for(const [name,count]of Object.entries(counts))if(count.files)console.log(`${name}: ${count.files} files, ${count.bytes} bytes`);
  return manifest;
 }
 const manifest=await loadManifest(root);
 if(command==='verify'){const result=await verifyLocal(root,manifest);if(result.errors.length)process.exitCode=1;return result;}
 if(command==='push')return pushAssets(root,manifest);
 if(command==='pull')return pullAssets(root,manifest);
 throw Error(`Unknown asset-store command: ${command}`);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await runAssetStore(process.argv[2]);}catch(error){console.error(error.message);process.exitCode=1;}
}
