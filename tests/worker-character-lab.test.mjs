import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

test('Worker permits only its exact Character Lab document beside existing blob previews',async t=>{
  const prior=globalThis.ASSETS;
  globalThis.ASSETS={'/index.html':{type:'text/html',body:btoa('<main>Studio</main>')}};
  t.after(()=>{if(prior===undefined)delete globalThis.ASSETS;else globalThis.ASSETS=prior;});
  for(const origin of ['http://127.0.0.1:4185','https://office.example']){
    const response=await worker.fetch(new Request(origin+'/'),{});
    assert.equal(response.status,200);
    const csp=response.headers.get('content-security-policy');
    const frames=csp.split(';').map(s=>s.trim()).find(s=>s.startsWith('frame-src ')).split(/\s+/).slice(1);
    assert.deepEqual(frames,['blob:',origin+'/character-lab.html']);
    assert.match(csp,/object-src 'none'/);assert.match(csp,/base-uri 'self'/);
  }
});
