import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {HYBRID_KEY, RoomStore, RoomHistory, starterRoom, normalizeRoom, floorFile, parseFloorJSON, parseRoomJSON} from '../web/hybrid-state.js';
import {HybridStudio} from '../web/hybrid-studio.js';
import {StorageRecoveryUI} from '../web/storage-recovery-ui.js';
import {defaultNativeRoom, copy} from '../web/native-state.js';
import {NativeStudio} from '../web/native-studio.js';
import {PLACEABLE_STUDIO_GLBS} from '../web/office-assets.js';
import {TYCOON_KEY, TycoonStore, createTycoonRoom, tycoonFloorFile, parseTycoonFloorJSON} from '../web/tycoon-state.js';
import {TycoonStudio} from '../web/tycoon-studio.js';
import {FurnitureLibrary, captureFurnitureSet} from '../web/tycoon-prefabs.js';
import {exportFurnitureBundle, importFurnitureBundle} from '../web/tycoon-prefab-files.js';
import {CustomModelStore, customHash, customModels, inspectCustomGLB, describeCustomAsset, disposeCustomModel} from '../web/custom-assets.js';
import {TycoonScene} from '../web/tycoon-scene.js';
import {rawObjectEntries, rawArrayItems} from '../web/raw-json-merge.js';

const locks = {request: async (_name, _options, run) => run()};
function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

function faultStorage(base, key) {
  return {
    readError: null, writeError: null,
    get length() { return base.length; },
    key(index) { return base.key(index); },
    getItem(k) { if (k === key && this.readError) throw this.readError; return base.getItem(k); },
    setItem(k, value) { if (k === key && this.writeError) throw this.writeError; base.setItem(k, value); },
  };
}

// This fake models IndexedDB's transaction commit/abort boundary. It does not
// establish how a real browser implements quota or private-mode storage.
function fakeIndexedDB() {
  const values = new Map(), state = {abortWrites: false, failOpen: false, lastDatabase: null};
  const db = {
    close() {},
    transaction(_name, mode) {
      const tx = {}, pending = [];let scheduled = false;
      tx.objectStore = () => ({
        get(id) {
          const request = {};
          queueMicrotask(() => { request.result = values.get(id);tx.oncomplete?.(); });
          return request;
        },
        put(value) {
          pending.push(structuredClone(value));
          if (!scheduled) {
            scheduled = true;
            queueMicrotask(() => {
              if (state.abortWrites) tx.onabort?.();
              else { for (const item of pending) values.set(item.id, item);tx.oncomplete?.(); }
            });
          }
        },
      });
      assert.ok(['readonly', 'readwrite'].includes(mode));
      return tx;
    },
  };
  return {
    state, values,
    open(name) {
      state.lastDatabase = name;
      const request = {};
      queueMicrotask(() => {
        if (state.failOpen) request.onerror?.();
        else { request.result = db;request.onsuccess?.(); }
      });
      return request;
    },
  };
}

const quota = () => new DOMException('storage full', 'QuotaExceededError');
const denied = () => new DOMException('storage denied', 'SecurityError');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR1sAAAAASUVORK5CYII=';

function domFixture(t) {
  const dom = new JSDOM('<main></main>', {url: 'https://office.test'});
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  t.after(() => dom.window.close());
  return dom;
}

class FixtureOffice {
  constructor(root) { this.root = root; this.assetModels = new Map(PLACEABLE_STUDIO_GLBS.map(a => [a.assetId, {}])); this.furniture = new Map(); }
  async load() { this.loaded = true; return true; }
  showDomain() {}
  setNativeRoom(room) { this.room = copy(room); }
  cancelObjectDrag() {}
  resize() {}
  dispose() {}
}

