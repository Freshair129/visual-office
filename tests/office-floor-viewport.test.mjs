import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {attachFloorViewport,floorMapSize} from '../web/office-floor-viewport.js';

test('late native controls yield touch ownership without resetting the floor view',()=>{
 const dom=new JSDOM('<div id="view"></div>'),root=dom.window.document.querySelector('#view');
 const viewport=attachFloorViewport(root),touches={ONE:0,TWO:2},controls={touches};
 viewport.zoomTo(1.5);root.scrollLeft=120;root.scrollTop=80;
 viewport.setNativeControls(controls);
 assert.deepEqual(controls.touches,{ONE:null,TWO:null});
 assert.equal(viewport.zoom,1.5);assert.equal(root.scrollLeft,120);assert.equal(root.scrollTop,80);
 viewport.setNativeControls(controls);assert.deepEqual(controls.touches,{ONE:null,TWO:null});
 viewport();assert.equal(controls.touches,touches);
 viewport.setNativeControls(controls);assert.equal(controls.touches,touches);
 dom.window.close();
});

test('Full HD keeps the artwork ratio; portrait keeps full-size furniture and scrolls',()=>{
 assert.deepEqual(floorMapSize(1920,1080),{width:2304,height:1536});
 const phone=floorMapSize(390,844);assert.equal(phone.width,1728);assert.equal(phone.height,1152);
 assert.ok(phone.width>390*3);assert.equal(phone.width/phone.height,1.5);
});
test('campus framing covers wide and portrait viewports with overscan even after zoom-out and resize',()=>{
 const dom=new JSDOM('<div id="view"></div>'),root=dom.window.document.querySelector('#view');
 let width=1920,height=1080,onResize;
 Object.defineProperties(root,{clientWidth:{get:()=>width},clientHeight:{get:()=>height}});
 dom.window.ResizeObserver=class{constructor(callback){onResize=callback;}observe(){}disconnect(){}};
 const viewport=attachFloorViewport(root,{framing:'cover',overscan:1.25});
 const check=()=>{const mapWidth=parseFloat(root.style.getPropertyValue('--floor-map-width'));assert.ok(mapWidth>=width*1.25);assert.ok(mapWidth/1.5>=height*1.25);assert.equal(root.style.getPropertyValue('--floor-map-top'),'0px');};
 check();viewport.fit();check();viewport.zoomTo(.01);check();
 width=390;height=844;onResize();viewport.fit();check();
 width=2560;height=1080;onResize();viewport.zoomTo(.01);check();
 viewport();dom.window.close();
});
test('ordinary floors retain whole-scene Fit rather than campus cover framing',()=>{
 const dom=new JSDOM('<div id="view"></div>'),root=dom.window.document.querySelector('#view');
 Object.defineProperties(root,{clientWidth:{value:1920},clientHeight:{value:1080}});
 const viewport=attachFloorViewport(root);viewport.fit();
 assert.equal(parseFloat(root.style.getPropertyValue('--floor-map-width')),1620);
 viewport();dom.window.close();
});
test('blank-ground dragging pans the viewport; objects and buttons retain their interaction',()=>{
 const dom=new JSDOM('<div id="view"><div class="hy-scene"><button class="hy-object">desk</button></div></div>');
 const root=dom.window.document.querySelector('#view'),scene=root.firstChild;root.scrollLeft=100;root.scrollTop=100;
 const dispose=attachFloorViewport(root);
 const event=(target,type,x,y)=>{const e=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,button:0,pointerType:'mouse',clientX:x,clientY:y});target.dispatchEvent(e);};
 event(scene,'pointerdown',100,100);event(root,'pointermove',70,80);assert.equal(root.scrollLeft,130);assert.equal(root.scrollTop,120);event(root,'pointerup',70,80);
 event(scene.firstChild,'pointerdown',100,100);event(root,'pointermove',0,0);assert.equal(root.scrollLeft,130);
 dispose();event(scene,'pointerdown',100,100);event(root,'pointermove',0,0);assert.equal(root.scrollLeft,130);dom.window.close();
});
test('native canvas keeps pointer ownership and mesh picking instead of viewport capture',()=>{
 const dom=new JSDOM('<div id="view"><canvas></canvas></div>'),root=dom.window.document.querySelector('#view'),canvas=root.firstChild;
 let captures=0,ups=0;root.setPointerCapture=()=>captures++;canvas.addEventListener('pointerup',()=>ups++);const dispose=attachFloorViewport(root);root.scrollLeft=100;
 for(const type of ['pointerdown','pointermove','pointerup']){const e=new dom.window.Event(type,{bubbles:true});Object.assign(e,{pointerId:2,pointerType:'mouse',button:0,clientX:type==='pointerdown'?100:0,clientY:100});canvas.dispatchEvent(e);}
 assert.equal(captures,0);assert.equal(ups,1);assert.equal(root.scrollLeft,100);dispose();dom.window.close();
});
test('alpha-verified transparent object padding is pannable but opaque object pixels remain clickable',()=>{
 const dom=new JSDOM('<div id="view"><button class="hy-object">desk</button></div>'),root=dom.window.document.querySelector('#view'),button=root.firstChild;let empty=true;
 const dispose=attachFloorViewport(root,{isEmptyGround:()=>empty});root.scrollLeft=100;
 const fire=(type,x)=>{const e=new dom.window.Event(type,{bubbles:true});Object.assign(e,{pointerId:1,button:0,pointerType:'mouse',clientX:x,clientY:100});button.dispatchEvent(e);};
 fire('pointerdown',100);fire('pointermove',50);fire('pointerup',50);assert.equal(root.scrollLeft,150);
 empty=false;fire('pointerdown',100);fire('pointermove',0);fire('pointerup',0);assert.equal(root.scrollLeft,150);dispose();dom.window.close();
});
