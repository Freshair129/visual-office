import http from 'node:http';
import {readFile, realpath, statfs, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname, extname, isAbsolute, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir, platform, release, arch} from 'node:os';
import {summarizeIntervals} from './perf-hybrid-metrics.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const web = resolve(repo, 'web');
const reportDir = resolve(repo, 'reports/perf-hybrid');
const scriptPath = resolve(repo, 'scripts/perf-hybrid-page.js');
const fixturePath = resolve(repo, 'scripts/perf-hybrid-fixture.mjs');
const observerPath = resolve(repo, 'scripts/perf-hybrid-observer.mjs');
const minFree = 50n * 1024n ** 3n, peakAllowance = 2n * 1024n ** 3n;
const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`Missing value for ${name}`);
  return args[i + 1];
}
const durationMs = Number(option('--duration-ms', '120000'));
const warmupMs = Number(option('--warmup-ms', '1000'));
if (!Number.isSafeInteger(durationMs) || durationMs < 1000 || !Number.isSafeInteger(warmupMs) || warmupMs < 0) throw Error('Invalid duration or warmup');
if (args.some((arg, i) => arg.startsWith('--') && !['--duration-ms','--warmup-ms'].includes(arg))) throw Error('Unknown option');
const tiers = [
  {name:'desktop',cpuRate:1,viewport:{width:1280,height:800},deviceScaleFactor:1,isMobile:false},
  {name:'mobile-4x-proxy',cpuRate:4,viewport:{width:390,height:844},deviceScaleFactor:1.5,isMobile:true},
  {name:'mobile-6x-proxy',cpuRate:6,viewport:{width:390,height:844},deviceScaleFactor:1.5,isMobile:true},
];
const html = `<!doctype html><html><head><meta charset="utf-8"><base href="/"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/hybrid-studio.css"><link rel="stylesheet" href="/office-floor-viewport.css"><script type="importmap">{"imports":{"three":"/vendor/three.module.js","three/addons/":"/vendor/addons/"}}</script><style>html,body{margin:0}.world-stage{overflow:auto;height:100vh}.hy-applied-floor{width:1728px}#profile-root{width:1728px;height:1152px}</style></head><body><div class="office-world floor-immersive inside-floor"><div class="world-stage"><div class="hy-applied-floor"><div id="profile-root"></div></div></div></div><script type="module" src="/__perf__/page.js"></script></body></html>`;
const mime = {'.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const sourceHashes = new Map();
const requests = [];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (parent, file) => { const rel = relative(parent, file); return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel); };
let sourceChanged = false;
async function space() {
  const info = await statfs(repo, {bigint:true});
  const available = info.bavail * info.bsize;
  if (available < minFree + peakAllowance) throw Error(`Insufficient free space: ${available} bytes; need 50 GiB floor plus 2 GiB allowance`);
  return String(available);
}
function resolvePlaywright() {
  const require = createRequire(import.meta.url);
  const choices = [process.env.PLAYWRIGHT_MODULE, 'playwright', join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
  for (const choice of choices) {
    try { return {chromium:require(choice).chromium, module:require.resolve(choice)}; }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw Error('Playwright not found. Set PLAYWRIGHT_MODULE to an already installed Playwright package; do not install dependencies for this run.');
}
async function main() {
  await mkdir(reportDir, {recursive:true});
  const tempDir = join(reportDir, 'runtime-tmp');
  await mkdir(tempDir, {recursive:true});
  // Playwright puts its temporary browser profile under the effective temp directory.
  process.env.TEMP = tempDir; process.env.TMP = tempDir; process.env.TMPDIR = tempDir;
  const reportPath = join(reportDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.json`);
  const report = {
    schema:'visual-office-hybrid-performance/v1', status:'running', startedAt:new Date().toISOString(),
    method:'Headless Chromium, local HybridScene and WebGL; fresh browser context per case; runtime LOD loader wrapped for timing; originals are a manifest-hash-verified A/B control; RAF and draw-entry timings are not physical presentation.',
    limitation:'Mobile viewports and CPU throttles are desktop-browser proxies, not physical-device measurements. The 12-role room is synthetic. Cases observe unsourced automatic activity, not a complete interaction lifecycle.',
    options:{durationMs,warmupMs,desktopAndProxyTiers:tiers}, host:{platform:platform(),release:release(),arch:arch(),node:process.version},
    timingQualification:durationMs >= 120000 ? '120-second observation requested per case; acceptance still requires review and adequate lifecycle/device coverage' : 'short diagnostic, not a 120-second observation',
    cases:[],errors:[],blockedRequests:[],requests,sourceHashes:{},
  };
  let server, browser;
  let reportCreated = false;
  async function persistReport() {
    report.sourceHashes = Object.fromEntries(sourceHashes);
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', reportCreated ? undefined : {flag:'wx'});
    reportCreated = true;
  }
  try {
    report.freeBytesAtStart = await space();
    for (const path of ['scripts/perf-hybrid.mjs','scripts/perf-hybrid-metrics.mjs','scripts/perf-hybrid-page.js','scripts/perf-hybrid-fixture.mjs','scripts/perf-hybrid-observer.mjs']) sourceHashes.set(path, sha(await readFile(resolve(repo, path))));
    const realWeb = await realpath(web);
    server = http.createServer(async (req, res) => {
      try {
        if (req.method !== 'GET') { res.writeHead(405).end(); return; }
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname === '/__perf__/') { res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'}).end(html); return; }
        let file;
        if (url.pathname === '/__perf__/page.js') file = scriptPath;
        else if (url.pathname === '/__perf__/fixture.mjs') file = fixturePath;
        else if (url.pathname === '/__perf__/observer.mjs') file = observerPath;
        else {
          const candidate = resolve(web, '.' + decodeURIComponent(url.pathname));
          if (!inside(web, candidate)) throw Error('outside web');
          file = await realpath(candidate);
          if (!inside(realWeb, file)) throw Error('outside web');
        }
        const bytes = await readFile(file), hash = sha(bytes), path = relative(repo, file).replaceAll('\\','/');
        if (sourceHashes.has(path) && sourceHashes.get(path) !== hash) sourceChanged = true;
        sourceHashes.set(path, hash);
        requests.push({path,bytes:bytes.length,sha256:hash});
        res.writeHead(200, {'content-type':mime[extname(file)] || 'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'}).end(bytes);
      } catch { res.writeHead(404).end('Not found'); }
    });
    await new Promise((resolveServer, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveServer); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const playwright = resolvePlaywright();
    report.playwrightModule = playwright.module;
    const chrome = process.env.CHROME_PATH || (platform() === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
    browser = await playwright.chromium.launch({headless:true,...(chrome ? {executablePath:chrome} : {}),args:[
      '--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run',
      '--host-resolver-rules=MAP * ~NOTFOUND,EXCLUDE 127.0.0.1','--enable-precise-memory-info',
      '--enable-gpu',...(platform() === 'win32' ? ['--use-angle=d3d11'] : []),'--disable-software-rasterizer',
    ]});
    report.browser = browser.version();
    for (const tier of tiers) for (const count of [4,12]) for (const variant of ['original','lod1']) {
      report.lastFreeBytes = await space();
      console.log(`Measuring ${tier.name}, ${count} avatars, ${variant} (${durationMs} ms)`);
      const context = await browser.newContext({viewport:tier.viewport,deviceScaleFactor:tier.deviceScaleFactor,isMobile:tier.isMobile,hasTouch:tier.isMobile,serviceWorkers:'block'});
      let diskFailure = null, checkingSpace = false;
      const monitor = setInterval(async () => {
        if (checkingSpace || diskFailure) return;
        checkingSpace = true;
        try { report.lastFreeBytes = await space(); }
        catch (error) { diskFailure = error; await context.close().catch(() => {}); }
        finally { checkingSpace = false; }
      }, 5000);
      try {
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.stack || error.message));
        page.on('console', message => {if (message.type() === 'error') errors.push(`console: ${message.text()}`);});
        await page.route('**/*', route => {
          const url = route.request().url();
          if (url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
          report.blockedRequests.push(url);
          return route.abort('blockedbyclient');
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', {rate:tier.cpuRate});
        await page.goto(`${origin}/__perf__/`, {waitUntil:'load'});
        await page.waitForFunction(() => typeof window.runHybridPerformance === 'function', null, {timeout:30000});
        const result = await page.evaluate(options => window.runHybridPerformance(options), {variant,count,durationMs,warmupMs});
        const heapAfterDisposal = await cdp.send('Runtime.getHeapUsage');
        if (errors.length) throw Error(`Browser errors: ${errors.join('; ')}`);
        const frame = {callbacks:summarizeIntervals(result.callbackIntervals),rendered:summarizeIntervals(result.renderIntervals),drawEntry:summarizeIntervals(result.drawEntries)};
        const drawWork = {count:result.drawWork.length,meanMs:result.drawWork.reduce((a,b) => a+b,0)/result.drawWork.length,maxMs:Math.max(...result.drawWork)};
        const samples = {callbackIntervalsMs:result.callbackIntervals,renderIntervalsMs:result.renderIntervals,drawEntryIntervalsMs:result.drawEntries,drawSubmissionMs:result.drawWork};
        delete result.callbackIntervals; delete result.renderIntervals; delete result.drawEntries; delete result.drawWork;
        result.load.characterFetchBytes = result.load.assets.flatMap(asset => asset.fetches).reduce((sum, fetch) => sum + (fetch.bytes || 0), 0);
        report.cases.push({tier:tier.name,cpuRate:tier.cpuRate,...result,heapAfterDisposal,frame,drawWork,samples,errors});
        await persistReport();
      } catch (error) {
        throw diskFailure || error;
      } finally { clearInterval(monitor); await context.close(); }
    }
    for (const [path, before] of sourceHashes) if (sha(await readFile(resolve(repo, path))) !== before) sourceChanged = true;
    report.sourceChanged = sourceChanged;
    report.softwareRendererCases = report.cases.filter(item => /swiftshader|software/i.test(item.gpu.renderer)).map(item => `${item.tier}/${item.count}/${item.variant}`);
    report.status = sourceChanged || report.blockedRequests.length ? 'invalid' : 'complete';
    if (report.status !== 'complete') process.exitCode = 1;
  } catch (error) {
    report.status = 'incomplete';
    report.errors.push({name:error.name,message:error.message});
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server?.listening) await new Promise(resolveServer => server.close(resolveServer));
    report.finishedAt = new Date().toISOString();
    await persistReport();
    console.log(`Report: ${reportPath}`);
    if (report.errors.length) console.error(report.errors.map(error => `${error.name}: ${error.message}`).join('\n'));
  }
}
await main();
