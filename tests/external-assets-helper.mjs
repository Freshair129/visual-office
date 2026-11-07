import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

export const EXTERNAL_ASSET_SKIP_REASON='external assets not present; run npm run assets:pull';
const manifest=JSON.parse(readFileSync(new URL('../asset-store/manifest.json',import.meta.url),'utf8'));
const listed=new Set(manifest.assets.map(asset=>asset.path));
const requireAssets=process.env.VO_REQUIRE_EXTERNAL_ASSETS==='1';

export function externalAssetTest(name,paths,fn){
 const normalized=[...new Set(paths.map(path=>path.replaceAll('\\','/').replace(/^\.\//,'')))];
 const unlisted=normalized.filter(path=>!listed.has(path));
 if(unlisted.length)throw new Error(`${name} uses external files missing from asset-store/manifest.json: ${unlisted.join(', ')}`);
 const missing=[];
 for(const path of normalized){try{if(!statSync(new URL(`../${path}`,import.meta.url)).isFile())missing.push(path);}catch(error){if(error.code==='ENOENT')missing.push(path);else throw error;}}
 if(missing.length&&requireAssets)return test(name,async()=>assert.fail(`${EXTERNAL_ASSET_SKIP_REASON}; VO_REQUIRE_EXTERNAL_ASSETS=1 requires ${missing.join(', ')}`));
 return test(name,missing.length?{skip:EXTERNAL_ASSET_SKIP_REASON}:undefined,fn);
}
