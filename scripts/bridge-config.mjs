import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
export async function loadBridgeConfig(){
 const env={...process.env};delete env.PSModulePath;
 const command="$taskSecure=(Get-Content -LiteralPath '.local/bridge-config.dpapi' -Raw).Trim() | ConvertTo-SecureString; $taskPtr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecure); try { [Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPtr)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPtr) }";
 const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-Command',command],{windowsHide:true,env});
 return JSON.parse(stdout);
}
