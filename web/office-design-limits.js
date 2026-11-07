// Explicit presentation profiles; scene data cannot opt itself into wider bounds.
export const LEGACY_COORDINATE_BOUNDS=Object.freeze({minX:0,maxX:100,minY:0,maxY:100});
export const TYCOON_COORDINATE_BOUNDS=Object.freeze({minX:-64,maxX:164,minY:-32,maxY:144});
export const TYCOON_BLUEPRINT_OPTIONS=Object.freeze({profile:'tycoon'});
const legacy=Object.freeze({maxWidth:16,maxDepth:10,maxPartitions:16,maxAreas:12,maxOffset:20,cornerBounds:Object.freeze({minX:2,maxX:98,minY:18,maxY:94})});
const tycoon=Object.freeze({maxWidth:24,maxDepth:16,maxPartitions:40,maxAreas:20,maxOffset:24,cornerBounds:TYCOON_COORDINATE_BOUNDS});
export function blueprintLimits(options={}){
  if(options.profile!==undefined&&!['legacy','tycoon'].includes(options.profile))throw Error('Unknown blueprint profile');
  return options.profile==='tycoon'?tycoon:legacy;
}
