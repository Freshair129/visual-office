import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_DISPATCH_ATTEMPTS,
  MAX_MESSAGE_ATTACHMENT_BYTES,
  MAX_RECONCILIATION_ATTEMPTS,
  OFFICE_EXECUTION_VERSION,
  classifyExecutionEvent,
  retryDisposition,
  validateCapabilityDeclaration,
  validateExecutionAssignment,
  validateExecutionEvent,
  validateOfficeCommand,
} from '../scripts/office-execution-contract.mjs';

const schema=JSON.parse(await readFile(new URL('../contracts/zuri-office-execution-v1.schema.json',import.meta.url),'utf8'));
const ids={command:'00000000-0000-4000-8000-000000000001',assignment:'00000000-0000-4000-8000-000000000002',claim:'00000000-0000-4000-8000-000000000003',job:'00000000-0000-4000-8000-000000000004',session:'00000000-0000-4000-8000-000000000005',turn:'00000000-0000-4000-8000-000000000006'};
const earlier='2026-10-11T10:00:00.000Z';
const later='2026-10-11T10:30:00.000Z';
const deadline='2026-10-11T11:00:00.000Z';

const command=(overrides={})=>({
  kind:'office-command',contractVersion:OFFICE_EXECUTION_VERSION,commandId:ids.command,
  idempotencyKey:'stable-command-key-0001',action:'session.create',expectedRevision:0,
  payload:{roleId:'beam',title:'Support handoff'},...overrides,
});

const assignment=(overrides={})=>({
  kind:'execution-assignment',contractVersion:OFFICE_EXECUTION_VERSION,assignmentId:ids.assignment,
  claimId:ids.claim,commandId:ids.command,jobId:ids.job,sessionId:ids.session,turnId:ids.turn,
  adapterId:'t3.local',adapterVersion:'0.0.45',action:'turn.start',expectedRevision:1,
  fencingToken:4,leaseExpiresAt:later,deadlineAt:deadline,payload:{message:{text:'Handle this request'}},...overrides,
});

const event=(overrides={})=>({
  kind:'execution-event',contractVersion:OFFICE_EXECUTION_VERSION,
  eventId:'00000000-0000-4000-8000-000000000007',assignmentId:ids.assignment,
  commandId:ids.command,jobId:ids.job,sessionId:ids.session,turnId:ids.turn,
  fencingToken:4,sequence:1,revision:1,cursor:'cursor-1',eventType:'assignment.accepted',
  status:'accepted',occurredAt:earlier,payload:{},...overrides,
});

const capabilities=()=>({
  sessionCreate:'supported',sessionResume:'unknown',turnStreaming:'supported',approvals:'supported',
  questions:'supported',attachments:'unknown',cancellation:'unsupported',workspaceAccess:'unsupported',
  crashRecovery:'unknown',
});
const checkAssignment=value=>validateExecutionAssignment(value,{now:earlier});
const checkDeclaration=value=>validateCapabilityDeclaration(value,{now:earlier});

const declaration=(overrides={})=>({
  kind:'capability-declaration',contractVersion:OFFICE_EXECUTION_VERSION,adapterId:'t3.local',
  adapterVersion:'0.0.45',observedAt:earlier,expiresAt:later,maxConcurrentTurns:3,
  maxAttachmentBytes:MAX_ATTACHMENT_BYTES,models:['gpt-5'],capabilities:capabilities(),...overrides,
});

const attachment=(id,sizeBytes)=>({id,name:`${id}.pdf`,mimeType:'application/pdf',sizeBytes,sha256:'a'.repeat(64)});
const errorCodes=result=>result.errors.map(error=>error.code);

