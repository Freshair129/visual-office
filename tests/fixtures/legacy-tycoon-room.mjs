// Frozen 12 x 8 geometry for legacy saved-layout regressions, not runtime defaults.
import {readFileSync} from 'node:fs';
const rooms=JSON.parse(readFileSync(new URL('./legacy-tycoon-rooms.json',import.meta.url),'utf8'));
export const createLegacyTycoonRoom=floor=>structuredClone(rooms[floor]);
