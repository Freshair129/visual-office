import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {setCharacterDownload,characterModelPath,availableCharacterActions} from '../web/characters/lab-state.js';

test('Blender pilot is Zuri-only and cannot expose unrelated paths',()=>{
  assert.equal(characterModelPath('zuri','blender'),'./assets/models/characters/reviews/zuri-head-revision.glb');
  assert.equal(characterModelPath('zuri','rejected'),'./assets/models/characters/reviews/zuri-blender-pilot.glb');
  assert.equal(characterModelPath('wangjai','rejected'),null);
  for(const id of ['staff-a','wangjai','../../outside'])assert.equal(characterModelPath(id,'blender'),null);
});

test('static Blender study offers no invented animation; prior clips remain available',()=>{
  assert.deepEqual(availableCharacterActions([]),[]);
  assert.deepEqual(availableCharacterActions([{name:'walking'},{name:'idle'},{name:'provider-script'}]),['idle','walking']);
});

test('before/after model paths are bounded and only Zuri has a preserved baseline',()=>{
  assert.equal(characterModelPath('zuri','before'),'./assets/models/characters/reviews/zuri-before-refinement.glb');
  assert.equal(characterModelPath('zuri','current'),'./assets/models/characters/zuri.glb');
  assert.equal(characterModelPath('wangjai','before'),null);
  assert.equal(characterModelPath('zuri','../../bad'),null);
  assert.equal(characterModelPath('__proto__'),null);
  const link=new JSDOM('<a></a>',{url:'http://localhost/character-lab.html'}).window.document.querySelector('a');
  setCharacterDownload(link,'zuri',true,'before');assert.match(link.href,/reviews\/zuri-before-refinement\.glb$/);
  setCharacterDownload(link,'staff-a',true,'before');assert.equal(link.hasAttribute('href'),false);
});

test('pending or failed character switches remove the previous keyboard download target',()=>{
  const link=new JSDOM('<a id="download" download>GLB</a>',{url:'http://localhost/character-lab.html'}).window.document.querySelector('a');
  setCharacterDownload(link,'zuri',true);assert.match(link.href,/zuri\.glb$/);assert.equal(link.tabIndex,0);
  setCharacterDownload(link,'wangjai',false);assert.equal(link.hasAttribute('href'),false);assert.equal(link.hasAttribute('download'),false);assert.equal(link.tabIndex,-1);assert.equal(link.getAttribute('aria-disabled'),'true');
  setCharacterDownload(link,'wangjai',false);assert.equal(link.hasAttribute('href'),false);
  setCharacterDownload(link,'wangjai',true);assert.match(link.href,/wangjai\.glb$/);assert.equal(link.download,'wangjai.glb');assert.equal(link.tabIndex,0);
  setCharacterDownload(link,'../../private',true);assert.equal(link.hasAttribute('href'),false);
});