test('schema is valid JSON and exposes the four versioned contract envelopes',()=>{
  assert.equal(schema.$id,'urn:zuri:office-execution:v1');
  assert.equal(schema.oneOf.length,4);
  assert.deepEqual(Object.keys(schema.$defs).filter(key=>['officeCommand','executionAssignment','executionEvent','capabilityDeclaration'].includes(key)).sort(),[
    'capabilityDeclaration','executionAssignment','executionEvent','officeCommand',
  ]);
  assert.ok(schema.$defs.executionEvent.required.includes('cursor'));
  assert.ok(schema.$defs.executionEvent.properties.receipt);
  const interactionRule=schema.$defs.officeCommand.allOf.find(rule=>rule.if.properties.action.const==='interaction.respond');
  assert.equal(interactionRule.then.properties.payload.allOf.length,2);
});

test('office commands are strict, action-bound, and reject client authority fields',()=>{
  assert.equal(validateOfficeCommand(command()).valid,true);
  const withScope=validateOfficeCommand(command({tenantId:'tenant-from-browser',providerToken:'secret'}));
  assert.ok(errorCodes(withScope).includes('UNKNOWN_FIELD'));
  const mismatched=validateOfficeCommand(command({action:'turn.start',sessionId:ids.session,payload:{message:{text:'Start'}}}));
  assert.ok(errorCodes(mismatched).includes('UUID_REQUIRED'));
  const createWithSession=validateOfficeCommand(command({sessionId:ids.session}));
  assert.ok(errorCodes(createWithSession).includes('CREATE_MUST_NOT_PREASSIGN_SESSION'));
  const answeredWithoutText=validateOfficeCommand(command({action:'interaction.respond',sessionId:ids.session,turnId:ids.turn,payload:{interactionId:'approval-1',decision:'answer'}}));
  assert.ok(errorCodes(answeredWithoutText).includes('ANSWER_REQUIRED'));
  const answerOnApprove=validateOfficeCommand(command({action:'interaction.respond',sessionId:ids.session,turnId:ids.turn,payload:{interactionId:'approval-1',decision:'approve',answer:'extra'}}));
  assert.ok(errorCodes(answerOnApprove).includes('ANSWER_NOT_ALLOWED'));
});

test('attachment references enforce per-file and aggregate limits without carrying file bytes',()=>{
  const within=command({action:'turn.start',sessionId:ids.session,turnId:ids.turn,payload:{message:{text:'Review files',attachments:[
    attachment('one',MAX_ATTACHMENT_BYTES),attachment('two',MAX_ATTACHMENT_BYTES),attachment('three',MAX_MESSAGE_ATTACHMENT_BYTES-2*MAX_ATTACHMENT_BYTES),
  ]}}});
  assert.equal(validateOfficeCommand(within).valid,true);
  const tooLarge=command({action:'turn.start',sessionId:ids.session,turnId:ids.turn,payload:{message:{text:'Review files',attachments:[
    attachment('one',MAX_ATTACHMENT_BYTES),attachment('two',MAX_ATTACHMENT_BYTES),attachment('three',MAX_ATTACHMENT_BYTES),
  ]}}});
  assert.ok(errorCodes(validateOfficeCommand(tooLarge)).includes('ATTACHMENT_TOTAL_EXCEEDED'));
  const invalidHash=command({action:'turn.start',sessionId:ids.session,turnId:ids.turn,payload:{message:{text:'Review file',attachments:[{...attachment('one',1),sha256:'not-a-digest'}]}}});
  assert.ok(errorCodes(validateOfficeCommand(invalidHash)).includes('INVALID_SHA256'));
});

test('assignments bind claim and fencing data and keep the lease within the immutable deadline',()=>{
  assert.equal(checkAssignment(assignment()).valid,true);
  assert.ok(errorCodes(checkAssignment(assignment({leaseExpiresAt:'2026-10-11T11:00:00.001Z'}))).includes('LEASE_EXCEEDS_DEADLINE'));
  assert.ok(errorCodes(checkAssignment(assignment({leaseExpiresAt:'2026-02-30T10:00:00Z'}))).includes('TIMESTAMP_REQUIRED'));
  assert.ok(errorCodes(checkAssignment(assignment({leaseExpiresAt:earlier}))).includes('LEASE_EXPIRED'));
  assert.ok(errorCodes(checkAssignment(assignment({deadlineAt:earlier}))).includes('DEADLINE_EXPIRED'));
  assert.ok(errorCodes(checkAssignment(assignment({payload:{message:{text:'x'},scope:{tenant:'t'}}}))).includes('UNKNOWN_FIELD'));
  assert.ok(errorCodes(checkAssignment(assignment({fencingToken:0}))).includes('INVALID_FENCING_TOKEN'));
});

