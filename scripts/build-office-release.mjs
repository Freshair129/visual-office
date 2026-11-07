import {build, version as esbuildVersion} from 'esbuild';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {dirname, extname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cssResourceReferences, hashArtifactFileList, htmlResourceReferences, validateReleaseFiles} from './office-release-policy.mjs';
import {officeReleaseStubPlugin, OFFICE_RELEASE_FORBIDDEN_INPUT_PATTERN} from './office-release-bundle.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseRoot = resolve(root, 'release');
const officeRoot = resolve(releaseRoot, 'office');
const provenancePath = resolve(releaseRoot, 'office-release.json');
const assetExtensions = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.glb', '.gltf', '.json', '.ttf', '.woff', '.woff2', '.otf', '.bin', '.txt']);
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const threePackage = JSON.parse(await readFile(resolve(root, 'node_modules/three/package.json'), 'utf8'));
const apiBase = normalizeApiBase(process.env.OFFICE_API_BASE || '/api/');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizeApiBase(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')
    || /[?#\\]/.test(value) || value.split('/').includes('..')) {
    throw new Error('OFFICE_API_BASE must be a same-origin path such as /api/');
  }
  return value.endsWith('/') ? value : `${value}/`;
}

async function resolveGitDirectory() {
  const gitMarker = resolve(root, '.git');
  const marker = await readFile(gitMarker, 'utf8').catch(() => '');
  const match = marker.match(/^gitdir:\s*(.+)\s*$/im);
  return match ? resolve(root, match[1]) : gitMarker;
}

