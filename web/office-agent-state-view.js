// Presentation mapping only. Character art never defines an Agent or a role.
const labels={idle:'idle',working:'working',thinking:'thinking',offline:'offline',stuck:'waiting',done:'done'};
export function floorActorStates(room,roster,{known=false,source=''}={}){
 return (room?.objects||[]).filter(o=>/^avatar-\d\d$/.test(o.kind)).map(o=>{
  const match=/^role-(\d+)-avatar$/.exec(o.id),agent=match?roster?.[Number(match[1])-1]:null;
  return known&&source&&agent?.connected&&labels[agent.status]
   ?{avatarId:o.id,state:labels[agent.status],source}
   :{avatarId:o.id,state:'unknown',source:''};
 });
}
