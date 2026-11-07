export const OFFICE_EXECUTION_VERSION='zuri.office-execution.v1';
export const MAX_DISPATCH_ATTEMPTS=3;
export const MAX_RECONCILIATION_ATTEMPTS=1;
export const MAX_ATTACHMENT_BYTES=8*1024*1024;
export const MAX_MESSAGE_ATTACHMENT_BYTES=20*1024*1024;

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hashPattern=/^[0-9a-f]{64}$/;
const capabilityNames=['sessionCreate','sessionResume','turnStreaming','approvals','questions','attachments','cancellation','workspaceAccess','crashRecovery'];
const capabilityStates=new Set(['supported','unsupported','unknown']);
const eventTypes=new Set(['assignment.accepted','turn.started','turn.delta','interaction.required','cancel.requested','cancel.acknowledged','cancel.confirmed','turn.completed','turn.failed','turn.unknown','turn.reconciled']);
const statuses=new Set(['accepted','running','waiting','cancel_requested','cancel_acknowledged','completed','failed','cancelled','unknown']);
const terminalStatuses=new Set(['completed','failed','cancelled']);

const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const isUuid=value=>typeof value==='string'&&uuidPattern.test(value);
const isText=(value,min,max)=>typeof value==='string'&&value.length>=min&&value.length<=max;
const timestampPattern=/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const isDate=value=>{
 if(typeof value!=='string')return false;
 const match=timestampPattern.exec(value);
 if(!match||!Number.isFinite(Date.parse(value)))return false;
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
 const leap=year%4===0&&(year%100!==0||year%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 return day<=days[month-1];
};
const clockMillis=now=>typeof now==='number'?now:(isDate(now)?Date.parse(now):NaN);
const stable=value=>Array.isArray(value)?`[${value.map(stable).join(',')}]`:isRecord(value)?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`:JSON.stringify(value);

function checkObject(value,path,allowed,required,errors){
 if(!isRecord(value)){errors.push({code:'OBJECT_REQUIRED',path});return false;}
 for(const key of required)if(!Object.hasOwn(value,key))errors.push({code:'FIELD_REQUIRED',path:`${path}.${key}`});
 for(const key of Object.keys(value))if(!allowed.includes(key))errors.push({code:'UNKNOWN_FIELD',path:`${path}.${key}`});
 return true;
}
function checkId(value,path,errors){if(!isUuid(value))errors.push({code:'UUID_REQUIRED',path});}
function checkDate(value,path,errors){if(!isDate(value))errors.push({code:'TIMESTAMP_REQUIRED',path});}
function checkPayloadMessage(payload,path,errors){
 if(!checkObject(payload,path,['message'],['message'],errors))return;
 const message=payload.message;
 if(!checkObject(message,`${path}.message`,['text','attachments'],['text'],errors))return;
 if(!isText(message.text,1,10000))errors.push({code:'INVALID_TEXT',path:`${path}.message.text`});
 if(message.attachments===undefined)return;
 if(!Array.isArray(message.attachments)||message.attachments.length>5){errors.push({code:'INVALID_ATTACHMENTS',path:`${path}.message.attachments`});return;}
 let total=0;
 for(let index=0;index<message.attachments.length;index++){
  const file=message.attachments[index],filePath=`${path}.message.attachments[${index}]`;
  if(!checkObject(file,filePath,['id','name','mimeType','sizeBytes','sha256'],['id','name','mimeType','sizeBytes','sha256'],errors))continue;
  if(!isText(file.id,1,200))errors.push({code:'INVALID_ATTACHMENT_ID',path:`${filePath}.id`});
  if(!isText(file.name,1,255))errors.push({code:'INVALID_ATTACHMENT_NAME',path:`${filePath}.name`});
  if(!isText(file.mimeType,1,128))errors.push({code:'INVALID_MIME_TYPE',path:`${filePath}.mimeType`});
  if(!Number.isInteger(file.sizeBytes)||file.sizeBytes<0||file.sizeBytes>MAX_ATTACHMENT_BYTES)errors.push({code:'INVALID_ATTACHMENT_SIZE',path:`${filePath}.sizeBytes`});
  else total+=file.sizeBytes;
  if(typeof file.sha256!=='string'||!hashPattern.test(file.sha256))errors.push({code:'INVALID_SHA256',path:`${filePath}.sha256`});
 }
 if(total>MAX_MESSAGE_ATTACHMENT_BYTES)errors.push({code:'ATTACHMENT_TOTAL_EXCEEDED',path:`${path}.message.attachments`});
}
function checkIdentity(value,path,errors,required){
 if(value===undefined&&!required)return;
 checkId(value,path,errors);
}
function result(errors){return{valid:errors.length===0,errors};}

export function validateOfficeCommand(command){
 const errors=[];
 const keys=['kind','contractVersion','commandId','idempotencyKey','action','expectedRevision','sessionId','turnId','payload'];
 if(!checkObject(command,'$',keys,['kind','contractVersion','commandId','idempotencyKey','action','expectedRevision','payload'],errors))return result(errors);
 if(command.kind!=='office-command')errors.push({code:'INVALID_KIND',path:'$.kind'});
 if(command.contractVersion!==OFFICE_EXECUTION_VERSION)errors.push({code:'UNSUPPORTED_CONTRACT_VERSION',path:'$.contractVersion'});
 checkId(command.commandId,'$.commandId',errors);
 if(!isText(command.idempotencyKey,16,128))errors.push({code:'INVALID_IDEMPOTENCY_KEY',path:'$.idempotencyKey'});
 if(!Number.isInteger(command.expectedRevision)||command.expectedRevision<0)errors.push({code:'INVALID_REVISION',path:'$.expectedRevision'});
 checkIdentity(command.sessionId,'$.sessionId',errors,false);
 checkIdentity(command.turnId,'$.turnId',errors,false);
 const payload=command.payload;
 switch(command.action){
  case 'session.create':
   if(command.sessionId!==undefined||command.turnId!==undefined)errors.push({code:'CREATE_MUST_NOT_PREASSIGN_SESSION',path:'$'});
   if(checkObject(payload,'$.payload',['roleId','title','executionProfileId'],['roleId','title'],errors)){
    if(!isText(payload.roleId,1,64))errors.push({code:'INVALID_ROLE_ID',path:'$.payload.roleId'});
    if(!isText(payload.title,1,120))errors.push({code:'INVALID_TITLE',path:'$.payload.title'});
    if(payload.executionProfileId!==undefined&&!isText(payload.executionProfileId,1,200))errors.push({code:'INVALID_EXECUTION_PROFILE',path:'$.payload.executionProfileId'});
   }
   break;
  case 'turn.start':
   checkIdentity(command.sessionId,'$.sessionId',errors,true);checkIdentity(command.turnId,'$.turnId',errors,true);
   checkPayloadMessage(payload,'$.payload',errors);
   break;
  case 'turn.cancel':
   checkIdentity(command.sessionId,'$.sessionId',errors,true);checkIdentity(command.turnId,'$.turnId',errors,true);
   checkObject(payload,'$.payload',[],[],errors);
   break;
  case 'interaction.respond':
   checkIdentity(command.sessionId,'$.sessionId',errors,true);checkIdentity(command.turnId,'$.turnId',errors,true);
   if(checkObject(payload,'$.payload',['interactionId','decision','answer'],['interactionId','decision'],errors)){
    if(!isText(payload.interactionId,1,200))errors.push({code:'INVALID_INTERACTION_ID',path:'$.payload.interactionId'});
    if(!['approve','reject','answer'].includes(payload.decision))errors.push({code:'INVALID_DECISION',path:'$.payload.decision'});
    if(payload.decision==='answer'&&!isText(payload.answer,1,6000))errors.push({code:'ANSWER_REQUIRED',path:'$.payload.answer'});
    if(payload.decision!=='answer'&&payload.answer!==undefined)errors.push({code:'ANSWER_NOT_ALLOWED',path:'$.payload.answer'});
   }
   break;
  default: errors.push({code:'UNSUPPORTED_ACTION',path:'$.action'});
 }
 return result(errors);
}

export function validateExecutionAssignment(assignment,{now=Date.now()}={}){
 const errors=[];
 const nowMs=clockMillis(now);
 if(!Number.isFinite(nowMs))errors.push({code:'INVALID_CLOCK',path:'$'});
 const keys=['kind','contractVersion','assignmentId','claimId','commandId','jobId','sessionId','turnId','adapterId','adapterVersion','action','expectedRevision','fencingToken','leaseExpiresAt','deadlineAt','payload'];
 if(!checkObject(assignment,'$',keys,keys,errors))return result(errors);
 if(assignment.kind!=='execution-assignment')errors.push({code:'INVALID_KIND',path:'$.kind'});
 if(assignment.contractVersion!==OFFICE_EXECUTION_VERSION)errors.push({code:'UNSUPPORTED_CONTRACT_VERSION',path:'$.contractVersion'});
 for(const key of ['assignmentId','claimId','commandId','jobId','sessionId','turnId'])checkId(assignment[key],`$.${key}`,errors);
 if(!isText(assignment.adapterId,1,64)||!/^[a-z][a-z0-9._/-]{0,63}$/.test(assignment.adapterId||''))errors.push({code:'INVALID_ADAPTER_ID',path:'$.adapterId'});
 if(!isText(assignment.adapterVersion,1,64))errors.push({code:'INVALID_ADAPTER_VERSION',path:'$.adapterVersion'});
 if(!['turn.start','turn.cancel'].includes(assignment.action))errors.push({code:'UNSUPPORTED_ACTION',path:'$.action'});
 if(!Number.isInteger(assignment.expectedRevision)||assignment.expectedRevision<0)errors.push({code:'INVALID_REVISION',path:'$.expectedRevision'});
 if(!Number.isInteger(assignment.fencingToken)||assignment.fencingToken<1)errors.push({code:'INVALID_FENCING_TOKEN',path:'$.fencingToken'});
 checkDate(assignment.leaseExpiresAt,'$.leaseExpiresAt',errors);checkDate(assignment.deadlineAt,'$.deadlineAt',errors);
 if(Number.isFinite(nowMs)&&isDate(assignment.leaseExpiresAt)&&Date.parse(assignment.leaseExpiresAt)<=nowMs)errors.push({code:'LEASE_EXPIRED',path:'$.leaseExpiresAt'});
 if(Number.isFinite(nowMs)&&isDate(assignment.deadlineAt)&&Date.parse(assignment.deadlineAt)<=nowMs)errors.push({code:'DEADLINE_EXPIRED',path:'$.deadlineAt'});
 if(isDate(assignment.leaseExpiresAt)&&isDate(assignment.deadlineAt)&&Date.parse(assignment.leaseExpiresAt)>Date.parse(assignment.deadlineAt))errors.push({code:'LEASE_EXCEEDS_DEADLINE',path:'$.leaseExpiresAt'});
 if(assignment.action==='turn.start')checkPayloadMessage(assignment.payload,'$.payload',errors);
 else if(assignment.action==='turn.cancel')checkObject(assignment.payload,'$.payload',[],[],errors);
 return result(errors);
}

export function validateExecutionEvent(event){
 const errors=[];
 const keys=['kind','contractVersion','eventId','assignmentId','commandId','jobId','sessionId','turnId','fencingToken','sequence','revision','cursor','eventType','status','occurredAt','payload','receipt'];
 const required=['kind','contractVersion','eventId','assignmentId','commandId','jobId','sessionId','turnId','fencingToken','sequence','revision','cursor','eventType','status','occurredAt','payload'];
 if(!checkObject(event,'$',keys,required,errors))return result(errors);
 if(event.kind!=='execution-event')errors.push({code:'INVALID_KIND',path:'$.kind'});
 if(event.contractVersion!==OFFICE_EXECUTION_VERSION)errors.push({code:'UNSUPPORTED_CONTRACT_VERSION',path:'$.contractVersion'});
 for(const key of ['eventId','assignmentId','commandId','jobId','sessionId','turnId'])checkId(event[key],`$.${key}`,errors);
 if(!Number.isInteger(event.fencingToken)||event.fencingToken<1)errors.push({code:'INVALID_FENCING_TOKEN',path:'$.fencingToken'});
 if(!Number.isInteger(event.sequence)||event.sequence<1)errors.push({code:'INVALID_SEQUENCE',path:'$.sequence'});
 if(!Number.isInteger(event.revision)||event.revision<1)errors.push({code:'INVALID_REVISION',path:'$.revision'});
 if(!isText(event.cursor,1,512))errors.push({code:'INVALID_CURSOR',path:'$.cursor'});
 if(!eventTypes.has(event.eventType))errors.push({code:'UNSUPPORTED_EVENT_TYPE',path:'$.eventType'});
 if(!statuses.has(event.status))errors.push({code:'INVALID_STATUS',path:'$.status'});
 checkDate(event.occurredAt,'$.occurredAt',errors);
 if(checkObject(event.payload,'$.payload',['delta','summary','errorCode','resultText','interaction'],[],errors)){
  if(event.payload.delta!==undefined&&!isText(event.payload.delta,0,8000))errors.push({code:'INVALID_DELTA',path:'$.payload.delta'});
  if(event.payload.summary!==undefined&&!isText(event.payload.summary,0,1000))errors.push({code:'INVALID_SUMMARY',path:'$.payload.summary'});
  if(event.payload.errorCode!==undefined&&!(typeof event.payload.errorCode==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(event.payload.errorCode)))errors.push({code:'INVALID_ERROR_CODE',path:'$.payload.errorCode'});
  if(event.payload.resultText!==undefined&&!isText(event.payload.resultText,0,12000))errors.push({code:'INVALID_RESULT_TEXT',path:'$.payload.resultText'});
  if(event.payload.interaction!==undefined&&checkObject(event.payload.interaction,'$.payload.interaction',['interactionId','kind','expiresAt'],['interactionId','kind','expiresAt'],errors)){
   if(!isText(event.payload.interaction.interactionId,1,200))errors.push({code:'INVALID_INTERACTION_ID',path:'$.payload.interaction.interactionId'});
   if(!['approval','question'].includes(event.payload.interaction.kind))errors.push({code:'INVALID_INTERACTION_KIND',path:'$.payload.interaction.kind'});
   checkDate(event.payload.interaction.expiresAt,'$.payload.interaction.expiresAt',errors);
  }
 }
 if(event.receipt!==undefined&&checkObject(event.receipt,'$.receipt',['providerReceiptId','terminationReceiptId','completedAt','confirmedAt'],[],errors)){
  for(const key of ['providerReceiptId','terminationReceiptId'])if(event.receipt[key]!==undefined&&!isText(event.receipt[key],1,200))errors.push({code:'INVALID_RECEIPT_ID',path:`$.receipt.${key}`});
  for(const key of ['completedAt','confirmedAt'])if(event.receipt[key]!==undefined)checkDate(event.receipt[key],`$.receipt.${key}`,errors);
 }
 const expected={
  'assignment.accepted':'accepted','turn.started':'running','turn.delta':'running','interaction.required':'waiting',
  'cancel.requested':'cancel_requested','cancel.acknowledged':'cancel_acknowledged','cancel.confirmed':'cancelled',
  'turn.completed':'completed','turn.failed':'failed','turn.unknown':'unknown'
 };
 if(expected[event.eventType]&&event.status!==expected[event.eventType])errors.push({code:'EVENT_STATUS_MISMATCH',path:'$.status'});
 if(event.eventType==='turn.delta'&&!isText(event.payload?.delta,1,8000))errors.push({code:'DELTA_REQUIRED',path:'$.payload.delta'});
 if(event.eventType==='interaction.required'&&!event.payload?.interaction)errors.push({code:'INTERACTION_REQUIRED',path:'$.payload.interaction'});
 if(['turn.failed','turn.unknown'].includes(event.eventType)&&!event.payload?.errorCode)errors.push({code:'ERROR_CODE_REQUIRED',path:'$.payload.errorCode'});
 if(event.eventType==='turn.completed'&&(!event.receipt?.providerReceiptId||!event.receipt?.completedAt))errors.push({code:'COMPLETION_RECEIPT_REQUIRED',path:'$.receipt'});
 if(event.eventType==='cancel.confirmed'&&(!event.receipt?.terminationReceiptId||!event.receipt?.confirmedAt))errors.push({code:'TERMINATION_RECEIPT_REQUIRED',path:'$.receipt'});
 if(event.eventType==='turn.reconciled'){
  if(!['running','completed','failed','cancelled','unknown'].includes(event.status))errors.push({code:'INVALID_RECONCILED_STATUS',path:'$.status'});
  if(event.status==='running'&&!event.receipt?.providerReceiptId)errors.push({code:'RECONCILED_RUNNING_RECEIPT_REQUIRED',path:'$.receipt.providerReceiptId'});
  if(event.status==='completed'&&(!event.receipt?.providerReceiptId||!event.receipt?.completedAt))errors.push({code:'RECONCILED_COMPLETION_RECEIPT_REQUIRED',path:'$.receipt'});
  if(event.status==='failed'&&!event.payload?.errorCode)errors.push({code:'RECONCILED_ERROR_CODE_REQUIRED',path:'$.payload.errorCode'});
  if(event.status==='cancelled'&&(!event.receipt?.terminationReceiptId||!event.receipt?.confirmedAt))errors.push({code:'RECONCILED_TERMINATION_RECEIPT_REQUIRED',path:'$.receipt'});
  if(event.status==='unknown'&&!event.payload?.errorCode)errors.push({code:'RECONCILED_ERROR_CODE_REQUIRED',path:'$.payload.errorCode'});
 }
 return result(errors);
}

export function validateCapabilityDeclaration(declaration,{now=Date.now()}={}){
 const errors=[];
 const nowMs=clockMillis(now);
 if(!Number.isFinite(nowMs))errors.push({code:'INVALID_CLOCK',path:'$'});
 const keys=['kind','contractVersion','adapterId','adapterVersion','observedAt','expiresAt','maxConcurrentTurns','maxAttachmentBytes','models','capabilities'];
 if(!checkObject(declaration,'$',keys,keys,errors))return result(errors);
 if(declaration.kind!=='capability-declaration')errors.push({code:'INVALID_KIND',path:'$.kind'});
 if(declaration.contractVersion!==OFFICE_EXECUTION_VERSION)errors.push({code:'UNSUPPORTED_CONTRACT_VERSION',path:'$.contractVersion'});
 if(!isText(declaration.adapterId,1,64)||!/^[a-z][a-z0-9._/-]{0,63}$/.test(declaration.adapterId||''))errors.push({code:'INVALID_ADAPTER_ID',path:'$.adapterId'});
 if(!isText(declaration.adapterVersion,1,64))errors.push({code:'INVALID_ADAPTER_VERSION',path:'$.adapterVersion'});
 checkDate(declaration.observedAt,'$.observedAt',errors);checkDate(declaration.expiresAt,'$.expiresAt',errors);
 if(isDate(declaration.observedAt)&&isDate(declaration.expiresAt)&&Date.parse(declaration.expiresAt)<=Date.parse(declaration.observedAt))errors.push({code:'INVALID_CAPABILITY_EXPIRY',path:'$.expiresAt'});
 if(Number.isFinite(nowMs)&&isDate(declaration.expiresAt)&&Date.parse(declaration.expiresAt)<=nowMs)errors.push({code:'CAPABILITY_EXPIRED',path:'$.expiresAt'});
 if(!Number.isInteger(declaration.maxConcurrentTurns)||declaration.maxConcurrentTurns<1||declaration.maxConcurrentTurns>1000)errors.push({code:'INVALID_CONCURRENCY_LIMIT',path:'$.maxConcurrentTurns'});
 if(!Number.isInteger(declaration.maxAttachmentBytes)||declaration.maxAttachmentBytes<0||declaration.maxAttachmentBytes>100*1024*1024)errors.push({code:'INVALID_ATTACHMENT_LIMIT',path:'$.maxAttachmentBytes'});
 if(!Array.isArray(declaration.models)||declaration.models.length>200||declaration.models.some(model=>!isText(model,1,200))||new Set(declaration.models).size!==declaration.models.length)errors.push({code:'INVALID_MODEL_LIST',path:'$.models'});
 if(checkObject(declaration.capabilities,'$.capabilities',capabilityNames,capabilityNames,errors))for(const name of capabilityNames)if(!capabilityStates.has(declaration.capabilities[name]))errors.push({code:'INVALID_CAPABILITY_STATE',path:`$.capabilities.${name}`});
 return result(errors);
}

const transitions={
 accepted:new Set(['running','failed','cancel_requested','unknown']),
 running:new Set(['running','waiting','completed','failed','cancel_requested','unknown']),
 waiting:new Set(['running','failed','cancel_requested','unknown']),
 cancel_requested:new Set(['cancel_acknowledged','completed','failed','unknown']),
 cancel_acknowledged:new Set(['cancelled','completed','failed','unknown']),
 unknown:new Set(['running','completed','failed','cancelled','unknown']),
 completed:new Set(),failed:new Set(),cancelled:new Set()
};

export function classifyExecutionEvent(previous,event,assignment){
 const checked=validateExecutionEvent(event);
 if(!checked.valid)return{action:'reject',code:'INVALID_EVENT',errors:checked.errors};
 if(!assignment||event.assignmentId!==assignment.assignmentId||event.commandId!==assignment.commandId||event.jobId!==assignment.jobId||event.sessionId!==assignment.sessionId||event.turnId!==assignment.turnId)return{action:'reject',code:'ASSIGNMENT_MISMATCH'};
 if(event.fencingToken!==assignment.fencingToken)return{action:'reject',code:'STALE_FENCING_TOKEN'};
 if(!previous){if(event.sequence!==1||event.eventType!=='assignment.accepted')return{action:'reconcile',code:'INITIAL_EVENT_GAP'};return{action:'apply'};}
 if(event.assignmentId!==previous.assignmentId||event.commandId!==previous.commandId||event.jobId!==previous.jobId||event.sessionId!==previous.sessionId||event.turnId!==previous.turnId)return{action:'reject',code:'EVENT_IDENTITY_CHANGED'};
 if(event.sequence===previous.sequence&&event.eventId===previous.eventId)return stable(event)===stable(previous)?{action:'duplicate'}:{action:'reject',code:'EVENT_ID_REUSE_CONFLICT'};
 if(event.sequence<=previous.sequence)return{action:'reject',code:'STALE_EVENT'};
 if(event.sequence!==previous.sequence+1)return{action:'reconcile',code:'EVENT_SEQUENCE_GAP'};
 if(event.revision<=previous.revision)return{action:'reject',code:'STALE_REVISION'};
 if(terminalStatuses.has(previous.status))return{action:'reject',code:'TERMINAL_STATE'};
 if(!transitions[previous.status]?.has(event.status))return{action:'reject',code:'ILLEGAL_STATE_TRANSITION'};
 if(previous.status==='unknown'&&event.eventType!=='turn.reconciled')return{action:'reject',code:'RECONCILIATION_REQUIRED'};
 if(previous.status==='cancel_requested'&&event.status==='cancelled')return{action:'reject',code:'CANCEL_ACK_REQUIRED'};
 return{action:'apply'};
}

export function retryDisposition({attemptCount,reconciliationCount,deadlineAt,outcome,now=Date.now()}){
 if(!Number.isInteger(attemptCount)||attemptCount<0||!Number.isInteger(reconciliationCount)||reconciliationCount<0||!isDate(deadlineAt))return{action:'stop',code:'INVALID_RETRY_STATE'};
 const nowMs=clockMillis(now);
 if(!Number.isFinite(nowMs))return{action:'stop',code:'INVALID_CLOCK'};
 if(nowMs>=Date.parse(deadlineAt))return{action:'stop',code:'DEADLINE_EXPIRED'};
 if(['completed','failed','cancelled'].includes(outcome))return{action:'stop',code:'TERMINAL_OUTCOME'};
 if(outcome==='unknown')return reconciliationCount<MAX_RECONCILIATION_ATTEMPTS?{action:'reconcile_once',code:'OUTCOME_UNKNOWN'}:{action:'stop',code:'OUTCOME_STILL_UNKNOWN'};
 if(!['not-dispatched','rejected-no-effect'].includes(outcome))return{action:'stop',code:'UNSAFE_RETRY_OUTCOME'};
 return attemptCount<MAX_DISPATCH_ATTEMPTS?{action:'dispatch-same-command',code:'SAFE_NO_EFFECT',attemptNumber:attemptCount+1,maxAttempts:MAX_DISPATCH_ATTEMPTS}:{action:'stop',code:'ATTEMPT_BUDGET_EXHAUSTED'};
}
