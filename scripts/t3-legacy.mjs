// Official v0.0.45: packages/contracts/src/orchestration.ts (legacy API).
const clean=(value,n=1000)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n):'';
const sessionStates=new Set(['idle','starting','running','ready','interrupted','stopped','error']);
const turnStates=new Set(['running','interrupted','completed','error']);
export function normalizeLegacy(shell,detail){
 const thread=detail?.thread;
 if(!shell?.id||!thread||thread.id!==shell.id||!Array.isArray(thread.messages)||!Array.isArray(thread.activities)||!Array.isArray(thread.checkpoints)||typeof shell.title!=='string'||!Number.isFinite(Date.parse(shell.updatedAt))||shell.session&&!sessionStates.has(shell.session.status)||shell.latestTurn&&!turnStates.has(shell.latestTurn.state))throw new Error('Unsupported T3 0.0.45 snapshot');
 const session=shell.session,turn=shell.latestTurn;
 let status=turn?.state==='completed'?'done':'idle';
 if(turn?.state==='running'||['starting','running'].includes(session?.status)||shell.backgroundLiveness==='working')status='working';
 if(turn?.state==='error'||session?.status==='error'||shell.hasPendingApprovals||shell.hasPendingUserInput||shell.hasActionableProposedPlan)status='stuck';
 const logs=[...thread.messages.filter(m=>['user','assistant','system'].includes(m.role)).map(m=>({text:m.text,time:m.updatedAt})),...thread.activities.filter(a=>['tool','approval','error'].includes(a.tone)).map(a=>({text:a.summary,time:a.createdAt}))];
 if(session?.lastError)logs.push({text:session.lastError,time:session.updatedAt});
 logs.sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));
 // Only explicit structured paths in the latest turn; prose/commands never establish a file.
 const checkpoints=thread.checkpoints.filter(c=>!turn||c.turnId===turn.turnId).sort((a,b)=>Date.parse(b.completedAt)-Date.parse(a.completedAt));
 const files=[...thread.activities.filter(a=>a.tone==='tool'&&(!turn||a.turnId===turn.turnId)).flatMap(a=>(a.payload?.data?.files??[]).map(f=>({path:f.path,time:a.createdAt}))),...checkpoints.flatMap(c=>(c.files??[]).map(f=>({path:f.path,time:c.completedAt})))].sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));
 const currentFile=clean(files.find(f=>typeof f.path==='string')?.path,500)||null;
 const [name,...role]=clean(shell.title,100).split(' · ');
 return{id:shell.id,name,role:role.join(' · '),provider:clean(shell.modelSelection?.instanceId??session?.providerInstanceId??session?.providerName,100),status,currentFile,lastLog:clean(logs.find(l=>clean(l.text))?.text),updatedAt:shell.updatedAt};
}
