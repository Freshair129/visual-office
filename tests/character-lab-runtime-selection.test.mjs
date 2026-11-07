import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCharacterSelection,characterReviewScope} from '../web/characters/lab-state.js';

test('Lab defaults to the current face review and keeps explicit historical/runtime choices',()=>{
 for(const requested of [null,'','../../private','https://other/model.glb'])assert.deepEqual(initialCharacterSelection(requested),{id:'zuri-face-r4',version:'current'});
 for(const id of ['zuri-anime','wangjai','staff-a','staff-b','zuri','anime','rain'])assert.deepEqual(initialCharacterSelection(id),{id,version:'current'});
 assert.deepEqual(initialCharacterSelection('blender'),{id:'zuri',version:'blender'});
});

test('Lab describes approved appearances truthfully without approving historical candidates',()=>{
 for(const id of ['zuri-face-r4','wangjai','staff-a','staff-b']){
  assert.match(characterReviewScope(id),/อนุมัติงานภาพ 7 พฤศจิกายน 2026/);assert.doesNotMatch(characterReviewScope(id),/ยังไม่อนุมัติ/);
  assert.doesNotMatch(characterReviewScope(id),/ยังไม่ใช้ในชั้นจริง/);
 }
 for(const id of ['zuri-anime','zuri','anime','rain','../../private'])assert.match(characterReviewScope(id),/ไม่ใช้ในชั้นจริง/);
});
