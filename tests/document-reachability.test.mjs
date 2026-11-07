import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDocumentation} from '../scripts/check-docs.mjs';

test('reachability follows encoded relative links and anchors, stops at cycles, and reports an orphan',()=>{
 const documents={
  'README.md':'# Home\n\n[Docs](docs/README.md)',
  'AGENTS.md':'[Cycle](docs/cycle-a.md#start)',
  'docs/README.md':'[Guide](guide%20notes.md#section) [Cycle](cycle-b.md)',
  'docs/guide notes.md':'# Section\n\n[Home](../README.md)',
  'docs/cycle-a.md':'# Start\n\n[Next](cycle-b.md)',
  'docs/cycle-b.md':'[Back](cycle-a.md#start)',
  'docs/orphan.md':'# Orphan',
 };
 const result=auditDocumentation({documents,paths:Object.keys(documents),entrypoints:['README.md','AGENTS.md']});
 assert.deepEqual(result.errors.map(error=>[error.code,error.source,error.target]),[
  ['UNREACHABLE_DOCUMENT','docs/README.md','docs/orphan.md'],
 ]);
 assert.equal(result.unreachableDocuments,1);
});