async function captureWindowDownload(win, trigger) {
  let blob, filename;
  win.URL.createObjectURL = value => { blob = value; return 'blob:test'; };
  win.URL.revokeObjectURL = () => {};
  win.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
  trigger();
  assert.ok(blob, 'export produced a Blob');
  const text = await new Promise((resolve, reject) => {
    const reader = new win.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
  assert.match(filename, /\.json$/);
  return JSON.parse(text);
}

async function captureWindowDownloadText(win, trigger) {
  let blob, filename;
  win.URL.createObjectURL = value => { blob = value;return 'blob:test'; };
  win.URL.revokeObjectURL = () => {};
  win.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
  trigger();
  assert.ok(blob, 'export produced a Blob');
  assert.match(filename, /\.json$/);
  return await new Promise((resolve, reject) => {
    const reader = new win.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

async function captureTycoonDownload(dom, editor) {
  let blob, filename;
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  URL.createObjectURL = value => { blob = value;return 'blob:test'; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
  try {
    editor.q('[data-export]').click();
    assert.match(filename, /\.json$/);
    assert.ok(blob);
    return JSON.parse(await blob.text());
  } finally { URL.createObjectURL = oldCreate;URL.revokeObjectURL = oldRevoke; }
}

test('Hybrid and Native isolate corrupt records and preserve untouched raw record bytes', () => {
  const storage = memoryStorage(),
    badDesign = '{ "id" : "damaged-design", "room" : {"schemaVersion":"office-room/v1","name":"bad","background":"garden","brief":"","objects":"broken"} }',
    badFloor = '{ "schemaVersion" : "office-room/v1", "name" : "bad lobby", "background" : "garden", "brief" : "", "objects" : "broken" }',
    badNative = '{ "schemaVersion" : "office-3d/v1", "objects" : "broken" }',
    raw = `{ "version" : 1, "designs" : [${badDesign}], "floors" : { "preview:lobby" : ${badFloor} }, "nativeFloors" : { "preview:customer" : ${badNative} }, "editions" : {} }`;
  storage.setItem(HYBRID_KEY, raw);
  const store = new RoomStore(storage);
  assert.equal(store.writeBlocked, false, 'a bad record does not block the whole envelope');
  assert.equal(store.apply('preview:projects', starterRoom()), true, 'a different Hybrid floor may save beside a bad library entry');
  assert.equal(store.applyNative('projects', defaultNativeRoom()), true, 'Native may save a different key');
  const after = storage.getItem(HYBRID_KEY);
  assert.ok(after.includes(badDesign), 'the unreadable library record remains byte-for-byte');
  assert.ok(after.includes(badFloor), 'the unreadable Hybrid floor remains byte-for-byte');
  assert.ok(after.includes(badNative), 'the unreadable Native floor remains byte-for-byte');
  assert.equal(store.apply('preview:lobby', starterRoom()), false, 'a write to the corrupt target is refused');
  assert.equal(store.lastWriteError.kind, 'record');
  assert.equal(storage.getItem(HYBRID_KEY), after, 'a refused target write changes no bytes');
});

test('Hybrid rejects payloads that strict room loading rejects before writing', () => {
  const storage = memoryStorage(), store = new RoomStore(storage);
  assert.equal(store.apply('preview:lobby', starterRoom()), true);
  const before = storage.getItem(HYBRID_KEY), oversized = {...starterRoom(), brief: 'x'.repeat(80_001)};
  assert.throws(() => parseRoomJSON(JSON.stringify(oversized)), /ใหญ่เกินไป/);
  assert.equal(store.apply('preview:projects', oversized), false);
  assert.equal(store.save('oversized', oversized), false);
  assert.equal(store.lastWriteError.kind, 'invalid');
  assert.equal(storage.getItem(HYBRID_KEY), before, 'rejected payloads do not reach storage');
  const oldRecord=JSON.stringify(oversized),oldBlob=`{"version":1,"designs":[],"floors":{"preview:lobby":${oldRecord}},"nativeFloors":{},"editions":{}}`;
  storage.setItem(HYBRID_KEY,oldBlob);
  const fresh = new RoomStore(storage);
  assert.equal(fresh.writeBlocked, false, 'an older oversized record does not lock the whole store');
  assert.equal(fresh.floor('lobby').brief,'x'.repeat(4000),'the tolerant display loader still renders the normalized legacy floor');
  assert.equal(fresh.issueFor('floors','preview:lobby'),null,'a record that still renders is not offered for deletion');
  assert.equal(fresh.apply('preview:projects', starterRoom()), true);
  assert.ok(storage.getItem(HYBRID_KEY).includes(oldRecord), 'the oversized old record is retained byte-for-byte');
});

test('Hybrid writes validate the normalized history room after cleaning stale Scene Sheet fields', () => {
  const room={...starterRoom(),background:'office',sceneSheet:'office-sheet/v1',placementGrid:{cellSize:.5},
    objects:[{id:'sheet-desk',kind:'work-desk',x:50,y:50,scale:1,flip:false,locked:false,rotation:90}]};
  const history=new RoomHistory(room),normalized=normalizeRoom(room),store=new RoomStore(memoryStorage());
  assert.throws(()=>parseRoomJSON(JSON.stringify(room)),/Scene Sheet/,'the original combination is not a strict saved room');
  assert.equal(normalized.sceneSheet,undefined);
  assert.equal(normalized.placementGrid,undefined);
  assert.equal(Object.hasOwn(normalized.objects[0],'rotation'),false);
  assert.doesNotThrow(()=>parseRoomJSON(JSON.stringify(history.current)));
  assert.equal(store.apply('preview:projects',history.current),true);
  assert.equal(store.save('stale-sheet',history.current),true);
});

test('missing storage values from adapters may be null or undefined', async () => {
  let hybridRaw,tycoonRaw;
  const storage={getItem(key){return key===HYBRID_KEY?hybridRaw:tycoonRaw;},setItem(key,value){if(key===HYBRID_KEY)hybridRaw=value;else tycoonRaw=value;}};
  const hybrid=new RoomStore(storage);
  assert.equal(hybrid.apply('preview:projects',starterRoom()),true);
  const tycoon=new TycoonStore({getItem:()=>undefined,setItem(_key,value){tycoonRaw=value;}},{locks});
  assert.equal((await tycoon.save('projects',createTycoonRoom('projects'))).ok,true);
  const reloaded=new TycoonStore({getItem:()=>tycoonRaw,setItem(_key,value){tycoonRaw=value;}},{locks});
  assert.ok(reloaded.get('projects'));
});

test('parseable unsupported envelopes allow backup only and never discard the stored key', async t => {
  const validRoom=JSON.stringify(starterRoom()),validTycoon=JSON.stringify({revision:1,edition:'tycoon3d',room:createTycoonRoom('projects')}),
    unsupported=[
      '{"version":2,"floors":{}}',
      '{"version":1,"extra":true,"floors":{}}',
      '{"version":1,"version":1,"floors":{}}',
      '{"version":1,"floors":[]}',
      `{"version":1,"floors":{"preview:lobby":${validRoom},"preview:lobby":${validRoom}}}`,
      `{"version":1,"floors":{"projects":${validTycoon},"projects":${validTycoon}}}`
    ];
  for(const raw of unsupported){
    const storage=memoryStorage();storage.setItem(HYBRID_KEY,raw);storage.setItem(TYCOON_KEY,raw);
    const hybrid=new RoomStore(storage);assert.equal(hybrid.writeBlocked,true);assert.equal(hybrid.lastWriteError.recoverable,false);assert.equal(hybrid.lastWriteError.backupOnly,true);
    assert.equal(hybrid.discardUnreadable(hybrid.lastWriteError),false);assert.equal(storage.getItem(HYBRID_KEY),raw);
    const tycoon=new TycoonStore(storage,{locks});tycoon.get('projects');assert.equal(tycoon.lastWriteError.recoverable,false);assert.equal(tycoon.lastWriteError.backupOnly,true);
    assert.equal(await tycoon.discardUnreadable(tycoon.lastWriteError),false);assert.equal(storage.getItem(TYCOON_KEY),raw);
  }

  const raw=unsupported[0],storage=memoryStorage();storage.setItem(HYBRID_KEY,raw);
  const issue=new RoomStore(storage).lastWriteError,dom=domFixture(t),ui=new StorageRecoveryUI(dom.window.document.querySelector('main'),{fileName:'hybrid-backup.json'});
  t.after(()=>{ui.dispose();dom.window.close();});
  assert.equal(ui.show(issue,()=>false),true);
  assert.equal(ui.panel.hidden,false);
  assert.equal(ui.panel.querySelector('[data-storage-remove]').hidden,true,'unsupported but parseable data has no discard control');
  assert.match(ui.dialog.querySelector('[data-storage-recovery-details]').textContent,/จะเก็บคลังเดิมไว้/);
  assert.equal(await captureWindowDownloadText(dom.window,()=>ui.panel.querySelector('[data-storage-backup]').click()),raw);
  assert.equal(ui.confirmRemoval(),false);
  assert.equal(storage.getItem(HYBRID_KEY),raw);
});

test('duplicate design IDs recover only the unreadable copy and preserve the valid copy', () => {
  const storage=memoryStorage(),good=JSON.stringify({id:'shared-id',room:starterRoom()}),
    bad=JSON.stringify({id:'shared-id',room:{schemaVersion:'office-room/v1',name:'bad',background:'garden',brief:'',objects:'broken'}}),
    raw=`{"version":1,"designs":[${good},${bad}],"floors":{},"nativeFloors":{},"editions":{}}`;
  storage.setItem(HYBRID_KEY,raw);const store=new RoomStore(storage),issue=store.issueFor('designs','shared-id');
  assert.equal(issue.index,1,'the damaged duplicate, not the first match, is targeted');
  assert.equal(store.discardUnreadable(issue),true);
  const after=storage.getItem(HYBRID_KEY),loaded=new RoomStore(storage);
  assert.ok(after.includes(good),'the valid raw copy remains byte-for-byte');
  assert.equal(loaded.data.designs.length,1);
  assert.equal(loaded.data.designs[0].id,'shared-id');
});

test('Tycoon unreadable-record discard rechecks the snapshot inside the store lock', async () => {
  const storage=memoryStorage(),badProject=`{"revision":1,"edition":"tycoon3d","room":{"schemaVersion":"office-tycoon/v1"}}`,
    original=`{"version":1,"floors":{"projects":${badProject}}}`,
    concurrent=`{"version":1,"floors":{"projects":${badProject},"lobby":${JSON.stringify({revision:1,edition:'tycoon3d',room:createTycoonRoom('lobby')})}}}`;
  storage.setItem(TYCOON_KEY,original);let enteredLock=false;
  const raceLocks={request:async(_name,_options,run)=>{enteredLock=true;storage.setItem(TYCOON_KEY,concurrent);return run();}},
    store=new TycoonStore(storage,{locks:raceLocks});
  store.get('projects');const issue=store.lastWriteError;
  assert.equal(await store.discardUnreadable(issue),false);
  assert.equal(enteredLock,true);
  assert.equal(storage.getItem(TYCOON_KEY),concurrent,'a waiting discard cannot overwrite a newer floor');
});

test('raw JSON entry readers reject missing closers, trailing commas and trailing bytes', () => {
  assert.throws(()=>rawObjectEntries('{"a":1'),/closing|object|JSON/i);
  assert.throws(()=>rawObjectEntries('{"a":1} trailing'),/trailing|JSON/i);
  assert.throws(()=>rawObjectEntries('{"a":1,}'),/comma|member|JSON/i);
  assert.throws(()=>rawArrayItems('[1'),/closing|array|JSON/i);
  assert.throws(()=>rawArrayItems('[1] trailing'),/trailing|JSON/i);
  assert.throws(()=>rawArrayItems('[1,]'),/comma|item|JSON/i);
});

test('Tycoon saves and edition selection isolate corrupt floors and preserve untouched raw bytes', async () => {
  const storage = memoryStorage(), project = createTycoonRoom('projects'),
    badLobby = '{ "revision" : 1, "edition" : "tycoon3d", "room" : {"schemaVersion":"office-tycoon/v1"} }',
    projectRecord = `{ "revision" : 1, "edition" : "tycoon3d", "room" : ${JSON.stringify(project)} }`,
    raw = `{ "version" : 1, "floors" : { "lobby" : ${badLobby}, "projects" : ${projectRecord} } }`;
  storage.setItem(TYCOON_KEY, raw);
  const store = new TycoonStore(storage, {locks}), changed = createTycoonRoom('projects');changed.objects[0].x += 0.5;
  assert.equal((await store.save('projects', changed, 1)).ok, true, 'a valid target floor can be saved');
  assert.ok(storage.getItem(TYCOON_KEY).includes(badLobby), 'the unreadable other floor remains byte-for-byte');
  assert.equal(await store.select('projects', 'legacy'), true, 'edition selection is also floor-scoped');
  assert.ok(storage.getItem(TYCOON_KEY).includes(badLobby));

  const badProject = '{ "revision" : 1, "edition" : "tycoon3d", "room" : { "schemaVersion" : "office-tycoon/v1" } }',
    targetRaw = `{ "version" : 1, "floors" : { "lobby" : ${JSON.stringify({revision: 1, edition: 'tycoon3d', room: createTycoonRoom('lobby')})}, "projects" : ${badProject} } }`;
  storage.setItem(TYCOON_KEY, targetRaw);
  const targetStore = new TycoonStore(storage, {locks});
  assert.equal((await targetStore.save('projects', createTycoonRoom('projects'), 1)).reason, 'storage');
  assert.equal(targetStore.lastWriteError.kind, 'record');
  assert.equal(await targetStore.select('projects', 'legacy'), false);
  assert.equal(storage.getItem(TYCOON_KEY), targetRaw, 'an invalid target floor is never overwritten');
});

test('a denied read must not be mistaken for an empty store when writes still work', async () => {
  const storage = memoryStorage(), rooms = new RoomStore(storage), tycoon = new TycoonStore(storage, {locks});
  assert.equal(rooms.apply('preview:lobby', starterRoom()), true);
  assert.equal((await tycoon.save('lobby', createTycoonRoom('lobby'))).ok, true);
  const hybridBefore = storage.getItem(HYBRID_KEY), tycoonBefore = storage.getItem(TYCOON_KEY);
  const denied = {getItem() { throw new DOMException('Access denied', 'SecurityError'); }, setItem: storage.setItem};
  assert.equal(new RoomStore(denied).apply('preview:projects', starterRoom()), false);
  assert.equal((await new TycoonStore(denied, {locks}).save('projects', createTycoonRoom('projects'))).ok, false);
  assert.equal(storage.getItem(HYBRID_KEY), hybridBefore);
  assert.equal(storage.getItem(TYCOON_KEY), tycoonBefore);
});

for (const mode of ['quota', 'rejected write', 'denied read', 'stale revision', 'corrupt before save']) {
  test(`Hybrid floor save: ${mode} retains its draft and exports it`, async t => {
    const base = memoryStorage(), seed = new RoomStore(base);
    assert.equal(seed.apply('preview:projects', {...starterRoom(), name: 'Last good'}), true);
    assert.equal(seed.applyNative('customer', defaultNativeRoom()), true);
    const storage = faultStorage(base, HYBRID_KEY), dom = domFixture(t);
    const editor = new HybridStudio(dom.window.document.querySelector('main'), {storage, initialFloor: 'projects'});
    t.after(() => editor.dispose());
    editor.change({name: 'Hybrid draft'});
    assert.equal(editor.history.dirty, true);
    if (mode === 'quota') storage.writeError = quota();
    if (mode === 'rejected write') storage.writeError = Error('write rejected after serialization');
    if (mode === 'denied read') storage.readError = denied();
    if (mode === 'stale revision') assert.equal(new RoomStore(base).apply('preview:projects', {...starterRoom(), name: 'Other tab'}), true);
    if (mode === 'corrupt before save') base.setItem(HYBRID_KEY, '{broken');
    if (mode === 'denied read' || mode === 'corrupt before save') editor.scopeBase = new RoomStore(storage).floorRevision('projects');
    const before = base.getItem(HYBRID_KEY), draft = copy(editor.history.current);
    assert.equal(editor.saveFloor(), false);
    assert.equal(base.getItem(HYBRID_KEY), before);
    assert.deepEqual(editor.history.current, draft);
    assert.equal(editor.history.dirty, true);
    const message = editor.root.querySelector('.hy-floor-state').textContent;
    if (mode === 'denied read' || mode === 'corrupt before save') assert.match(message, /ข้อมูล.*อ่านไม่ได้/);
    else if (mode === 'stale revision') assert.match(message, /เปลี่ยนจากที่อื่น/);
    else assert.match(message, /บันทึกชั้นไม่สำเร็จ/);
    const exported = await captureWindowDownload(dom.window, () => editor.root.querySelector('.hy-download-floor').click());
    assert.equal(exported.floor, 'projects');
    assert.equal(exported.room.name, 'Hybrid draft');
    assert.deepEqual(parseFloorJSON(JSON.stringify(exported)).room, draft);
    if (mode !== 'corrupt before save') assert.ok(new RoomStore(base).nativeSaved('customer'));
  });

  test(`Native floor save: ${mode} retains its draft and exports it`, async t => {
    const base = memoryStorage(), seed = new RoomStore(base);
    assert.equal(seed.apply('preview:lobby', {...starterRoom(), name: 'Good lobby'}), true);
    assert.equal(seed.applyNative('projects', defaultNativeRoom()), true);
    const storage = faultStorage(base, HYBRID_KEY), dom = domFixture(t);
    const editor = new NativeStudio(dom.window.document.querySelector('main'), {storage, initialFloor: 'projects', loadOffice: async () => ({Office: FixtureOffice})});
    await editor.ready;
    t.after(() => editor.dispose());
    editor.move('desk-0', {x: 2});
    assert.equal(editor.history.dirty, true);
    if (mode === 'quota') storage.writeError = quota();
    if (mode === 'rejected write') storage.writeError = Error('write rejected after serialization');
    if (mode === 'denied read') storage.readError = denied();
    if (mode === 'stale revision') assert.equal(new RoomStore(base).apply('preview:projects', starterRoom()), true);
    if (mode === 'corrupt before save') base.setItem(HYBRID_KEY, '{broken');
    if (mode === 'denied read' || mode === 'corrupt before save') editor.base = new RoomStore(storage).floorRevision('projects');
    const before = base.getItem(HYBRID_KEY), draft = copy(editor.history.current);
    assert.equal(editor.save(), false);
    assert.equal(base.getItem(HYBRID_KEY), before);
    assert.deepEqual(editor.history.current, draft);
    assert.equal(editor.history.dirty, true);
    const message = editor.root.querySelector('.ns-status').textContent;
    if (mode === 'denied read' || mode === 'corrupt before save') assert.match(message, /ข้อมูล 3D.*อ่านไม่ได้/);
    else if (mode === 'stale revision') assert.match(message, /เปลี่ยนจากที่อื่น/);
    else assert.match(message, /บันทึกไม่ได้/);
    const exported = await captureWindowDownload(dom.window, () => editor.root.querySelector('.ns-export').click());
    assert.equal(exported.floor, 'projects');
    assert.equal(exported.edition, 'native3d');
    assert.deepEqual(parseFloorJSON(JSON.stringify(exported)).room, draft);
    if (mode !== 'corrupt before save') assert.equal(new RoomStore(base).floor('lobby').name, 'Good lobby');
  });

  test(`Tycoon floor save: ${mode} retains its draft and exports it`, async t => {
    const base = memoryStorage(), storage = faultStorage(base, TYCOON_KEY), store = new TycoonStore(storage, {locks});
    assert.equal((await store.save('projects', createTycoonRoom('projects'))).ok, true);
    assert.equal((await store.save('lobby', createTycoonRoom('lobby'))).ok, true);
    const dom = domFixture(t), previousDocument = globalThis.document;
    globalThis.document = dom.window.document;
    t.after(() => { globalThis.document = previousDocument; });
    const editor = new TycoonStudio(dom.window.document.querySelector('main'), {floor: 'projects', store, Scene: class { setScene() {} dispose() {} }});
    t.after(() => editor.dispose());
    assert.equal(editor.change(room => { room.objects[0].x += 0.5; }), true);
    if (mode === 'quota') storage.writeError = quota();
    if (mode === 'rejected write') storage.writeError = Error('write rejected after serialization');
    if (mode === 'denied read') storage.readError = denied();
    if (mode === 'stale revision') assert.equal((await new TycoonStore(base, {locks}).save('projects', createTycoonRoom('projects'), 1)).ok, true);
    if (mode === 'corrupt before save') base.setItem(TYCOON_KEY, '{broken');
    const before = base.getItem(TYCOON_KEY), draft = copy(editor.room);
    const result = await editor.save();
    assert.equal(result.ok, false);
    assert.equal(base.getItem(TYCOON_KEY), before);
    assert.deepEqual(editor.room, draft);
    assert.equal(editor.dirty, true);
    const message = editor.root.querySelector('.tycoon-editor-feedback').textContent;
    if (mode === 'denied read' || mode === 'corrupt before save') {
      assert.equal(result.reason, 'storage');
      assert.match(message, /ข้อมูลชั้นที่บันทึกไว้อ่านไม่ได้/);
      assert.equal(editor.store.lastWriteError.kind, 'envelope');
    } else if (mode === 'stale revision') {
      assert.equal(result.reason, 'conflict');
      assert.match(message, /ฉบับใหม่จากอีกหน้าต่าง/);
    } else assert.match(message, /บันทึกไม่ได้/);
    const exported = await captureTycoonDownload(dom, editor);
    assert.equal(exported.floor, 'projects');
    assert.deepEqual(parseTycoonFloorJSON(JSON.stringify(exported)).room, draft);
    if (mode !== 'corrupt before save') assert.ok(new TycoonStore(base, {locks}).get('lobby'));
  });
}

test('each edition warns when corrupt storage is present on initial load', async t => {
  const storage = memoryStorage();storage.setItem(HYBRID_KEY, '{broken');storage.setItem(TYCOON_KEY, '{broken');
  const dom = domFixture(t), doc = dom.window.document, previousDocument = globalThis.document;globalThis.document = doc;
  t.after(() => { globalThis.document = previousDocument; });
  const hybridRoot = doc.createElement('main'), nativeRoot = doc.createElement('main'), tycoonRoot = doc.createElement('main');
  doc.body.append(hybridRoot, nativeRoot, tycoonRoot);
  const hybrid = new HybridStudio(hybridRoot, {storage, initialFloor: 'projects'});
  const native = new NativeStudio(nativeRoot, {storage, initialFloor: 'projects', loadOffice: async () => ({Office: FixtureOffice})});
  const tycoon = new TycoonStudio(tycoonRoot, {floor: 'projects', store: new TycoonStore(storage, {locks}), Scene: class { setScene() {} dispose() {} }});
  t.after(() => { hybrid.dispose();native.dispose();tycoon.dispose(); });
  await native.ready;
  for (const node of [hybridRoot.querySelector('.hy-floor-state'), nativeRoot.querySelector('.ns-status'), tycoonRoot.querySelector('.tycoon-editor-feedback')]) {
    assert.match(node.textContent, /อ่าน.*ไม่ได้|เสียหาย/);
  }
  assert.equal(storage.getItem(HYBRID_KEY), '{broken');
  assert.equal(storage.getItem(TYCOON_KEY), '{broken');
});

test('Hybrid library recovery exports the raw envelope and requires explicit confirmation', async t => {
  const storage = memoryStorage(), raw = '{broken';storage.setItem(HYBRID_KEY, raw);
  const dom = domFixture(t), editor = new HybridStudio(dom.window.document.querySelector('main'), {storage, initialFloor: 'projects'});
  t.after(() => editor.dispose());editor.change({name: 'Unsaved room'});
  assert.equal(editor.save(), false);
  assert.match(editor.root.querySelector('.hy-feedback').textContent, /ข้อมูลที่บันทึกไว้อ่านไม่ได้/);
  assert.equal(editor.root.querySelector('[data-storage-remove]').disabled, true, 'discard stays disabled until a backup is exported');
  const backup = await captureWindowDownloadText(dom.window, () => editor.root.querySelector('[data-storage-backup]').click());
  assert.equal(backup, raw);
  editor.root.querySelector('[data-storage-remove]').click();
  assert.equal(editor.root.querySelector('.office-storage-recovery-dialog').open, true, 'removal requires a second confirmation');
  editor.root.querySelector('[data-storage-cancel]').click();
  assert.equal(storage.getItem(HYBRID_KEY), raw, 'cancel keeps the unreadable envelope');
  editor.root.querySelector('[data-storage-remove]').click();editor.root.querySelector('[data-storage-confirm]').click();
  assert.equal(storage.getItem(HYBRID_KEY), null, 'only the unreadable envelope is discarded after confirmation');
  assert.equal(editor.history.current.name, 'Unsaved room');assert.equal(editor.history.dirty, true);
  assert.equal(editor.save(), true, 'the retained draft can be saved after recovery');
});

test('Hybrid library recovery removes only the corrupt design after exporting raw storage', async t => {
  const storage = memoryStorage(), badDesign = '{ "id" : "damaged-design", "room" : {"schemaVersion":"office-room/v1","name":"bad","background":"garden","brief":"","objects":"broken"} }',
    goodFloor = '{ "schemaVersion" : "office-room/v1", "name" : "Good lobby", "background" : "garden", "brief" : "", "objects" : [] }',
    raw = `{ "version" : 1, "designs" : [${badDesign}], "floors" : { "preview:lobby" : ${goodFloor} }, "nativeFloors" : {}, "editions" : {} }`;
  storage.setItem(HYBRID_KEY, raw);
  const dom = domFixture(t), editor = new HybridStudio(dom.window.document.querySelector('main'), {storage, initialFloor: 'projects'});
  t.after(() => editor.dispose());editor.change({name: 'Draft beside broken library item'});editor.designId='damaged-design';
  assert.equal(editor.save(), false);
  assert.match(editor.root.querySelector('.hy-feedback').textContent, /ข้อมูลที่บันทึกไว้อ่านไม่ได้/);
  assert.equal(await captureWindowDownloadText(dom.window, () => editor.root.querySelector('[data-storage-backup]').click()), raw);
  editor.root.querySelector('[data-storage-remove]').click();editor.root.querySelector('[data-storage-confirm]').click();
  const after=storage.getItem(HYBRID_KEY);
  assert.ok(after.includes(goodFloor), 'the valid floor stays byte-for-byte');
  assert.equal(JSON.parse(after).designs.length, 0, 'only the unreadable design is removed');
  assert.equal(editor.history.current.name, 'Draft beside broken library item');assert.equal(editor.history.dirty, true);
});

test('Native recovery removes only its unreadable floor and preserves other raw records', async t => {
  const storage = memoryStorage(), goodLobby = '{ "schemaVersion" : "office-room/v1", "name" : "Good lobby", "background" : "garden", "brief" : "", "objects" : [] }',
    badNative = '{ "schemaVersion" : "office-3d/v1", "objects" : "broken" }',
    raw = `{ "version" : 1, "designs" : [], "floors" : { "preview:lobby" : ${goodLobby} }, "nativeFloors" : { "preview:projects" : ${badNative} }, "editions" : { "preview:projects" : "native3d" } }`;
  storage.setItem(HYBRID_KEY, raw);
  const dom = domFixture(t), editor = new NativeStudio(dom.window.document.querySelector('main'), {storage, initialFloor: 'projects', loadOffice: async () => ({Office: FixtureOffice})});
  await editor.ready;t.after(() => editor.dispose());editor.move('desk-0', {x: 2});
  assert.equal(editor.save(), false);
  assert.match(editor.root.querySelector('.ns-status').textContent, /ข้อมูล 3D.*อ่านไม่ได้/);
  const backup = await captureWindowDownloadText(dom.window, () => editor.root.querySelector('[data-storage-backup]').click());
  assert.equal(backup, raw);
  editor.root.querySelector('[data-storage-remove]').click();editor.root.querySelector('[data-storage-confirm]').click();
  const after = storage.getItem(HYBRID_KEY);
  assert.ok(after.includes(goodLobby), 'the readable Lobby record stays byte-for-byte');
  assert.equal(Object.hasOwn(JSON.parse(after).nativeFloors, 'preview:projects'), false);
  assert.equal(editor.history.dirty, true);
  assert.equal(editor.save(), true, 'the retained Native draft can be saved after recovery');
});

test('Tycoon keeps its unreadable load warning through edits and recovers one floor after backup', async t => {
  const storage = memoryStorage(), goodLobby = `{ "revision" : 1, "edition" : "tycoon3d", "room" : ${JSON.stringify(createTycoonRoom('lobby'))} }`,
    badProject = '{ "revision" : 1, "edition" : "tycoon3d", "room" : {"schemaVersion":"office-tycoon/v1"} }',
    raw = `{ "version" : 1, "floors" : { "lobby" : ${goodLobby}, "projects" : ${badProject} } }`;
  storage.setItem(TYCOON_KEY, raw);
  const dom = domFixture(t), previousDocument = globalThis.document;globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previousDocument; });
  const editor = new TycoonStudio(dom.window.document.querySelector('main'), {floor: 'projects', storage, Scene: class { setScene() {} dispose() {} }});
  t.after(() => editor.dispose());
  assert.match(editor.root.querySelector('.tycoon-editor-feedback').textContent, /ข้อมูลชั้นที่บันทึกไว้อ่านไม่ได้/);
  editor.change(room => { room.objects[0].x += 0.5; });
  assert.match(editor.root.querySelector('.tycoon-editor-feedback').textContent, /ข้อมูลชั้นที่บันทึกไว้อ่านไม่ได้/, 'the first edit does not hide the load warning');
  const draft = copy(editor.room), result = await editor.save();
  assert.equal(result.reason, 'storage');assert.equal(editor.dirty, true);
  assert.match(editor.root.querySelector('.tycoon-editor-feedback').textContent, /ข้อมูลชั้นที่บันทึกไว้อ่านไม่ได้/);
  const backup = await captureWindowDownloadText(dom.window, () => editor.root.querySelector('[data-storage-backup]').click());
  assert.equal(backup, raw);
  editor.root.querySelector('[data-storage-remove]').click();await editor.storageRecovery.confirmRemoval();
  const after = storage.getItem(TYCOON_KEY);
  assert.ok(after.includes(goodLobby), 'the other readable floor stays byte-for-byte');
  assert.equal(Object.hasOwn(JSON.parse(after).floors, 'projects'), false);
  assert.deepEqual(editor.room, draft);assert.equal(editor.dirty, true);
  assert.equal((await editor.save()).ok, true, 'the retained Tycoon draft can be saved after recovery');
});

for (const action of ['apply', 'restore']) {
  test(`Hybrid assignment dialog refuses a stale ${action} without overwriting the other tab`, async t => {
    const storage = memoryStorage(), initial = new RoomStore(storage);
    assert.equal(initial.apply('preview:projects', {...starterRoom(), name: 'Initial'}), true);
    const dom = domFixture(t), editor = new HybridStudio(dom.window.document.querySelector('main'), {storage, initialFloor: 'projects'});
    t.after(() => editor.dispose());
    editor.change({name: 'Unsaved assignment'});
    editor.openFloor();
    assert.equal(new RoomStore(storage).apply('preview:projects', {...starterRoom(), name: 'Other tab'}), true);
    const before = storage.getItem(HYBRID_KEY);
    editor.root.querySelector(action === 'apply' ? '.hy-confirm-floor' : '.hy-unapply').click();
    assert.equal(storage.getItem(HYBRID_KEY), before);
    assert.equal(new RoomStore(storage).floor('projects').name, 'Other tab');
    assert.equal(editor.history.current.name, 'Unsaved assignment');
    assert.equal(editor.hasUnsavedFloor(), true);
    assert.match(editor.root.querySelector('.hy-floor-feedback').textContent, /เปลี่ยนจากที่อื่น/);
    const exported = await captureWindowDownload(dom.window, () => editor.root.querySelector('.hy-download-floor').click());
    assert.equal(exported.room.name, 'Unsaved assignment');
  });
}

test('Hybrid assignment keeps the saved library copy and unsaved floor draft if the second write fails', async t => {
  const base = memoryStorage(), original = new RoomStore(base);
  assert.equal(original.apply('preview:projects', {...starterRoom(), name: 'Previous floor'}), true);
  let writes = 0;
  const storage = {getItem: base.getItem, setItem(key, value) { if (++writes === 2) throw quota(); base.setItem(key, value); }};
  const dom = domFixture(t), editor = new HybridStudio(dom.window.document.querySelector('main'), {storage, initialFloor: 'projects'});
  t.after(() => editor.dispose());
  editor.change({name: 'Library copy'});editor.openFloor();
  editor.root.querySelector('.hy-confirm-floor').click();
  const saved = new RoomStore(base);
  assert.equal(saved.floor('projects').name, 'Previous floor');
  assert.equal(saved.data.designs.some(d => d.room.name === 'Library copy'), true);
  assert.equal(editor.history.current.name, 'Library copy');
  assert.equal(editor.hasUnsavedFloor(), true);
  assert.match(editor.root.querySelector('.hy-floor-feedback').textContent, /บันทึกชั้นไม่สำเร็จ/);
  const exported = await captureWindowDownload(dom.window, () => editor.root.querySelector('.hy-download-floor').click());
  assert.equal(exported.room.name, 'Library copy');
});

test('Hybrid cannot apply a draft after the editing floor changed before the dialog opened', async t => {
  const storage = memoryStorage(), initial = new RoomStore(storage);
  assert.equal(initial.apply('preview:projects', {...starterRoom(), name: 'Initial'}), true);
  const dom = domFixture(t), editor = new HybridStudio(dom.window.document.querySelector('main'), {storage, initialFloor: 'projects'});
  t.after(() => editor.dispose());editor.change({name: 'Unsaved draft'});
  assert.equal(new RoomStore(storage).apply('preview:projects', {...starterRoom(), name: 'Other tab'}), true);
  editor.openFloor();
  editor.root.querySelector('.hy-confirm-floor').click();
  assert.equal(new RoomStore(storage).floor('projects').name, 'Other tab');
  assert.equal(editor.history.current.name, 'Unsaved draft');assert.equal(editor.history.dirty, true);
  assert.match(editor.root.querySelector('.hy-floor-feedback').textContent, /ชั้นที่กำลังแก้ถูกเปลี่ยนจากที่อื่น/);
});

test('Hybrid library save failure retains the draft, floor and room export', async t => {
  const base = memoryStorage(), seed = new RoomStore(base);
  assert.equal(seed.apply('preview:projects', {...starterRoom(), name: 'Saved floor'}), true);
  const storage = faultStorage(base, HYBRID_KEY), dom = domFixture(t);
  const editor = new HybridStudio(dom.window.document.querySelector('main'), {storage, initialFloor: 'projects'});
  t.after(() => editor.dispose());
  editor.change({name: 'Unsaved library copy'});storage.writeError = quota();
  const before = base.getItem(HYBRID_KEY);
  assert.equal(editor.save(), false);
  assert.equal(base.getItem(HYBRID_KEY), before);
  assert.equal(editor.history.dirty, true);
  assert.equal(editor.history.current.name, 'Unsaved library copy');
  assert.match(editor.root.querySelector('.hy-feedback').textContent, /บันทึกไม่ได้/);
  const exported = await captureWindowDownload(dom.window, () => editor.root.querySelector('.hy-export').click());
  assert.equal(exported.name, 'Unsaved library copy');
});

test('edition and furniture keys are distinct and writes remain floor scoped', async () => {
  const storage = memoryStorage(), rooms = new RoomStore(storage), tycoon = new TycoonStore(storage, {locks});
  assert.equal(rooms.apply('preview:lobby', {...starterRoom(), name: 'Hybrid lobby'}), true);
  assert.equal(rooms.applyNative('projects', defaultNativeRoom()), true);
  const legacyBefore = storage.getItem(HYBRID_KEY);
  assert.equal((await tycoon.save('lobby', createTycoonRoom('lobby'))).ok, true);
  assert.equal((await tycoon.save('projects', createTycoonRoom('projects'))).ok, true);
  const lobby = copy(tycoon.get('lobby')), tycoonBefore = storage.getItem(TYCOON_KEY);
  const library = new FurnitureLibrary(storage), set = captureFurnitureSet(createTycoonRoom('projects'), ['desk-1', 'chair-1'], 'Pair', png);
  const prefabKey = library.save(set), prefabBefore = storage.getItem(prefabKey);
  assert.equal(new Set([HYBRID_KEY, TYCOON_KEY, prefabKey]).size, 3);
  assert.equal(storage.getItem(HYBRID_KEY), legacyBefore);
  assert.equal(storage.getItem(TYCOON_KEY), tycoonBefore);
  const changed = createTycoonRoom('projects');changed.objects[0].x += 0.5;
  assert.equal((await tycoon.save('projects', changed, 1)).ok, true);
  assert.deepEqual(tycoon.get('lobby'), lobby);
  assert.equal(storage.getItem(HYBRID_KEY), legacyBefore);
  assert.equal(storage.getItem(prefabKey), prefabBefore);
  const nativeBefore = copy(new RoomStore(storage).nativeSaved('projects'));
  assert.equal(new RoomStore(storage).apply('preview:lobby', {...starterRoom(), name: 'Updated lobby'}), true);
  assert.deepEqual(new RoomStore(storage).nativeSaved('projects'), nativeBefore);
  assert.deepEqual(tycoon.get('projects').room, changed);
  assert.equal(storage.getItem(prefabKey), prefabBefore);
});

test('saving another floor preserves legacy Hybrid records that are normalized for display', () => {
  const storage = memoryStorage(), legacy = starterRoom();
  legacy.background = 'office';
  legacy.objects.push({id: 'legacy-printer', kind: 'printer', x: 42, y: 72, scale: 1, flip: false, locked: false});
  const snapshot = {version: 1, designs: [{id: 'legacy-design', room: copy(legacy)}], floors: {'preview:projects': copy(legacy)}};
  storage.setItem(HYBRID_KEY, JSON.stringify(snapshot));
  const store = new RoomStore(storage);
  assert.equal(store.floor('projects').objects.some(o => o.id === 'legacy-printer'), false, 'legacy renderer normalizes the old Office printer');
  assert.equal(store.applyNative('customer', defaultNativeRoom()), true);
  const saved = JSON.parse(storage.getItem(HYBRID_KEY));
  assert.deepEqual(saved.floors['preview:projects'], legacy);
  assert.deepEqual(saved.designs[0].room, legacy);
});

test('older Hybrid v1 stores without Native fields remain writable', () => {
  const storage = memoryStorage(), lobby = starterRoom();
  storage.setItem(HYBRID_KEY, JSON.stringify({version: 1, designs: [], floors: {'preview:lobby': lobby}}));
  const store = new RoomStore(storage);
  assert.equal(store.applyNative('projects', defaultNativeRoom()), true);
  assert.deepEqual(new RoomStore(storage).floor('lobby'), lobby);
  assert.ok(new RoomStore(storage).nativeFloor('projects'));
});

test('prefab corruption leaves other cards readable and reports the damaged entry', t => {
  const storage = memoryStorage(), library = new FurnitureLibrary(storage);
  const good = captureFurnitureSet(createTycoonRoom('projects'), ['desk-1', 'chair-1'], 'Good pair', png);
  const goodKey = library.save(good), badKey = 'zuri-office:furniture-set:v1:damaged';
  storage.setItem(badKey, '{"schemaVersion":');
  const goodBytes = storage.getItem(goodKey), badBytes = storage.getItem(badKey);
  const dom = domFixture(t), previousDocument = globalThis.document;globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previousDocument; });
  const editor = new TycoonStudio(dom.window.document.querySelector('main'), {storage, Scene: class { setScene() {} dispose() {} }});
  t.after(() => editor.dispose());
  assert.match(editor.prefabs.q('[data-prefab-cards]').textContent, /Good pair/);
  assert.match(editor.prefabs.q('[data-prefab-status]').textContent, /อ่าน.*ไม่ได้|เสียหาย/);
  assert.equal(storage.getItem(goodKey), goodBytes);
  assert.equal(storage.getItem(badKey), badBytes);
});

for (const mode of ['quota', 'rejected write', 'denied access']) {
  test(`prefab ${mode} reports failure without damaging the floor or existing set`, async t => {
    const base = memoryStorage(), good = captureFurnitureSet(createTycoonRoom('projects'), ['desk-1', 'chair-1'], 'Good pair', png);
    const goodKey = new FurnitureLibrary(base).save(good), before = base.getItem(goodKey);
    let failing = false;
    const storage = {
      get length() { if (failing && mode === 'denied access') throw denied(); return base.length; },
      key: base.key, getItem: base.getItem,
      setItem(key, value) { if (failing && key.startsWith('zuri-office:furniture-set:')) throw mode === 'quota' ? quota() : Error('write rejected'); base.setItem(key, value); },
    };
    const dom = domFixture(t), previousDocument = globalThis.document;globalThis.document = dom.window.document;
    t.after(() => { globalThis.document = previousDocument; });
    const editor = new TycoonStudio(dom.window.document.querySelector('main'), {floor: 'projects', storage, Scene: class { setScene() {} dispose() {} async furnitureThumbnail() { return png; } }});
    t.after(() => editor.dispose());
    editor.change(room => { room.objects[0].x += 0.5; });
    editor.selectIds(['desk-1', 'chair-1']);
    editor.prefabs.q('[data-prefab-name]').value = 'Unsaved pair';
    const draft = copy(editor.room);failing = true;
    assert.equal(await editor.prefabs.save(), false);
    assert.equal(editor.dirty, true);
    assert.deepEqual(editor.room, draft);
    assert.equal(base.getItem(goodKey), before);
    assert.match(editor.prefabs.q('[data-prefab-status]').textContent, /ไม่ได้|denied|rejected/i);
    assert.equal(editor.q('[data-export]').disabled, false);
    const exported = await captureTycoonDownload(dom, editor);
    assert.deepEqual(parseTycoonFloorJSON(JSON.stringify(exported)).room, draft);
    const savedExport = [...editor.prefabs.root.querySelectorAll('button')].find(button => button.textContent === 'ส่งออกชุด Good pair');
    assert.ok(savedExport, 'the previously saved set remains exportable');
    if (mode === 'quota') {
      const catalog = JSON.parse(await readFile('web/assets/models/tycoon/manifest.json', 'utf8'));
      const previousFetch = globalThis.fetch;let blob;
      globalThis.fetch = async url => {
        if (url === './assets/models/tycoon/manifest.json') return {ok: true, json: async () => catalog};
        const match = /^\.\/assets\/models\/tycoon\/([a-z-]+\.glb)$/.exec(url);
        assert.ok(match, 'fixture forbids nonlocal requests');
        const bytes = await readFile(`web/assets/models/tycoon/${match[1]}`);
        return {ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)};
      };
      dom.window.URL.createObjectURL = value => { blob = value;return 'blob:test'; };
      dom.window.URL.revokeObjectURL = () => {};
      dom.window.HTMLAnchorElement.prototype.click = function () {};
      try {
        assert.equal(await savedExport.onclick(), true);
        const text = await new Promise((resolve, reject) => {const reader = new dom.window.FileReader();reader.onload = () => resolve(reader.result);reader.onerror = () => reject(reader.error);reader.readAsText(blob);});
        assert.deepEqual(await importFurnitureBundle(text, {catalog}), good);
      } finally { globalThis.fetch = previousFetch; }
    }
  });
}

test('custom model transaction abort retains committed bytes and rejects every pending item', async () => {
  const fake = fakeIndexedDB(), store = new CustomModelStore(fake);
  const items = await Promise.all(['chair', 'desk', 'plant'].map(async name => {
    const bytes = new Uint8Array(await readFile(`web/assets/models/tycoon/${name}.glb`));
    return {id: await customHash(bytes), bytes};
  }));
  await store.putMany([items[0]]);
  assert.equal(fake.state.lastDatabase, 'zuri-office-custom-models');
  fake.state.abortWrites = true;
  await assert.rejects(store.putMany(items.slice(1)), /บันทึก GLB ไม่ได้/);
  assert.deepEqual(await store.get(items[0].id), items[0].bytes);
  await assert.rejects(store.get(items[1].id), /ไม่พบ GLB/);
  await assert.rejects(store.get(items[2].id), /ไม่พบ GLB/);
  fake.state.failOpen = true;
  await assert.rejects(store.putMany([items[1]]), /เปิดคลังโมเดลไม่ได้/);
  await assert.rejects(store.get(items[0].id), /เปิดคลังโมเดลไม่ได้/);
  fake.state.failOpen = false;
  assert.deepEqual(await store.get(items[0].id), items[0].bytes);
  await assert.rejects(new CustomModelStore(null).putMany([items[1]]), /IndexedDB ไม่พร้อม/);
});

test('a corrupt custom GLB is rejected on scene load without damaging another model', async t => {
  const fake = fakeIndexedDB(), prior = customModels.indexedDB;customModels.indexedDB = fake;
  t.after(() => { customModels.indexedDB = prior; });
  const bytes = new Uint8Array(await readFile('web/assets/models/tycoon/chair.glb')), id = await customHash(bytes);
  await customModels.putMany([{id, bytes}]);
  fake.values.set('bad-model', {id: 'bad-model', bytes: new Uint8Array([1, 2, 3]).buffer});
  const scene = {cache: new Map()};
  await assert.rejects(TycoonScene.prototype.loadAsset.call(scene, 'custom', {id: 'bad-model'}));
  assert.equal(scene.cache.size, 0);
  assert.deepEqual(await customModels.get(id), bytes);
});

for (const mode of ['transaction abort', 'storage unavailable', 'card write rejected']) {
  test(`custom asset ${mode} leaves the selected source and floor draft intact`, async t => {
    const fake = fakeIndexedDB(), previousDB = customModels.indexedDB;customModels.indexedDB = fake;
    t.after(() => { customModels.indexedDB = previousDB; });
    const existing = new Uint8Array(await readFile('web/assets/models/tycoon/desk.glb')), existingId = await customHash(existing);
    await customModels.putMany([{id: existingId, bytes: existing}]);
    const base = memoryStorage();let rejectCard = false;
    const storage = {
      get length() { return base.length; }, key: base.key, getItem: base.getItem,
      setItem(key, value) { if (rejectCard && key.startsWith('zuri-office:furniture-set:')) throw quota();base.setItem(key, value); },
    };
    const dom = domFixture(t), previousDocument = globalThis.document;globalThis.document = dom.window.document;
    t.after(() => { globalThis.document = previousDocument; });
    const editor = new TycoonStudio(dom.window.document.querySelector('main'), {floor: 'projects', storage, Scene: class { setScene() {} dispose() {} async furnitureThumbnail() { return png; } }});
    t.after(() => editor.dispose());
    editor.change(room => { room.objects[0].x += 0.5; });
    const draft = copy(editor.room), panel = editor.prefabs.custom;
    const bytes = new Uint8Array(await readFile('web/assets/models/tycoon/chair.glb'));
    assert.equal(await panel.read({name: 'chair.glb', size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)}), true);
    const pendingId = panel.info.id;
    if (mode === 'transaction abort') fake.state.abortWrites = true;
    if (mode === 'storage unavailable') fake.state.failOpen = true;
    if (mode === 'card write rejected') rejectCard = true;
    assert.equal(await panel.save(), false);
    assert.match(panel.q('[data-custom-status]').textContent, /ไม่ได้|เต็ม/);
    assert.equal(panel.info.id, pendingId);
    assert.equal(panel.value('name'), 'chair');
    assert.deepEqual(editor.room, draft);
    assert.equal(editor.dirty, true);
    assert.equal(editor.q('[data-export]').disabled, false);
    const exported = await captureTycoonDownload(dom, editor);
    assert.deepEqual(parseTycoonFloorJSON(JSON.stringify(exported)).room, draft);
    assert.equal(editor.prefabs.store.list().length, 0);
    fake.state.failOpen = false;
    assert.deepEqual(await customModels.get(existingId), existing);
    if (mode === 'card write rejected') assert.deepEqual(await customModels.get(pendingId), bytes);
    else await assert.rejects(customModels.get(pendingId), /ไม่พบ GLB/);
  });
}

