// A desk keeps its chosen conversation while live status changes in other tasks.
export function chatChoices(agent,sessions,jobs,assignment){
 const choices=jobs.flatMap(j=>j.steps.filter(s=>s.agentId===agent.id&&s.status!=='cancelled').map(s=>({id:s.threadId,title:j.title+(s.phase==='synthesis'?' · สรุปทีม':''),pending:!sessions.some(t=>t.id===s.threadId)})));
 const manual=sessions.find(s=>s.id===assignment?.id);
 if(manual&&!choices.some(c=>c.id===manual.id))choices.push({id:manual.id,title:manual.name+' · แชทที่ผูกไว้',pending:false});
 return choices.filter((c,i)=>choices.findIndex(o=>o.id===c.id)===i);
}
export function selectedChat(choices,remembered,preferred){return choices.find(c=>c.id===remembered)?.id||choices.find(c=>c.id===preferred)?.id||choices[0]?.id||null;}

// A URL is a navigation request, never authority to fetch an arbitrary thread.
export function chatOwnerIndex(thread,profiles,sessions,jobs,assignments){
 const matches=profiles.map((profile,index)=>chatChoices(profile,sessions,jobs,assignments[index]).some(c=>c.id===thread)?index:-1).filter(index=>index>=0);
 return matches.length===1?matches[0]:-1;
}

export function resolveChatRoute(id,profiles,sessions,jobs,assignments){
 if(!id)return{kind:'default',index:-1};
 if(id==='choose')return{kind:'choose',index:-1};
 if(id.startsWith('agent:')){
  const [profileId,...detail]=id.slice(6).split(':'),index=profiles.findIndex(p=>p.id===profileId);
  if(!detail.length)return{kind:index<0?'unknown':'profile',index};
  const thread=detail.join(':'),allowed=index>=0&&!!thread&&chatChoices(profiles[index],sessions,jobs,assignments[index]).some(c=>c.id===thread);
  return{kind:allowed?'thread':'unknown',index:allowed?index:-1,thread:allowed?thread:null};
 }
 const index=chatOwnerIndex(id,profiles,sessions,jobs,assignments);
 return{kind:index<0?'unknown':'thread',index,thread:index>=0?id:null};
}

export function chatRouteId(thread,index,profiles,sessions,jobs,assignments){
 if(!profiles[index])return 'choose';
 if(!thread)return 'agent:'+profiles[index].id;
 return chatOwnerIndex(thread,profiles,sessions,jobs,assignments)===index?thread:`agent:${profiles[index].id}:${thread}`;
}
