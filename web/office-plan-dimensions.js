// Dimensions come from authored metric geometry. A zone is not assumed enclosed.
const close=(a,b)=>Math.abs(a-b)<1e-6;
function covered(plan,axis,at,start,end){
  const spans=(plan.partitions||[]).filter(wall=>wall.axis===axis&&close(wall.at,at)&&wall.end>start&&wall.start<end).map(wall=>[wall.start,wall.end]).sort((a,b)=>a[0]-b[0]);
  let cursor=start;for(const [a,b]of spans){if(a>cursor+1e-6)return false;cursor=Math.max(cursor,b);if(cursor>=end-1e-6)return true;}return false;
}
export function describeAreaDimensions(plan,area,{wallThickness=.2}={}){
  if(!plan||!area||![area.x,area.z,area.width,area.depth,wallThickness].every(Number.isFinite)||area.width<=0||area.depth<=0||wallThickness<0)throw Error('Invalid metric area');
  const west=close(area.x,0)?'outer':covered(plan,'z',area.x,area.z,area.z+area.depth)?'inner':null;
  const east=close(area.x+area.width,plan.width)?'outer':covered(plan,'z',area.x+area.width,area.z,area.z+area.depth)?'inner':null;
  const rear=close(area.z,0)?'outer':covered(plan,'x',area.z,area.x,area.x+area.width)?'inner':null;
  const front=close(area.z+area.depth,plan.depth)?'outer':covered(plan,'x',area.z+area.depth,area.x,area.x+area.width)?'inner':null;
  const enclosed=!!(west&&east&&rear&&front),inset=side=>enclosed&&side==='inner'?wallThickness/2:0;
  const widthM=area.width-inset(west)-inset(east),depthM=area.depth-inset(rear)-inset(front);
  if(widthM<=0||depthM<=0)throw Error('Walls leave no clear room area');
  return {basis:enclosed?'clear-room':'authored-zone',widthM,depthM,areaM2:widthM*depthM};
}
export function metricLength(from,to){
  if(!Array.isArray(from)||!Array.isArray(to)||from.length!==2||to.length!==2||![...from,...to].every(Number.isFinite))throw Error('Invalid metric dimension endpoints');
  return Math.hypot(to[0]-from[0],to[1]-from[1]);
}
