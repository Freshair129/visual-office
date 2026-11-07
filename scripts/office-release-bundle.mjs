import {readFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {javascriptResourceReferences} from './office-release-policy.mjs';
import {rewriteBareThreeImports} from './office-browser-modules.mjs';

const stubModules = new Map([
  ['zuri-connector.js', {
    id: 'zuri-connector-disabled',
    contents: `
export class ZuriConnector {
  async getStatus() { return {enabled:false, synthetic:false, target:''}; }
  async getScope() { return {businesses:[]}; }
  async getDomain() { return {state:'UNAVAILABLE', records:[], agent:{state:'UNAVAILABLE'}}; }
  async askGrowth() { return {response:{state:'UNAVAILABLE'}}; }
  async searchKnowledge() { return {response:{state:'UNAVAILABLE'}}; }
  disconnect() {}
}
export const normalizeZuriOrigin = () => null;
export const safeZuriBusinessesUrl = () => null;
export const safeZuriLoginUrl = () => null;
`,
  }],
  ['tycoon-domain-view.js', {
    id: 'dynamic-context-view-disabled',
    contents: `export class TycoonDomainView { constructor() { throw new Error('Dynamic context is disabled in the Office release.'); } }`,
  }],
  ['office-domain-context.js', {
    id: 'dynamic-context-policy-disabled',
    contents: `export const CONTEXT_PROFILE=''; export const CONTEXT_PATH=''; export const parseOfficeDomainContext=()=>null; export const contextAllows=()=>false; export const domainKeyValid=()=>false;`,
  }],
  ['rich-content-dev-policy.js', {
    id: 'rich-content-dev-policy-disabled',
    contents: `export const DEVELOPMENT_INTERACTIVE_POLICY="default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; worker-src 'none'";`,
  }],
  ['office-context-route.js', {
    id: 'dynamic-context-route-disabled',
    contents: `export const resolveOfficeContextRoute=()=>({kind:'building',key:'building'}); export const domainDetail=()=>null; export const buildingPage=()=>null;`,
  }],
]);

export const OFFICE_RELEASE_FORBIDDEN_INPUT_PATTERN = /(^|\/)(?:worker|tests|reports|synthetic-workspace)(\/|\.)|(^|\/)perf(?:[-/][^/]+)?(?:\/|\.)|scripts\/(?:serve|office-proxy|bridge)|marketing-(?:preview|controls)|office-context-(?:data|route)\.js|office-domain-context\.js|tycoon-domain-view\.js|web\/zuri-connector\.js/i;

function stubForSourcePath(path) {
  return stubModules.get(path.replace(/\\/g, '/').split('/').at(-1));
}

export function officeReleaseStubPlugin() {
  const stubsById = new Map([...stubModules.values()].map(stub => [stub.id, stub]));
  return {
    name: 'office-release-stubs',
    setup(esbuild) {
      esbuild.onResolve({filter: /(?:zuri-connector|tycoon-domain-view|office-domain-context|office-context-route|rich-content-dev-policy)\.js$/}, args => {
        const stub = stubForSourcePath(args.path);
        return stub ? {path: stub.id, namespace: 'office-release'} : null;
      });
      esbuild.onLoad({filter: /.*/, namespace: 'office-release'}, args => {
        const stub = stubsById.get(args.path);
        if (!stub) return null;
        return {contents: stub.contents, loader: 'js'};
      });
    },
  };
}

export async function collectOfficeReleaseImportGraph({webRoot, entries = ['app.js', 'character-lab.js']}) {
  const pending = [...entries];
  const visited = new Set();
  while (pending.length) {
    const relativePath = pending.pop().replace(/\\/g, '/');
    if (visited.has(relativePath)) continue;
    const stub = stubForSourcePath(relativePath);
    if (stub) {
      visited.add(`office-release:${stub.id}`);
      continue;
    }
    visited.add(relativePath);
    if (extname(relativePath) !== '.js') continue;
    const absolutePath = resolve(webRoot, relativePath);
    const source = rewriteBareThreeImports(await readFile(absolutePath, 'utf8'), absolutePath, webRoot);
    for (const reference of javascriptResourceReferences(relativePath, source)) {
      if (extname(reference) === '.js') pending.push(reference);
    }
  }
  return visited;
}
