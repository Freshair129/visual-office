// Fixed art proportions; phones pan through the floor instead of shrinking props.
export function floorMapSize(width,height){const w=Math.max(1440,width,height*1.5)*1.2;return {width:w,height:w/1.5};}

export function attachFloorViewport(root,{isEmptyGround,nativeControls,framing='contain',overscan=1.25}={}){
 // The fullscreen map owns touch gestures; native mouse orbit remains available.
 const win=root.ownerDocument.defaultView;let drag=null,frame=null,initial=true,zoom=1,pinch=null,disposed=false;
 let nativeTouches;
 const setNativeControls=controls=>{
  if(disposed)return;
  if(nativeTouches)nativeControls.touches=nativeTouches;
  nativeControls=controls;nativeTouches=controls?.touches;
  if(nativeTouches)controls.touches={...nativeTouches,ONE:null,TWO:null};
 };
 setNativeControls(nativeControls);
 root.tabIndex=0;root.setAttribute('role','region');root.setAttribute('aria-label','ฉากทั้งชั้น · ลากพื้นที่ว่างหรือเลื่อนเพื่อดูห้อง · ใช้ปุ่มลูกศรได้');
 const center=()=>{root.scrollLeft=Math.max(0,(root.scrollWidth-root.clientWidth)/2);root.scrollTop=Math.max(0,(root.scrollHeight-root.clientHeight)/2);};
 const dimensions=()=>({width:root.clientWidth||win.innerWidth,height:root.clientHeight||win.innerHeight});
 const base=()=>{const d=dimensions();return floorMapSize(d.width,d.height).width;};
 // Campus art must extend beyond every screen edge, including at Fit/minimum zoom.
 // Floor editors retain whole-scene Fit so their complete room remains inspectable.
 const minimum=()=>{const d=dimensions();return (framing==='cover'?Math.max(d.width,d.height*1.5)*overscan:Math.min(d.width,d.height*1.5))/base();};
 const top=()=>Math.max(0,(dimensions().height-base()*zoom/1.5)/2);
 const apply=()=>{root.style.setProperty('--floor-map-width',`${base()*zoom}px`);root.style.setProperty('--floor-map-top',`${top()}px`);root.dataset.floorZoom=String(Math.round(zoom*100));};
 const zoomTo=(value,x=root.clientWidth/2,y=root.clientHeight/2)=>{if(disposed)return;const before=base()*zoom,oldTop=top(),left=root.scrollLeft,up=root.scrollTop;zoom=Math.max(minimum(),Math.min(3,value));apply();const ratio=base()*zoom/before;const oldLeft=Math.max(0,(root.clientWidth-before)/2),newLeft=Math.max(0,(root.clientWidth-base()*zoom)/2);root.scrollLeft=(left+x-oldLeft)*ratio-x+newLeft;root.scrollTop=(up+y-oldTop)*ratio-y+top();};
 const resize=()=>{zoom=initial&&framing==='cover'?minimum():Math.max(minimum(),Math.min(3,zoom));apply();if(initial&&root.clientWidth){initial=false;center();}};
 const wheel=e=>{if(e.target.closest('dialog,input,textarea,select'))return;e.preventDefault();e.stopPropagation();const r=root.getBoundingClientRect(),unit=e.deltaMode===1?16:e.deltaMode===2?root.clientHeight:1;zoomTo(zoom*Math.exp(-Math.max(-300,Math.min(300,e.deltaY*unit))*.002),e.clientX-r.left,e.clientY-r.top);};
 const fingers=e=>{const [a,b]=e.touches;return {distance:Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY),x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2};};
 const touchStart=e=>{if(e.touches.length!==2||e.target.closest('dialog'))return;e.preventDefault();drag=null;root.classList.remove('floor-panning');pinch={...fingers(e),zoom};};
 const touchMove=e=>{if(!pinch||e.touches.length!==2)return;e.preventDefault();const f=fingers(e),r=root.getBoundingClientRect();zoomTo(pinch.zoom*f.distance/Math.max(1,pinch.distance),pinch.x-r.left,pinch.y-r.top);root.scrollLeft+=pinch.x-f.x;root.scrollTop+=pinch.y-f.y;pinch={...f,zoom};};
 const touchEnd=()=>{pinch=null;};
 root.addEventListener('wheel',wheel,{passive:false,capture:true});root.addEventListener('touchstart',touchStart,{passive:false});root.addEventListener('touchmove',touchMove,{passive:false});root.addEventListener('touchend',touchEnd);root.addEventListener('touchcancel',touchEnd);
 const down=e=>{const control=e.target.closest('button,input,select,textarea,a,dialog,canvas');if(e.button!==0||e.pointerType==='touch'||control&&!(control.matches('.hy-object')&&isEmptyGround?.(e)===true))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:root.scrollLeft,top:root.scrollTop};root.setPointerCapture?.(e.pointerId);root.classList.add('floor-panning');};
 const move=e=>{if(!drag||e.pointerId!==drag.id)return;root.scrollLeft=drag.left+drag.x-e.clientX;root.scrollTop=drag.top+drag.y-e.clientY;};
 const end=e=>{if(!drag||e.pointerId!==drag.id)return;if(root.hasPointerCapture?.(e.pointerId))root.releasePointerCapture(e.pointerId);drag=null;root.classList.remove('floor-panning');};
 const key=e=>{if(e.target!==root)return;const delta={ArrowLeft:[-80,0],ArrowRight:[80,0],ArrowUp:[0,-80],ArrowDown:[0,80]}[e.key];if(delta){e.preventDefault();root.scrollLeft+=delta[0];root.scrollTop+=delta[1];}};
 for(const [event,handler]of [['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end],['keydown',key]])root.addEventListener(event,handler);
 const observer=win.ResizeObserver?new win.ResizeObserver(resize):null;observer?.observe(root);resize();frame=win.requestAnimationFrame?.(()=>{resize();center();});
 const dispose=()=>{setNativeControls(null);disposed=true;pinch=null;root.removeEventListener('wheel',wheel,true);root.removeEventListener('touchstart',touchStart);root.removeEventListener('touchmove',touchMove);root.removeEventListener('touchend',touchEnd);root.removeEventListener('touchcancel',touchEnd);if(frame!=null)win.cancelAnimationFrame?.(frame);observer?.disconnect();drag=null;root.classList.remove('floor-panning');for(const [event,handler]of [['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',end],['keydown',key]])root.removeEventListener(event,handler);};
 dispose.setNativeControls=setNativeControls;dispose.center=center;dispose.zoomTo=zoomTo;dispose.fit=()=>{zoomTo(minimum());center();};dispose.reset=()=>{zoomTo(1);center();};Object.defineProperty(dispose,'zoom',{get:()=>zoom});return dispose;
}
