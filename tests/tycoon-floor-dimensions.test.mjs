import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {OFFICE_FLOORS} from '../web/office-floor-registry.js';
import {createTycoonRoom} from '../web/tycoon-state.js';
import {createTycoonFloorDimensions} from '../web/tycoon-floor-plans.js';
import {describeAreaDimensions,metricLength} from '../web/office-plan-dimensions.js';

test('all delivered drawings bind room, door and aisle dimensions to the actual metric plans',async()=>{
 const combined=new JSDOM(await readFile('docs/game-design/tycoon-floor-plans.svg','utf8'),{contentType:'image/svg+xml'}).window.document;
 assert.equal(combined.querySelectorAll('.floor-plan').length,15);
 for(const floor of OFFICE_FLOORS){
  const room=createTycoonRoom(floor.key),plan=room.blueprintPlan,group=combined.querySelector(`[data-floor="${floor.key}"]`);
  assert.equal(Number(group.querySelector('[data-dimension-kind="overall-width"]').getAttribute('data-metres')),plan.width);
  assert.equal(Number(group.querySelector('[data-dimension-kind="overall-depth"]').getAttribute('data-metres')),plan.depth);
  const surface=group.querySelector('.floor-surface'),pixelsPerMetre=Number(surface.getAttribute('width'))/plan.width;
  for(const wall of group.querySelectorAll('.partition-wall,.outer-wall'))assert.ok(Math.abs(Number(wall.getAttribute('stroke-width'))/pixelsPerMetre-.2)<1e-8,'drawn wall thickness is metric');
  const rear=group.querySelector('.outer-wall'),half=Number(rear.getAttribute('stroke-width'))/2;
  assert.ok(Math.abs(Number(rear.getAttribute('y1'))+half-Number(surface.getAttribute('y')))<1e-8,'outer wall inside face meets clear floor boundary');
  for(const area of plan.areas){
   const label=group.querySelector(`.area-label[data-area-id="${area.id}"]`),dimensions=describeAreaDimensions(plan,area);
   assert.ok(label,`${floor.key}/${area.id}`);assert.equal(label.getAttribute('data-dimension-basis'),dimensions.basis);
   for(const [attribute,value]of [['data-width-m',dimensions.widthM],['data-depth-m',dimensions.depthM],['data-area-m2',dimensions.areaM2]])assert.ok(Math.abs(Number(label.getAttribute(attribute))-value)<=.005001,`${floor.key}/${area.id}/${attribute}`);
  }
  assert.equal(Number(group.querySelector('[data-door-id="entry"]').getAttribute('data-width-m')),plan.door.width);
  for(const wall of plan.partitions.filter(w=>w.door))assert.equal(Number(group.querySelector(`[data-door-id="${wall.id}"]`).getAttribute('data-width-m')),wall.door.width);
  const probes=createTycoonFloorDimensions(floor.key),spans=[...group.querySelectorAll('[data-dimension-kind="aisle"]')];assert.equal(spans.length,probes.length);
  for(const [index,probe]of probes.entries())assert.ok(Math.abs(Number(spans[index].getAttribute('data-metres'))-metricLength(probe.from,probe.to))<=.005001);
  for(const badge of group.querySelectorAll('.aisle-key circle')){
   const x=Number(badge.getAttribute('cx')),y=Number(badge.getAttribute('cy')),r=Number(badge.getAttribute('r'));
   for(const box of group.querySelectorAll('.area-label rect')){const left=Number(box.getAttribute('x')),top=Number(box.getAttribute('y')),right=left+Number(box.getAttribute('width')),bottom=top+Number(box.getAttribute('height'));assert.ok(x+r<left||x-r>right||y+r<top||y-r>bottom,`${floor.key} aisle marker overlaps a room label`);}
  }
  const labels=[...group.querySelectorAll('.area-label rect')];
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j],ax=Number(a.getAttribute('x')),ay=Number(a.getAttribute('y')),bx=Number(b.getAttribute('x')),by=Number(b.getAttribute('y'));assert.ok(ax+Number(a.getAttribute('width'))<bx||bx+Number(b.getAttribute('width'))<ax||ay+Number(a.getAttribute('height'))<by||by+Number(b.getAttribute('height'))<ay,`${floor.key} room markers overlap`);}
  assert.equal(group.querySelectorAll('.area-schedule-row').length,plan.areas.length);
  assert.ok(group.querySelector('.entry-lift-route').getAttribute('points').split(' ').length>=2);
 }
});

test('individual SVG sheets preserve the stated 1:100 physical scale at 100 percent printing',async()=>{
 for(const floor of OFFICE_FLOORS){
  const doc=new JSDOM(await readFile(`docs/game-design/floor-plans/${floor.key}.svg`,'utf8'),{contentType:'image/svg+xml'}).window.document,svg=doc.documentElement;
  assert.match(svg.getAttribute('width'),/mm$/);assert.match(svg.getAttribute('height'),/mm$/);
  const viewBox=svg.getAttribute('viewBox').split(' ').map(Number),millimetresPerUnit=parseFloat(svg.getAttribute('width'))/viewBox[2];
  const span=svg.querySelector('[data-dimension-kind="overall-width"] line'),printedWidth=(Number(span.getAttribute('x2'))-Number(span.getAttribute('x1')))*millimetresPerUnit;
  assert.ok(Math.abs(printedWidth-240)<1e-6,'24 metres must print as 240 mm at 1:100');
  assert.ok(Math.abs(parseFloat(svg.getAttribute('height'))/viewBox[3]-millimetresPerUnit)<1e-8,'isotropic scale');
  assert.match(svg.textContent,/1:100 at 100%/);assert.match(svg.textContent,/clear: wall-face dimensions/);assert.equal(svg.querySelectorAll('.floor-plan').length,1);
 }
});
