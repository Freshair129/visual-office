// Presentation slots describe the existing floor, never create Agent identities.
export function sceneWorkspaceContext(object,floor,roster=[],access={}){
 const slot=/^role-([1-9]\d*)-(avatar|desk|chair)$/.exec(object?.id||'');
 const index=slot?Number(slot[1])-1:-1;
 const agent=index>=0&&index<(floor?.roles?.length||0)?roster[index]||null:null;
 const bound=!!(access.allowed&&access.kind!=='demo'&&agent?.sourceAgentId&&agent.connected&&!floor?.reserved);
 return{agent,roleIndex:agent?index:null,bound,floorLabel:floor?.label||'ชั้นนี้'};
}
