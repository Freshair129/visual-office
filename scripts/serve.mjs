import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {loadBridgeConfig} from './bridge-config.mjs';
import {createZuriConnector} from './zuri-connector.mjs';
import {proxyOfficeRequest} from './office-proxy.mjs';
import {rewriteBareThreeImports} from './office-browser-modules.mjs';
import {normalizeZuriOrigin} from '../web/office-zuri-transfer.js';
const root=resolve('web'),port=Number(process.env.PORT||4173);
// Static preview never loads bridge credentials or forwards requests to a Site.
const config=process.argv.includes('--preview')?null:await loadBridgeConfig().catch(()=>null);
const zuriConnector=createZuriConnector({enabled:process.argv.includes('--zuri')});
// Explicit local preview configuration; deployed builds retain their own static configuration.
const handoffOrigin=process.argv.includes('--preview')&&process.env.OFFICE_HANDOFF_ZURI_ORIGIN?normalizeZuriOrigin(process.env.OFFICE_HANDOFF_ZURI_ORIGIN):null;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.gltf':'model/gltf+json','.glb':'model/gltf-binary','.ttf':'font/ttf','.json':'application/json'};
http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://127.0.0.1:'+port);
 if(u.pathname==='/office-zuri-config.json'&&handoffOrigin){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(JSON.stringify({origins:[handoffOrigin]}));return;}
 if(u.pathname.startsWith('/api/zuri')){await zuriConnector(req,res,u);return;}
 if(u.pathname.startsWith('/api/')){
  const request=new Request(u,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
  const response=await proxyOfficeRequest(request,{config});
  res.writeHead(response.status,Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));return;
 }
 const path=resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}if(!(await stat(path)).isFile())throw Error('not found');
 const bytes=await readFile(path),body=extname(path)==='.js'?rewriteBareThreeImports(bytes.toString('utf8'),path,root):bytes;
 res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}).end(body);
}catch{res.writeHead(404).end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}`));
