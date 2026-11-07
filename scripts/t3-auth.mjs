import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {homedir} from 'node:os';
import path from 'node:path';
const run=promisify(execFile);
export const t3Executable=path.join(homedir(),'.t3/runtime/versions/0.0.45/t3.exe');
export const t3Url='http://127.0.0.1:3773';
export async function pairing(label='ZURI Office monitor'){
 const {stdout}=await run(t3Executable,['auth','pairing','create','--ttl','5m','--label',label,'--json'],{windowsHide:true});
 return JSON.parse(stdout);
}
export async function access(scopes='orchestration:read',label='ZURI Office monitor'){
 const issued=await pairing(label);
 const credential=issued.credential??issued.token;
 if(!credential)throw new Error('T3 pairing credential missing');
 const response=await fetch(t3Url+'/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:token-exchange',subject_token:credential,subject_token_type:'urn:t3:params:oauth:token-type:environment-bootstrap',requested_token_type:'urn:ietf:params:oauth:token-type:access_token',scope:scopes,client_label:'ZURI Office',client_device_type:'bot'}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('T3 authentication failed: HTTP '+response.status);
 const result=await response.json();
 if(result.scope.split(' ').sort().join(' ')!==scopes.split(' ').sort().join(' '))throw new Error('Unexpected T3 token scopes');
 return {token:result.access_token,expiresAt:Date.now()+result.expires_in*1000};
}
export async function t3Request(route,token,body){
 const response=await fetch(t3Url+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('T3 HTTP '+response.status+' on '+route);
 return response.json();
}
export async function revokeLabel(label){
 const {stdout}=await run(t3Executable,['auth','session','list','--json'],{windowsHide:true});
 const sessions=JSON.parse(stdout).filter(s=>s.client?.label===label&&s.subject==='one-time-token');
 for(const session of sessions)await run(t3Executable,['auth','session','revoke',session.sessionId],{windowsHide:true});
 return sessions.length;
}
