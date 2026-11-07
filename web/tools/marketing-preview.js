import {TycoonView} from '../tycoon-view.js';
import {ZuriConnector} from '../zuri-connector.js';
const log=document.querySelector('#calls'),scenario=document.querySelector('#scenario'),pending=document.querySelector('#pending');
const refreshLog=async()=>{const r=await fetch('/__fixture/log');if(!r.ok)throw Error('Synthetic server required');const data=await r.json();log.textContent=JSON.stringify(data,null,2);pending.textContent='คำตอบค้าง: '+data.pending;};
const control=async body=>{const r=await fetch('/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('Synthetic control rejected');await refreshLog();};
const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
// Relative same-origin requests only; this page requires the isolated fixture server.
const connector=new ZuriConnector({fetchImpl:async(path,init)=>{if(!path.startsWith('/api/zuri/'))throw Error('fixture route');const r=await fetch(path,init);await refreshLog();return r;}});
await refreshLog();
const view=new TycoonView(document.querySelector('#world'),{connector,storage,onNavigate:floor=>{location.hash='office/'+(floor||'building');},onStudio:()=>alert('Playtest นี้ทดสอบ Marketing read เท่านั้น · Studio เดิมยังอยู่ในแอปหลัก'),onLegacy:()=>alert('Playtest นี้ใช้ GLB edition')});
const show=()=>{const floor=location.hash.split('/')[1];view.show(['lobby','projects','growth'].includes(floor)?floor:'building');};
window.addEventListener('hashchange',show);show();
scenario.onchange=()=>control({scenario:scenario.value});
document.querySelector('#release').onclick=()=>control({action:'release'});
document.querySelector('#expire').onclick=async()=>{await control({action:'expire'});view.data.deny('AUTH_REQUIRED');};
document.querySelector('#reset').onclick=async()=>{await control({action:'reset'});void view.data.connect();};
document.querySelector('#mobile').onclick=()=>document.body.classList.toggle('mobile');

// Never follow a real login/navigation link from this synthetic surface.
document.addEventListener('click',event=>{if(event.target.closest('a')){event.preventDefault();event.stopImmediatePropagation();}},true);
