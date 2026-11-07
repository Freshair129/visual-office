import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {buildManifest,verifyManifest,signAwsV4,updateIgnoreContent,validateManifest} from '../scripts/asset-store.mjs';

test('SigV4 matches the AWS S3 GET Object header-authentication test vector',()=>{
 const signed=signAwsV4({
  method:'GET',url:'https://examplebucket.s3.amazonaws.com/test.txt',headers:{range:'bytes=0-9'},
  payloadHash:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  accessKey:'AKIAIOSFODNN7EXAMPLE',secretKey:'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',date:'20130524T000000Z',
 });
 assert.equal(signed.signature,'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
 assert.match(signed.headers.authorization,/SignedHeaders=host;range;x-amz-content-sha256;x-amz-date/);
});

test('SigV4 sorts the AWS S3 canonical query string by its encoded keys',()=>{
 const signed=signAwsV4({
  method:'GET',url:'https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J',headers:{},
  payloadHash:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  accessKey:'AKIAIOSFODNN7EXAMPLE',secretKey:'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',date:'20130524T000000Z',
 });
 assert.equal(signed.signature,'34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7');
 assert.equal(signed.canonicalRequest.split('\n')[2],'max-keys=2&prefix=J');
});

test('manifest generation records repository paths, exact hashes, sizes, content types and classes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'visual-office-asset-manifest-'));
 try{
  const image=Buffer.from('image payload'),mark=Buffer.from('<svg/>'),candidate=Buffer.from('model');
  await mkdir(join(root,'web/assets/office-world'),{recursive:true});
  await mkdir(join(root,'web/assets/brand'),{recursive:true});
  await mkdir(join(root,'web/assets/models/characters/candidates'),{recursive:true});
  await writeFile(join(root,'web/assets/office-world/idle-campus-desktop.png'),image);
  await writeFile(join(root,'web/assets/brand/zuri-iconic-primary.svg'),mark);
  await writeFile(join(root,'web/assets/models/characters/candidates/rain.glb'),candidate);
  const manifest=await buildManifest(root);
  assert.deepEqual(manifest.assets.map(({path,class:kind})=>[path,kind]),[
   ['web/assets/brand/zuri-iconic-primary.svg','brand-mark'],
   ['web/assets/models/characters/candidates/rain.glb','third-party-candidate'],
   ['web/assets/office-world/idle-campus-desktop.png','imagegen'],
  ]);
  const entry=manifest.assets.at(-1);
  assert.equal(entry.bytes,image.length);assert.equal(entry.sha256,createHash('sha256').update(image).digest('hex'));
  assert.equal(entry.contentType,'image/png');assert.ok(entry.licenseNote);
  const old={path:'web/assets/models/characters/zuri.glb',bytes:42,sha256:'a'.repeat(64),contentType:'model/gltf-binary',class:'brand-character',licenseNote:'preserved'};
  const merged=await buildManifest(root,[old]);assert.deepEqual(merged.assets.find(asset=>asset.path===old.path),old);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('manifest verification accepts exact bytes and reports missing, size and hash mismatches',async()=>{
 const root=await mkdtemp(join(tmpdir(),'visual-office-asset-verify-'));
 try{
  const path='web/assets/office-world/idle-campus-desktop.png',file=resolve(root,path),bytes=Buffer.from('original');
  await mkdir(join(root,'web/assets/office-world'),{recursive:true});await writeFile(file,bytes);
  const manifest=await buildManifest(root);assert.deepEqual(await verifyManifest(root,manifest),{checked:1,errors:[]});
  await writeFile(file,'different');assert.equal((await verifyManifest(root,manifest)).errors[0].reason.startsWith('size mismatch'),true);
  await writeFile(file,Buffer.from('modified'));assert.equal((await verifyManifest(root,manifest)).errors[0].reason,'SHA-256 mismatch');
  await writeFile(file,bytes);await rm(file);
  assert.deepEqual((await verifyManifest(root,manifest)).errors,[{path,reason:'missing'}]);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('manifest validation rejects traversal, non-canonical paths and inconsistent asset metadata',()=>{
 const base={schemaVersion:'visual-office-asset-store/v1',assets:[{path:'web/assets/office-world/idle-campus-desktop.png',bytes:1,sha256:'a'.repeat(64),contentType:'image/png',class:'imagegen',licenseNote:'generated'}]};
 assert.deepEqual(validateManifest(base),[]);
 for(const path of ['../web/assets/office-world/idle-campus-desktop.png','C:/outside/web/assets/office-world/idle-campus-desktop.png','web\\assets\\office-world\\idle-campus-desktop.png']){
  assert.equal(validateManifest({...base,assets:[{...base.assets[0],path}]})[0].reason,'unsafe or non-canonical path');
 }
 assert.equal(validateManifest({...base,assets:[{...base.assets[0],class:'brand-character'}]})[0].reason,'unrecognized asset class or path');
 assert.equal(validateManifest({...base,assets:[{...base.assets[0],sha256:'bad'}]})[0].reason,'invalid SHA-256');
});

test('external asset ignore block uses one root-anchored pattern for each manifest path',()=>{
 const content=updateIgnoreContent('node_modules/\n\nreports/\n',["web/assets/office-world/a.png","docs/game-design/characters/b.png"]);
 assert.match(content,/^node_modules\/\n\nreports\/\n\n# BEGIN external asset store paths$/m);
 assert.match(content,/^\/docs\/game-design\/characters\/b\.png$/m);
 assert.match(content,/^\/web\/assets\/office-world\/a\.png$/m);
 assert.equal(updateIgnoreContent(content,['web/assets/office-world/a.png']).match(/# BEGIN external asset store paths/g).length,1);
});
