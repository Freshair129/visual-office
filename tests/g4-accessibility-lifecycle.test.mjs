import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {visibleAnimation, visibleThreeLoop, pauseOnReducedMotion} from '../web/visible-animation.js';
import {FramePacer} from '../web/tycoon-frame-pacer.js';
import {StorageRecoveryUI} from '../web/storage-recovery-ui.js';
import {CloudClient} from '../web/cloud-client.js';

test('Lab animation cancels while hidden and resumes without hidden elapsed time', () => {
  const doc = new JSDOM('').window.document;
  let hidden = false, next = 0;
  Object.defineProperty(doc, 'hidden', {get: () => hidden});
  const frames = new Map(), draws = [];
  const stop = visibleAnimation(doc, cb => {const id = ++next;frames.set(id, cb);return id;}, id => frames.delete(id), (dt, elapsed) => draws.push([dt, elapsed]));
  const run = time => {const [id, cb] = frames.entries().next().value;frames.delete(id);cb(time);};
  run(100);run(116);
  hidden = true;doc.dispatchEvent(new doc.defaultView.Event('visibilitychange'));
  assert.equal(frames.size, 0);
  hidden = false;doc.dispatchEvent(new doc.defaultView.Event('visibilitychange'));
  run(100000);
  assert.deepEqual(draws.map(item => item[0]), [0, .016, 0]);
  assert.equal(draws[2][1], .016);
  stop();assert.equal(frames.size, 0);
  doc.dispatchEvent(new doc.defaultView.Event('visibilitychange'));assert.equal(frames.size, 0);
});

test('Tycoon loop adapter stops while hidden and resets frame pacing', () => {
  const doc = new JSDOM('').window.document;
  let hidden = false, loop;
  Object.defineProperty(doc, 'hidden', {get: () => hidden});
  const pacer = new FramePacer(30);
  const renderer = {setAnimationLoop(value) {loop = value;}};
  const deltas = [], stop = visibleThreeLoop(doc, renderer, pacer, ms => deltas.push(pacer.sample(ms)));
  loop(0);loop(34);
  hidden = true;doc.dispatchEvent(new doc.defaultView.Event('visibilitychange'));assert.equal(loop, null);
  hidden = false;doc.dispatchEvent(new doc.defaultView.Event('visibilitychange'));loop(100000);
  assert.deepEqual(deltas, [0, .034, 0]);
  stop();assert.equal(loop, null);
});

test('enabling reduced motion pauses Lab and listener is released', () => {
  const preference = new EventTarget();preference.matches = false;let pauses = 0;
  const stop = pauseOnReducedMotion(preference, () => pauses++);
  preference.dispatchEvent(new Event('change'));assert.equal(pauses, 0);
  preference.matches = true;preference.dispatchEvent(new Event('change'));assert.equal(pauses, 1);
  stop();preference.dispatchEvent(new Event('change'));assert.equal(pauses, 1);
});

test('recovery dialog has a contextual name, safe initial focus and live status', () => {
  const doc = new JSDOM('<main></main>').window.document;
  const ui = new StorageRecoveryUI(doc.querySelector('main'));
  ui.show({recoverable:true, rawText:'bad', kind:'envelope'}, () => false);
  assert.equal(ui.dialog.getAttribute('aria-label'), ui.dialog.querySelector('h2').textContent);
  assert.ok(ui.dialog.querySelector('[data-storage-cancel]').hasAttribute('autofocus'));
  assert.equal(ui.status.getAttribute('role'), 'status');
  ui.backupReady = true;ui.canDiscard = true;
  ui.dialog.close = () => {ui.dialog.open = false;};
  assert.equal(ui.confirmRemoval(), false);
  assert.match(ui.status.textContent, /นำข้อมูลออกไม่ได้/);
});

test('public HTML entry points declare a document language', async () => {
  for (const name of ['index.html', 'character-lab.html', 'tools/office-prop-baker.html', 'tools/marketing-preview.html', 'tools/marketing-controls.html']) {
    const html = await readFile(new URL(`../web/${name}`, import.meta.url), 'utf8');
    const doc = new JSDOM(html).window.document;
    assert.ok(doc.documentElement.lang, `${name} needs a document language`);
  }
});

test('CloudClient pauses polling when hidden and refreshes only an active connection on return', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  let reads = 0;
  const client = new CloudClient({fetchImpl:async path => {
    reads++;
    return Response.json(path === '/api/office' ? {version:1,sessions:[]} : path === '/api/jobs' ? {jobs:[]} : {context:''});
  },onSnapshot(){},onState(){}});
  await client.refresh();assert.equal(reads,3);
  client.setVisible(false);t.mock.timers.tick(15000);assert.equal(reads,3);
  await client.setVisible(true);assert.equal(reads,6);
  client.disconnect();client.setVisible(false);client.setVisible(true);t.mock.timers.tick(15000);assert.equal(reads,6);
});

test('a CloudClient request completing while hidden cannot restart its polling timer', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  let release, reads = 0;
  const first = new Promise(resolve => {release = resolve;});
  const client = new CloudClient({fetchImpl:async path => {
    reads++;
    if (reads === 1) await first;
    return Response.json(path === '/api/office' ? {version:1,sessions:[]} : path === '/api/jobs' ? {jobs:[]} : {context:''});
  },onSnapshot(){},onState(){}});
  const pending = client.refresh();client.setVisible(false);release();await pending;
  assert.equal(reads,3);t.mock.timers.tick(15000);assert.equal(reads,3);
  await client.setVisible(true);assert.equal(reads,6);client.disconnect();
});