test('floor and furniture codecs reject foreign or incompatible versions before changing storage', async () => {
  const storage = memoryStorage(), room = starterRoom(), native = defaultNativeRoom(), tycoon = createTycoonRoom('projects');
  const legacyFile = floorFile('projects', room), nativeFile = floorFile('projects', native), modernFile = tycoonFloorFile('projects', tycoon);
  assert.deepEqual(parseFloorJSON(JSON.stringify(legacyFile)), legacyFile);
  assert.deepEqual(parseFloorJSON(JSON.stringify(nativeFile)), nativeFile);
  assert.deepEqual(parseTycoonFloorJSON(JSON.stringify(modernFile)), modernFile);
  for (const file of [modernFile, {...legacyFile, schemaVersion: 'office-floor/v0'}, {...nativeFile, edition: 'hybrid'}, {...legacyFile, scope: 'business'}, {...legacyFile, credential: 'secret'}]) {
    assert.throws(() => parseFloorJSON(JSON.stringify(file)));
  }
  for (const file of [legacyFile, nativeFile, {...modernFile, schemaVersion: 'office-floor/v1'}, {...modernFile, scope: 'business'}, {...modernFile, token: 'secret'}]) {
    assert.throws(() => parseTycoonFloorJSON(JSON.stringify(file)));
  }
  const models = {putMany: async () => assert.fail('invalid bundle must not write models')};
  for (const file of [legacyFile, modernFile, {schemaVersion: 'office-furniture-bundle/v0'}, {schemaVersion: 'office-furniture-bundle/v2', geometryContract: 'office-tycoon-metric/v0', set: {}, models: []}]) {
    await assert.rejects(importFurnitureBundle(JSON.stringify(file), {models}));
  }
  assert.equal(storage.length, 0);
});

