import {defaultBlueprintPlan,validateBlueprintPlan} from './office-blueprint-state.js';
import {TYCOON_BLUEPRINT_OPTIONS} from './office-design-limits.js';
import {OFFICE_FLOOR_KEYS,isOfficeFloor} from './office-floor-registry.js';

// @spec Office Tycoon v0.2 §5–6 — function-led, locally previewable department programmes.
// @tested tests/tycoon-floor-plans.test.mjs — plan envelope, geometry, circulation, furnishings and saved legacy rooms.

const clone=value=>JSON.parse(JSON.stringify(value));
const localToWorld=({x,z})=>({x:x-12,z:z-8});
const area=(id,type,name,x,z,width,depth)=>({id,type,name,x,z,width,depth});
const partition=(id,axis,at,start,end,door)=>({id,axis,at,start,end,...(door?{door}: {})});
const door=(offset,width=1.4)=>({offset,width});

function enclosure(id,x0,z0,x1,z1,doorSide,width=1.4){
  const centerOffset=(length)=>(length-width)/2;
  return [
    partition(`${id}-west`,'z',x0,z0,z1,doorSide==='west'?door(centerOffset(z1-z0),width):null),
    partition(`${id}-east`,'z',x1,z0,z1,doorSide==='east'?door(centerOffset(z1-z0),width):null),
    partition(`${id}-rear`,'x',z0,x0,x1,doorSide==='rear'?door(centerOffset(x1-x0),width):null),
    partition(`${id}-front`,'x',z1,x0,x1,doorSide==='front'?door(centerOffset(x1-x0),width):null),
  ];
}

const COMMON_CORE=Object.freeze([
  partition('core-west','z',9,.2,4.2),
  partition('core-east','z',15,.2,4.2),
  partition('core-front','x',4.2,9,15,door(2.1,1.8)),
  // The rear service reserve stays sealed from the lift lobby. It is not a stair, room route or simulated facility.
  partition('service-west','z',10.1,.2,1.55),
  partition('service-east','z',13.9,.2,1.55),
  partition('service-back','x',1.55,10.1,13.9),
]);

