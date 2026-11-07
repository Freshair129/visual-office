import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile, stat} from 'node:fs/promises';
import {join, resolve, sep} from 'node:path';
import {officeApiUrl, OFFICE_API_BASE} from '../web/office-api-base.js';
import {
  cssResourceReferences,
  htmlResourceReferences,
  javascriptResourceReferences,
} from '../scripts/office-release-policy.mjs';
import {rewriteBareThreeImports} from '../scripts/office-browser-modules.mjs';
import {
  collectOfficeReleaseImportGraph,
  OFFICE_RELEASE_FORBIDDEN_INPUT_PATTERN,
} from '../scripts/office-release-bundle.mjs';

const webRoot = resolve('web');

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

test('web HTML entries use external scripts and styles with local references', async () => {
  const htmlFiles = (await filesUnder(webRoot)).filter(path => path.endsWith('.html'));
  assert.ok(htmlFiles.includes(join(webRoot, 'index.html')));
  assert.ok(htmlFiles.includes(join(webRoot, 'character-lab.html')));
  for (const absolutePath of htmlFiles) {
    const relativePath = absolutePath.slice(webRoot.length + 1).split(sep).join('/');
    const html = await readFile(absolutePath, 'utf8');
    const references = htmlResourceReferences(relativePath, html);
    for (const reference of references) {
      const target = resolve(webRoot, reference);
      assert.ok(target.startsWith(webRoot + sep), `${relativePath} reference escaped web/: ${reference}`);
      assert.equal((await stat(target)).isFile(), true, `${relativePath} references missing ${reference}`);
    }
  }
});

test('web HTML, CSS and modules contain no inline CSP exceptions or remote module resources', async () => {
  const sourceFiles = await filesUnder(webRoot);
  const files = new Map();
  for (const absolutePath of sourceFiles) {
    const relativePath = absolutePath.slice(webRoot.length + 1).split(sep).join('/');
    const isSource = /\.(?:html|css|js)$/.test(absolutePath);
    const source = isSource ? await readFile(absolutePath, 'utf8') : null;
    files.set(relativePath, source !== null && relativePath.endsWith('.js')
      ? rewriteBareThreeImports(source, absolutePath, webRoot)
      : source);
  }
  const pending = [...files.keys()].filter(path => path.endsWith('.html'));
  const visited = new Set();
  while (pending.length) {
    const path = pending.pop();
    if (visited.has(path)) continue;
    visited.add(path);
    const source = files.get(path);
    assert.ok(source !== undefined, `referenced web source is missing: ${path}`);
    if (source === null) continue;
    let references = [];
    if (path.endsWith('.html')) references = htmlResourceReferences(path, source);
    else if (path.endsWith('.css')) references = cssResourceReferences(path, source);
    else if (path.endsWith('.js')) references = javascriptResourceReferences(path, source);
    for (const reference of references) {
      assert.ok(files.has(reference), `${path} references missing ${reference}`);
      pending.push(reference);
    }
  }
});

test('Office API URLs retain same-origin /api defaults and reject remote routes', () => {
  assert.equal(OFFICE_API_BASE, '/api/');
  assert.equal(officeApiUrl('preferences'), '/api/preferences');
  assert.equal(officeApiUrl('/jobs/123?summary=1'), '/api/jobs/123?summary=1');
  assert.throws(() => officeApiUrl('https://example.test/api'), /same-origin/);
  assert.throws(() => officeApiUrl('//example.test/api'), /same-origin/);
  assert.throws(() => officeApiUrl('jobs#fragment'), /same-origin/);
});

test('the development server rewrites bare Three.js imports to local vendor modules', () => {
  assert.equal(
    rewriteBareThreeImports("import * as THREE from 'three';", resolve(webRoot, 'models.js'), webRoot),
    "import * as THREE from './vendor/three.module.js';",
  );
  assert.equal(
    rewriteBareThreeImports("import * as THREE from 'three';", resolve(webRoot, 'characters', 'human.js'), webRoot),
    "import * as THREE from '../vendor/three.module.js';",
  );
  assert.equal(
    rewriteBareThreeImports("import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';", resolve(webRoot, 'office-prop-models.js'), webRoot),
    "import {RoundedBoxGeometry} from './vendor/addons/geometries/RoundedBoxGeometry.js';",
  );
});

test('release policy rejects inline code, remote imports and dynamic code construction', () => {
  assert.throws(() => htmlResourceReferences('index.html', '<script>run()</script>'), /inline script/);
  assert.throws(() => cssResourceReferences('app.css', '@font-face{src:url(https://fonts.example/font.woff2)}'), /Remote resource/);
  assert.throws(() => javascriptResourceReferences('app.js', 'import "https://cdn.example/app.js"'), /Remote resource/);
  assert.throws(() => javascriptResourceReferences('app.js', 'eval("run()")'), /eval/);
  assert.throws(() => javascriptResourceReferences('app.js', 'new Function("return 1")'), /new Function/);
  assert.throws(() => javascriptResourceReferences('app.js', 'const policy="script-src unsafe-inline"', {release: true}), /unsafe-inline/);
});

test('release client entries do not reach development, synthetic or Worker modules', async () => {
  const inputs = await collectOfficeReleaseImportGraph({webRoot});
  const forbidden = [...inputs].filter(path => OFFICE_RELEASE_FORBIDDEN_INPUT_PATTERN.test(path)).sort();
  assert.deepEqual(forbidden, []);
  assert.ok(inputs.has('office-release:zuri-connector-disabled'));
  for (const retained of ['building-view.js', 'tycoon-view.js', 'hybrid-scene.js', 'tycoon-studio.js']) {
    assert.ok(inputs.has(retained), `ordinary release route became unreachable: ${retained}`);
  }
});
