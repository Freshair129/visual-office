import {OFFICE_FLOORS} from './office-floor-registry.js';
import {OFFICE_DEPARTMENTS} from './office-departments.js';
import {createTycoonRoom,validateTycoonRoom,TYCOON_KINDS} from './tycoon-state.js';
import {createTycoonNavigation,tycoonStructure,tycoonPlan,tycoonWorld} from './tycoon-blueprint.js';
import {blueprintLayout} from './office-blueprints.js';
import {WORLD_DESIGN_NAMESPACE,designId,canonicalJSON,sha256} from './office-world-identity.js';
import {officeBlueprints,roomAreaTypes} from './office-blueprint-state.js';
import {CUSTOM_CATEGORIES} from './custom-assets.js';
import {roomSurfaces,surfaceMaterials} from './room-surfaces.js';
import {TYCOON_BLUEPRINT_OPTIONS,TYCOON_COORDINATE_BOUNDS} from './office-design-limits.js';

export const HANDOFF_SCHEMA='zuri-office-design-handoff/v1';
export const HANDOFF_TYPES=['building','floor','scene','room','partition','opening','asset','assetRevision','placement','station','navigationRoute','exclusionZone','department','team','role','agentDesign','workflow','workflowStep','workflowHandoff'];
const TYPES=HANDOFF_TYPES;
// Explicit design allocations: array order and new furniture never reassign a role.
// A removed/unsupported station leaves that design slot unallocated.
const ROLE_DESKS={
 lobby:{host:null,intake:null,evidence:null,router:null},
 projects:{lead:'desk-1',planner:'desk-2',delivery:'desk-3',review:'desk-4'},
 customer:{crm:'customer-crm-desk',lifecycle:'customer-lifecycle-desk',care:'customer-care-desk',sales:'customer-sales-desk'},
 market:{analyst:'market-analyst-desk',research:'market-research-desk',insight:'market-insight-desk',review:'market-evidence-desk'},
 growth:{lead:'desk-1',content:'desk-2',performance:'desk-3',creative:'desk-4'},
 'line-oa':{lead:'line-experience-desk',design:'line-message-design-desk',ops:'line-channel-ops-desk',review:'line-conversation-qa-desk'},
 commerce:{lead:'commerce-order-desk',pricing:'commerce-pricing-desk',fulfilment:'commerce-fulfilment-desk',review:'commerce-exception-desk'},
 inventory:{lead:'inventory-position-desk',reserve:'inventory-reservation-desk',count:'inventory-stocktake-desk',quality:'inventory-data-quality-desk'},
 warehouse:{lead:'warehouse-coordination-desk',inbound:'warehouse-inbound-desk',outbound:'warehouse-outbound-desk',review:'warehouse-quality-desk'},
 procurement:{lead:'procurement-planner-desk',supplier:'procurement-supplier-desk',po:'procurement-po-desk',receipt:'procurement-receipt-desk'},
 assets:{lead:'assets-register-desk',receive:'assets-inspection-desk',audit:'assets-audit-desk',lifecycle:'assets-lifecycle-desk'},
 people:{lead:'people-service-desk',directory:'people-directory-desk',onboard:'people-onboarding-desk',review:'people-privacy-review-desk'},
 operations:{lead:'operations-lead-desk',schedule:'operations-schedule-desk',process:'operations-process-desk',quality:'operations-quality-desk'},
 knowledge:{lead:'knowledge-curator-desk',pipeline:'knowledge-pipeline-desk',research:'knowledge-research-desk',review:'knowledge-citation-review-desk'},
 platform:{lead:'platform-coordination-desk',integrate:'platform-integration-desk',access:'platform-access-desk',audit:'platform-audit-desk'},
};
const allocatedDesk=(floor,role,stations)=>{if(!Object.hasOwn(ROLE_DESKS[floor]||{},role))throw Error('Missing role allocation design: '+floor+'/'+role);const objectId=ROLE_DESKS[floor][role];return stations.find(s=>s.type==='desk'&&s.objectId===objectId);};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const clone=x=>JSON.parse(JSON.stringify(x));
const ref=(relation,targetId)=>({relation,targetId});
const identityCache=new Map();
const handoffId=async(type,...keys)=>{const name=canonicalJSON([type,...keys]);if(!identityCache.has(name)){if(identityCache.size>=20000)identityCache.delete(identityCache.keys().next().value);identityCache.set(name,designId(type,...keys));}return identityCache.get(name);};
const sceneDerivationCache=new Map();
// Derived geometry crosses V8/browser math implementations. Quantize derived
// coordinates only; preserve user snapshots and hash the actual serialized data.
const measuredJSON=value=>typeof value==='number'?Number(value.toFixed(8)):Array.isArray(value)?value.map(measuredJSON):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,measuredJSON(v)])):value;
const deriveScene=(room,hash)=>{let value=sceneDerivationCache.get(hash);if(value){sceneDerivationCache.delete(hash);sceneDerivationCache.set(hash,value);return value;}const plan=tycoonPlan(room),nav=createTycoonNavigation(room),navigation={...nav,stations:measuredJSON(nav.stations)},layout=measuredJSON(blueprintLayout(plan,TYCOON_BLUEPRINT_OPTIONS)),structure=measuredJSON(tycoonStructure(room));value={plan,navigation,layout,structure};if(sceneDerivationCache.size>=32)sceneDerivationCache.delete(sceneDerivationCache.keys().next().value);sceneDerivationCache.set(hash,value);return value;};
const edges={building:['building'],floor:['floor'],scene:['scene'],department:['department'],team:['team'],role:['role'],asset:['asset'],revision:['assetRevision'],placement:['placement'],seat:['placement'],station:['station'],workflow:['workflow'],next:['workflowStep'],entry:['workflowStep'],targetDepartment:['department'],avatar:['assetRevision']};
const text=(maxLength=500)=>({type:'string',minLength:1,maxLength,pattern:'\\S'});
const boundedTextArray=(maxItems=32,maxLength=500,minItems=1)=>({type:'array',minItems,maxItems,items:text(maxLength)});
const number=(minimum,maximum)=>({type:'number',minimum,maximum});
const integer=(minimum,maximum)=>({type:'integer',minimum,maximum});
const object=(required,properties)=>({type:'object',additionalProperties:false,required,properties});
const vector=(length,min=-100,max=100)=>({type:'array',minItems:length,maxItems:length,items:number(min,max)});
const uuidSchema={type:'string',pattern:UUID.source};
const pointSchema=object(['x','y'],{x:number(TYCOON_COORDINATE_BOUNDS.minX,TYCOON_COORDINATE_BOUNDS.maxX),y:number(TYCOON_COORDINATE_BOUNDS.minY,TYCOON_COORDINATE_BOUNDS.maxY)});
const worldPointSchema=object(['x','y','z'],{x:number(-100,100),y:number(-10,10),z:number(-100,100)});
const nullableWorldPoint={oneOf:[worldPointSchema,{type:'null'}]};
const worldStationSchema=object(['position','seat','seatRoot','footAnchor','headingRad','seatHeightM'],{position:worldPointSchema,seat:nullableWorldPoint,seatRoot:nullableWorldPoint,footAnchor:nullableWorldPoint,headingRad:number(-Math.PI*4,Math.PI*4),seatHeightM:{oneOf:[number(0,4),{type:'null'}]}});
const worldPoint=point=>{if(!point)return null;const value=tycoonWorld(point);return measuredJSON({x:value.x,y:value.y,z:value.z});};
const stationWorld=station=>({position:worldPoint(station.position),seat:worldPoint(station.seat),seatRoot:worldPoint(station.seatRoot),footAnchor:worldPoint(station.footAnchor),headingRad:station.heading,seatHeightM:Number.isFinite(station.seatHeight)?station.seatHeight:null});
const blueprintDoor=object(['wall','offset','width'],{wall:{enum:['rear','front','left','right']},offset:number(.2,24),width:number(1.2,3),open:{type:'boolean'}});
const blueprintWindow=object(['id','wall','offset','width','sill','top'],{id:{type:'string',minLength:1,maxLength:40,pattern:'^[a-zA-Z0-9_-]+$'},wall:{enum:['rear','front','left','right']},offset:number(.2,24),width:number(.6,3),sill:number(.3,1.8),top:number(.7,2.5)});
const partitionDoor=object(['offset','width'],{offset:number(.2,24),width:number(1.2,3),open:{type:'boolean'}});
const areaSchema=object(['id','type','name','x','z','width','depth'],{id:{type:'string',minLength:1,maxLength:40,pattern:'^[a-zA-Z0-9_-]+$'},type:{enum:Object.keys(roomAreaTypes)},name:text(60),x:number(0,24),z:number(0,16),width:number(.5,24),depth:number(.5,16)});
const partitionSchema=object(['id','axis','at','start','end'],{id:{type:'string',minLength:1,maxLength:40,pattern:'^[a-zA-Z0-9_-]+$'},axis:{enum:['x','z']},at:number(.3,24),start:number(0,24),end:number(1,24),door:partitionDoor});
const blueprintSchema=object(['version','base','width','depth','originX','originZ','door','windows'],{version:{const:1},base:{enum:Object.keys(officeBlueprints)},width:number(8,24),depth:number(6,16),originX:number(-20,10),originZ:number(-20,10),door:blueprintDoor,windows:{type:'array',maxItems:8,items:blueprintWindow},partitions:{type:'array',maxItems:40,items:partitionSchema},areas:{type:'array',maxItems:20,items:areaSchema}});
const textureSchema=object(['data','repeatX','repeatY','offsetX','offsetY','rotation','opacity'],{data:{type:'string',minLength:30,maxLength:180000,pattern:'^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$'},repeatX:number(.1,20),repeatY:number(.1,20),offsetX:number(-1,1),offsetY:number(-1,1),rotation:number(-180,180),opacity:number(0,1)});
const finishSchema={type:'object',additionalProperties:false,properties:{color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},material:{enum:surfaceMaterials.map(x=>x.id)},texture:{oneOf:[textureSchema,{type:'null'}]}}};
const customAssetSchema=object(['id','name','category','size','sourceSize','origin','interaction'],{id:{type:'string',pattern:'^[a-f0-9]{64}$'},name:text(60),category:{enum:CUSTOM_CATEGORIES},size:{type:'array',minItems:3,maxItems:3,items:number(.01,12)},sourceSize:{type:'array',minItems:3,maxItems:3,items:number(.000001,1000000)},origin:{type:'array',minItems:3,maxItems:3,items:number(-1000000,1000000)},interaction:{oneOf:[
 object(['mode'],{mode:{const:'none'}}),
 object(['mode','approach'],{mode:{const:'stand'},approach:vector(2,-12,12)}),
 object(['mode','approach','seat','height','heading'],{mode:{const:'seat'},approach:vector(2,-12,12),seat:vector(2,-12,12),height:number(.1,2),heading:number(-Math.PI*2,Math.PI*2)}),
]}});
const roomObjectSchema=object(['id','kind','x','y','z','rotation','scale','intent'],{id:{type:'string',minLength:1,maxLength:64,pattern:'^[a-z][a-z0-9-]*$'},kind:{enum:TYCOON_KINDS.filter(k=>k!=='actor')},x:number(-24,24),y:number(0,4),z:number(-24,24),rotation:number(-Math.PI*2,Math.PI*2),scale:number(.25,3),intent:{enum:['none','enter','projects','floors','connect','work','marketing-ask','meeting','artifacts','decor']},color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},groupId:{type:'string',pattern:'^group-[a-z0-9-]{1,48}$'},finish:finishSchema,asset:customAssetSchema});
const structuralObjectSchema=object(['id','kind','y','size'],{id:{type:'string',minLength:1,maxLength:160,pattern:'^[a-zA-Z0-9:_-]+$'},kind:{enum:['floor','wall','window','door-frame','door']},x:number(-100,100),y:number(-10,20),z:number(-100,100),size:{type:'array',minItems:3,maxItems:3,items:number(.001,100)},rotation:number(-Math.PI*2,Math.PI*2),intent:{type:'string',maxLength:80}});
const navigationStation=object(['objectId','approach'],{objectId:{type:'string',minLength:1,maxLength:64,pattern:'^[a-z][a-z0-9-]*$'},approach:pointSchema,seat:pointSchema});
const navigationSchema=object(['version','routes','forbidden','stations'],{version:{const:1},routes:{type:'array',maxItems:16,items:object(['id','points'],{id:{type:'string',minLength:1,maxLength:60,pattern:'^[a-zA-Z0-9_-]+$'},points:{type:'array',minItems:2,maxItems:32,items:pointSchema}})},forbidden:{type:'array',maxItems:16,items:object(['id','points'],{id:{type:'string',minLength:1,maxLength:60,pattern:'^[a-zA-Z0-9_-]+$'},points:{type:'array',minItems:3,maxItems:24,items:pointSchema}})},stations:{type:'array',maxItems:40,items:navigationStation}});
const roomSnapshotSchema=object(['schemaVersion','width','depth','objects'],{schemaVersion:{const:'office-tycoon/v1'},width:number(6,24),depth:number(6,20),objects:{type:'array',maxItems:80,items:roomObjectSchema},blueprintPlan:blueprintSchema,navigation:navigationSchema,layers:{type:'array',maxItems:80,uniqueItems:true,items:{type:'string',minLength:1,maxLength:64}},finishes:{type:'object',additionalProperties:finishSchema,properties:Object.fromEntries(roomSurfaces.map(s=>[s.id,finishSchema]))}});
const doorGeometry=object(['id','label','open','start','end','height','widthMeters'],{id:{type:'string',minLength:1,maxLength:64,pattern:'^[a-zA-Z0-9:_-]+$'},label:text(80),open:{type:'boolean'},start:vector(2,-64,164),end:vector(2,-64,164),height:number(.1,5),widthMeters:number(1.2,3)});
const windowGeometry=blueprintWindow;
const dataSchemas={
 building:{units:{const:'metres'}},
 floor:{level:integer(0,14),domainKey:{type:['string','null'],enum:[null,...OFFICE_FLOORS.filter(f=>f.domainKey).map(f=>f.domainKey)]}},
 scene:{snapshot:{$ref:'#/$defs/tycoonRoom'},snapshotHash:{type:'string',pattern:'^[a-f0-9]{64}$'}},
 room:{area:areaSchema},partition:{geometry:partitionSchema},opening:{geometry:{oneOf:[doorGeometry,windowGeometry]}},
 asset:{kind:{enum:TYCOON_KINDS}},assetRevision:{sha256:{type:'string',pattern:'^[a-f0-9]{64}$'},bytes:integer(1,20_000_000),uri:{type:'string',pattern:'^assets/[a-f0-9]{64}\\.glb$'},format:{const:'glb'}},
 placement:{localId:{type:'string',minLength:1,maxLength:160,pattern:'^[a-zA-Z][a-zA-Z0-9:_-]*$'},object:{oneOf:[{$ref:'#/$defs/structuralObject'},{$ref:'#/$defs/roomObject'}]},structural:{type:'boolean'}},
 navigationRoute:{geometry:navigationSchema.properties.routes.items,worldPoints:{type:'array',minItems:2,maxItems:32,items:worldPointSchema}},
 exclusionZone:{geometry:navigationSchema.properties.forbidden.items,worldPoints:{type:'array',minItems:3,maxItems:24,items:worldPointSchema}},
 station:{localId:{type:'string',minLength:1,maxLength:80,pattern:'^[a-z][a-z0-9:-]*$'},interaction:object(['id','objectId','type','position','heading'],{id:{type:'string',minLength:1,maxLength:80,pattern:'^station:[a-z][a-z0-9-]*$'},objectId:{type:'string',minLength:1,maxLength:64,pattern:'^[a-z][a-z0-9-]*$'},type:{enum:['desk','sofa','water']},position:pointSchema,seat:pointSchema,seatRoot:pointSchema,seatObjectId:{type:'string',minLength:1,maxLength:64,pattern:'^[a-z][a-z0-9-]*$'},seatHeight:number(0,4),footAnchor:pointSchema,heading:number(-Math.PI*4,Math.PI*4)}),world:worldStationSchema},
 department:{domainKey:{type:['string','null'],enum:[null,...OFFICE_FLOORS.filter(f=>f.domainKey).map(f=>f.domainKey)]},purpose:text(1000),sourceRefs:boundedTextArray(40,512)},team:{purpose:text(1000)},
 role:{responsibilities:boundedTextArray(24,500),inputs:boundedTextArray(24,500),outputs:boundedTextArray(24,500),proposedCapabilities:boundedTextArray(24,500),requiresHumanReview:boundedTextArray(24,500),sourceCatalogCode:{type:['string','null'],maxLength:64,pattern:'^[a-z0-9][a-z0-9-]{0,63}$'}},
 agentDesign:{identityKind:{const:'agent-design-slot'},agentInstanceId:{type:'null'},agentVersionId:{type:'null'}},
 workflow:{trigger:text(1000),inputs:boundedTextArray(24,500),outputs:boundedTextArray(24,500)},
 workflowStep:{action:text(2000),output:text(1000),reviewPolicy:text(2000),onFailure:text(2000)},workflowHandoff:{artifact:text(1000),condition:text(2000)},
};
export const HANDOFF_DATA_SCHEMAS=dataSchemas;
export const HANDOFF_DATA_KEYS=Object.fromEntries(Object.entries(dataSchemas).map(([type,fields])=>[type,Object.keys(fields)]));
const dataKeys=HANDOFF_DATA_KEYS;
const requiredRefs={building:[],floor:['building','department'],scene:['floor'],room:['floor'],partition:['floor'],opening:['floor'],asset:[],assetRevision:['asset'],placement:['floor','scene','revision'],station:['floor','placement'],navigationRoute:['floor'],exclusionZone:['floor'],department:[],team:['department','floor'],role:['team'],agentDesign:['role','team','floor','avatar'],workflow:['department','floor','entry'],workflowStep:['workflow','role'],workflowHandoff:['workflow','targetDepartment']};
const optionalRefs={station:['seat'],agentDesign:['station'],workflowStep:['next']};

