// Candidate-only contract. Public Zuri API/auth remains unselected.
export const CONTEXT_PROFILE='office-domain-context/v1-candidate';
export const CONTEXT_PATH='/api/zuri/synthetic/domain-context';
export const CONTEXT_BYTES=65536;
export const domainKeyValid=key=>typeof key==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(key)&&!['scm','crm','business-home','lobby','studio','building'].includes(key);
const operations=['marketing.campaigns.read','marketing.overview.read'];
const fail=()=>{throw Error('Invalid candidate domain context');};
const text=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
function exact(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail();}
function array(v,max){if(!Array.isArray(v)||v.length>max)fail();}
export function parseOfficeDomainContext(raw,businessId,{wallNow}={}){
 exact(raw,['schemaVersion','businessId','contextRevision','generatedAt','sourceRevision','domains']);
 if(raw.schemaVersion!=='office-domain-context/v1'||!text(businessId,128)||raw.businessId!==businessId||!text(raw.contextRevision,128)||!/^[a-f0-9]{40}$/.test(raw.sourceRevision)||typeof wallNow!=='function')fail();
 const now=wallNow(),time=Date.parse(raw.generatedAt);
 if(!Number.isFinite(now)||!Number.isFinite(time)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(raw.generatedAt)||new Date(time).toISOString()!==raw.generatedAt||time>now||now-time>60000)fail();
 array(raw.domains,64);const keys=new Set();
 for(const row of raw.domains){
  exact(row,['domainKey','label','canonicalDomainId','availability','modules','reads','actions']);
  if(!domainKeyValid(row.domainKey)||keys.has(row.domainKey)||!text(row.label,160)||!(row.canonicalDomainId===null||text(row.canonicalDomainId,128))||!['ACTIVE','RESERVED','UNAVAILABLE'].includes(row.availability))fail();keys.add(row.domainKey);
  if(row.domainKey==='growth'&&row.canonicalDomainId!=='DOM-MARKETING')fail();
  if(row.modules!==null){array(row.modules,64);const modules=new Set();for(const m of row.modules){exact(m,['key','label']);if(typeof m.key!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(m.key)||modules.has(m.key)||!text(m.label,160))fail();modules.add(m.key);}}
  array(row.reads,2);array(row.actions,0);const seen=new Set();for(const hint of row.reads){exact(hint,['operation','decision']);if(row.domainKey!=='growth'||!operations.includes(hint.operation)||seen.has(hint.operation)||!['ALLOW','DENY','UNKNOWN'].includes(hint.decision))fail();seen.add(hint.operation);}
 }
 if(new TextEncoder().encode(JSON.stringify(raw)).length>CONTEXT_BYTES)fail();
 return JSON.parse(JSON.stringify(raw));
}
export function contextAllows(context,key,operation){return key==='growth'&&operations.includes(operation)&&context?.domains.some(d=>d.domainKey===key&&d.availability==='ACTIVE'&&d.reads.some(h=>h.operation===operation&&h.decision==='ALLOW'))===true;}
export async function readContextJSON(response){
 const reader=response.body?.getReader();if(!reader)fail();let size=0;const chunks=[];
 try{if(Number(response.headers.get('content-length'))>CONTEXT_BYTES)fail();for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>CONTEXT_BYTES)fail();chunks.push(value);}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
