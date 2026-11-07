import {posix} from 'node:path';
import {JSDOM} from 'jsdom';

// Static public HTML documents are browser entry points too (for example the
// embedded Character Lab). Parse without executing scripts or fetching resources.
export function browserModuleEntries(documents){
 const entries=new Set();
 for(const {path,html}of documents){
  const doc=JSDOM.fragment(html),origin='https://office-audit.invalid';
  let base,basePath;
  try{base=new URL(doc.querySelector('base[href]')?.getAttribute('href')||'',origin+'/'+path.slice(4));basePath='web'+decodeURIComponent(base.pathname);}catch{continue;}
  if(base.origin!==origin)continue;
  for(const script of doc.querySelectorAll('script[type="module" i][src]')){
   let src=script.getAttribute('src').trim().split(/[?#]/)[0];
   try{src=decodeURIComponent(src).replaceAll('\\','/');}catch{continue;}
   if(!src||/^[a-z][a-z\d+.-]*:|^\/\//i.test(src))continue;
   const target=posix.normalize(src.startsWith('/')?'web'+src:posix.join(basePath.endsWith('/')?basePath:posix.dirname(basePath),src));
   if(target.startsWith('web/')&&!target.endsWith('/'))entries.add(target);
  }
 }
 return [...entries].sort();
}