roomObjectSchema.allOf=[
 {if:{required:['kind'],properties:{kind:{const:'custom'}}},then:{required:['asset']}},
 {if:{required:['kind'],properties:{kind:{enum:TYCOON_KINDS.filter(k=>k!=='actor'&&k!=='custom')}}},then:{not:{required:['asset']}}},
];
roomSnapshotSchema.properties.finishes.additionalProperties=false;

export async function buildOfficeHandoffSchema(){
  const relationNames=['building','floor','scene','department','team','role','asset','revision','placement','seat','station','workflow','next','entry','targetDepartment','avatar'];
  const entity={type:'object',additionalProperties:false,required:['id','type','key','label','data','refs'],properties:{id:uuidSchema,type:{enum:TYPES},key:{type:'string',minLength:1,maxLength:256,pattern:'^[a-zA-Z0-9][a-zA-Z0-9/_:-]*$'},label:text(160),data:{type:'object'},refs:{type:'array',maxItems:256,items:object(['relation','targetId'],{relation:{enum:relationNames},targetId:uuidSchema})}},allOf:TYPES.map(type=>({if:{required:['type'],properties:{type:{const:type}}},then:{properties:{data:object(dataKeys[type],dataSchemas[type])}}}))};
  const packageId=await handoffId('package','office-world');
  return {$schema:'https://json-schema.org/draft/2020-12/schema',$id:'urn:zuri-office:design-handoff:v1',title:'Visual Office design registration proposal',type:'object',additionalProperties:false,required:['schemaVersion','namespace','packageId','purpose','bindingContext','entities','contentHash'],properties:{schemaVersion:{const:HANDOFF_SCHEMA},namespace:{const:WORLD_DESIGN_NAMESPACE},packageId:{const:packageId},purpose:{const:'design-registration-proposal'},bindingContext:object(['tenantId','businessId','workspaceId'],{tenantId:{type:'null'},businessId:{type:'null'},workspaceId:{type:'null'}}),contentHash:{type:'string',pattern:'^[a-f0-9]{64}$'},entities:{type:'array',minItems:1,maxItems:20000,items:{$ref:'#/$defs/entity'}}},$defs:{entity,tycoonRoom:roomSnapshotSchema,roomObject:roomObjectSchema,structuralObject:structuralObjectSchema},$comment:'JSON Schema checks bounded field shapes and types. validateOfficeHandoff additionally checks derived UUIDs, source-catalog completeness, ownership, scene-derived graph equality, workflow reachability, snapshot hashes, and asset revision identity; verify bundled GLB bytes separately.'};
}