async function gitMetadata() {
  const gitDir = await resolveGitDirectory();
  const commonDirName = await readFile(join(gitDir, 'commondir'), 'utf8').catch(() => '');
  const commonDir = commonDirName.trim() ? resolve(gitDir, commonDirName.trim()) : gitDir;
  const head = (await readFile(join(gitDir, 'HEAD'), 'utf8')).trim();
  let revision = head;
  if (head.startsWith('ref: ')) {
    const refName = head.slice(5);
    let resolved = '';
    for (const base of [...new Set([gitDir, commonDir])]) {
      resolved = await readFile(join(base, refName), 'utf8').catch(() => '');
      if (resolved.trim()) break;
    }
    if (!resolved.trim()) {
      const packedRefs = await readFile(join(commonDir, 'packed-refs'), 'utf8').catch(() => '');
      resolved = packedRefs.split(/\r?\n/).find(line => line.endsWith(` ${refName}`))?.split(' ')[0] || '';
    }
    revision = resolved.trim();
  }
  if (!/^[a-f0-9]{40,64}$/i.test(revision)) throw new Error('Could not resolve the Git revision from .git metadata');
  const config = await readFile(join(commonDir, 'config'), 'utf8').catch(() => '');
  const remoteBlock = config.match(/^\[remote "origin"\]([\s\S]*?)(?=^\[|$)/m)?.[1] || '';
  const remoteUrl = remoteBlock.match(/^\s*url\s*=\s*(.+)$/m)?.[1]?.trim() || '';
  const repository = githubRepository(remoteUrl) || 'Freshair129/visual-office';
  return {revision: revision.toLowerCase(), repository, remoteUrl};
}

function githubRepository(remoteUrl) {
  const match = remoteUrl.match(/(?:github\.com[:/])([^/]+\/[^/]+?)(?:\.git)?$/i);
  return match ? match[1] : '';
}

async function gitIndexPath() {
  const gitDir = await resolveGitDirectory();
  return join(gitDir, 'index');
}

async function trackedPathsFromIndex() {
  const bytes = await readFile(await gitIndexPath());
  if (bytes.toString('ascii', 0, 4) !== 'DIRC') throw new Error('Unsupported Git index format');
  const version = bytes.readUInt32BE(4);
  if (![2, 3].includes(version)) throw new Error(`Unsupported Git index version ${version}; release requires index v2 or v3`);
  const count = bytes.readUInt32BE(8);
  const paths = new Set();
  let offset = 12;
  for (let i = 0; i < count; i++) {
    const start = offset;
    if (offset + 62 > bytes.length) throw new Error('Git index ended inside an entry');
    const flags = bytes.readUInt16BE(offset + 60);
    offset += 62;
    if (flags & 0x4000) offset += 2;
    const end = bytes.indexOf(0, offset);
    if (end < 0) throw new Error('Git index entry has no path terminator');
    paths.add(bytes.toString('utf8', offset, end).replace(/\\/g, '/'));
    offset = start + Math.ceil((end + 1 - start) / 8) * 8;
  }
  return paths;
}

async function sourceBytes(path) {
  return readFile(resolve(root, path));
}

async function walkFiles(directory) {
  const result = [];
  const entries = await readdir(directory, {withFileTypes: true}).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walkFiles(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

async function assertNoUnexpectedOutputFiles(expectedPaths) {
  const existing = await walkFiles(officeRoot);
  const unexpected = existing.map(path => relative(officeRoot, path).split(sep).join('/')).filter(path => !expectedPaths.has(path));
  if (unexpected.length) {
    throw new Error(`Refusing to overwrite release/office with unowned or stale files: ${unexpected.join(', ')}`);
  }
}

const bundle = await build({
  absWorkingDir: root,
  entryPoints: {app: 'web/app.js', 'character-lab': 'web/character-lab.js'},
  outdir: officeRoot,
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  legalComments: 'linked',
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  assetNames: 'assets/[name]-[hash]',
  write: false,
  metafile: true,
  define: {
    __OFFICE_RELEASE__: 'true',
    __OFFICE_API_BASE__: JSON.stringify(apiBase),
  },
  plugins: [officeReleaseStubPlugin()],
  logLevel: 'warning',
});

const inputNames = Object.keys(bundle.metafile.inputs).map(path => path.replace(/\\/g, '/'));
const forbiddenInputs = inputNames.filter(path => OFFICE_RELEASE_FORBIDDEN_INPUT_PATTERN.test(path));
if (forbiddenInputs.length) throw new Error(`Development or Worker input entered the client bundle: ${forbiddenInputs.join(', ')}`);
const virtualConnector = inputNames.some(path => path.includes('zuri-connector-disabled'));
if (!virtualConnector) throw new Error('Expected the uncontracted Zuri connector to be disabled for the release build');

const outputFiles = new Map();
const sourceInputPaths = new Set([
  'package.json',
  'package-lock.json',
  'scripts/build-assets.mjs',
  'scripts/build-rich.mjs',
  'scripts/build-studio-assets.mjs',
  'scripts/build-office-blueprints.mjs',
  'scripts/build-tycoon-assets.mjs',
  'scripts/build-office-release.mjs',
  'scripts/office-release-bundle.mjs',
  'scripts/office-browser-modules.mjs',
  'scripts/office-release-policy.mjs',
  'asset-store/manifest.json',
  'web/index.html',
  'web/character-lab.html',
]);
for (const output of bundle.outputFiles) {
  const path = relative(officeRoot, output.path).split(sep).join('/');
  if (!path || path.startsWith('../')) throw new Error(`Bundle output escaped release/office: ${output.path}`);
  outputFiles.set(path, Buffer.from(output.contents));
}

const assetStore = JSON.parse(await readFile(resolve(root, 'asset-store/manifest.json'), 'utf8'));
const assetStoreBytes = await readFile(resolve(root, 'asset-store/manifest.json'));
const listedExternalAssets = new Map(assetStore.assets.map(asset => [asset.path.replace(/\\/g, '/'), asset]));
const trackedPaths = await trackedPathsFromIndex();
const files = new Map(outputFiles);
const includedExternalAssets = [];
const missingExternalAssets = [];

async function addAsset(sourcePath, bytes, sourceEntry) {
  sourceInputPaths.add(sourcePath);
  const artifactPath = sourcePath.slice('web/'.length);
  files.set(artifactPath, Buffer.from(bytes));
  if (sourceEntry) {
    includedExternalAssets.push({
      sourcePath,
      artifactPath,
      sha256: sourceEntry.sha256,
      sizeBytes: sourceEntry.bytes,
      class: sourceEntry.class,
      licenseNote: sourceEntry.licenseNote,
    });
  }
}

for (const sourcePath of [...trackedPaths].filter(path => path.startsWith('web/assets/')).sort()) {
  const extension = extname(sourcePath).toLowerCase();
  const isLicenseText = /(?:^|\/)(?:LICENSE|LICENSES)(?:\.[^/]*)?$/i.test(sourcePath);
  if (!assetExtensions.has(extension) && !isLicenseText) continue;
  if (listedExternalAssets.has(sourcePath)) continue;
  await addAsset(sourcePath, await sourceBytes(sourcePath));
}

for (const [sourcePath, entry] of [...listedExternalAssets].filter(([path]) => path.startsWith('web/assets/')).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
  let bytes;
  try {
    bytes = await sourceBytes(sourcePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      missingExternalAssets.push({sourcePath, class: entry.class, reason: 'not present; runtime procedural fallback remains available'});
      continue;
    }
    throw error;
  }
  const digest = sha256(bytes);
  if (bytes.length !== entry.bytes || digest !== entry.sha256) {
    throw new Error(`Manifest-listed external asset does not match its pinned bytes: ${sourcePath}`);
  }
  await addAsset(sourcePath, bytes, entry);
}

for (const sourcePath of ['web/office-zuri-config.json']) {
  if (trackedPaths.has(sourcePath)) {
    sourceInputPaths.add(sourcePath);
    files.set(sourcePath.slice('web/'.length), await sourceBytes(sourcePath));
  }
}

const htmlInputs = ['index.html', 'character-lab.html'];
for (const htmlPath of htmlInputs) {
  let html = (await sourceBytes(`web/${htmlPath}`)).toString('utf8');
  html = html.replace(/<p><a href="http:\/\/127\.0\.0\.1:3773\/"[^>]*>[\s\S]*?<\/a><\/p>/gi, '');
  if (!files.has('assets/brand/zuri-app-dark-micro.svg')) html = html.replace(/<link\b(?=[^>]*\brel="icon")(?=[^>]*\bhref="\.\/assets\/brand\/zuri-app-dark-micro\.svg")[^>]*>/gi, '');
  files.set(htmlPath, Buffer.from(html));
}

async function addCss(cssPath) {
  if (files.has(cssPath)) return;
  const sourcePath = `web/${cssPath}`;
  sourceInputPaths.add(sourcePath);
  const bytes = await sourceBytes(sourcePath);
  files.set(cssPath, bytes);
  const refs = cssResourceReferences(cssPath, bytes.toString('utf8'));
  for (const ref of refs.filter(path => path.endsWith('.css'))) await addCss(ref);
}

for (const htmlPath of htmlInputs) {
  const html = files.get(htmlPath).toString('utf8');
  for (const reference of htmlResourceReferences(htmlPath, html).filter(path => path.endsWith('.css'))) await addCss(reference);
}

const references = validateReleaseFiles(files, {release: true});
const unresolvedSourceFiles = [];
for (const [fromPath, resourcePaths] of references) {
  for (const resourcePath of resourcePaths) {
    if (!files.has(resourcePath)) unresolvedSourceFiles.push(`${fromPath} -> ${resourcePath}`);
  }
}
if (unresolvedSourceFiles.length) throw new Error(`Release has unresolved local references: ${unresolvedSourceFiles.join(', ')}`);

const artifacts = [...files].map(([path, bytes]) => ({path, sha256: sha256(bytes), sizeBytes: bytes.length}))
  .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const artifactHash = hashArtifactFileList(artifacts);
const inputFiles = new Set([
  ...sourceInputPaths,
  ...inputNames.filter(path => !path.startsWith('office-release:')),
  ...includedExternalAssets.map(asset => asset.sourcePath),
  ...missingExternalAssets.map(asset => asset.sourcePath),
]);
const inputRecords = [];
for (const path of [...inputFiles].sort()) {
  try {
    inputRecords.push({path: path.replace(/\\/g, '/'), sha256: sha256(await sourceBytes(path))});
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    inputRecords.push({path: path.replace(/\\/g, '/'), sha256: 'missing'});
  }
}
const sourceInputsSha256 = sha256(inputRecords.map(file => `${file.path}\t${file.sha256}\n`).join(''));

const git = await gitMetadata();
const provenance = {
  schemaVersion: 'office-release/v1',
  repository: `https://github.com/${git.repository}`,
  revision: git.revision,
  sourceInputsSha256,
  sourceInputs: inputRecords,
  basePath: '/office/',
  apiBase,
  tools: {node: process.version, esbuild: esbuildVersion, three: threePackage.version},
  externalAssetPolicy: {
    manifestPath: 'asset-store/manifest.json',
    manifestSha256: sha256(assetStoreBytes),
    rule: 'Include external client assets only when their exact web/assets path is listed and their bytes match manifest size and SHA-256. Unlisted machine files are excluded. Manifest source files outside web/assets are not client runtime assets.',
    included: includedExternalAssets.sort((a, b) => a.sourcePath < b.sourcePath ? -1 : a.sourcePath > b.sourcePath ? 1 : 0),
    missingOptional: missingExternalAssets.sort((a, b) => a.sourcePath < b.sourcePath ? -1 : a.sourcePath > b.sourcePath ? 1 : 0),
    excludedOutsideClientRoot: assetStore.assets.filter(asset => !asset.path.replace(/\\/g, '/').startsWith('web/assets/')).length,
  },
  artifact: {
    algorithm: 'sha256(sorted UTF-8 lines: path<TAB>sha256<LF>)',
    sha256: artifactHash,
    fileCount: artifacts.length,
    totalSizeBytes: artifacts.reduce((sum, file) => sum + file.sizeBytes, 0),
    files: artifacts,
  },
};

const priorProvenance = await readFile(provenancePath, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
if (priorProvenance) {
  const previous = JSON.parse(priorProvenance);
  if (previous.revision === provenance.revision && previous.sourceInputsSha256 === sourceInputsSha256
    && previous.artifact?.sha256 !== artifactHash) {
    throw new Error('Determinism check failed: the same revision and source input fingerprint produced a different artifact hash');
  }
}

await assertNoUnexpectedOutputFiles(new Set(files.keys()));
for (const [path, bytes] of files) {
  const destination = resolve(officeRoot, path);
  if (!destination.startsWith(officeRoot + sep)) throw new Error(`Refusing release path outside artifact root: ${path}`);
  await mkdir(dirname(destination), {recursive: true});
  await writeFile(destination, bytes);
}
await mkdir(releaseRoot, {recursive: true});
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(JSON.stringify({
  repository: git.repository,
  revision: git.revision,
  artifactSha256: artifactHash,
  files: artifacts.length,
  sizeBytes: provenance.artifact.totalSizeBytes,
  includedManifestAssets: includedExternalAssets.length,
  missingOptionalManifestAssets: missingExternalAssets.length,
  apiBase,
}, null, 2));
