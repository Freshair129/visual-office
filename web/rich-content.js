import {marked,createDOMPurify} from './vendor/rich/rich-libs.js';
import {DEVELOPMENT_INTERACTIVE_POLICY} from './rich-content-dev-policy.js';
let purifier,mermaidPromise,diagramNumber=0;
// Replaced by a literal in the release bundle so dev-only branches are removed.
const releaseBuild=typeof __OFFICE_RELEASE__!=='undefined'&&__OFFICE_RELEASE__===true;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
marked.use({renderer:{image({href,text}){return '<a href="'+escape(href)+'">ดูรูปภาพ'+(text?' · '+escape(text):'')+'</a>';}}});
const clean=()=>purifier??=createDOMPurify(window);
const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(label,action)=>{const b=element('button',label);b.type='button';b.onclick=action;return b;};
const copy=async(b,text)=>{try{await navigator.clipboard.writeText(text);b.textContent='คัดลอกแล้ว';}catch{b.textContent='เลือกและคัดลอกจากโค้ดได้';}};
const RELEASE_INTERACTIVE_POLICY="default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; worker-src 'none'";
export const INTERACTIVE_POLICY=releaseBuild?RELEASE_INTERACTIVE_POLICY:DEVELOPMENT_INTERACTIVE_POLICY;
function releasePreviewMarkup(source){
 const sanitized=clean().sanitize(String(source),{USE_PROFILES:{html:true,svg:true,svgFilters:true},FORBID_TAGS:['script','style','link','meta','base','iframe','object','embed','form'],FORBID_ATTR:['style','srcset','srcdoc','action','formaction','background']});
 const parsed=new DOMParser().parseFromString(sanitized,'text/html');
 for(const element of parsed.body.querySelectorAll('*'))for(const attribute of [...element.attributes]){
  const name=attribute.name.toLowerCase();
  if(name.startsWith('on')||name==='style'||['src','srcset','poster','action','formaction','data','manifest','background','longdesc'].includes(name)){element.removeAttribute(attribute.name);continue;}
  if((name==='href'||name==='xlink:href')&&!attribute.value.trim().startsWith('#'))element.removeAttribute(attribute.name);
 }
 return parsed.body.innerHTML;
}
export function interactiveDocument(source,{cspSafe=releaseBuild}={}){
 // The release client never emits the development policy, whatever the caller asks.
 cspSafe=releaseBuild||cspSafe;
 const policy=cspSafe?RELEASE_INTERACTIVE_POLICY:DEVELOPMENT_INTERACTIVE_POLICY;
 const body=cspSafe?releasePreviewMarkup(source):source;
 const defaultStyle=cspSafe?'':'<style>body{font:14px/1.6 system-ui,sans-serif;color:#1f2937;margin:20px;background:white}button,input,select{font:inherit}button{cursor:pointer}img,svg,canvas{max-width:100%}</style>';
 return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+policy+'"><meta name="viewport" content="width=device-width,initial-scale=1">'+defaultStyle+'</head><body>'+body+'</body></html>';
}
export function safeSvg(source,{cspSafe=releaseBuild}={}){
 cspSafe=releaseBuild||cspSafe;
 const result=clean().sanitize(source,{USE_PROFILES:{svg:true,svgFilters:true},FORBID_TAGS:['foreignObject','image','a','script']});
 const doc=new DOMParser().parseFromString(result,'image/svg+xml');const svg=doc.documentElement;
 if(svg.localName!=='svg'||doc.querySelector('parsererror'))throw new Error('Invalid SVG');
 for(const node of [svg,...svg.querySelectorAll('*')]){
  for(const attr of [...node.attributes])if((/href$/i.test(attr.name)&&!attr.value.startsWith('#'))||[...attr.value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].some(m=>!m[2].trim().startsWith('#')))node.removeAttribute(attr.name);
   if(node.localName==='style'){
    if(cspSafe){node.remove();continue;}
    node.textContent=node.textContent.replace(/@import[^;]+;/gi,'').replace(/url\([^)]*\)/gi,m=>/^url\(\s*['"]?#/.test(m)?m:'none');
   }
  if(cspSafe)for(const attr of [...node.attributes])if(attr.name.toLowerCase()==='style')node.removeAttribute(attr.name);
 }
 return document.importNode(svg,true);
}
function getMermaid(){return mermaidPromise??=import('./vendor/rich/mermaid.js').then(({default:m})=>{m.initialize({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true,theme:'base',fontFamily:'Plex, sans-serif',htmlLabels:false,flowchart:{htmlLabels:false},themeVariables:{primaryColor:'#FFF8EE',primaryTextColor:'#1F2937',primaryBorderColor:'#E8820C',lineColor:'#526174',secondaryColor:'#EEF1F4',tertiaryColor:'#FFFFFF'}});return m;});}
function codeCard(source,language){
 const card=element('section',undefined,'rich-card'),bar=element('div',undefined,'rich-card-bar');bar.append(element('span',language||'code'));
 const cp=button('คัดลอก',()=>void copy(cp,source));bar.append(cp);card.append(bar);
 const details=element('details',undefined,'rich-source');details.append(element('summary','ดูโค้ด'));const pre=element('pre');pre.append(element('code',source));details.append(pre);card.append(details);return{card,bar,details};
}
function diagramCard(source,language,onResize){
 const {card,bar,details}=codeCard(source,language==='mermaid'?'Mermaid':'SVG diagram');
 const canvas=element('div',undefined,'diagram-canvas'),stage=element('div',undefined,'diagram-stage');canvas.append(stage);card.insertBefore(canvas,details);stage.textContent='กำลังสร้างแผนภาพ…';card.dataset.renderState='waiting';
 let scale=1,rendered=false;const zoom=n=>{scale=Math.max(.5,Math.min(3,n));stage.style.width=Math.round(scale*100)+'%';};
 const controls=element('div',undefined,'diagram-controls');controls.append(button('−',()=>zoom(scale-.25)),button('+',()=>zoom(scale+.25)),button('พอดี',()=>zoom(1)));bar.insertBefore(controls,bar.lastChild);
 async function draw(){if(rendered)return;rendered=true;try{if(source.length>6000)throw new Error('Diagram too large');let svg;
   if(language==='mermaid'){await document.fonts?.ready;const m=await getMermaid();const result=await m.render('zuri-diagram-'+(++diagramNumber),source);svg=safeSvg(result.svg);}else svg=safeSvg(source);
   if(!card.isConnected)return;onResize({before:true});svg.removeAttribute('height');svg.setAttribute('width','100%');svg.style.maxWidth='none';stage.replaceChildren(svg);card.dataset.renderState='ready';
   const download=button('SVG',()=>{const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));const a=element('a');a.href=url;a.download='zuri-diagram.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});bar.append(download);onResize();
  }catch{onResize({before:true});stage.textContent='ยังแสดงแผนภาพนี้ไม่ได้ · เปิดดูโค้ดเพื่อตรวจรูปแบบ';card.dataset.renderState='error';details.open=true;onResize();}}
 if(typeof IntersectionObserver==='function'){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void draw();}});observer.observe(card);card._richObserver=observer;}else void draw();
 return card;
}
function interactiveCard(source,onResize){
 const {card,bar,details}=codeCard(source,'Interactive');card.classList.add('interactive-card');
 const hint=element('p',releaseBuild?'HTML · ตัวอย่างแบบอ่านอย่างเดียว':'HTML / JavaScript · เปิดเพื่อโต้ตอบกับชิ้นงาน','interactive-hint');card.insertBefore(hint,details);
 const openLabel=releaseBuild?'ดูตัวอย่างแบบอ่านอย่างเดียว':'เปิดชิ้นงาน';
 const run=button(openLabel,()=>{
  onResize({before:true});
  if(card.querySelector('iframe')){const frame=card.querySelector('iframe');frame.remove();run.textContent=openLabel;hint.hidden=false;onResize();return;}
  const frame=element('iframe');frame.title=releaseBuild?'ตัวอย่าง HTML แบบอ่านอย่างเดียว':'ชิ้นงาน interactive';frame.setAttribute('sandbox',releaseBuild?'':'allow-scripts');frame.setAttribute('referrerpolicy','no-referrer');frame.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'");
  frame.srcdoc=interactiveDocument(source);card.insertBefore(frame,details);run.textContent='ปิดตัวอย่าง';hint.hidden=true;onResize();
 });bar.insertBefore(run,bar.lastChild);return card;
}
export function renderRichMessage(container,text,{onResize=()=>{}}={}){
 container.classList.add('markdown-body');container.innerHTML=clean().sanitize(marked.parse(text,{gfm:true,breaks:true}),{USE_PROFILES:{html:true},FORBID_TAGS:['iframe','style','form','input','button','textarea','img'],FORBID_ATTR:['style','id','name']});
 for(const a of container.querySelectorAll('a')){try{const u=new URL(a.getAttribute('href'),location.href);if(!['https:','http:'].includes(u.protocol)){a.removeAttribute('href');continue;}a.target='_blank';a.rel='noopener noreferrer';}catch{a.removeAttribute('href');}}
 for(const img of container.querySelectorAll('img')){const a=element('span',img.alt||'รูปภาพ');try{const u=new URL(img.getAttribute('src'),location.href);if(['https:','http:'].includes(u.protocol)){const link=element('a','ดูรูปภาพ'+(img.alt?' · '+img.alt:''));link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';img.replaceWith(link);continue;}}catch{}img.replaceWith(a);}
 for(const table of container.querySelectorAll('table')){const wrap=element('div',undefined,'table-scroll');table.replaceWith(wrap);wrap.append(table);}
 let cards=0;for(const code of container.querySelectorAll('pre > code')){const language=(code.className.match(/language-([\w-]+)/)||[])[1]?.toLowerCase()||'',source=code.textContent;
  if(++cards>8)continue;
  if(['mermaid','svg'].includes(language))code.parentElement.replaceWith(diagramCard(source,language,onResize));
  else if(['html','interactive'].includes(language))code.parentElement.replaceWith(interactiveCard(source,onResize));
  else{const {card,details}=codeCard(source,language);details.open=true;details.querySelector('summary').hidden=true;code.parentElement.replaceWith(card);}
 }
}
export function disposeRichMessages(root){for(const card of root.querySelectorAll('.rich-card')){card._richObserver?.disconnect();if(card.dataset.previewUrl)URL.revokeObjectURL(card.dataset.previewUrl);}}