function checkSchema(value,schema,root,path='value'){
 if(schema===true)return;if(schema===false)throw Error(`${path} is not allowed`);
 if(schema.$ref){if(!schema.$ref.startsWith('#/$defs/'))throw Error(`Unsupported schema reference at ${path}`);const target=root.$defs[schema.$ref.slice('#/$defs/'.length)];if(!target)throw Error(`Unknown schema reference at ${path}`);checkSchema(value,target,root,path);}
 if(schema.type){const types=Array.isArray(schema.type)?schema.type:[schema.type],ok=types.some(type=>type==='null'?value===null:type==='array'?Array.isArray(value):type==='object'?!!value&&typeof value==='object'&&!Array.isArray(value):type==='integer'?Number.isInteger(value):type==='number'?typeof value==='number'&&Number.isFinite(value):type==='string'?typeof value==='string':type==='boolean'?typeof value==='boolean':false);if(!ok)throw Error(`${path} has an invalid type`);}
 if(Object.hasOwn(schema,'const')&&canonicalJSON(value)!==canonicalJSON(schema.const))throw Error(`${path} has an invalid constant`);
 if(schema.enum&&!schema.enum.some(item=>canonicalJSON(item)===canonicalJSON(value)))throw Error(`${path} is outside the supported values`);
 for(const branch of schema.allOf||[])checkSchema(value,branch,root,path);
 if(schema.anyOf&&!schema.anyOf.some(branch=>schemaMatches(value,branch,root)))throw Error(`${path} does not match an allowed shape`);
 if(schema.oneOf&&schema.oneOf.filter(branch=>schemaMatches(value,branch,root)).length!==1)throw Error(`${path} must match exactly one allowed shape`);
 if(schema.not&&schemaMatches(value,schema.not,root))throw Error(`${path} matches a forbidden shape`);
 if(schema.if){if(schemaMatches(value,schema.if,root)&&schema.then)checkSchema(value,schema.then,root,path);else if(!schemaMatches(value,schema.if,root)&&schema.else)checkSchema(value,schema.else,root,path);}
 if(typeof value==='string'){if(value.length<(schema.minLength??0)||value.length>(schema.maxLength??Infinity)||schema.pattern&&!new RegExp(schema.pattern).test(value))throw Error(`${path} has an invalid string value`);}
 if(typeof value==='number'){if(!Number.isFinite(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)||schema.exclusiveMinimum!==undefined&&value<=schema.exclusiveMinimum||schema.exclusiveMaximum!==undefined&&value>=schema.exclusiveMaximum)throw Error(`${path} is outside its numeric bounds`);}
 if(Array.isArray(value)){if(value.length<(schema.minItems??0)||value.length>(schema.maxItems??Infinity))throw Error(`${path} has an invalid item count`);if(schema.uniqueItems&&new Set(value.map(canonicalJSON)).size!==value.length)throw Error(`${path} has duplicate items`);if(schema.items)for(const [i,item]of value.entries())checkSchema(item,schema.items,root,`${path}[${i}]`);}
 if(value&&typeof value==='object'&&!Array.isArray(value)){for(const name of schema.required||[])if(!Object.hasOwn(value,name))throw Error(`${path}.${name} is required`);const props=schema.properties||{};for(const [key,child]of Object.entries(value)){if(Object.hasOwn(props,key))checkSchema(child,props[key],root,`${path}.${key}`);else if(schema.additionalProperties===false)throw Error(`${path}.${key} is not allowed`);else if(schema.additionalProperties&&typeof schema.additionalProperties==='object')checkSchema(child,schema.additionalProperties,root,`${path}.${key}`);}}
}
function schemaMatches(value,schema,root){try{checkSchema(value,schema,root);return true;}catch{return false;}}

