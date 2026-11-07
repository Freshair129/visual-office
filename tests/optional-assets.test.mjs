import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {fallbackOptionalImage,optionalAssetPlaceholder,watchOptionalAssetImages} from '../web/optional-assets.js';

test('app image failures replace missing logo and artwork with local neutral SVG placeholders',()=>{
 const dom=new JSDOM('<main><picture><source srcset="./assets/office-world/campus-mobile.png"><img data-optional-asset="image" data-optional-label="Campus preview" src="./assets/office-world/campus.png" alt="Campus"></picture><img data-optional-asset="logo" src="./assets/brand/mark.svg"></main>');
 const root=dom.window.document.querySelector('main'),stop=watchOptionalAssetImages(root);const [art,logo]=root.querySelectorAll('img');
 art.dispatchEvent(new dom.window.Event('error'));logo.dispatchEvent(new dom.window.Event('error'));
 assert.match(art.src,/^data:image\/svg\+xml,/);assert.match(decodeURIComponent(art.src.split(',')[1]),/Campus preview/);
 assert.equal(root.querySelector('source').hasAttribute('srcset'),false);
 assert.match(decodeURIComponent(logo.src.split(',')[1]),/>ZURI</);
 assert.equal(fallbackOptionalImage(art),false,'a placeholder failure does not recurse');
 assert.match(optionalAssetPlaceholder('Team','image'),/^data:image\/svg\+xml,/);
 stop();dom.window.close();
});
