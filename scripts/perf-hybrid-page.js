// Served only by the loopback performance runner. This creates no saved floor.
import {HybridScene} from '/hybrid-scene.js';
import {HybridOffice3D} from '/hybrid-office-3d.js';
import {departmentStarterRoom, parseRoomJSON} from '/hybrid-state.js';
import {domainFloors} from '/domain-office.js';
import {CharacterLibrary} from '/characters/runtime.js';
import {characterAsset} from '/characters/runtime-catalog.js';
import {hybridPerformanceFixture} from '/__perf__/fixture.mjs';
import {observeInitialHybridDraw,observeCharacterLoads} from '/__perf__/observer.mjs';

const now = () => performance.now();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function originalAsset(library, id) {
  // A/B control only: use the same LOD manifest's pinned source bytes/hash and
  // the same runtime parser, skeleton cloning, mixer and scene as production.
  const lod = characterAsset(id, 'hybrid'), original = characterAsset(id, 'lab');
  const manifest = await library.json(lod.manifest);
  const meta = manifest.assets?.find(entry => entry.id === id);
  if (!meta || meta.source !== `web/${original.path.replace(/^\.\//, '')}` ||
      !Number.isSafeInteger(meta.before?.bytes) || meta.before.bytes <= 0 ||
      !/^[a-f0-9]{64}$/.test(meta.before?.sha256 || '')) throw Error(`Invalid original metadata: ${id}`);
  const response = await library.fetcher(original.path);
  if (!response.ok) throw Error(`Original unavailable: ${id}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== meta.before.bytes) throw Error(`Original size mismatch: ${id}`);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== meta.before.sha256) throw Error(`Original hash mismatch: ${id}`);
  return library.parse(bytes);
}

window.runHybridPerformance = async ({variant, count, durationMs, warmupMs}) => {
  if (!['lod1','original'].includes(variant) || ![4,12].includes(count)) throw Error('Invalid measurement variant');
  const root = document.querySelector('#profile-root'), room = hybridPerformanceFixture(count, {domainFloors,departmentStarterRoom,parseRoomJSON}), begin = now();
  const observer = observeInitialHybridDraw(HybridOffice3D.prototype, count, () => now() - begin);
  const loadObserver = observeCharacterLoads(CharacterLibrary.prototype, variant, () => now() - begin, originalAsset);
  const assetMetrics = loadObserver.entries;
  let scene, layer;
  try {
    scene = new HybridScene(root, {getFloor:() => ({key:'customer',label:'Local benchmark'})});
    scene.render(room, null, true);
    layer = scene.modelLayer;
    if (!layer || root.dataset.renderer !== '3d') throw Error('Hybrid 3D renderer unavailable');
    const actors = [...layer.models.values()].map(model => model.userData.runtimeCharacter).filter(Boolean);
    if (actors.length !== count) throw Error(`Expected ${count} actors, got ${actors.length}`);
    let timeout;
    try {
      await Promise.race([
        Promise.all(actors.map(actor => actor.ready)),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(Error('Character load timed out')), 180_000); }),
      ]);
    } finally { clearTimeout(timeout); }
    const readyMs = now() - begin;
    if (actors.some(actor => actor.status !== 'ready')) throw Error(`Character fallback: ${actors.map(a => `${a.id}:${a.status}:${a.error || ''}`).join(', ')}`);
    const {firstCharacterDraw, firstAllReadyDraw} = observer.result();
    if (!firstAllReadyDraw) throw Error('No draw observed with all characters ready');
    loadObserver.restore();
    observer.restore();
    const gl = layer.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    await pause(warmupMs);
    const renderer = layer.renderer, realRender = renderer.render.bind(renderer);
    const drawEntries = [], drawWork = [], callbackIntervals = [], renderIntervals = [];
    let maxCalls = 0, maxTriangles = 0, previousDraw = null, previousCallback = null, previousRenderedCallback = null;
    let lastRender = renderer.info.render.frame, beginSamples = now();
    renderer.render = (...args) => {
      const start = now();
      try { return realRender(...args); }
      finally {
        const end = now();
        if (previousDraw !== null) drawEntries.push(start - previousDraw);
        previousDraw = start;
        drawWork.push(end - start);
        maxCalls = Math.max(maxCalls, renderer.info.render.calls);
        maxTriangles = Math.max(maxTriangles, renderer.info.render.triangles);
      }
    };
    await new Promise((resolve, reject) => {
      let frame, timer;
      function sample(timestamp) {
        if (previousCallback !== null) callbackIntervals.push(timestamp - previousCallback);
        previousCallback = timestamp;
        const renderedFrame = renderer.info.render.frame;
        if (renderedFrame !== lastRender) {
          if (previousRenderedCallback !== null) renderIntervals.push(timestamp - previousRenderedCallback);
          previousRenderedCallback = timestamp;
          lastRender = renderedFrame;
        }
        if (now() - beginSamples >= durationMs) { clearTimeout(timer); resolve(); }
        else frame = requestAnimationFrame(sample);
      }
      frame = requestAnimationFrame(sample);
      timer = setTimeout(() => { cancelAnimationFrame(frame); reject(Error('Animation frame sampling timed out')); }, Math.max(30000, durationMs * 2 + 10000));
    });
    renderer.render = realRender;
    const rect = root.getBoundingClientRect();
    const result = {
      variant, count, room:{objects:room.objects.length, kind:count === 4 ? 'current-customer-starter' : 'synthetic-12-role-starter', appearances:room.objects.filter(o => o.appearance).map(o => o.appearance)},
      activity:'HybridScene automatic animation, unsourced states; not a forced walking/seat lifecycle',
      load:{readyMs, firstCharacterDraw, firstAllReadyDraw, assets:assetMetrics},
      gpu:{renderer:gpu,vendor,canvasWidth:renderer.domElement.width,canvasHeight:renderer.domElement.height,maxCalls,maxTriangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures},
      viewport:{width:innerWidth,height:innerHeight,devicePixelRatio,sceneWidth:rect.width,sceneHeight:rect.height},
      jsHeapBytesBeforeDisposal:performance.memory?.usedJSHeapSize ?? null,
      elapsedMs:now() - beginSamples,callbackIntervals,renderIntervals,drawEntries,drawWork,
    };
    if (assetMetrics.length !== 4 || assetMetrics.some(asset => asset.parseMs === null || asset.fetches.filter(fetch => fetch.bytes > 0).length !== 1)) throw Error('Character load instrumentation incomplete');
    if (renderIntervals.length < 10 || drawEntries.length < 10) throw Error('Insufficient rendered frames');
    return result;
  } finally {
    loadObserver.restore();
    observer.restore();
    scene?.dispose();
  }
};
