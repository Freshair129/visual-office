// Declarative local navigation only. No HTML, URLs or arbitrary code.
export function useOfficeInteraction(root,object,{onFloor,onElevator}={}){
  const a=object?.interaction;if(!a||a.type==='none')return;
  if(a.type==='floor')return onFloor?.(a.floor);
  if(a.type==='elevator')return onElevator?.();
  if(a.type!=='popup')return;
  root.querySelector('.native-popup')?.remove();
  const doc=root.ownerDocument,d=doc.createElement('dialog');d.className='hy-interaction-popup native-popup';
  const h=doc.createElement('h2');h.textContent=a.title||'รายละเอียด';
  const p=doc.createElement('p');p.textContent=a.body;
  const close=doc.createElement('button');close.type='button';close.textContent='ปิด';close.onclick=()=>d.close();
  d.setAttribute('aria-label',h.textContent);d.append(h,p,close);root.append(d);d.showModal();
}
