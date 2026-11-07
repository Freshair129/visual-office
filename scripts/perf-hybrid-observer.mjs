// HybridOffice3D.draw is the actual scene boundary; Three's WebGLRenderer.render
// is an instance method, not a prototype method. Stop observing after load.
export function observeInitialHybridDraw(prototype, expectedCharacters, elapsed) {
  const original = prototype.draw;
  if (typeof original !== 'function' || !Number.isInteger(expectedCharacters) || expectedCharacters < 1) throw Error('Invalid initial draw observer');
  let firstCharacterDraw = null, firstAllReadyDraw = null;
  prototype.draw = function (...args) {
    const ready = [...(this.models?.values() || [])].filter(model => model.userData?.runtimeCharacter?.status === 'ready').length;
    const record = !this.disposed && !this.unavailable && ready && (!firstCharacterDraw || ready === expectedCharacters && !firstAllReadyDraw);
    const start = record ? elapsed() : 0;
    try { return original.apply(this, args); }
    finally {
      if (record) {
        const draw = {startMs:start,cpuSubmissionMs:elapsed() - start,readyCharacters:ready};
        if (!firstCharacterDraw) firstCharacterDraw = draw;
        if (ready === expectedCharacters && !firstAllReadyDraw) firstAllReadyDraw = draw;
      }
    }
  };
  return {result:() => ({firstCharacterDraw,firstAllReadyDraw}),restore:() => { prototype.draw = original; }};
}

// Wrap the real loader on a per-call proxy so concurrent source loads keep their
// own timings while sharing the production library's cache and manifest state.
export function observeCharacterLoads(prototype, variant, elapsed, loadOriginal) {
  const original = prototype.loadAsset, entries = [];
  if (typeof original !== 'function' || !['lod1','original'].includes(variant) || typeof loadOriginal !== 'function') throw Error('Invalid character load observer');
  prototype.loadAsset = async function (id) {
    const entry = {id,startMs:elapsed(),fetches:[],parseMs:null,sourceReadyMs:null};
    entries.push(entry);
    const proxy = Object.create(this);
    proxy.fetcher = async url => {
      const fetch = {url:String(url),startMs:elapsed()};
      entry.fetches.push(fetch);
      const response = await this.fetcher(url);
      fetch.headersMs = elapsed();
      if (/\.glb(?:$|\?)/.test(String(url))) {
        const arrayBuffer = response.arrayBuffer.bind(response);
        response.arrayBuffer = async () => {
          const bytes = await arrayBuffer();
          fetch.bodyMs = elapsed();
          fetch.bytes = bytes.byteLength;
          return bytes;
        };
      }
      return response;
    };
    proxy.parse = async bytes => {
      const start = elapsed();
      try { return await this.parse(bytes); }
      finally { entry.parseMs = elapsed() - start; }
    };
    try { return await (variant === 'lod1' ? original.call(proxy,id) : loadOriginal(proxy,id)); }
    finally { entry.sourceReadyMs = elapsed(); }
  };
  return {entries,restore:() => { prototype.loadAsset = original; }};
}
