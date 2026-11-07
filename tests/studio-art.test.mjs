import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {ArtHistory,ART_KEY,normalizeArt,artDefaults,artStyles,parts} from '../web/studio-art-state.js';
import {ArtStudio} from '../web/studio-art.js';
import {DesignStudio} from '../web/design-studio.js';
import {externalAssetTest} from './external-assets-helper.mjs';

test('art preferences migrate empty/corrupt storage and discard foreign context',()=>{
  const h=new ArtHistory({getItem:()=>'{broken'});
  assert.deepEqual(h.current,artDefaults());assert.equal(h.hasSaved,false);
  const safe=normalizeArt({version:1,style:'__proto__',tone:'foreign',businessId:'secret',positions:{desk:{x:-900,y:Infinity,scale:99}}});
  assert.equal(safe.style,'soft3d');assert.equal(safe.businessId,undefined);
  assert.equal(safe.positions.desk.x,12);assert.equal(safe.positions.desk.scale,1.25);
});
test('three styles share positions; undo, cancel and reload preserve explicit saved selection',()=>{
  let stored;const storage={getItem:()=>stored,setItem:(key,val)=>{assert.equal(key,ART_KEY);stored=val;}};
  const h=new ArtHistory(storage);const positions=h.current.positions;
  for(const style of artStyles){h.change({style});assert.deepEqual(h.current.positions,positions);}
  assert.equal(stored,undefined);assert.equal(h.save(),true);
  h.change({style:'soft3d',cast:false});h.undo();assert.equal(h.current.style,'anime');assert.equal(h.current.cast,true);
  h.change({tone:'blue'});h.cancel();assert.equal(h.current.tone,'cream');
  assert.deepEqual(new ArtHistory(storage).current,h.current);
  const denied=new ArtHistory({setItem(){throw Error('quota');}});denied.change({style:'anime'});
  assert.equal(denied.save(),false);assert.equal(denied.dirty,true);
});
function setup(t){
  const dom=new JSDOM('<main></main>',{url:'https://office.test'});t.after(()=>dom.window.close());
  const root=dom.window.document.querySelector('main'),storage=dom.window.localStorage;
  const ui=new ArtStudio(root,{storage});t.after(()=>ui.dispose());
  return {dom,root,ui,storage};
}
test('live controls swap component assets without resetting composition and save only on Apply',t=>{
  const {root,ui,storage,dom}=setup(t);
  assert.equal(root.querySelector('.art-apply').disabled,false);
  root.querySelector('[data-select-part="plant"]').click();
  root.querySelector('[data-move="left"]').click();
  const position={...ui.history.current.positions.plant};
  for(const style of artStyles){
    root.querySelector(`[data-art-style="${style}"]`).click();
    assert.match(root.querySelector('[data-part="plant"] img').src,new RegExp(`/${style}/plant.png$`));
    assert.deepEqual(ui.history.current.positions.plant,position);
    assert.match(root.querySelector('[data-part="duo"] img').src,/shared\/duo.png$/);
  }
  const plant=root.querySelector('[data-part="plant"]');
  plant.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
  assert.equal(ui.history.current.positions.plant.y,position.y-1);
  assert.equal(storage.getItem(ART_KEY),null);
  root.querySelector('.art-apply').click();assert.equal(JSON.parse(storage.getItem(ART_KEY)).style,'anime');
  root.querySelector('[data-tone-choice="blue"]').click();root.querySelector('.art-cancel').click();
  assert.equal(root.querySelector('.art-stage').dataset.tone,'cream');
  root.querySelector('.art-cast').click();assert.equal(root.querySelector('[data-part="duo"]').hidden,true);
  root.querySelector('.art-undo').click();assert.equal(root.querySelector('[data-part="duo"]').hidden,false);
});
test('pointer gestures produce one undo step, cancellation restores and boundary clamps stay finite',t=>{
  const {root,ui}=setup(t),button=root.querySelector('[data-part="desk"]'),stage=root.querySelector('.art-stage');
  stage.getBoundingClientRect=()=>({width:1000,height:700});
  button.onpointerdown({button:0,pointerId:1,clientX:10,clientY:10});
  button.onpointermove({pointerId:1,clientX:110,clientY:80});
  assert.equal(ui.history.past.length,0);
  button.onpointerup({pointerId:1});assert.equal(ui.history.past.length,1);
  assert.equal(ui.history.current.positions.desk.x,artDefaults().positions.desk.x+10);
  const savedPosition={...ui.history.current.positions.desk};
  button.onpointerdown({button:0,pointerId:2,clientX:10,clientY:10});
  button.onpointermove({pointerId:2,clientX:99999,clientY:99999});button.onpointercancel();
  assert.deepEqual(ui.history.current.positions.desk,savedPosition);assert.equal(ui.history.past.length,1);
  assert.match(button.style.left,/clamp/);ui.dispose();ui.dispose();assert.equal(root.children.length,0);
});
test('new art mode avoids WebGL until legacy tab and releases it on return',t=>{
  const dom=new JSDOM('<main></main>',{url:'https://office.test'}),old=globalThis.window;globalThis.window=dom.window;
  t.after(()=>{globalThis.window=old;dom.window.close();});
  let made=0,disposed=0;
  class Scene{constructor(){made++;}setState(){}select(){}dispose(){disposed++;}}
  const root=dom.window.document.querySelector('main'),ui=new DesignStudio(root,{Scene,storage:dom.window.localStorage});
  assert.equal(made,0);assert.equal(root.querySelector('.studio-layout').hidden,true);
  root.querySelector('[data-studio-mode="model"]').click();assert.equal(made,1);
  root.querySelector('[data-studio-mode="art"]').click();assert.equal(disposed,1);
  ui.dispose();assert.equal(disposed,1);
});
externalAssetTest('every style has individual RGBA PNG assets and the shared cast is separate',[
 ...['soft3d','painted','anime'].flatMap(style=>['desk','lift','plant'].map(part=>`web/assets/studio-styles/${style}/${part}.png`)),
 'web/assets/studio-styles/shared/duo.png',
],async()=>{
  const files=artStyles.flatMap(s=>parts.filter(p=>p!=='duo').map(p=>`${s}/${p}`)).concat('shared/duo');
  for(const file of files){
    const data=await readFile(`web/assets/studio-styles/${file}.png`);
    assert.equal(data.toString('ascii',1,4),'PNG');assert.equal(data[25],6,'must have RGBA channel');
    assert.ok(data.readUInt32BE(16)>=1000);assert.ok(data.readUInt32BE(20)>=1000);
  }
});
