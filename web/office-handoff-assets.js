import {TYCOON_FACTORY_ASSETS} from './tycoon-factory-assets.js';
import {tycoonStructure} from './tycoon-blueprint.js';
import {sha256} from './office-world-identity.js';
import {inspectCustomGLB,verifyCustomMeasurement,disposeCustomModel} from './custom-assets.js';

export async function collectHandoffAssets(rooms,{readFile,readCustom}={}){
  const manifest=JSON.parse(new TextDecoder().decode(await readFile('assets/models/tycoon/manifest.json'))),wanted=new Map();
  const add=(kind,asset=null)=>{const key=asset?'custom/'+asset.id:kind;if(!wanted.has(key))wanted.set(key,{descriptors:[]});if(asset)wanted.get(key).descriptors.push(asset);};
  add('actor');
  for(const room of Object.values(rooms)){for(const o of tycoonStructure(room))add(o.kind);for(const o of room.objects)add(o.kind,o.asset||null);}
  const descriptors={},blobs=new Map();let total=0;
  for(const [key,entry]of wanted){
    const custom=entry.descriptors[0]||null;
    const factory=TYCOON_FACTORY_ASSETS[key],meta=factory||manifest.assets.find(a=>a.kind===key);
    if(!custom&&(!meta||!/^[a-z0-9-]+\.glb$/.test(meta.file)))throw Error('Missing model: '+key);
    if(custom&&typeof readCustom!=='function')throw Error('Custom GLB reader is required');
    const bytes=new Uint8Array(custom?await readCustom(custom.id):await readFile('assets/models/'+(factory?'tycoon-factory/':'tycoon/')+meta.file));
    if(bytes.byteLength<20||bytes.byteLength>20_000_000||new DataView(bytes.buffer,bytes.byteOffset).getUint32(0,true)!==0x46546c67)throw Error('Invalid/oversized GLB');
    const hash=await sha256(bytes);if(hash!==(custom?custom.id:meta.sha256))throw Error('Model hash mismatch: '+key);
    if(custom){const measurement=await inspectCustomGLB(bytes,{geometryOnly:true});try{if(measurement.id!==hash)throw Error('Custom GLB hash mismatch: '+key);for(const asset of entry.descriptors)verifyCustomMeasurement(measurement,asset);}finally{disposeCustomModel(measurement.model);}}
    const uri=`assets/${hash}.glb`;descriptors[key]={sha256:hash,bytes:bytes.length,uri};if(!blobs.has(uri)){total+=bytes.length;if(total>64_000_000)throw Error('Asset package exceeds 64 MB');blobs.set(uri,bytes);}
  }
  return {descriptors,blobs};
}

export async function verifyCustomAssetMeasurements(entities,readAsset){
  if(!Array.isArray(entities)||typeof readAsset!=='function')throw Error('Invalid packaged custom asset input');
  const byId=new Map(entities.map(entity=>[entity.id,entity])),groups=new Map();
  for(const placement of entities.filter(entity=>entity.type==='placement')){
    const object=placement.data?.object;if(object?.kind!=='custom')continue;
    const asset=object.asset,revisionRefs=(placement.refs||[]).filter(ref=>ref.relation==='revision'),revision=revisionRefs.length===1?byId.get(revisionRefs[0].targetId):null;
    if(!asset||!revision||revision.type!=='assetRevision'||revision.data?.sha256!==asset.id||revision.data?.uri!==`assets/${asset.id}.glb`)throw Error('Custom placement does not reference its content-addressed GLB revision');
    let group=groups.get(asset.id);if(!group){group={revision,descriptors:[]};groups.set(asset.id,group);}else if(group.revision.id!==revision.id)throw Error('Custom GLB has inconsistent package revisions');
    group.descriptors.push(asset);
  }
  for(const [hash,{revision,descriptors}]of groups){
    const bytes=new Uint8Array(await readAsset(revision.data.uri)),measurement=await inspectCustomGLB(bytes,{geometryOnly:true});
    try{if(measurement.id!==hash)throw Error('Packaged custom GLB hash mismatch');for(const descriptor of descriptors)verifyCustomMeasurement(measurement,descriptor);}finally{disposeCustomModel(measurement.model);}
  }
}

const encoder=new TextEncoder();
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
// Deterministic, bounded ZIP/store writer. Paths are fixed names or verified content hashes.
export function handoffZip(manifest,blobs,schema){
  const files=new Map([['manifest.json',encoder.encode(JSON.stringify(manifest,null,2)+'\n')],['schema.json',encoder.encode(JSON.stringify(schema,null,2)+'\n')],['README.txt',encoder.encode('Design registration proposal. IDs are external design identities, not registered Zuri AgentInstances. Resolve tenant/Business and validate roles/capabilities at the receiver. See manifest contentHash and asset SHA-256. No DB write or operational approval is included.\n')],...blobs]);
  files.set('id-map.json',encoder.encode(JSON.stringify(manifest.entities.map(e=>({externalSource:'visual-office-design',externalId:e.id,kind:e.type,key:e.key,zuriId:null})),null,2)+'\n'));
  const local=[],central=[];let offset=0;
  const u16=(v,n,x)=>v.setUint16(n,x,true),u32=(v,n,x)=>v.setUint32(n,x,true);
  for(const [path,bytes]of files){if(!/^(manifest\.json|schema\.json|id-map\.json|README\.txt|assets\/[0-9a-f]{64}\.glb)$/.test(path))throw Error('Unsafe archive path');const name=encoder.encode(path),crc=crc32(bytes),header=new Uint8Array(30+name.length),h=new DataView(header.buffer);
    u32(h,0,0x04034b50);u16(h,4,20);u16(h,12,33);u32(h,14,crc);u32(h,18,bytes.length);u32(h,22,bytes.length);u16(h,26,name.length);header.set(name,30);local.push(header,bytes);
    const entry=new Uint8Array(46+name.length),e=new DataView(entry.buffer);u32(e,0,0x02014b50);u16(e,4,20);u16(e,6,20);u16(e,14,33);u32(e,16,crc);u32(e,20,bytes.length);u32(e,24,bytes.length);u16(e,28,name.length);u32(e,42,offset);entry.set(name,46);central.push(entry);offset+=header.length+bytes.length;
  }
  const centralSize=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);u32(e,0,0x06054b50);u16(e,8,files.size);u16(e,10,files.size);u32(e,12,centralSize);u32(e,16,offset);
  const output=new Uint8Array(offset+centralSize+22);let cursor=0;for(const bytes of [...local,...central,end]){output.set(bytes,cursor);cursor+=bytes.length;}return output;
}