const PROGRAMMES=Object.freeze({
  lobby:{
    areas:[
      area('lobby-public-arrival','work','Public arrival',10.5,13.4,8,2.1),
      area('lobby-intake','work','Reception and intake',6.1,10.3,4.2,5),
      area('lobby-private-meeting','meeting','Private visitor meeting',1,9.2,5.8,5),
      area('lobby-waiting','rest','Visitor waiting lounge',16,9.7,7.2,5.5),
    ],
    dimensions:[{id:'lobby-waiting-aisle',from:[16.4,12.5],to:[19.175,12.5],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('lobby-visitor-room',1,9.2,6.8,14.2,'east'),
      ...enclosure('lobby-waiting-room',16.3,9.4,23.3,15.1,'west'),
    ],
    stations:[],
    reviews:[{x:3.8,z:11.7,tableId:'visitor-meeting-table',leftId:'visitor-chair-left',rightId:'visitor-chair-right',intent:'meeting'}],
    furniture:[
      ['reception','reception',8.2,14,0,'connect'],
      ['board','welcome',14,14.4,0,'projects'],
      ['sofa','lounge',20.2,12.5],
      ['coffee-table','lounge-table',19.2,11],
      ['coffee','coffee',17.2,11.4],
      ['plant','plant-left',2,7],
      ['plant','plant-right',22,7],
      ['plant','reception-plant',9.9,12.1],
    ],
  },
  projects:{
    areas:[
      area('projects-delivery-hub','work','Project delivery hub',3.4,6.4,17.2,7.2),
      area('projects-focus-room','work','Quiet focus room',.8,1.4,6,4.4),
      area('projects-dependency-wall','work','Dependency and planning wall',7.1,1.4,2.2,4.4),
      area('projects-review-room','meeting','Delivery review room',16.3,1.2,6.9,4.6),
    ],
    dimensions:[{id:'projects-delivery-row-gap',from:[5.8,12.1],to:[7.7,12.1],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('projects-focus',.8,1.4,6.8,5.8,'front'),
      ...enclosure('projects-review',16.3,1.2,23.2,5.8,'west'),
      partition('projects-planning-screen','x',6.2,.6,2.6),
    ],
    stations:[
      {id:'desk-1',x:5,z:12.1,rotation:Math.PI},{id:'desk-2',x:8.5,z:12.1,rotation:Math.PI},
      {id:'desk-3',x:15.5,z:7.6,rotation:0},{id:'desk-4',x:3,z:2.3,rotation:0},
    ],
    reviews:[{x:19.7,z:3.5,tableId:'meeting',leftId:'projects-review-chair-left',rightId:'projects-review-chair-right',intent:'meeting'}],
    furniture:[
      ['board','project-board',8.1,5.2],
      ['cabinet','artifacts',7.8,1.9],
      ['coffee','coffee',20.8,12.8],
    ],
  },
  customer:{
    areas:[
      area('customer-public-wait','rest','Public waiting lounge',16.3,9.4,7.1,5.7),
      area('customer-intake','work','Customer service intake',1,10.8,8.2,4.5),
      area('customer-relations','work','Relationship and lifecycle bay',8.8,7,7.1,8.2),
      area('customer-private-case','meeting','Private case review room',16.3,1,7.1,4.8),
      area('customer-private-consult-1','meeting','Private consultation room A',.8,1,6.2,4.5),
      area('customer-private-consult-2','meeting','Private consultation room B',.8,5.9,6.2,4.5),
    ],
    dimensions:[{id:'customer-waiting-aisle',from:[16.4,13],to:[18.975,13],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('customer-consult-a',.8,1,7,5.5,'east'),
      ...enclosure('customer-consult-b',.8,5.9,7,10.4,'east'),
      ...enclosure('customer-case-room',16.3,1,23.4,5.8,'west'),
      ...enclosure('customer-wait-room',16.3,9.4,23.4,15.1,'west'),
      partition('customer-intake-screen','z',10.8,9.5,15.7),
    ],
    stations:[
      {id:'customer-crm',x:9.8,z:13,rotation:Math.PI},{id:'customer-lifecycle',x:13.3,z:13,rotation:Math.PI},
      {id:'customer-care',x:9.8,z:8,rotation:0},{id:'customer-sales',x:13.3,z:8,rotation:0},
    ],
    reviews:[
      {x:19.8,z:3.2,tableId:'customer-review-table',leftId:'customer-review-chair-left',rightId:'customer-review-chair-right'},
      {x:3.8,z:3.1,tableId:'customer-consult-table-a',leftId:'customer-consult-chair-a-left',rightId:'customer-consult-chair-a-right'},
      {x:3.8,z:8,tableId:'customer-consult-table-b',leftId:'customer-consult-chair-b-left',rightId:'customer-consult-chair-b-right'},
    ],
    furniture:[
      ['reception','customer-intake-counter',4.8,14.2],
      ['sofa','customer-waiting-sofa',20,13],
      ['coffee-table','customer-waiting-table',20,10.8],
      ['cabinet','customer-case-records',21.8,4.9],
      ['plant','customer-care-plant',14.5,9.6],
    ],
  },
  market:{
    areas:[
      area('market-signal-wall','work','Market signal wall',.8,2,7.7,3.5),
      area('market-research-pods','work','Research pods',.8,8,8.8,6.3),
      area('market-source-library','work','Source library',14.7,7.1,8.7,5),
      area('market-evidence-review','meeting','Evidence review room',16.5,1.1,6.5,4.8),
    ],
    dimensions:[{id:'market-research-pod-aisle',from:[5.8,12.1],to:[7.7,12.1],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('market-evidence-room',16.5,1.1,23,5.9,'west'),
      partition('market-pod-screen-west','z',2.8,7.6,14.7),
      partition('market-pod-screen-rear','x',7.1,2.8,9.7),
      partition('market-library-screen','x',6.5,14,23.5),
    ],
    stations:[
      {id:'market-analyst',x:5,z:12.1,rotation:Math.PI},{id:'market-research',x:8.5,z:12.1,rotation:Math.PI},
      {id:'market-insight',x:16,z:11.4,rotation:Math.PI},{id:'market-evidence',x:19.5,z:11.4,rotation:Math.PI},
    ],
    reviews:[{x:19.7,z:3.5,tableId:'market-review-table',leftId:'market-review-chair-left',rightId:'market-review-chair-right'}],
    furniture:[
      ['board','market-evidence-wall',4.1,4.2],
      ['cabinet','market-source-shelves',20,8.1],
    ],
  },
  growth:{
    areas:[
      area('growth-content-studio','work','Content production studio',.8,9.2,8.1,5.8),
      area('growth-campaign-bay','work','Campaign planning bay',8.9,9.2,6.4,5.8),
      area('growth-performance','work','Performance measurement room',16.1,.8,7.2,4.2),
      area('growth-campaign-review','meeting','Campaign review room',.8,.8,6.8,5.1),
      area('growth-edit-booth-a','work','Editing booth A',16.1,5.3,7.2,3.2),
      area('growth-edit-booth-b','work','Editing booth B',16.1,8.9,7.2,3.2),
    ],
    dimensions:[{id:'growth-performance-clearance',from:[16.2,2.9],to:[19.2,2.9],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('growth-review-room',.8,.8,7.6,5.9,'east'),
      ...enclosure('growth-performance-room',16.1,.8,23.3,5,'west'),
      ...enclosure('growth-edit-booth-a',16.1,5.3,23.3,8.5,'west'),
      ...enclosure('growth-edit-booth-b',16.1,8.9,23.3,12.1,'west'),
      partition('growth-studio-review-screen','x',8.2,.6,8.8),
      partition('growth-studio-campaign-return','z',14.8,8.2,15.4),
    ],
    stations:[
      {id:'desk-1',x:4.6,z:12,rotation:Math.PI},{id:'desk-2',x:8.2,z:12,rotation:Math.PI},
      {id:'desk-3',x:20,z:2.9,rotation:Math.PI},{id:'desk-4',x:20,z:7.1,rotation:Math.PI},
    ],
    reviews:[{x:3.7,z:2.5,tableId:'meeting',leftId:'growth-review-chair-left',rightId:'growth-review-chair-right',intent:'meeting'}],
    furniture:[
      ['board','marketing-board',11.3,14.2,0,'projects'],
      ['kiosk','marketing-ask',13.8,12.5,0,'marketing-ask'],
      ['board','growth-metrics-board',19.9,4.1],
      ['cabinet','growth-edit-a-shelf',21.7,7.9],
      ['board','growth-edit-b-board',21.7,11.5],
    ],
  },
  'line-oa':{
    areas:[
      area('line-oa-flow-lab','work','Message flow lab',.8,8.7,8.8,6.5),
      area('line-oa-channel-ops','work','Channel operations bay',14.8,8.8,8.8,6.3),
      area('line-oa-preview-bay','work','Test and preview bay',14.8,5.8,8.7,2.7),
      area('line-oa-qa-room','meeting','Conversation QA room',16.6,1.1,6.5,4.6),
    ],
    dimensions:[{id:'line-flow-workbench-aisle',from:[5.8,12],to:[7.7,12],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('line-qa-room',16.6,1.1,23.1,5.7,'west'),
      partition('line-flow-baffle','x',7.1,.6,9.7),
      partition('line-preview-return','z',14.8,6.1,9.5),
      partition('line-channel-screen','x',9.5,14.8,23.5,door(3.1,1.4)),
    ],
    stations:[
      {id:'line-experience',x:5,z:12,rotation:Math.PI},{id:'line-message-design',x:8.5,z:12,rotation:Math.PI},
      {id:'line-channel-ops',x:16,z:12,rotation:Math.PI},{id:'line-conversation-qa',x:19.5,z:7.1,rotation:0},
    ],
    reviews:[{x:19.8,z:3.4,tableId:'line-oa-review-table',leftId:'line-oa-review-chair-left',rightId:'line-oa-review-chair-right'}],
    furniture:[
      ['board','line-flow-board',4.2,14.5],
      ['coffee','line-channel-coffee',17,7.1],
    ],
  },
  commerce:{
    areas:[
      area('commerce-order-coordination','work','Order coordination hub',.8,9.2,8.7,5.8),
      area('commerce-pricing','work','Pricing planning room',.8,1,6.2,4.9),
      area('commerce-fulfilment','work','Fulfilment planning bay',14.8,6.1,3.8,3.7),
      area('commerce-exception-room','meeting','Order exception review room',16,10.2,7.3,4.9),
      area('commerce-exception-triage','work','Exception triage and escalation bay',18.8,6.1,4.5,3.7),
    ],
    dimensions:[{id:'commerce-pricing-clearance',from:[.9,3.5],to:[3.2,3.5],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('commerce-pricing-room',.8,1,7,5.9,'east'),
      ...enclosure('commerce-exception-room',16,10.2,23.3,15.1,'west'),
      partition('commerce-order-screen','x',8.1,.6,9.5),
      partition('commerce-triage-gate','z',18.8,6.1,9.8,door(1.05,1.4)),
    ],
    stations:[
      {id:'commerce-order',x:5,z:12,rotation:Math.PI},{id:'commerce-pricing',x:4,z:3.5,rotation:Math.PI},
      {id:'commerce-fulfilment',x:16,z:7.1,rotation:0},{id:'commerce-exception',x:21,z:7.1,rotation:0},
    ],
    reviews:[{x:19.7,z:12.7,tableId:'commerce-review-table',leftId:'commerce-review-chair-left',rightId:'commerce-review-chair-right'}],
    furniture:[
      ['board','commerce-order-board',4.1,14.5],
      ['cabinet','commerce-exception-files',22,14.4],
      ['board','commerce-triage-board',21,9.4],
    ],
  },
  inventory:{
    areas:[
      area('inventory-stock-position','work','Stock position and ledger wall',.8,10.4,7,4.8),
      area('inventory-reservation','work','Reservation planning bay',.8,5.6,7,4.4),
      area('inventory-count-bench','work','Central physical count island',8.3,7.2,7.4,6),
      area('inventory-variance-room','meeting','Variance review room',16.5,.8,6.8,4.9),
      area('inventory-count-loop','work','Two-way count circulation loop',8,6.2,8,8.2),
      area('inventory-replenishment','work','Replenishment and reservation release',16.2,8.8,7.1,6.2),
    ],
    dimensions:[
      {id:'inventory-count-loop-west',from:[8.1,10.3],to:[10.65,10.3],label:'ทางเดิน'},
      {id:'inventory-count-loop-east',from:[13.35,10.3],to:[15.9,10.3],label:'ทางเดิน'},
    ],
    partitions:[
      ...enclosure('inventory-count-loop',8,6.2,16,14.4,'west'),
      ...enclosure('inventory-variance-room',16.5,.8,23.3,5.7,'west'),
      partition('inventory-stocktake-screen','x',5.2,.6,7.6),
      partition('inventory-reservation-return','z',7.6,7.6,8.8),
    ],
    stations:[
      {id:'inventory-position',x:3.5,z:12.3,rotation:Math.PI},{id:'inventory-reservation',x:6,z:8.3,rotation:0},
      {id:'inventory-stocktake',x:18,z:12.2,rotation:Math.PI},{id:'inventory-data-quality',x:21,z:12.2,rotation:Math.PI},
    ],
    reviews:[
      {x:19.8,z:3.2,tableId:'inventory-review-table',leftId:'inventory-review-chair-left',rightId:'inventory-review-chair-right'},
    ],
    furniture:[
      ['board','inventory-stock-wall',4.1,14.5],
      ['cabinet','inventory-ledger-shelf',3,7.1],
      ['meeting','inventory-count-island',12,10.3],
      ['cabinet','inventory-count-scanner',12,12.8],
      ['board','inventory-replenishment-board',19.6,9.1],
    ],
  },
  warehouse:{
    areas:[
      area('warehouse-inbound-plan','work','Inbound appointment planning lane',.8,8.2,7,7),
      area('warehouse-pick-pack-plan','work','Pick pack and outbound planning lane',16.3,8.2,7,7),
      area('warehouse-capacity-board','work','Central capacity and flow yard',8.2,7.2,7.8,7.1),
      area('warehouse-process-review','meeting','Warehouse process review room',.8,.8,6.8,4.9),
      area('warehouse-outbound-plan','work','Outbound wave planning bay',16.3,5.8,7,2.8),
      area('warehouse-inbound-staging','work','Inbound staging sequence',.8,5.8,7,2.2),
    ],
    dimensions:[{id:'warehouse-capacity-aisle',from:[12.975,10.6],to:[15.9,10.6],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('warehouse-review-room',.8,.8,7.6,5.7,'east'),
      partition('warehouse-u-west','z',8,7,14.6),
      partition('warehouse-u-rear','x',7,8,16,door(3.1,1.8)),
      partition('warehouse-u-east','z',16,7,14.6),
      partition('warehouse-inbound-checkpoint','x',9.1,.6,7.7),
      partition('warehouse-outbound-checkpoint','x',9.1,16.3,23.4),
    ],
    stations:[
      {id:'warehouse-coordination',x:3,z:12.2,rotation:Math.PI},{id:'warehouse-inbound',x:6.5,z:12.2,rotation:Math.PI},
      {id:'warehouse-outbound',x:18,z:12.2,rotation:Math.PI},{id:'warehouse-quality',x:21,z:12.2,rotation:Math.PI},
    ],
    reviews:[{x:4,z:3.2,tableId:'warehouse-review-table',leftId:'warehouse-review-chair-left',rightId:'warehouse-review-chair-right'}],
    furniture:[
      ['board','warehouse-capacity-board',12,10.6],
      ['cabinet','warehouse-planning-files',14.7,12.8],
      ['board','warehouse-inbound-board',3.8,14.5],
      ['board','warehouse-outbound-board',20,7.2],
      ['cabinet','warehouse-inbound-staging-rack',4,6.8],
    ],
  },
  procurement:{
    areas:[
      area('procurement-supplier-comparison','meeting','Public supplier comparison suite',.8,9,7.2,6.2),
      area('procurement-purchase-plan','work','Purchase planning and approvals',.8,5.6,8.3,3.2),
      area('procurement-po-coordination','work','Staff purchase order coordination',14.7,9.5,8.5,5.5),
      area('procurement-receipt-review','meeting','Receiving evidence review room',16.3,.8,7,4.9),
      area('procurement-staff-zone','work','Private staff planning zone',8.5,6.2,7.2,8.8),
      area('procurement-award-board','work','Supplier award decision wall',8.5,9.5,6,4.8),
    ],
    dimensions:[{id:'procurement-staff-row-gap',from:[5.3,7.2],to:[7.9,7.2],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('procurement-supplier-suite',.8,9,8,15.2,'east'),
      ...enclosure('procurement-receipt-room',16.3,.8,23.3,5.7,'west'),
      partition('procurement-staff-entry','x',9.1,8.5,15.7,door(3.4,1.6)),
      partition('procurement-staff-return','z',15.7,6,9),
    ],
    stations:[
      {id:'procurement-planner',x:4.5,z:7.2,rotation:Math.PI},{id:'procurement-supplier',x:8.7,z:7.2,rotation:Math.PI},
      {id:'procurement-po',x:16,z:12.3,rotation:Math.PI},{id:'procurement-receipt',x:19.5,z:12.3,rotation:Math.PI},
    ],
    reviews:[
      {x:4.2,z:12.1,tableId:'procurement-supplier-table',leftId:'procurement-supplier-chair-left',rightId:'procurement-supplier-chair-right'},
      {x:19.8,z:3.2,tableId:'procurement-review-table',leftId:'procurement-review-chair-left',rightId:'procurement-review-chair-right'},
    ],
    furniture:[
      ['board','procurement-scorecard-board',5.7,14.5],
      ['cabinet','procurement-supplier-files',6.4,10],
      ['board','procurement-award-wall',11.3,13.7],
      ['cabinet','procurement-po-files',22,14.4],
    ],
  },
  assets:{
    areas:[
      area('assets-intake-inspection','work','Asset intake inspection bay',.8,9,8.2,6.1),
      area('assets-register-wall','work','Register and custody wall',.8,5.4,8.2,3.4),
      area('assets-lifecycle','work','Lifecycle planning bay',14.8,6.1,8.7,3.7),
      area('assets-audit-room','work','Asset evidence audit room',16.4,.8,6.9,4.9),
      area('assets-intake-bench','work','Condition check and tagging bench',1,10,7.8,5),
    ],
    dimensions:[{id:'assets-inspection-clearance',from:[.9,11],to:[4.2,11],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('assets-inspection-bay',.8,9,9,15.2,'east'),
      ...enclosure('assets-audit-room',16.4,.8,23.3,5.7,'west'),
      partition('assets-register-divider','x',8.7,.6,8.4),
      partition('assets-lifecycle-screen','z',14,6.1,9.4),
    ],
    stations:[
      {id:'assets-register',x:5,z:6.5,rotation:0},{id:'assets-inspection',x:5,z:11,rotation:Math.PI},
      {id:'assets-audit',x:19.5,z:3.3,rotation:Math.PI},{id:'assets-lifecycle',x:17,z:7.2,rotation:0},
    ],
    reviews:[
      {x:4.6,z:13.8,tableId:'assets-inspection-table',leftId:'assets-inspection-chair-left',rightId:'assets-inspection-chair-right'},
    ],
    furniture:[
      ['board','assets-register-wall-board',3,6],
      ['cabinet','assets-inspection-files',8,14.4],
      ['cabinet','assets-audit-files',21.8,4.5],
      ['board','assets-condition-board',7.6,10],
    ],
  },
  people:{
    areas:[
      area('people-private-service','work','Private consultation suite',.8,.8,7.2,9.5),
      area('people-directory','work','Employee directory service point',8.5,5.5,7,4),
      area('people-onboarding','work','Onboarding coordination bay',8.5,10,7,5.2),
      area('people-privacy-room','work','Privacy review room',16.3,.8,7,4.9),
      area('people-consult-room-1','meeting','Confidential consultation room A',.8,.8,6.5,4.1),
      area('people-consult-room-2','meeting','Confidential consultation room B',.8,5.3,6.5,4.5),
    ],
    dimensions:[{id:'people-consult-clearance-a',from:[.9,3.5],to:[3.2,3.5],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('people-consult-room-a',.8,.8,7.3,4.9,'east'),
      ...enclosure('people-consult-room-b',.8,5.3,7.3,9.8,'east'),
      ...enclosure('people-privacy-room',16.3,.8,23.3,5.7,'west'),
      partition('people-directory-screen','x',9.6,8.4,15.6),
      partition('people-onboarding-return','z',15.6,9.6,15.6),
    ],
    stations:[
      {id:'people-service',x:4,z:3.5,rotation:Math.PI},{id:'people-directory',x:10,z:7.4,rotation:0},
      {id:'people-onboarding',x:10,z:12,rotation:Math.PI},{id:'people-privacy-review',x:19.5,z:3.2,rotation:Math.PI},
    ],
    reviews:[
      {x:3.9,z:7.1,tableId:'people-consult-table-b',leftId:'people-consult-chair-b-left',rightId:'people-consult-chair-b-right'},
    ],
    furniture:[
      ['board','people-onboarding-board',14,14.4],
      ['cabinet','people-directory-files',14.6,6.2],
      ['board','people-privacy-board',21.7,4.4],
      ['board','people-consult-guidance',5.8,4.5],
    ],
  },
  operations:{
    areas:[
      area('operations-dispatch','work','Service dispatch planning hub',.8,9.8,7,5.4),
      area('operations-schedule','work','Schedule and capacity bay',16.2,10,7.1,5.2),
      area('operations-triage','work','Exception triage bay',16.2,5.8,7.1,3.8),
      area('operations-quality-room','meeting','Quality review room',.8,.8,6.8,4.9),
      area('operations-control-island','work','Central control planning and huddle island',8.2,7,7.8,7.4),
      area('operations-incident-room','meeting','Incident coordination room',16.2,.8,7.1,4.9),
    ],
    partitions:[
      ...enclosure('operations-quality-room',.8,.8,7.6,5.7,'east'),
      ...enclosure('operations-incident-room',16.2,.8,23.3,5.7,'west'),
      partition('operations-control-west','z',8,6.5,14.8),
      partition('operations-control-east','z',16,7,14.8,door(3,1.8)),
      partition('operations-control-rear','x',6.5,8,15.5,door(3.3,1.8)),
      partition('operations-triage-gate','x',10,16.2,23.3,door(3.1,1.6)),
    ],
    stations:[
      {id:'operations-lead',x:4,z:12,rotation:Math.PI},{id:'operations-schedule',x:18,z:12,rotation:Math.PI},
      {id:'operations-process',x:10,z:12,rotation:0},{id:'operations-quality',x:14,z:12,rotation:0},
    ],
    reviews:[
      {x:4,z:3.2,tableId:'operations-review-table',leftId:'operations-review-chair-left',rightId:'operations-review-chair-right'},
      {x:19.7,z:3.2,tableId:'operations-incident-table',leftId:'operations-incident-chair-left',rightId:'operations-incident-chair-right'},
    ],
    furniture:[
      ['board','operations-service-board',4,14.3],
      ['coffee','operations-water-point',22,14],
      ['board','operations-triage-board',22,8.2],
      ['meeting','operations-control-table',12,9],
    ],
    dimensions:[{id:'operations-control-aisle',from:[13.35,9],to:[15.9,9],label:'ทางเดิน'}],
  },
  knowledge:{
    areas:[
      area('knowledge-ingest-prep','work','Front source preparation zone',.8,10.5,8,5),
      area('knowledge-pipeline','work','Ingestion pipeline work bay',8.8,10,7,5.5),
      area('knowledge-quiet-research','work','Rear quiet research room',16.2,5.2,7.1,4.2),
      area('knowledge-citation-review','meeting','Citation and provenance review room',.8,.8,6.8,4.9),
      area('knowledge-library-aisle','work','Rear reference library aisle',20.2,5.3,3.1,4),
    ],
    dimensions:[{id:'knowledge-library-aisle-gap',from:[21.5,6.425],to:[21.5,8.375],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('knowledge-citation-room',.8,.8,7.6,5.7,'east'),
      ...enclosure('knowledge-quiet-research-room',16.2,5.2,23.3,9.4,'west'),
      partition('knowledge-ingest-front-line','x',9.5,.6,8.4),
      partition('knowledge-library-aisle-wall','z',15.4,9.8,14.7),
    ],
    stations:[
      {id:'knowledge-curator',x:4,z:12,rotation:Math.PI},{id:'knowledge-pipeline',x:10.5,z:12,rotation:Math.PI},
      {id:'knowledge-research',x:18,z:7.2,rotation:0},{id:'knowledge-citation-review',x:4,z:3.1,rotation:0},
    ],
    reviews:[],
    furniture:[
      ['board','knowledge-evidence-wall',12,14.4],
      ['cabinet','knowledge-source-shelves',21.5,6],
      ['cabinet','knowledge-ingest-files',7.7,14.3],
      ['cabinet','knowledge-research-shelf-b',21.5,8.8],
    ],
  },
  platform:{
    areas:[
      area('platform-integration-workbench','work','Integration workbench',.8,9.8,8.8,5.4),
      area('platform-readiness-wall','work','Readiness and dependency wall',.8,5.7,8.8,3.5),
      area('platform-access-review','meeting','Access proposal review room',16.3,1,6.8,4.7),
      area('platform-audit-room','work','Audit evidence room',16.3,9,6.9,6.1),
    ],
    dimensions:[{id:'platform-integration-workbench-gap',from:[5.8,12],to:[7.7,12],label:'ทางเดิน'}],
    partitions:[
      ...enclosure('platform-access-room',16.3,1,23.1,5.7,'west'),
      ...enclosure('platform-audit-room',16.3,9,23.2,15.1,'west'),
      partition('platform-readiness-divider','x',9,.6,9.4),
    ],
    stations:[
      {id:'platform-coordination',x:5,z:12,rotation:Math.PI},{id:'platform-integration',x:8.5,z:12,rotation:Math.PI},
      {id:'platform-access',x:19.5,z:4.8,rotation:Math.PI},{id:'platform-audit',x:21.5,z:12,rotation:Math.PI},
    ],
    reviews:[{x:19.2,z:2,tableId:'platform-review-table',leftId:'platform-review-chair-left',rightId:'platform-review-chair-right'}],
    furniture:[
      ['board','platform-readiness-board',4.2,7.4],
      ['cabinet','platform-audit-files',22,14],
      ['coffee','platform-status-coffee',8.2,6.8],
    ],
  },
});

function basePlan(floor){
  const programme=PROGRAMMES[floor];
  if(!programme)throw Error('ชั้นนี้ยังไม่มีฉาก Tycoon');
  const plan=defaultBlueprintPlan('large');
  return validateBlueprintPlan({
    ...plan,
    width:24,depth:16,originX:-14,originZ:-10,
    door:{wall:'front',offset:11.2,width:1.6},
    windows:[
      {id:'rear-window-left',wall:'rear',offset:1,width:1.8,sill:1,top:2.2},
      {id:'rear-window-right',wall:'rear',offset:21.2,width:1.8,sill:1,top:2.2},
    ],
    partitions:[...clone(COMMON_CORE),...clone(programme.partitions)],
    areas:clone(programme.areas),
  },TYCOON_BLUEPRINT_OPTIONS);
}

function makeObjects(floor){
  const programme=PROGRAMMES[floor],objects=[];
  const put=(kind,id,x,z,intent='decor',rotation=0)=>{
    const point=localToWorld({x,z});
    objects.push({id,kind,x:point.x,y:0,z:point.z,rotation,scale:1,intent});
  };
  // Shared lift and directory placement are common local presentation anchors only.
  put('lift','lift',12,2.4,'floors');
  put('kiosk','directory',14,5.3,'floors');
  if(floor==='lobby'){
    for(const [kind,id,x,z,rotation=0,intent='decor'] of programme.furniture)put(kind,id,x,z,intent,rotation);
  }else{
    put('plant','plant-right',22.8,7,'decor');
    if(floor==='projects'||floor==='growth')put('plant','plant-left',1.3,14.9,'decor');
    for(const station of programme.stations){
      const chairZ=station.z+(station.rotation===Math.PI?-1.2:1.2);
      const deskId=station.id.startsWith('desk-')?station.id:`${station.id}-desk`;
      put('desk',deskId,station.x,station.z,'work',station.rotation);
      put('chair',deskChairId(deskId),station.x,chairZ,'decor',station.rotation);
    }
    for(const fixture of programme.furniture||[])put(fixture[0],fixture[1],fixture[2],fixture[3],fixture[5]||'decor',fixture[4]||0);
  }
  for(const review of programme.reviews||[]){
    put('meeting',review.tableId,review.x,review.z,review.intent||'decor');
    put('chair',review.leftId,review.x-2,review.z,'decor',Math.PI/2);
    put('chair',review.rightId,review.x+2,review.z,'decor',-Math.PI/2);
  }
  return objects;
}

function deskChairId(deskId){return deskId.startsWith('desk-')?deskId.replace(/^desk-/,'chair-'):deskId.replace(/-desk$/,'-chair');}

export function createTycoonFloorPlan(floor){
  if(!isOfficeFloor(floor)||!OFFICE_FLOOR_KEYS.includes(floor)||!PROGRAMMES[floor])throw Error('ชั้นนี้ยังไม่มีฉาก Tycoon');
  return {width:24,depth:16,objects:makeObjects(floor),blueprintPlan:basePlan(floor)};
}

export function createTycoonFloorDimensions(floor){
  if(!isOfficeFloor(floor)||!OFFICE_FLOOR_KEYS.includes(floor)||!PROGRAMMES[floor])throw Error('ชั้นนี้ยังไม่มีฉาก Tycoon');
  const probes=clone(PROGRAMMES[floor].dimensions||[]);
  if(probes.length<1||probes.length>3||probes.some(({id,from,to,label})=>
    typeof id!=='string'||!Array.isArray(from)||!Array.isArray(to)||from.length!==2||to.length!==2||label!=='ทางเดิน'||
    from.some((v,i)=>!Number.isFinite(v)||v<0||v>(i===0?24:16))||to.some((v,i)=>!Number.isFinite(v)||v<0||v>(i===0?24:16))||
    Math.hypot(to[0]-from[0],to[1]-from[1])<.5||(Math.abs(from[0]-to[0])>1e-8&&Math.abs(from[1]-to[1])>1e-8)))throw Error('ข้อมูลมิติทางเดินไม่ถูกต้อง');
  return probes;
}
