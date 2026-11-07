const views=new Set(['office','chat','work','results','knowledge','team','inbox']);
const aliases={jobs:'work',activity:'inbox'};
export function workspaceRoute(hash=''){
 const [raw,id]=hash.replace(/^#/,'').split('/');
 const view=aliases[raw]||raw;
 let detail=null;try{detail=id?decodeURIComponent(id):null;}catch{}
 return {view:views.has(view)?view:'office',id:detail};
}
export function workspaceHash(view,id){return '#'+(views.has(view)?view:'office')+(id?'/'+encodeURIComponent(id):'');}
