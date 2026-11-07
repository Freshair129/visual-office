import {mkdir,writeFile} from 'node:fs/promises';
import {officeBlueprints,blueprintSVG,applyOfficeBlueprint} from '../web/office-blueprints.js';
const target=new URL('../web/assets/office-blueprints/',import.meta.url);
await mkdir(target,{recursive:true});
for(const b of Object.values(officeBlueprints)){
  const room=applyOfficeBlueprint({schemaVersion:'office-room/v1',name:`${b.label} office`,background:'office',brief:'Metric simulation template; no Agent records.',objects:[]},b.id);
  await writeFile(new URL(`${b.id}.svg`,target),blueprintSVG(b.id,room)+'\n');
  await writeFile(new URL(`${b.id}.json`,target),JSON.stringify(room,null,2)+'\n');
}
console.log('Built 3 measured Office SVG blueprints and 3 room templates.');
