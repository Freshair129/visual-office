// Receives secrets through hidden PTY stdin; encrypts for this Windows user.
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
await mkdir('.local',{recursive:true});
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');process.stdin.resume();
console.log('Ready for bridge configuration JSON (input hidden).');
let input='';
process.stdin.on('data',chunk=>{
 if(chunk.includes('\u0003'))process.exit(130);
 input+=chunk;if(!/[\r\n]/.test(input))return;
 process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);
 let config;try{config=JSON.parse(input.trim());if(!config.siteUrl?.startsWith('https://')||!config.siteBearer||!config.syncKey)throw new Error();}catch{console.error('Invalid configuration');process.exit(1);}
 const command="$taskInput=[Console]::In.ReadToEnd(); $taskSecure=ConvertTo-SecureString -String $taskInput -AsPlainText -Force; ConvertFrom-SecureString -SecureString $taskSecure | Set-Content -LiteralPath '.local/bridge-config.dpapi' -Encoding utf8";
 const env={...process.env};delete env.PSModulePath;
 const child=spawn('powershell.exe',['-NoProfile','-Command',command],{windowsHide:true,env,stdio:['pipe','ignore','pipe']});
 child.stdin.end(JSON.stringify(config));child.on('exit',code=>{console.log(code===0?'Encrypted bridge configuration saved.':'Encryption failed.');process.exit(code??1);});
});
