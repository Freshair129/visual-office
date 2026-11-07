import {loadBridgeConfig} from './bridge-config.mjs';
const config=await loadBridgeConfig();
const response=await fetch(config.siteUrl+'/api/office',{headers:{'OAI-Sites-Authorization':'Bearer '+config.siteBearer},signal:AbortSignal.timeout(15000)});
if(!response.ok)throw new Error('Office HTTP '+response.status);
const snapshot=await response.json();console.log(JSON.stringify({version:snapshot.version,source:snapshot.source,hostStatus:snapshot.hostStatus,stale:snapshot.stale,receivedAt:snapshot.receivedAt,sessions:snapshot.sessions}));