test('portable furniture v1 and custom v2 round trip while incompatible bundles cause no writes', async t => {
  const catalog = JSON.parse(await readFile('web/assets/models/tycoon/manifest.json', 'utf8'));
  const load = async kind => new Uint8Array(await readFile(`web/assets/models/tycoon/${kind}.glb`));
  const v1Set = captureFurnitureSet(createTycoonRoom('projects'), ['desk-1', 'chair-1'], 'Legacy pair', png);
  const v1 = await exportFurnitureBundle(v1Set, {catalog, load});
  assert.equal(JSON.parse(v1).schemaVersion, 'office-furniture-bundle/v1');
  assert.deepEqual(await importFurnitureBundle(v1, {catalog}), v1Set);
  const incompatible = JSON.parse(v1);incompatible.kit.revision = 'unsupported-kit';
  await assert.rejects(importFurnitureBundle(JSON.stringify(incompatible), {catalog}));

  const bytes = await load('chair'), info = await inspectCustomGLB(bytes);
  t.after(() => disposeCustomModel(info.model));
  const asset = describeCustomAsset(info, {name: 'Custom chair', category: 'chair', height: 1});
  const room = {schemaVersion: 'office-tycoon/v1', width: 12, depth: 8, objects: [{id: 'custom-model', kind: 'custom', asset, x: 0, y: 0, z: 0, rotation: 0, scale: 1, intent: 'decor'}]};
  const v2Set = captureFurnitureSet(room, ['custom-model'], 'Custom', png), models = new Map([[asset.id, bytes]]);
  let writes = 0;
  const adapter = {get: async id => models.get(id), putMany: async items => { writes++;for (const item of items) models.set(item.id, item.bytes); }};
  const v2 = await exportFurnitureBundle(v2Set, {models: adapter});
  assert.equal(JSON.parse(v2).schemaVersion, 'office-furniture-bundle/v2');
  assert.deepEqual(await importFurnitureBundle(v2, {models: adapter}), v2Set);
  assert.equal(writes, 1);
  for (const mutate of [v => { v.schemaVersion = 'office-furniture-bundle/v1'; }, v => { v.set.schemaVersion = 'office-furniture-set/v1'; }, v => { v.geometryContract = 'office-tycoon-metric/v0'; }]) {
    const invalid = JSON.parse(v2);mutate(invalid);
    await assert.rejects(importFurnitureBundle(JSON.stringify(invalid), {models: adapter, catalog}));
  }
  assert.equal(writes, 1, 'incompatible files do not add custom models');
});

