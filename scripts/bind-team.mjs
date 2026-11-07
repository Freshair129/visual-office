import {readFile} from 'node:fs/promises';
import {loadBridgeConfig} from './bridge-config.mjs';
const config=await loadBridgeConfig();const headers={'OAI-Sites-Authorization':'Bearer '+config.siteBearer};
const response=await fetch(config.siteUrl+'/api/preferences',{headers});if(!response.ok)throw new Error('Preferences HTTP '+response.status);const existing=await response.json();
if(existing.assignments?.filter(a=>a.id).length===6){console.log('Keeping existing six desk assignments.');process.exit(0);}
const ids=JSON.parse(await readFile('.local/team-threads.json','utf8'));
const outfits=['#F5EFE4','#1F2937','#D6ECFA','#6B7280','#F5EFE4','#C6A052'],skins=['#dfaf8c','#f1c8a6','#dfaf8c','#b9825b','#82573e','#f1c8a6'],hairs=['bob','short','bun','short','bob','short'];
const prefs={assignments:ids.map(id=>({id,name:''})),avatars:existing.avatars??Object.fromEntries(ids.map((_,i)=>[i,{outfit:outfits[i],skin:skins[i],hair:hairs[i],glasses:[0,3].includes(i)}]))};
const saved=await fetch(config.siteUrl+'/api/preferences',{method:'PUT',headers:{...headers,origin:config.siteUrl,'content-type':'application/json'},body:JSON.stringify(prefs)});if(!saved.ok)throw new Error('Preferences save HTTP '+saved.status);
const verify=await fetch(config.siteUrl+'/api/preferences',{headers}).then(r=>r.json());if(JSON.stringify(verify)!==JSON.stringify(prefs))throw new Error('Preferences roundtrip mismatch');console.log('Six T3 sessions bound to desks; cloud preferences verified.');
