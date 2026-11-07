// Persistent scene identities use secure UUID material; group and layer attributes have separate lifecycles.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCAL_ID=/^[a-z][a-z0-9-]{0,63}$/;

export function createLocalDesignId(prefix,usedIds=new Set(),maxLength=64){
  if(typeof prefix!=='string'||!/^[a-z][a-z0-9-]*$/.test(prefix)||!Number.isInteger(maxLength)||maxLength<1||!(usedIds instanceof Set))throw Error('Invalid local design ID request');
  const suffixLength=Math.min(32,maxLength-prefix.length-1);
  if(suffixLength<24)throw Error('Local design ID limit is too short for a secure UUID');
  const crypto=globalThis.crypto;
  if(typeof crypto?.randomUUID!=='function')throw Error('Secure UUID generation is unavailable');
  for(let attempt=0;attempt<16;attempt++){
    const uuid=crypto.randomUUID();
    if(typeof uuid!=='string'||!UUID.test(uuid))throw Error('Secure UUID provider returned an invalid value');
    const id=`${prefix}-${uuid.replaceAll('-','').toLowerCase().slice(0,suffixLength)}`;
    if(id.length<=maxLength&&LOCAL_ID.test(id)&&!usedIds.has(id)){usedIds.add(id);return id;}
  }
  throw Error('Unable to allocate a unique local design ID');
}