test('Hybrid conditional save prevents a writer racing between its read and setItem',
  {todo: 'RoomStore has no cross-tab lock or atomic compare-and-swap; a safe fix needs a shared locking contract for every writer'}, t => {
    const base = memoryStorage(), seed = new RoomStore(base);
    assert.equal(seed.apply('preview:projects', {...starterRoom(), name: 'Initial'}), true);
    let inject = false;
    const storage = {
      getItem: base.getItem,
      setItem(key, value) {
        if (inject) { inject = false;new RoomStore(base).apply('preview:projects', {...starterRoom(), name: 'Concurrent writer'}); }
        base.setItem(key, value);
      },
    };
    const dom = domFixture(t), editor = new HybridStudio(dom.window.document.querySelector('main'), {storage, initialFloor: 'projects'});
    t.after(() => editor.dispose());
    editor.change({name: 'Local draft'});inject = true;
    assert.equal(editor.saveFloor(), false);
    assert.equal(new RoomStore(base).floor('projects').name, 'Concurrent writer');
    assert.equal(editor.history.dirty, true);
  });

test('a failed custom asset save exposes a portable export of its unsaved model and descriptor',
  {todo: 'The custom import panel has no export path until a library card has been saved'}, async t => {
    const fake = fakeIndexedDB(), previousDB = customModels.indexedDB;customModels.indexedDB = fake;
    t.after(() => { customModels.indexedDB = previousDB; });
    const dom = domFixture(t), previousDocument = globalThis.document;globalThis.document = dom.window.document;
    t.after(() => { globalThis.document = previousDocument; });
    const editor = new TycoonStudio(dom.window.document.querySelector('main'), {floor: 'projects', storage: memoryStorage(), Scene: class { setScene() {} dispose() {} async furnitureThumbnail() { return png; } }});
    t.after(() => editor.dispose());
    const panel = editor.prefabs.custom, bytes = new Uint8Array(await readFile('web/assets/models/tycoon/chair.glb'));
    assert.equal(await panel.read({name: 'chair.glb', size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)}), true);
    fake.state.abortWrites = true;assert.equal(await panel.save(), false);
    assert.ok([...panel.root.querySelectorAll('button,a')].some(control => /ส่งออก|export/i.test(control.textContent)), 'pending model and descriptor need their own portable export');
  });
test.todo('A failed custom-asset card write can leave an unreferenced IndexedDB model; safe cross-store rollback needs reference and concurrency rules');
