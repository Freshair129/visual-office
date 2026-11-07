// Office transport policy. Payload schemas and authorization stay with each owner.
// These are Office endpoints, not a declaration of live Zuri platform contracts.
const id='[0-9a-f-]+';
const sample='11111111-1111-4111-8111-111111111111';
const route=(key,path,methods,owner,consumers,{browser=true,worker=true,binary=false,example=path}={})=>
 Object.freeze({id:key,path,pattern:new RegExp('^'+path+'$','i'),methods:Object.freeze(methods),owner,consumers:Object.freeze(consumers),browser,worker,binary,example});
export const OFFICE_API_ROUTES=Object.freeze([
 route('office','/api/office',['GET'],'worker/index.js',['web/cloud-client.js','scripts/cloud-probe.mjs']),
 route('team','/api/team',['GET','PUT'],'worker/index.js',['web/cloud-client.js','web/knowledge-view.js']),
 route('jobs','/api/jobs',['GET','POST'],'worker/index.js',['web/cloud-client.js','web/tasks.js']),
 route('cancel',`/api/jobs/${id}/cancel`,['POST'],'worker/index.js',['web/work-view.js'],{example:`/api/jobs/${sample}/cancel`}),
 route('preferences','/api/preferences',['GET','PUT'],'worker/index.js',['web/app.js','scripts/bind-team.mjs']),
 route('reviews','/api/work-reviews',['GET','PUT'],'worker/work-review.js',['web/app.js']),
 route('review','/api/work-reviews/[^/]+',['GET','PUT'],'worker/work-review.js',['web/work-view.js'],{example:`/api/work-reviews/${sample}`}),
 route('result-files','/api/result-files',['GET'],'worker/result-files.js',['web/results-view.js']),
 route('result-download',`/api/result-files/${id}/${id}/download`,['GET'],'worker/result-files.js',['web/results-view.js'],{binary:true,example:`/api/result-files/${sample}/${sample}/download`}),
 route('chat',`/api/chats/${id}`,['GET'],'worker/chat.js',['web/chat.js','web/team-page.js'],{example:`/api/chats/${sample}`}),
 route('chat-history',`/api/chats/${id}/history`,['GET'],'worker/chat.js',['web/chat.js'],{example:`/api/chats/${sample}/history`}),
 route('chat-messages',`/api/chats/${id}/messages`,['POST'],'worker/chat.js',['web/chat.js'],{example:`/api/chats/${sample}/messages`}),
 route('chat-watch',`/api/chats/${id}/watch`,['POST'],'worker/chat.js',['web/chat.js'],{example:`/api/chats/${sample}/watch`}),
 route('chat-upload',`/api/chats/${id}/attachments/${id}`,['POST'],'worker/chat.js',['web/chat.js'],{binary:true,example:`/api/chats/${sample}/attachments/${sample}`}),
 route('knowledge','/api/knowledge',['GET'],'worker/knowledge.js',['web/knowledge-view.js','web/tasks.js']),
 route('knowledge-upload',`/api/knowledge/files/${id}`,['POST'],'worker/knowledge.js',['web/knowledge-view.js'],{binary:true,example:`/api/knowledge/files/${sample}`}),
 ...['approve','revoke','purge'].map(action=>route('knowledge-'+action,`/api/knowledge/versions/${id}/${action}`,['POST'],'worker/knowledge.js',['web/knowledge-view.js'],{example:`/api/knowledge/versions/${sample}/${action}`})),
 route('runner-jobs','/api/runner/jobs',['GET'],'worker/index.js',['scripts/bridge.mjs'],{browser:false}),
 route('runner-job',`/api/runner/jobs/${id}`,['PUT'],'worker/index.js',['scripts/bridge.mjs'],{browser:false,example:`/api/runner/jobs/${sample}`}),
 route('sync','/api/sync',['POST'],'worker/index.js',['scripts/bridge.mjs'],{browser:false}),
 route('runner-chats','/api/runner/chats',['GET'],'worker/chat.js',['scripts/bridge.mjs'],{browser:false}),
 route('runner-chat-snapshot','/api/runner/chats/snapshot',['POST'],'worker/chat.js',['scripts/bridge.mjs'],{browser:false}),
 route('runner-chat-message',`/api/runner/chats/messages/${id}/${id}`,['PUT'],'worker/chat.js',['scripts/bridge.mjs'],{browser:false,example:`/api/runner/chats/messages/${sample}/${sample}`}),
 route('runner-chat-file',`/api/runner/chats/attachments/${id}/${id}`,['GET','PUT'],'worker/chat.js',['scripts/chat-attachments.mjs'],{browser:false,binary:true,example:`/api/runner/chats/attachments/${sample}/${sample}`}),
 route('runner-knowledge',`/api/runner/knowledge/${id}`,['GET','PUT'],'worker/knowledge.js',['scripts/knowledge-attachments.mjs'],{browser:false,binary:true,example:`/api/runner/knowledge/${sample}`}),
]);
export const resolveOfficeApi=pathname=>OFFICE_API_ROUTES.find(route=>route.pattern.test(pathname))||null;
