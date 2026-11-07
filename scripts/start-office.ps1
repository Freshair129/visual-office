$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$taskCodexRoot=Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin'
if(Test-Path -LiteralPath $taskCodexRoot){
 $taskCodexDirectory=Get-ChildItem -LiteralPath $taskCodexRoot -Directory | Where-Object {Test-Path -LiteralPath (Join-Path $_.FullName 'codex.exe')} | Sort-Object LastWriteTime -Descending | Select-Object -First 1
 if($taskCodexDirectory){$env:PATH=$taskCodexDirectory.FullName+';'+$env:PATH}
}
$taskT3=Join-Path $env:USERPROFILE '.t3\runtime\versions\0.0.45\t3.exe'
$taskListener=Get-NetTCPConnection -LocalPort 3773 -State Listen -ErrorAction SilentlyContinue
if(-not $taskListener){
 $taskProcess=Start-Process -FilePath $taskT3 -ArgumentList @('--host','127.0.0.1','--port','3773','--no-browser') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot '.local\t3-server.stdout.log') -RedirectStandardError (Join-Path $taskRoot '.local\t3-server.stderr.log') -PassThru
 $taskProcess.Id | Set-Content -LiteralPath (Join-Path $taskRoot '.local\t3-server.pid')
}else{
 $taskOwner=Get-Process -Id $taskListener[0].OwningProcess
 if($taskOwner.Path -ne $taskT3){throw 'Port 3773 is occupied by another application.'}
}
$taskBridgePidPath=Join-Path $taskRoot '.local\bridge.pid'
if(Test-Path -LiteralPath $taskBridgePidPath){
 $taskPid=[int](Get-Content -LiteralPath $taskBridgePidPath)
 $taskExisting=Get-CimInstance Win32_Process -Filter "ProcessId=$taskPid" -ErrorAction SilentlyContinue
 if($taskExisting -and $taskExisting.CommandLine -like '*scripts/bridge.mjs*'){return}
}
$taskNode=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if(-not (Test-Path -LiteralPath $taskNode)){$taskNode=(Get-Command node -ErrorAction Stop).Source}
$taskBridge=Start-Process -FilePath $taskNode -ArgumentList @('scripts/bridge.mjs') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot '.local\bridge.stdout.log') -RedirectStandardError (Join-Path $taskRoot '.local\bridge.stderr.log') -PassThru
$taskBridge.Id | Set-Content -LiteralPath $taskBridgePidPath