export async function buildOfficeHandoff({rooms={},assets}={}){
  if(!assets||typeof assets!=='object')throw Error('Measured asset descriptors required');
  const entities=[],ids=new Map();
  async function add(type,key,label,data={},refs=[]){const id=await handoffId(type,key);if(ids.has(id))throw Error('Duplicate semantic identity: '+type+'/'+key);const e={id,type,key,label,data:clone(data),refs};ids.set(id,e);entities.push(e);return id;}
  const building=await add('building','main','Zuri Office design',{units:'metres'}),assetIds=new Map(),revisionIds=new Map();
  const useAsset=async(kind,custom)=>{
    const key=custom?'custom/'+custom.id:kind;if(revisionIds.has(key))return revisionIds.get(key);
    const a=assets[key];if(!a||!a.sha256||!Number.isSafeInteger(a.bytes))throw Error('Missing verified asset: '+key);
    const assetId=await add('asset',key,custom?.name||kind,{kind});assetIds.set(key,assetId);
    const revision=await add('assetRevision',key+'/'+a.sha256,`${custom?.name||kind} revision`,{sha256:a.sha256,bytes:a.bytes,uri:a.uri,format:'glb'},[ref('asset',assetId)]);revisionIds.set(key,revision);return revision;
  };
  const avatar=await useAsset('actor');
  for(const floor of OFFICE_FLOORS){
    const d=OFFICE_DEPARTMENTS.find(d=>d.key===floor.key);if(!d)throw Error('Missing department design: '+floor.key);
    const room=validateTycoonRoom(rooms[floor.key]||createTycoonRoom(floor.key)),snapshotHash=await sha256(canonicalJSON(room)),{plan,navigation:nav,layout,structure}=deriveScene(room,snapshotHash),department=await add('department',floor.key,d.label,{domainKey:floor.domainKey,purpose:d.purpose,sourceRefs:d.sourceRefs}),floorId=await add('floor',floor.key,floor.label,{level:floor.level,domainKey:floor.domainKey},[ref('building',building),ref('department',department)]),sceneId=await add('scene',floor.key+'/layout',floor.label+' layout',{snapshot:room,snapshotHash},[ref('floor',floorId)]);
    for(const area of plan.areas||[])await add('room',floor.key+'/'+area.id,area.name,{area},[ref('floor',floorId)]);
    for(const p of plan.partitions||[])await add('partition',floor.key+'/'+p.id,p.id,{geometry:p},[ref('floor',floorId)]);
    for(const door of layout.doors)await add('opening',floor.key+'/door/'+door.id,door.label,{geometry:door},[ref('floor',floorId)]);
    for(const window of plan.windows||[])await add('opening',floor.key+'/window/'+window.id,window.id,{geometry:window},[ref('floor',floorId)]);
    for(const [type,items]of [['navigationRoute',room.navigation?.routes||[]],['exclusionZone',room.navigation?.forbidden||[]]])for(const geometry of items)await add(type,floor.key+'/'+geometry.id,geometry.id,{geometry,worldPoints:geometry.points.map(worldPoint)},[ref('floor',floorId)]);
    const placements=new Map(),stations=[];
    for(const [structural,objects]of [[true,structure],[false,room.objects]])for(const object of objects){
      const revision=await useAsset(object.kind,object.asset),key=floor.key+'/'+(structural?'structure/':'furniture/')+object.id;
      const placement=await add('placement',key,object.asset?.name||object.id,{localId:object.id,object,structural},[ref('floor',floorId),ref('scene',sceneId),ref('revision',revision)]);if(!structural)placements.set(object.id,placement);
    }
    for(const s of nav.stations){const relations=[ref('floor',floorId),ref('placement',placements.get(s.objectId))];if(s.seatObjectId)relations.push(ref('seat',placements.get(s.seatObjectId)));const station=await add('station',floor.key+'/'+s.id,s.id,{localId:s.id,interaction:s,world:stationWorld(s)},relations);stations.push({id:station,objectId:s.objectId,type:s.type});}
    const team=await add('team',floor.key+'/team',d.label+' team',{purpose:d.purpose},[ref('department',department),ref('floor',floorId)]),roleIds=new Map();
    for(const role of d.roles){
      const roleId=await add('role',floor.key+'/'+role.key,role.title,{responsibilities:role.responsibilities,inputs:role.inputs,outputs:role.outputs,proposedCapabilities:role.proposedCapabilities,requiresHumanReview:role.requiresHumanReview,sourceCatalogCode:role.sourceCatalogCode??null},[ref('team',team)]);roleIds.set(role.key,roleId);
      const station=allocatedDesk(floor.key,role.key,stations),relations=[ref('role',roleId),ref('team',team),ref('floor',floorId),ref('avatar',avatar)];if(station)relations.push(ref('station',station.id));
      await add('agentDesign',floor.key+'/'+role.key+'/slot-1',role.title+' · unregistered design',{identityKind:'agent-design-slot',agentInstanceId:null,agentVersionId:null},relations);
    }
    for(const workflow of d.workflows){
      const key=floor.key+'/'+workflow.key,workflowId=await handoffId('workflow',key),stepIds=new Map(await Promise.all(workflow.steps.map(async s=>[s.key,await handoffId('workflowStep',key+'/'+s.key)])));
      await add('workflow',key,workflow.label,{trigger:workflow.trigger,inputs:workflow.inputs,outputs:workflow.outputs},[ref('department',department),ref('floor',floorId),ref('entry',stepIds.get(workflow.steps[0].key))]);
      for(const step of workflow.steps)await add('workflowStep',key+'/'+step.key,step.label,{action:step.action,output:step.output,reviewPolicy:step.reviewPolicy,onFailure:step.onFailure},[ref('workflow',workflowId),ref('role',roleIds.get(step.roleKey)),...(step.next||[]).map(n=>ref('next',stepIds.get(n)))]);
      for(const [i,h]of (workflow.handoffs||[]).entries())await add('workflowHandoff',key+'/'+(h.key||h.toDepartmentKey),h.artifact,{artifact:h.artifact,condition:h.condition},[ref('workflow',workflowId),ref('targetDepartment',await handoffId('department',h.toDepartmentKey))]);
    }
  }
  entities.sort((a,b)=>a.id.localeCompare(b.id));
  const body={schemaVersion:HANDOFF_SCHEMA,namespace:WORLD_DESIGN_NAMESPACE,packageId:await handoffId('package','office-world'),purpose:'design-registration-proposal',bindingContext:{tenantId:null,businessId:null,workspaceId:null},entities};
  const manifest={...body,contentHash:await sha256(canonicalJSON(body))};await validateOfficeHandoff(manifest);return manifest;
}

