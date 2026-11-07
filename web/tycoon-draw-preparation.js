import {Vector4} from 'three';
// @tested tests/tycoon-draw-preparation.test.mjs
// Compile/reflection alone does not exercise the default framebuffer's driver
// draw path. Rehearse it only behind the hidden load gate, then clear before
// any yield. The fence polls command completion without blocking the JS thread.
export async function prepareTycoonHiddenDraw(renderer,scene,camera,{stage,actor,isCurrent=()=>true,yieldTurn=()=>new Promise(resolve=>setTimeout(resolve,10)),now=()=>performance.now(),maxWaitMs=10000}={}){
 const started=now(),gl=renderer?.getContext?.(),canvas=renderer?.domElement;
 let lost=false,sync=null,submitted=false,submitMs=0,polls=0,scissored=false;
 const onLost=()=>{lost=true;},reason=()=>!isCurrent()?'superseded':lost||gl?.isContextLost?.()?'context-lost':null;
 const result=(completed,cancelled,why)=>({completed,cancelled,submitted,submitMs,polls,scissored,durationMs:Math.max(0,now()-started),path:'default-framebuffer-draw-clear',...(why?{reason:why}:{})});
 canvas?.addEventListener?.('webglcontextlost',onLost);
 try{
  const invalid=reason();if(invalid)return result(false,true,invalid);
  if(!stage||stage.visible!==false)return result(false,false,'stage-not-hidden');
  if(!['render','clear','getRenderTarget','setRenderTarget','getScissorTest','setScissorTest'].every(key=>typeof renderer?.[key]==='function'))return result(false,false,'draw-preparation-unavailable');
  if(!['fenceSync','clientWaitSync','deleteSync','flush'].every(key=>typeof gl?.[key]==='function'))return result(false,false,'gpu-fence-unavailable');
  const target=renderer.getRenderTarget(),face=renderer.getActiveCubeFace?.(),mip=renderer.getActiveMipmapLevel?.(),scissor=renderer.getScissorTest(),stageVisible=stage.visible,actorVisible=actor?.visible;
  const rectangle=typeof renderer.getScissor==='function'&&typeof renderer.setScissor==='function'?renderer.getScissor(new Vector4()):null;
  const submitStarted=now();
  try{
   try{
    renderer.setRenderTarget(null);
    // Keep real geometry, camera, program variants and full shadow-map targets;
    // only the default framebuffer's fragment area is reduced. Shadow render
    // targets bind their own scissor state in the pinned Three renderer.
    if(rectangle){renderer.setScissor(0,0,1,1);renderer.setScissorTest(true);scissored=true;}
    stage.visible=true;if(actor)actor.visible=true;
    renderer.render(scene,camera);submitted=true;
   }finally{
    stage.visible=stageVisible;if(actor)actor.visible=actorVisible;
    // The actual default-buffer draw must never survive to a browser paint.
    try{renderer.setScissorTest(false);renderer.clear();}
    // Three's scissor getter is renderer-global; a non-null target then applies
    // its own scissorTest on bind. Restore the default first and bind last.
    finally{try{try{if(rectangle)renderer.setScissor(rectangle);}finally{renderer.setScissorTest(scissor);}}finally{renderer.setRenderTarget(target,face,mip);}}
   }
  }catch(error){const invalid=reason();if(invalid)return result(false,true,invalid);throw error;}
  submitMs=Math.max(0,now()-submitStarted);
  const stale=reason();if(stale)return result(false,true,stale);
  sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)return result(false,false,'gpu-fence-unavailable');
  gl.flush();
  for(;;){
   const invalid=reason();if(invalid)return result(false,true,invalid);
   const status=gl.clientWaitSync(sync,0,0);polls++;
   const afterPoll=reason();if(afterPoll)return result(false,true,afterPoll);
   if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)return result(true,false);
   if(status===gl.WAIT_FAILED)return result(false,false,'gpu-fence-failed');
   if(status!==gl.TIMEOUT_EXPIRED)return result(false,false,'gpu-fence-status-unavailable');
   if(now()-started>=maxWaitMs)return result(false,false,'gpu-draw-timeout');
   await yieldTurn();
  }
 }finally{
  try{if(sync)gl.deleteSync(sync);}finally{canvas?.removeEventListener?.('webglcontextlost',onLost);}
 }
}