test('events require a strict cursor, sequence data, and authoritative terminal receipts',()=>{
  assert.equal(validateExecutionEvent(event()).valid,true);
  const missingCursor=event();
  delete missingCursor.cursor;
  assert.ok(errorCodes(validateExecutionEvent(missingCursor)).includes('FIELD_REQUIRED'));
  assert.ok(errorCodes(validateExecutionEvent(event({occurredAt:'2026-02-30T10:00:00Z'}))).includes('TIMESTAMP_REQUIRED'));
  const completedWithoutReceipt=event({eventType:'turn.completed',status:'completed'});
  assert.ok(errorCodes(validateExecutionEvent(completedWithoutReceipt)).includes('COMPLETION_RECEIPT_REQUIRED'));
  const cancelledWithoutReceipt=event({eventType:'cancel.confirmed',status:'cancelled'});
  assert.ok(errorCodes(validateExecutionEvent(cancelledWithoutReceipt)).includes('TERMINATION_RECEIPT_REQUIRED'));
  const validCancellation=event({eventType:'cancel.confirmed',status:'cancelled',receipt:{terminationReceiptId:'stop-44',confirmedAt:later}});
  assert.equal(validateExecutionEvent(validCancellation).valid,true);
  assert.ok(errorCodes(validateExecutionEvent(event({eventType:'turn.delta',status:'running',payload:{delta:''}}))).includes('DELTA_REQUIRED'));
});

test('reconciliation must carry evidence matching the recovered state',()=>{
  const cancelled=event({eventType:'turn.reconciled',status:'cancelled'});
  assert.ok(errorCodes(validateExecutionEvent(cancelled)).includes('RECONCILED_TERMINATION_RECEIPT_REQUIRED'));
  assert.equal(validateExecutionEvent(event({eventType:'turn.reconciled',status:'cancelled',receipt:{terminationReceiptId:'stop-44',confirmedAt:later}})).valid,true);
  assert.equal(validateExecutionEvent(event({eventType:'turn.reconciled',status:'running',receipt:{providerReceiptId:'provider-turn-8'}})).valid,true);
  assert.ok(errorCodes(validateExecutionEvent(event({eventType:'turn.reconciled',status:'completed'}))).includes('RECONCILED_COMPLETION_RECEIPT_REQUIRED'));
  assert.ok(errorCodes(validateExecutionEvent(event({eventType:'turn.reconciled',status:'failed'}))).includes('RECONCILED_ERROR_CODE_REQUIRED'));
  assert.ok(errorCodes(validateExecutionEvent(event({eventType:'turn.reconciled',status:'unknown'}))).includes('RECONCILED_ERROR_CODE_REQUIRED'));
});

test('capability declarations fail closed and expire after their observation time',()=>{
  assert.equal(checkDeclaration(declaration()).valid,true);
  assert.ok(errorCodes(checkDeclaration(declaration({expiresAt:earlier}))).includes('INVALID_CAPABILITY_EXPIRY'));
  assert.ok(errorCodes(checkDeclaration(declaration({expiresAt:earlier}))).includes('CAPABILITY_EXPIRED'));
  assert.ok(errorCodes(checkDeclaration(declaration({capabilities:{...capabilities(),cancellation:true}}))).includes('INVALID_CAPABILITY_STATE'));
  assert.ok(errorCodes(checkDeclaration(declaration({models:['gpt-5','gpt-5']}))).includes('INVALID_MODEL_LIST'));
});

