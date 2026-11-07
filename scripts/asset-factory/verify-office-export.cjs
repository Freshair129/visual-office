// Actual production UI export, isolated browser storage and disabled preview connector.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {pathToFileURL}=require('url');
const {chromium}=require('C:/Users/suanr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const output=process.argv[2];if(!output||fs.existsSync(output))throw Error('Provide a fresh evidence directory');fs.mkdirSync(output,{recursive:true});
 const fixture=JSON.parse(fs.readFileSync('tests/fixtures/external-chairs/fixtures.json')).fixtures[0];fixture.bytes=Array.from(fs.readFileSync(path.join('tests/fixtures/external-chairs',fixture.file)));
 const sourceFiles=['scripts/asset-factory/verify-office-export.cjs','web/office-handoff.schema.json','tests/fixtures/external-chairs/fixtures.json',path.join('tests/fixtures/external-chairs',fixture.file),...fs.readdirSync('web').filter(f=>f.endsWith('.js')).map(f=>'web/'+f)];
 const hashes=()=>Object.fromEntries(sourceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));const before=hashes();
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-gpu','--use-angle=d3d11','--disable-software-rasterizer']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push({method:r.method(),url:r.url()});});
  await page.goto('http://127.0.0.1:'+(process.env.PREVIEW_PORT||4197)+'/profile-blank');
  await page.setContent('<script type="importmap">{"imports":{"three":"/vendor/three.module.js","three/addons/":"/vendor/addons/"}}</script><link rel="stylesheet" href="/tycoon-view.css"><main></main>');
  const prepared=await page.evaluate(async fixture=>{
   const {TycoonView}=await import('/tycoon-view.js'),{OFFICE_FLOORS}=await import('/office-floor-registry.js');
   const {TycoonStore,createTycoonRoom}=await import('/tycoon-state.js'),{inspectCustomGLB,describeCustomAsset,customModels}=await import('/custom-assets.js');
   const info=await inspectCustomGLB(new Uint8Array(fixture.bytes));await customModels.putMany([{id:info.id,bytes:info.bytes}]);
   const room=createTycoonRoom('people'),chair=room.objects.find(o=>o.kind==='chair');chair.asset=describeCustomAsset(info,{name:fixture.id,category:'chair',height:fixture.height,interaction:fixture.interaction});chair.kind='custom';chair.rotation=chair.rotation+Math.PI-fixture.interaction.heading;room.objects.find(o=>o.kind==='desk').color='#faab34';
   const saved=await new TycoonStore(localStorage).save('people',room);if(!saved.ok)throw Error('Browser fixture save failed: '+saved.reason);
   window.officeView=new TycoonView(document.querySelector('main'),{storage:localStorage,onNavigate:floor=>window.officeView.show(floor)});await officeView.ready;officeView.show('people');
   return {floorKeys:OFFICE_FLOORS.map(f=>f.key),customAssetId:info.id,chairId:chair.id};
  },fixture);
  await page.waitForFunction(()=>officeView.scene?.ready===true);
  await page.locator('[data-nav="floors"]').click();
  if(await page.locator('.tycoon-floor-choice').count()!==15)throw Error('Floor directory incomplete');
  await page.getByRole('button',{name:'ปิดรายละเอียด'}).click();
  await page.getByRole('button',{name:'ทีมและ Workflow',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.tycoon-sheet-body').textContent.includes('Agent design ID:'));
  await page.screenshot({path:path.join(output,'people-team-workflow.png')});
  const exportStart=Date.now(),downloadEvent=page.waitForEvent('download',{timeout:180000});await page.getByRole('button',{name:'ส่งออกแปลนทุกชั้น + ทีม + ID (.zip)',exact:true}).click();
  const failure=page.waitForFunction(()=>document.querySelector('.tycoon-sheet-body')?.textContent.includes('ส่งออกไม่ได้'),null,{timeout:180000}).then(async()=>{throw Error(await page.locator('.tycoon-sheet-body').innerText());});
  const download=await Promise.race([downloadEvent,failure]);await download.saveAs(path.join(output,'browser-office-world.zip'));
  const {readHandoffArchive}=await import(pathToFileURL(path.resolve('scripts/office-handoff-archive.mjs')));
  const {validateOfficeHandoff}=await import(pathToFileURL(path.resolve('web/office-handoff.js')));
  const files=readHandoffArchive(fs.readFileSync(path.join(output,'browser-office-world.zip'))),manifest=await validateOfficeHandoff(JSON.parse(files.get('manifest.json')));
  const savedPeople=manifest.entities.find(e=>e.type==='scene'&&e.key==='people/layout').data.snapshot;
  if(savedPeople.objects.find(o=>o.id===prepared.chairId)?.asset?.id!==prepared.customAssetId||savedPeople.objects.find(o=>o.kind==='desk').color!=='#faab34')throw Error('Saved floor/custom model was not exported');
  for(const revision of manifest.entities.filter(e=>e.type==='assetRevision')){const bytes=files.get(revision.data.uri);if(!bytes||bytes.length!==revision.data.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==revision.data.sha256)throw Error('Browser model hash mismatch');}
  const {verifyCustomAssetMeasurements}=await import(pathToFileURL(path.resolve('web/office-handoff-assets.js')));
  await verifyCustomAssetMeasurements(manifest.entities,uri=>files.get(uri));
  const schema=JSON.parse(files.get('schema.json'));if(JSON.stringify(schema)!==JSON.stringify(JSON.parse(fs.readFileSync('web/office-handoff.schema.json'))))throw Error('Browser schema mismatch');
  const map=JSON.parse(files.get('id-map.json'));if(map.length!==manifest.entities.length||map.some(row=>row.zuriId!==null)||new Set(map.map(r=>r.externalId)).size!==map.length)throw Error('Browser ID map mismatch');
  const after=hashes(),sourceUnchanged=JSON.stringify(before)===JSON.stringify(after);
  const report={method:'Production TycoonView, real Chrome UI clicks and downloaded ZIP; saved People floor edit plus external chair through production IndexedDB import; isolated local browser storage; preview connectors disabled',browser:browser.version(),...prepared,entities:manifest.entities.length,contentHash:manifest.contentHash,archiveEntries:files.size,exportAndVerifyElapsedMs:Date.now()-exportStart,errors,writes,sourceUnchanged,sourceHashes:before,registeredInZuri:false};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  if(errors.length||writes.length||!sourceUnchanged)throw Error('UI export verification failed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
