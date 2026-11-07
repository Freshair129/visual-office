// Keep the selected isometric camera while fitting larger authored floor plates.
export function tycoonCameraFrame(room,ratio=1,scale=1,kind='projects'){
  ratio=Math.max(.1,ratio);scale=Math.max(.1,scale);
  const width=Number.isFinite(room?.width)?room.width:16,depth=Number.isFinite(room?.depth)?room.depth:10;
  const horizontal=(width+depth)/Math.SQRT2+2;
  const vertical=(width+depth)/Math.SQRT2*.52+2.8*Math.sqrt(1-.52**2)+2;
  const height=Math.max(kind==='building'?21:14,23/ratio,kind==='building'?0:horizontal/ratio,kind==='building'?0:vertical)/scale;
  const plan=room?.blueprintPlan;
  return {height,width:height*ratio,centerX:plan?plan.originX+plan.width/2+2:0,centerZ:plan?plan.originZ+plan.depth/2+2:0};
}
