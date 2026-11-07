import {domainFloors} from './domain-office.js';

// Local design coverage. This list grants no Business/domain access.
export const OFFICE_FLOORS=Object.freeze([
  Object.freeze({key:'lobby',level:0,label:'G · Lobby',domainKey:null}),
  ...domainFloors.map((d,i)=>Object.freeze({key:d.key,level:i+1,label:`${String(i+1).padStart(2,'0')} · ${d.label}`,domainKey:d.key})),
]);
export const OFFICE_FLOOR_KEYS=Object.freeze(OFFICE_FLOORS.map(f=>f.key));
export const isOfficeFloor=key=>OFFICE_FLOOR_KEYS.includes(key);
