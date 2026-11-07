import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {dirname, extname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createOfficeReleaseServer} from './office-release-server.mjs';
import {hashArtifactFileList, OFFICE_RELEASE_CSP, validateReleaseFiles} from './office-release-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseRoot = resolve(root, 'release');
const officeRoot = resolve(releaseRoot, 'office');
const provenance = JSON.parse(await readFile(resolve(releaseRoot, 'office-release.json'), 'utf8'));

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

if (provenance.schemaVersion !== 'office-release/v1' || provenance.basePath !== '/office/') {
  throw new Error('Unexpected Visual Office release provenance schema or base path');
}
if (!Array.isArray(provenance.sourceInputs)) throw new Error('Release provenance does not contain source input hashes');
const inputCanonical = [...provenance.sourceInputs]
  .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  .map(input => `${input.path}\t${input.sha256}\n`).join('');
if (hash(inputCanonical) !== provenance.sourceInputsSha256) throw new Error('Source input fingerprint does not match the listed hashes');
for (const input of provenance.sourceInputs) {
  if (!input.path || input.path.startsWith('/') || input.path.includes('\\') || input.path.split('/').includes('..')) {
    throw new Error(`Unsafe source input path: ${input.path}`);
  }
  try {
    if (hash(await readFile(resolve(root, input.path))) !== input.sha256) {
      throw new Error(`Source input hash mismatch: ${input.path}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT' || input.sha256 !== 'missing') throw error;
  }
}
const artifactFiles = provenance.artifact?.files;
if (!Array.isArray(artifactFiles)) throw new Error('Release provenance does not contain an artifact file list');
const artifactMap = new Map();
for (const item of artifactFiles) {
  if (!item.path || item.path.startsWith('/') || item.path.includes('\\') || item.path.split('/').includes('..')) throw new Error(`Unsafe artifact path: ${item.path}`);
  const path = resolve(officeRoot, item.path);
  if (!path.startsWith(officeRoot + sep)) throw new Error(`Artifact path escapes release root: ${item.path}`);
  const bytes = await readFile(path);
  if (bytes.length !== item.sizeBytes || hash(bytes) !== item.sha256) throw new Error(`Artifact hash mismatch: ${item.path}`);
  artifactMap.set(item.path, bytes);
}
const actualPaths = (await walk(officeRoot)).map(path => resolve(officeRoot, path).slice(officeRoot.length + 1).split(sep).join('/')).sort();
const listedPaths = [...artifactMap.keys()].sort();
if (actualPaths.join('\n') !== listedPaths.join('\n')) throw new Error('Artifact directory and provenance file list differ');
if (hashArtifactFileList(artifactFiles) !== provenance.artifact.sha256) throw new Error('Sorted artifact file-list hash mismatch');
if (artifactFiles.some(file => /^(?:worker|tests|scripts|tools|perf)(?:\/|$)/i.test(file.path))) {
  throw new Error('Worker, harness, tests, tools or perf content entered the static release');
}
for (const asset of provenance.externalAssetPolicy?.included || []) {
  const artifactAsset = artifactMap.get(asset.artifactPath);
  if (!artifactAsset || hash(artifactAsset) !== asset.sha256 || artifactAsset.length !== asset.sizeBytes) {
    throw new Error(`Manifest-listed asset does not match provenance: ${asset.sourcePath}`);
  }
}

const references = validateReleaseFiles(artifactMap, {release: true});
const server = createOfficeReleaseServer(officeRoot);
await new Promise((resolveListen, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolveListen);
});
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
const fetched = new Set();

async function load(path) {
  if (fetched.has(path)) return;
  fetched.add(path);
  const response = await fetch(`${origin}/office/${path}`);
  if (response.status !== 200) throw new Error(`Release server returned HTTP ${response.status} for /office/${path}`);
  if (response.headers.get('content-security-policy') !== OFFICE_RELEASE_CSP) {
    throw new Error(`Unexpected CSP header for /office/${path}`);
  }
  const content = await response.arrayBuffer();
  if (content.byteLength !== artifactMap.get(path)?.byteLength) throw new Error(`Server payload size mismatch for /office/${path}`);
  for (const reference of references.get(path) || []) await load(reference);
}

try {
  for (const html of artifactFiles.filter(file => file.path.endsWith('.html'))) await load(html.path);
  const index = await fetch(`${origin}/office/`);
  if (index.status !== 200 || index.headers.get('content-security-policy') !== OFFICE_RELEASE_CSP) {
    throw new Error('The /office/ prefix did not serve index.html with the required CSP');
  }
} finally {
  await new Promise(resolveClose => server.close(resolveClose));
}

console.log(JSON.stringify({
  status: 'PASS',
  basePath: provenance.basePath,
  csp: OFFICE_RELEASE_CSP,
  htmlPages: artifactFiles.filter(file => file.path.endsWith('.html')).map(file => file.path),
  referencedFilesServed: fetched.size + 1,
  artifactSha256: provenance.artifact.sha256,
  totalSizeBytes: provenance.artifact.totalSizeBytes,
}, null, 2));
