const escapeXml=value=>String(value||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');

export function optionalAssetPlaceholder(label='',kind='image'){
 const logo=kind==='logo',caption=logo?'ZURI':String(label||'Visual Office').slice(0,52);
 const svg=logo
  ?`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="40" fill="#f2ecdf"/><circle cx="80" cy="80" r="52" fill="#fffaf1" stroke="#dfd3bf" stroke-width="4"/><text x="80" y="93" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" letter-spacing="1" fill="#6f5c45">${escapeXml(caption)}</text></svg>`
  :`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#f7f3ea"/><stop offset="1" stop-color="#e9e1d3"/></linearGradient></defs><rect width="960" height="600" fill="url(#g)"/><path d="M0 430h960v170H0z" fill="#e4d9c8"/><path d="M104 430V220l226-120 226 120v210" fill="#eee6d8" stroke="#cbbb9f" stroke-width="12" stroke-linejoin="round"/><rect x="310" y="276" width="136" height="154" rx="8" fill="#d9e4e4" stroke="#cbbb9f" stroke-width="8"/><circle cx="720" cy="168" r="58" fill="#fffaf2" stroke="#e4d9c8" stroke-width="6"/><text x="480" y="520" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="600" fill="#766854">${escapeXml(caption)}</text></svg>`;
 return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function fallbackOptionalImage(image,{label,kind=image?.dataset?.optionalAsset||'image'}={}){
 if(!image)return false;
 const src=image.getAttribute('src');if(!src||src.startsWith('data:image/svg+xml,'))return false;
 const caption=label||image.dataset.optionalLabel||image.getAttribute('alt')||image.closest?.('.hy-object')?.querySelector?.('.hy-object-label')?.textContent||'Visual Office';
 image.dataset.optionalAssetOriginalSrc=src;
 image.dataset.optionalAssetPlaceholder=optionalAssetPlaceholder(caption,kind);
 image.dataset.optionalAssetFallback='true';
 image.removeAttribute('srcset');
 image.closest?.('picture')?.querySelectorAll('source').forEach(source=>source.removeAttribute('srcset'));
 image.src=image.dataset.optionalAssetPlaceholder;
 const sprite=image.closest?.('.hy-object')?.querySelector?.('.hy-sprite-art');
 if(sprite)sprite.style.backgroundImage=`url("${image.dataset.optionalAssetPlaceholder}")`;
 return true;
}

export function watchOptionalAssetImages(root){
 if(!root)return()=>{};
 const bind=image=>{
  const src=image?.getAttribute?.('src')||'';
  const localAsset=/assets\/(?:brand|office-world|studio-styles)\//.test(src)||/assets\/(?:zuri-wordmark|zuri-icon-ink)\.svg/.test(src);
  if(!image?.matches?.('img')||(!image.matches('img[data-optional-asset]')&&!localAsset)||image.dataset.optionalAssetBound==='true')return;
  if(!image.dataset.optionalAsset)image.dataset.optionalAsset=/assets\/brand\//.test(src)?'logo':'image';
  image.dataset.optionalAssetBound='true';
  image.addEventListener('error',()=>fallbackOptionalImage(image));
  image.addEventListener('load',()=>{
   if(image.getAttribute('src')!==image.dataset.optionalAssetPlaceholder){
    delete image.dataset.optionalAssetFallback;delete image.dataset.optionalAssetPlaceholder;delete image.dataset.optionalAssetOriginalSrc;
   }
  });
  if(image.complete&&image.naturalWidth===0)fallbackOptionalImage(image);
 };
 if(root.matches?.('img[data-optional-asset]'))bind(root);
 root.querySelectorAll?.('img').forEach(bind);
 const Observer=root.ownerDocument?.defaultView?.MutationObserver||globalThis.MutationObserver;
 if(!Observer)return()=>{};
 const observer=new Observer(records=>{for(const record of records){
  if(record.type==='attributes'){bind(record.target);continue;}
  for(const node of record.addedNodes){if(node.nodeType!==1)continue;bind(node);node.querySelectorAll?.('img').forEach(bind);}
 }});
 observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['src','data-optional-asset']});
 return()=>observer.disconnect();
}