export async function validateOfficeHandoff(value){
  const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(v,k)))throw Error('Invalid handoff fields');};
  const schema=await buildOfficeHandoffSchema();
  exact(value,['schemaVersion','namespace','packageId','purpose','bindingContext','entities','contentHash']);
  if(value.schemaVersion!==HANDOFF_SCHEMA||value.namespace!==WORLD_DESIGN_NAMESPACE||value.purpose!=='design-registration-proposal'||value.packageId!==await handoffId('package','office-world'))throw Error('Unsupported design handoff package identity');
  exact(value.bindingContext,['tenantId','businessId','workspaceId']);if(Object.values(value.bindingContext).some(v=>v!==null))throw Error('Registration context must be resolved by Zuri');
  if(!Array.isArray(value.entities)||value.entities.length>20000||new TextEncoder().encode(JSON.stringify(value)).length>20_000_000)throw Error('Handoff size limit');
  const {contentHash,...body}=value;if(contentHash!==await sha256(canonicalJSON(body)))throw Error('Content hash mismatch');
  const byId=new Map(),semantic=new Set(),validatedScenes=new Map();
  for(const e of value.entities){
    exact(e,['id','type','key','label','data','refs']);if(!UUID.test(e.id)||!TYPES.includes(e.type)||typeof e.key!=='string'||!e.key||typeof e.label!=='string'||!e.label||byId.has(e.id)||semantic.has(e.type+'/'+e.key))throw Error('Duplicate or invalid entity identity');
    if(e.key.length>256||!/^[a-zA-Z0-9][a-zA-Z0-9/_:-]*$/.test(e.key)||e.label.length>160||!e.label.trim())throw Error('Entity key or label exceeds its schema bounds');
    if(e.id!==await handoffId(e.type,e.key))throw Error('Identity differs from immutable semantic key');exact(e.data,dataKeys[e.type]);
    if(['building','floor','asset','assetRevision','department','team','role','agentDesign','workflow','workflowStep','workflowHandoff'].includes(e.type))checkSchema(e.data,object(dataKeys[e.type],dataSchemas[e.type]),schema,`${e.type}/${e.key}.data`);
    if(!Array.isArray(e.refs)||e.refs.length>256)throw Error('Invalid references');
    if(e.type==='assetRevision'&&(!/^[0-9a-f]{64}$/.test(e.data.sha256)||!Number.isSafeInteger(e.data.bytes)||e.data.bytes<=0||e.data.format!=='glb'||e.data.uri!==`assets/${e.data.sha256}.glb`))throw Error('Unverified asset revision');
    if(e.type==='scene'){const room=validateTycoonRoom(e.data.snapshot);if(e.data.snapshotHash!==await sha256(canonicalJSON(room)))throw Error('Scene snapshot hash mismatch');validatedScenes.set(e.id,room);}
    if(e.type==='agentDesign'&&(e.data.identityKind!=='agent-design-slot'||e.data.agentInstanceId!==null||e.data.agentVersionId!==null))throw Error('Design cannot claim registered Agent identity');
    byId.set(e.id,e);semantic.add(e.type+'/'+e.key);
  }
  const relation=(e,name)=>e.refs.filter(r=>r.relation===name).map(r=>byId.get(r.targetId));
  for(const e of value.entities){
    const seen=new Set();for(const r of e.refs){exact(r,['relation','targetId']);if(![...(requiredRefs[e.type]||[]),...(optionalRefs[e.type]||[])].includes(r.relation)||!edges[r.relation]?.includes(byId.get(r.targetId)?.type)||seen.has(r.relation+'/'+r.targetId))throw Error('Dangling, mistyped or duplicate relation');seen.add(r.relation+'/'+r.targetId);}
    for(const name of requiredRefs[e.type]||[])if(relation(e,name).length!==1)throw Error('Missing/ambiguous '+name+' on '+e.type);
    for(const name of optionalRefs[e.type]||[])if(name!=='next'&&relation(e,name).length>1)throw Error('Ambiguous optional relation');
    if(e.type==='floor'||e.type==='department'){const f=OFFICE_FLOORS.find(f=>f.key===e.key);if(!f||e.data.domainKey!==f.domainKey)throw Error('Unknown domain mapping');if(e.type==='floor'&&(e.data.level!==f.level||relation(e,'department')[0]?.key!==f.key))throw Error('Floor department mismatch');}
    if(e.type==='team'&&relation(relation(e,'floor')[0],'department')[0]?.id!==relation(e,'department')[0]?.id)throw Error('Team department/floor mismatch');
    if(e.type==='placement'&&relation(relation(e,'scene')[0],'floor')[0]?.id!==relation(e,'floor')[0]?.id)throw Error('Placement scene/floor mismatch');
    if(e.type==='station'){const f=relation(e,'floor')[0];for(const p of [...relation(e,'placement'),...relation(e,'seat')])if(relation(p,'floor')[0]?.id!==f.id)throw Error('Station crosses floors');}
    if(e.type==='agentDesign'){const team=relation(e,'team')[0];if(relation(relation(e,'role')[0],'team')[0]?.id!==team.id||relation(team,'floor')[0]?.id!==relation(e,'floor')[0]?.id)throw Error('Agent design team/floor mismatch');for(const s of relation(e,'station'))if(relation(s,'floor')[0]?.id!==relation(e,'floor')[0]?.id||s.data.interaction.type!=='desk')throw Error('Agent station must be a real desk on the same floor');}
    if(e.type==='workflowStep'){const w=relation(e,'workflow')[0],role=relation(e,'role')[0],team=relation(role,'team')[0];if(relation(team,'department')[0]?.id!==relation(w,'department')[0]?.id)throw Error('Workflow role crosses departments');for(const n of relation(e,'next'))if(relation(n,'workflow')[0]?.id!==w.id)throw Error('Workflow step crosses workflows');}
    if(e.type==='workflow'){const department=relation(e,'department')[0],floorDepartment=relation(relation(e,'floor')[0],'department')[0];if(!department||floorDepartment?.id!==department.id)throw Error('Workflow floor department mismatch');}
    if(e.type==='assetRevision'){const asset=relation(e,'asset')[0];if(!asset||e.key!==`${asset.key}/${e.data.sha256}`)throw Error('Asset revision key must derive from logical asset key and content hash');}
    if(e.type==='workflow'){
      const steps=value.entities.filter(s=>s.type==='workflowStep'&&relation(s,'workflow')[0]?.id===e.id),visited=new Set(),queue=relation(e,'entry');
      while(queue.length){const s=queue.pop();if(visited.has(s.id))continue;if(relation(s,'workflow')[0]?.id!==e.id)throw Error('Invalid workflow entry');visited.add(s.id);queue.push(...relation(s,'next'));}
      if(steps.some(s=>!visited.has(s.id))||!steps.some(s=>relation(s,'next').length===0))throw Error('Unreachable steps or missing terminal step');
      const terminating=new Set(steps.filter(s=>relation(s,'next').length===0).map(s=>s.id));let changed=true;while(changed){changed=false;for(const s of steps)if(!terminating.has(s.id)&&relation(s,'next').some(n=>terminating.has(n.id))){terminating.add(s.id);changed=true;}}if(steps.some(s=>!terminating.has(s.id)))throw Error('Workflow has no path to terminal');
    }
  }
  const list=type=>value.entities.filter(e=>e.type===type),byTypeKey=new Map(value.entities.map(e=>[e.type+'/'+e.key,e])),revisionsByAsset=new Map();
  for(const revision of list('assetRevision')){const assetId=relation(revision,'asset')[0]?.id;if(!revisionsByAsset.has(assetId))revisionsByAsset.set(assetId,[]);revisionsByAsset.get(assetId).push(revision);}
  const requireEntity=(type,key,label,data,relations)=>{
    const e=byTypeKey.get(type+'/'+key);if(!e||e.label!==label||canonicalJSON(e.data)!==canonicalJSON(data))throw Error(`Incomplete or changed ${type} design: ${key}`);
    const expected=relations.map(([name,id])=>({relation:name,targetId:id})).sort((a,b)=>a.relation.localeCompare(b.relation)||a.targetId.localeCompare(b.targetId));
    const actual=e.refs.map(({relation,targetId})=>({relation,targetId})).sort((a,b)=>a.relation.localeCompare(b.relation)||a.targetId.localeCompare(b.targetId));
    if(canonicalJSON(actual)!==canonicalJSON(expected))throw Error(`Invalid ${type} ownership references: ${key}`);return e;
  };
  const requireSet=(type,expectedKeys)=>{const actual=list(type).map(e=>e.key).sort(),expected=[...expectedKeys].sort();if(canonicalJSON(actual)!==canonicalJSON(expected))throw Error(`Incomplete or unexpected ${type} coverage`);};
  if(list('building').length!==1||list('floor').length!==OFFICE_FLOORS.length||OFFICE_FLOORS.some(f=>!semantic.has('floor/'+f.key)))throw Error('Incomplete building/floor coverage');
  const building=requireEntity('building','main','Zuri Office design',{units:'metres'},[]);
  const expectedKeys=Object.fromEntries(TYPES.map(type=>[type,[]]));expectedKeys.building.push('main');
  const expectedAssets=new Map([['actor',{kind:'actor',label:'actor'}]]);
  for(const floorInfo of OFFICE_FLOORS){
    const d=OFFICE_DEPARTMENTS.find(item=>item.key===floorInfo.key);if(!d)throw Error('Missing department design catalog entry: '+floorInfo.key);
    expectedKeys.floor.push(floorInfo.key);expectedKeys.department.push(floorInfo.key);expectedKeys.team.push(`${floorInfo.key}/team`);
    const department=requireEntity('department',floorInfo.key,d.label,{domainKey:floorInfo.domainKey,purpose:d.purpose,sourceRefs:d.sourceRefs},[]);
    const floor=requireEntity('floor',floorInfo.key,floorInfo.label,{level:floorInfo.level,domainKey:floorInfo.domainKey},[['building',building.id],['department',department.id]]);
    const team=requireEntity('team',`${floorInfo.key}/team`,`${d.label} team`,{purpose:d.purpose},[['department',department.id],['floor',floor.id]]);
    const roleIds=new Map();
    for(const role of d.roles){
      const roleKey=`${floorInfo.key}/${role.key}`;expectedKeys.role.push(roleKey);expectedKeys.agentDesign.push(`${roleKey}/slot-1`);
      const roleEntity=requireEntity('role',roleKey,role.title,{responsibilities:role.responsibilities,inputs:role.inputs,outputs:role.outputs,proposedCapabilities:role.proposedCapabilities,requiresHumanReview:role.requiresHumanReview,sourceCatalogCode:role.sourceCatalogCode??null},[['team',team.id]]);roleIds.set(role.key,roleEntity.id);
    }
    const sceneKey=`${floorInfo.key}/layout`,scene=byTypeKey.get('scene/'+sceneKey);if(!scene)throw Error('Missing floor scene: '+sceneKey);
    const room=validatedScenes.get(scene.id);if(!room)throw Error('Scene snapshot was not validated');
    const {plan,navigation:nav,layout,structure}=deriveScene(room,scene.data.snapshotHash);
    expectedKeys.scene.push(sceneKey);requireEntity('scene',sceneKey,floorInfo.label+' layout',{snapshot:room,snapshotHash:scene.data.snapshotHash},[['floor',floor.id]]);
    const children={room:[],partition:[],opening:[],navigationRoute:[],exclusionZone:[]};
    for(const [type,items]of [['navigationRoute',room.navigation?.routes||[]],['exclusionZone',room.navigation?.forbidden||[]]])for(const geometry of items){const key=floorInfo.key+'/'+geometry.id;expectedKeys[type].push(key);children[type].push(key);requireEntity(type,key,geometry.id,{geometry,worldPoints:geometry.points.map(worldPoint)},[['floor',floor.id]]);}
    for(const area of plan.areas||[]){const key=`${floorInfo.key}/${area.id}`;expectedKeys.room.push(key);children.room.push(key);requireEntity('room',key,area.name,{area},[['floor',floor.id]]);}
    for(const partition of plan.partitions||[]){const key=`${floorInfo.key}/${partition.id}`;expectedKeys.partition.push(key);children.partition.push(key);requireEntity('partition',key,partition.id,{geometry:partition},[['floor',floor.id]]);}
    const openings=[...layout.doors.map(door=>({key:`${floorInfo.key}/door/${door.id}`,label:door.label,geometry:door})),...(plan.windows||[]).map(window=>({key:`${floorInfo.key}/window/${window.id}`,label:window.id,geometry:window}))];
    for(const opening of openings){expectedKeys.opening.push(opening.key);children.opening.push(opening.key);requireEntity('opening',opening.key,opening.label,{geometry:opening.geometry},[['floor',floor.id]]);}
    for(const [type,keys]of Object.entries(children)){const actual=list(type).filter(e=>relation(e,'floor')[0]?.id===floor.id).map(e=>e.key).sort();if(canonicalJSON(actual)!==canonicalJSON([...keys].sort()))throw Error(`Scene snapshot ${type} graph differs from floor plan`);}
    const avatarAsset=byTypeKey.get('asset/actor'),avatarRevision=avatarAsset&&revisionsByAsset.get(avatarAsset.id)?.[0];if(!avatarAsset||!avatarRevision)throw Error('Missing shared design avatar revision');
    for(const role of d.roles){
      const slotKey=`${floorInfo.key}/${role.key}/slot-1`,slotStation=allocatedDesk(floorInfo.key,role.key,nav.stations),refs=[['role',roleIds.get(role.key)],['team',team.id],['floor',floor.id],['avatar',avatarRevision.id]];
      if(slotStation){const stationEntity=byTypeKey.get(`station/${floorInfo.key}/${slotStation.id}`);if(!stationEntity)throw Error('Missing allocated role desk station: '+slotStation.id);refs.push(['station',stationEntity.id]);}
      requireEntity('agentDesign',slotKey,role.title+' · unregistered design',{identityKind:'agent-design-slot',agentInstanceId:null,agentVersionId:null},refs);
    }
    for(const station of nav.stations){
      const placement=byTypeKey.get(`placement/${floorInfo.key}/furniture/${station.objectId}`),seat=station.seatObjectId?byTypeKey.get(`placement/${floorInfo.key}/furniture/${station.seatObjectId}`):null;
      if(!placement||station.seatObjectId&&!seat)throw Error('Station has no real scene placement');
      const key=`${floorInfo.key}/${station.id}`;expectedKeys.station.push(key);
      requireEntity('station',key,station.id,{localId:station.id,interaction:station,world:stationWorld(station)},[['floor',floor.id],['placement',placement.id],...(seat?[['seat',seat.id]]:[])]);
    }
    const placements=[...structure.map(object=>({object,structural:true})),...room.objects.map(object=>({object,structural:false}))];
    for(const item of placements){
      const object=item.object,key=`${floorInfo.key}/${item.structural?'structure/':'furniture/'}${object.id}`,assetKey=object.asset?'custom/'+object.asset.id:object.kind;
      expectedKeys.placement.push(key);if(!expectedAssets.has(assetKey))expectedAssets.set(assetKey,{kind:object.kind,label:object.asset?.name||object.kind});
      const asset=byTypeKey.get('asset/'+assetKey),revision=asset&&revisionsByAsset.get(asset.id)?.[0];
      if(!asset||!revision)throw Error('Placement references a missing logical asset revision: '+assetKey);
      requireEntity('placement',key,object.asset?.name||object.id,{localId:object.id,object,structural:item.structural},[['floor',floor.id],['scene',scene.id],['revision',revision.id]]);
    }
    for(const workflow of d.workflows){
      const workflowKey=`${floorInfo.key}/${workflow.key}`;expectedKeys.workflow.push(workflowKey);
      const stepIds=new Map();for(const step of workflow.steps)stepIds.set(step.key,await handoffId('workflowStep',workflowKey+'/'+step.key));
      const workflowId=await handoffId('workflow',workflowKey),workflowEntity=requireEntity('workflow',workflowKey,workflow.label,{trigger:workflow.trigger,inputs:workflow.inputs,outputs:workflow.outputs},[['department',department.id],['floor',floor.id],['entry',stepIds.get(workflow.steps[0].key)]]);
      for(const step of workflow.steps){
        const stepKey=`${workflowKey}/${step.key}`;expectedKeys.workflowStep.push(stepKey);
        const next=(step.next||[]).map(key=>stepIds.get(key));
        requireEntity('workflowStep',stepKey,step.label,{action:step.action,output:step.output,reviewPolicy:step.reviewPolicy,onFailure:step.onFailure},[['workflow',workflowId],['role',roleIds.get(step.roleKey)],...next.map(id=>['next',id])]);
      }
      for(const handoff of workflow.handoffs||[]){
        const key=`${workflowKey}/${handoff.key}`;expectedKeys.workflowHandoff.push(key);
        const target=OFFICE_DEPARTMENTS.find(item=>item.key===handoff.toDepartmentKey);if(!target)throw Error('Workflow handoff target is not a registered Office department');
        requireEntity('workflowHandoff',key,handoff.artifact,{artifact:handoff.artifact,condition:handoff.condition},[['workflow',workflowEntity.id],['targetDepartment',await handoffId('department',target.key)]]);
      }
    }
  }
  const expectedAssetKeys=[...expectedAssets.keys()].sort();
  for(const [assetKey,assetSpec]of expectedAssets){
    const asset=byTypeKey.get('asset/'+assetKey);if(!asset)throw Error('Missing logical asset: '+assetKey);
    if(asset.data.kind!==assetSpec.kind||asset.label!==assetSpec.label)throw Error('Logical asset differs from its scene source: '+assetKey);
    const revisions=revisionsByAsset.get(asset.id)||[];if(revisions.length!==1)throw Error('Each logical asset must have exactly one packaged revision');
    const revision=revisions[0],revisionKey=`${assetKey}/${revision.data.sha256}`;expectedKeys.asset.push(assetKey);expectedKeys.assetRevision.push(revisionKey);
    requireEntity('assetRevision',revisionKey,`${assetSpec.label} revision`,revision.data,[['asset',asset.id]]);
  }
  for(const type of TYPES)requireSet(type,expectedKeys[type]);
  return clone(value);
}
