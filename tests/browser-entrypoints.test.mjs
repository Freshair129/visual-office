import test from 'node:test';
import assert from 'node:assert/strict';
import {browserModuleEntries} from '../scripts/browser-entrypoints.mjs';

test('nested documents resolve the first local base exactly like browser URLs',()=>{
 assert.deepEqual(browserModuleEntries([
  {path:'web/tools/marketing-preview.html',html:'<base href="/"><script type="module" src="tools/marketing-preview.js"></script>'},
  {path:'web/tools/baker.html',html:'<script type="module" src="./office-prop-baker.js"></script>'},
  {path:'web/reviews/a.html',html:'<base href="../tools/"><base href="/ignored/"><script type="module" src="./office-prop-baker.js"></script>'},
  {path:'web/reviews/b.html',html:'<base href="https://remote.invalid/"><script type="module" src="remote.js"></script>'}
 ]),['web/tools/marketing-preview.js','web/tools/office-prop-baker.js']);
});

test('reachability includes module scripts from the app and standalone Character Lab',()=>{
 assert.deepEqual(browserModuleEntries([
  {path:'web/index.html',html:'<script type="module" src="./app.js"></script>'},
  {path:'web/character-lab.html',html:'<script type="module" src="./character-lab.js?v=1#start"></script><script type="module" src="./character-lab.js"></script>'}
 ]),['web/app.js','web/character-lab.js']);
});

test('HTML module discovery ignores examples, inline scripts, external URLs and escaping paths',()=>{
 assert.deepEqual(browserModuleEntries([{path:'web/reviews/lab.html',html:`
 <!-- <script type="module" src="fake.js"></script> -->
 <script src="classic.js"></script><script type="importmap">{}</script>
 <script type="module">import './inline-example.js';</script>
 <script type="module" src="https://other.example/remote.js"></script>
 <script type="module" src="//other.example/remote.js"></script>
 <script type="module" src="../../../escape.js"></script>
 <script type="module" src="../../%2e%2e/escape.js"></script>
 <script type="module" src="/character-lab.js"></script>
 <script type="module" src="../app.js"></script>`}]),['web/app.js','web/character-lab.js']);
});
