import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDocumentation,checkDocumentation} from '../scripts/check-docs.mjs';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

const audit=(documents,paths=Object.keys(documents),indexes={},externalAssets=[])=>auditDocumentation({documents,paths,indexes,externalAssets});

test('documentation check resolves reference links, image paths and encoded filenames relative to their source',()=>{
 const result=audit({'docs/README.md':'[Guide][g]\n\n[g]: <My%20Guide.md#hello>\n\n![map](../web/map.png)','docs/My Guide.md':'# Hello'},['docs/README.md','docs/My Guide.md','web/map.png']);
 assert.deepEqual(result.errors,[]);assert.equal(result.links,2);
});
test('documentation check rejects missing files and exact-case mismatches on Windows too',()=>{
 const result=audit({'docs/README.md':'[missing](missing.md) [case](guide.md)'},['docs/README.md','docs/Guide.md']);
 assert.deepEqual(result.errors.map(e=>e.code),['MISSING_TARGET','PATH_CASE']);
});
test('documentation links accept exact asset-store manifest paths that are absent locally',()=>{
 const listed='web/assets/brand/zuri-iconic-primary.svg';
 const result=audit({'README.md':`[brand mark](${listed}) [unknown](web/assets/brand/other.svg)`},['README.md'],{},[listed]);
 assert.deepEqual(result.errors.map(error=>[error.code,error.target]),[['MISSING_TARGET','web/assets/brand/other.svg']]);
 assert.deepEqual(result.references.map(reference=>reference.target),[listed]);
});
test('documentation check verifies Unicode, duplicate and explicit section anchors',()=>{
 const result=audit({'README.md':'[ไทย](docs/a.md#หัวข้อ) [again](docs/a.md#hello-1) [explicit](docs/a.md#stable) [bad](docs/a.md#absent)','docs/a.md':'# หัวข้อ\n# Hello\n# Hello\n<a id="stable"></a>'});
 assert.deepEqual(result.errors.map(e=>e.code),['MISSING_ANCHOR']);
});
test('documentation check does not accept ignored local evidence as a portable repository target',()=>{
 const result=audit({'README.md':'[capture](reports/local.png)'});
 assert.equal(result.errors[0].code,'MISSING_TARGET');
});
test('documentation check classifies external URLs and machine-local sources without probing them',()=>{
 const result=audit({'README.md':'[upstream](https://example.test/guide#intro) [design](F:/design/README.md) [local](file:///C:/private.md)'});
 assert.deepEqual(result.errors,[]);assert.equal(result.external.length,1);assert.equal(result.machineLocal.length,2);
});
test('documentation check rejects paths escaping the repository and malformed encodings',()=>{
 const result=audit({'README.md':'[escape](../other/README.md) [bad](docs/%ZZ.md)'});
 assert.deepEqual(result.errors.map(e=>e.code),['OUTSIDE_REPOSITORY','INVALID_ENCODING']);
});
test('documentation indexes must cover every direct document in their assigned family',()=>{
 const documents={'docs/README.md':'[a](a.md)','docs/a.md':'# A','docs/b.md':'# B'};
 const result=audit(documents,Object.keys(documents),{'docs/README.md':['docs/a.md','docs/b.md']});
 assert.deepEqual(result.errors.map(e=>e.code),['NOT_INDEXED']);assert.equal(result.errors[0].target,'docs/b.md');
});
test('code examples do not create real document headings or HTML section anchors',()=>{
 const result=audit({'README.md':'[code](guide.md#fake) [heading](guide.md#not-a-section)','guide.md':'```html\n<a id="fake"></a>\n# Not a section\n```'});
 assert.deepEqual(result.errors.map(e=>e.code),['MISSING_ANCHOR','MISSING_ANCHOR']);
});
test('a tracked file deleted from disk cannot satisfy a document link',async()=>{
 const root=await mkdtemp(join(tmpdir(),'office-doc-check-'));
 try{
  execFileSync('git',['init','--quiet'],{cwd:root});
  await writeFile(join(root,'README.md'),'[capture](capture.png)');await writeFile(join(root,'capture.png'),'test');
  execFileSync('git',['add','.'],{cwd:root});await rm(join(root,'capture.png'));
  const result=await checkDocumentation(root);
  assert.ok(result.errors.some(e=>e.code==='MISSING_TARGET'&&e.target==='capture.png'));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('an assigned document family cannot silently lose its index',()=>{
 const result=audit({'docs/guide.md':'# Guide'},['docs/guide.md'],{'docs/README.md':['docs/guide.md']});
 assert.ok(result.errors.some(e=>e.code==='MISSING_INDEX'));
});
test('only real HTML ids and named anchors satisfy fragments, including unquoted ids',()=>{
 const result=audit({'README.md':'[fake](guide.md#fake) [field](guide.md#field) [real](guide.md#real) [named](guide.md#named)',
  'guide.md':'<div data-id="fake" id=real></div>\n<input name="field">\n<a name="named"></a>'});
 assert.deepEqual(result.errors.map(e=>[e.code,e.target]),[['MISSING_ANCHOR','guide.md#fake'],['MISSING_ANCHOR','guide.md#field']]);
});
test('new root documents must be linked from the central documentation index too',async()=>{
 const root=await mkdtemp(join(tmpdir(),'office-doc-check-'));
 try{
  execFileSync('git',['init','--quiet'],{cwd:root});await mkdir(join(root,'docs'));
  await writeFile(join(root,'README.md'),'[Docs](docs/README.md)');
  await writeFile(join(root,'EXTRA.md'),'# Extra');
  await writeFile(join(root,'docs','README.md'),'[Root](../README.md)');
  const result=await checkDocumentation(root);
  assert.ok(result.errors.some(e=>e.code==='NOT_INDEXED'&&e.target==='EXTRA.md'));
 }finally{await rm(root,{recursive:true,force:true});}
});
