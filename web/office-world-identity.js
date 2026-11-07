// Fixed external-design namespace; never an actual Tenant/Business/AgentInstance ID.
export const WORLD_DESIGN_NAMESPACE='a5008f6e-4554-49c4-b2bc-7f8084857493';
const encoder=new TextEncoder();
export async function designId(kind,...keys){
  if(typeof kind!=='string'||!kind||keys.some(k=>typeof k!=='string'||!k))throw Error('Identity requires nonempty semantic keys');
  const namespace=Uint8Array.from(WORLD_DESIGN_NAMESPACE.replaceAll('-','').match(/../g),h=>parseInt(h,16)),name=encoder.encode(JSON.stringify([kind,...keys])),bytes=new Uint8Array(namespace.length+name.length);
  bytes.set(namespace);bytes.set(name,namespace.length);
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-1',bytes)).slice(0,16);hash[6]=(hash[6]&15)|0x50;hash[8]=(hash[8]&63)|0x80;
  const hex=Array.from(hash,n=>n.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function canonicalJSON(value){
  const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
  return JSON.stringify(sort(value));
}
export async function sha256(value){const bytes=typeof value==='string'?encoder.encode(value):value;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');}
