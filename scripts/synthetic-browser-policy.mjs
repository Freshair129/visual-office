// Harness-only browser containment; never injected into the production build.
export const syntheticCsp="connect-src 'self'; form-action 'self'; object-src 'none'; base-uri 'self'";
export const navigationGuard=`(()=>{
 const allowed=value=>{try{return new URL(value,location.href).origin===location.origin}catch{return false}};
 document.addEventListener('click',e=>{const link=e.target.closest?.('a[href]');if(link&&!allowed(link.href)){e.preventDefault();e.stopImmediatePropagation();}},true);
 document.addEventListener('submit',e=>{if(!allowed(e.target.action)){e.preventDefault();e.stopImmediatePropagation();}},true);
 const open=window.open.bind(window);window.open=(url,...args)=>allowed(url)?open(url,...args):null;
})();`;
export const protectSyntheticHtml=html=>html.replace(/<head([^>]*)>/i,`<head$1><script>${navigationGuard}</script>`);