test('event projection rejects gaps, stale fencing, conflicting duplicates, and illegal terminal movement',()=>{
  const accepted=event();
  assert.deepEqual(classifyExecutionEvent(null,accepted,assignment()),{action:'apply'});
  assert.deepEqual(classifyExecutionEvent(accepted,accepted,assignment()),{action:'duplicate'});
  assert.equal(classifyExecutionEvent(accepted,event({sequence:3,revision:3,cursor:'cursor-3'}),assignment()).action,'reconcile');
  assert.equal(classifyExecutionEvent(accepted,event({fencingToken:3}),assignment()).code,'STALE_FENCING_TOKEN');
  assert.equal(classifyExecutionEvent(accepted,event({payload:{summary:'changed'}}),assignment()).code,'EVENT_ID_REUSE_CONFLICT');

  const running=event({eventId:'00000000-0000-4000-8000-000000000008',sequence:2,revision:2,cursor:'cursor-2',eventType:'turn.started',status:'running'});
  assert.deepEqual(classifyExecutionEvent(accepted,running,assignment()),{action:'apply'});
  const unknown=event({eventId:'00000000-0000-4000-8000-000000000009',sequence:3,revision:3,cursor:'cursor-3',eventType:'turn.unknown',status:'unknown',payload:{errorCode:'PROVIDER_STATE_UNKNOWN'}});
  assert.deepEqual(classifyExecutionEvent(running,unknown,assignment()),{action:'apply'});
  const notReconciled=event({eventId:'00000000-0000-4000-8000-000000000010',sequence:4,revision:4,cursor:'cursor-4',eventType:'turn.started',status:'running'});
  assert.equal(classifyExecutionEvent(unknown,notReconciled,assignment()).code,'RECONCILIATION_REQUIRED');
  const stopped=event({eventId:'00000000-0000-4000-8000-000000000011',sequence:4,revision:4,cursor:'cursor-4',eventType:'turn.reconciled',status:'cancelled',receipt:{terminationReceiptId:'stop-44',confirmedAt:later}});
  assert.deepEqual(classifyExecutionEvent(unknown,stopped,assignment()),{action:'apply'});
  const afterTerminal=event({eventId:'00000000-0000-4000-8000-000000000012',sequence:5,revision:5,cursor:'cursor-5',eventType:'turn.started',status:'running'});
  assert.equal(classifyExecutionEvent(stopped,afterTerminal,assignment()).code,'TERMINAL_STATE');
});

test('retry policy is deadline-bound and caps dispatch and read-only reconciliation loops',()=>{
  const now='2026-10-11T10:15:00.000Z';
  const policy=(overrides={})=>retryDisposition({attemptCount:0,reconciliationCount:0,deadlineAt:deadline,outcome:'not-dispatched',now,...overrides});
  assert.deepEqual(policy(),{action:'dispatch-same-command',code:'SAFE_NO_EFFECT',attemptNumber:1,maxAttempts:MAX_DISPATCH_ATTEMPTS});
  assert.equal(policy({attemptCount:2,outcome:'rejected-no-effect'}).attemptNumber,3);
  assert.deepEqual(policy({attemptCount:MAX_DISPATCH_ATTEMPTS,outcome:'rejected-no-effect'}),{action:'stop',code:'ATTEMPT_BUDGET_EXHAUSTED'});
  assert.deepEqual(policy({outcome:'unknown'}),{action:'reconcile_once',code:'OUTCOME_UNKNOWN'});
  assert.deepEqual(policy({outcome:'unknown',reconciliationCount:MAX_RECONCILIATION_ATTEMPTS}),{action:'stop',code:'OUTCOME_STILL_UNKNOWN'});
  assert.deepEqual(policy({outcome:'unknown',now:deadline}),{action:'stop',code:'DEADLINE_EXPIRED'});
  assert.deepEqual(policy({outcome:'maybe'}),{action:'stop',code:'UNSAFE_RETRY_OUTCOME'});
  assert.deepEqual(policy({attemptCount:-1}),{action:'stop',code:'INVALID_RETRY_STATE'});
});
