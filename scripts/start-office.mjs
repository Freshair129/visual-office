// Windows sign-in launcher. Uses Node directly; no PowerShell script policy changes.
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {openSync,closeSync} from 'node:fs';
import {mkdir,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {t3Executable,t3Url} from './t3-auth.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);await mkdir('.local',{recursive:true});
const env={...process.env};delete env.PSModulePath;
// Codex desktop bundles its CLI in versioned directories; find the latest binary at sign-in.
const codexRoot=path.join(process.env.LOCALAPPDATA??path.join(homedir(),'AppData/Local'),'OpenAI/Codex/bin');
try{const entries=await readdir(codexRoot,{withFileTypes:true});const candidates=await Promise.all(entries.filter(e=>e.isDirectory()).map(async e=>{const directory=path.join(codexRoot,e.name);const info=await stat(path.join(directory,'codex.exe')).catch(()=>null);return info?{directory,time:info.mtimeMs}:null;}));const latest=candidates.filter(Boolean).sort((a,b)=>b.time-a.time)[0];const pathKey=Object.keys(env).find(k=>k.toLowerCase()==='path')??'Path';if(latest)env[pathKey]=latest.directory+path.delimiter+(env[pathKey]??'');}catch{}
const run=promisify(execFile);
const ps=command=>run(path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-Command',command],{windowsHide:true,env});
const launch=(exe,args,prefix)=>{const out=openSync('.local/'+prefix+'.stdout.log','a'),err=openSync('.local/'+prefix+'.stderr.log','a');try{const child=spawn(exe,args,{cwd:root,env,windowsHide:true,detached:true,stdio:['ignore',out,err]});child.unref();return child.pid;}finally{closeSync(out);closeSync(err);}};
const {stdout:owner}=await ps("$taskListener=Get-NetTCPConnection -LocalPort 3773 -State Listen -ErrorAction SilentlyContinue; if($taskListener){(Get-Process -Id $taskListener[0].OwningProcess).Path}");
if(owner.trim()&&owner.trim().toLowerCase()!==t3Executable.toLowerCase())throw new Error('Port 3773 belongs to another application');
if(!owner.trim()){
 const pid=launch(t3Executable,['--host','127.0.0.1','--port','3773','--no-browser'],'t3-server');await writeFile('.local/t3-server.pid',String(pid));
 for(let attempt=0;attempt<20;attempt++){try{const r=await fetch(t3Url+'/.well-known/t3/environment',{signal:AbortSignal.timeout(1000)});if(r.ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
}
let oldPid;try{oldPid=Number((await readFile('.local/bridge.pid','utf8')).trim())}catch{}
if(Number.isSafeInteger(oldPid)&&oldPid>0){const {stdout}=await ps(`(Get-CimInstance Win32_Process -Filter 'ProcessId=${oldPid}' -ErrorAction SilentlyContinue).CommandLine`);if(stdout.includes('scripts/bridge.mjs')){console.log('Office bridge already running');process.exit(0);}}
const pid=launch(process.execPath,['scripts/bridge.mjs'],'bridge');await writeFile('.local/bridge.pid',String(pid));console.log('Office runtime started');
