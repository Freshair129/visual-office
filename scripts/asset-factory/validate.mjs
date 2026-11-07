import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';

// Structural inspection is deliberately not a substitute for renderer or art QA.
export function inspectGlb(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 20 || bytes.toString('ascii',0,4) !== 'glTF' ||
      bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw Error('invalid GLB header');
  const length = bytes.readUInt32LE(12);
  if (bytes.toString('ascii',16,20) !== 'JSON' || length % 4 || 20 + length > bytes.length) throw Error('invalid JSON chunk');
  const json = JSON.parse(bytes.toString('utf8',20,20+length));
  let offset=20+length, binLength=null;
  while (offset < bytes.length) {
    if (offset+8 > bytes.length) throw Error('truncated chunk header');
    const chunkLength=bytes.readUInt32LE(offset), type=bytes.toString('ascii',offset+4,offset+8);
    if (chunkLength % 4 || offset+8+chunkLength > bytes.length) throw Error('invalid chunk length');
    if (type === 'JSON') throw Error('duplicate JSON chunk');
    if (type === 'BIN\0') {
      if (binLength !== null) throw Error('duplicate BIN chunk');
      binLength=chunkLength;
    }
    offset+=8+chunkLength;
  }
  if (json.asset?.version !== '2.0' || !Array.isArray(json.meshes) || !json.meshes.length) throw Error('missing glTF meshes');
  if (json.meshes.some(mesh=>!Array.isArray(mesh?.primitives) || !mesh.primitives.length)) throw Error('missing mesh primitives');
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    const position=primitive?.attributes?.POSITION;
    if (!Number.isInteger(position) || position < 0 || !Array.isArray(json.accessors) || position >= json.accessors.length || !json.accessors[position]) throw Error('invalid position accessor');
  }
  const internal=(json.buffers || []).filter(item=>!item.uri);
  if (internal.length > 1 || (internal.length && (!Number.isInteger(internal[0].byteLength) || internal[0].byteLength < 0 || binLength === null || internal[0].byteLength > binLength || binLength-internal[0].byteLength > 3))) throw Error('invalid binary buffer');
  for (const item of [...(json.buffers || []), ...(json.images || [])]) {
    if (item.uri && !item.uri.startsWith('data:')) throw Error('external dependency');
  }
  return {meshes:json.meshes.length, materials:json.materials?.length || 0, skins:json.skins?.length || 0,
    animations:(json.animations || []).map(a=>a.name || ''), bytes:bytes.length};
}

export async function validateManifest(manifest, read) {
  const errors=[], assets=[], ids=new Set(), kinds=new Set(), files=new Set();
  if (!Array.isArray(manifest?.assets) || !manifest.assets.length) return {ok:false, errors:['missing assets'], assets};
  for (const asset of manifest.assets) {
    for (const [key,set] of [['id',ids],['kind',kinds],['file',files]]) {
      if (typeof asset?.[key] !== 'string' || !asset[key]) errors.push(`missing ${key}`);
      else if (set.has(asset[key])) errors.push(`duplicate ${key}: ${asset[key]}`);
      else set.add(asset[key]);
    }
    if (typeof asset?.file !== 'string' || !/^[a-z0-9-]+\.glb$/.test(asset.file)) { errors.push(`unsafe file: ${asset?.file}`); continue; }
    try {
      const bytes=await read(asset.file), info=inspectGlb(bytes);
      if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) errors.push(`hash mismatch: ${asset.file}`);
      if (asset.bytes !== undefined && bytes.length !== asset.bytes) errors.push(`size mismatch: ${asset.file}`);
      assets.push({id:asset.id,kind:asset.kind,...info});
    } catch (error) { errors.push(`${asset.file}: ${error.message}`); }
  }
  return {ok:errors.length===0,errors,assets};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory=resolve(process.argv[2] || 'web/assets/models/tycoon');
  try {
    const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
    const result=await validateManifest(manifest, file=>readFile(join(directory,file)));
    console.log(JSON.stringify(result,null,2)); if (!result.ok) process.exitCode=1;
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
