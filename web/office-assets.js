// Shared catalog for Studio browsing, floor-state validation and generated model metadata.
// Furniture and decor Asset IDs never represent or mutate Agent role assignments.

export const STUDIO_MODEL_METADATA=Object.freeze({
  'desk-starter':{assetId:'visual-office.desk.starter.v1',name:'โต๊ะทำงาน Starter',category:'furniture',placeable:true,sceneKind:'asset'},
  'desk-studio':{assetId:'visual-office.desk.studio.v1',name:'โต๊ะทำงาน Studio',category:'furniture',placeable:true,sceneKind:'asset'},
  'desk-signature':{assetId:'visual-office.desk.signature.v1',name:'โต๊ะทำงาน Signature',category:'furniture',placeable:true,sceneKind:'asset'},
  'chair-ergonomic':{assetId:'visual-office.chair.ergonomic.v1',name:'เก้าอี้ทำงาน Ergonomic',category:'furniture',placeable:true,sceneKind:'asset',footprint:[.9,.95],anchors:{ground:[0,0,0],seat:[0,.66,-.02],back:[0,1.36,.21]}},
  'meeting-table':{assetId:'visual-office.meeting-table.standard.v1',name:'โต๊ะประชุม 6 ที่นั่ง',category:'furniture',placeable:true,sceneKind:'asset',footprint:[2.7,1.45],anchors:{ground:[0,0,0],top:[0,.9,0]}},
  'lounge-sofa':{assetId:'visual-office.sofa.lounge.v1',name:'โซฟาพักผ่อน 2 ที่นั่ง',category:'furniture',placeable:true,sceneKind:'asset',footprint:[2.05,1.05],anchors:{ground:[0,0,0],seat:[0,.64,-.05]}},
  'coffee-table':{assetId:'visual-office.coffee-table.studio.v1',name:'โต๊ะกลาง Soft 3D',category:'furniture',placeable:true,sceneKind:'asset',footprint:[1.65,1.35],anchors:{ground:[0,0,0],top:[0,.75,0]}},
  'storage-cabinet':{assetId:'visual-office.cabinet.studio.v1',name:'ตู้เก็บของ Soft 3D',category:'furniture',placeable:true,sceneKind:'asset',footprint:[1.55,.85],anchors:{ground:[0,0,0],front:[0,.65,.36]}},
  'reception-counter':{assetId:'visual-office.reception-counter.standard.v1',name:'เคาน์เตอร์ต้อนรับ',category:'furniture',placeable:true,sceneKind:'asset',footprint:[2.55,1.1],anchors:{ground:[0,0,0],worktop:[0,1.07,0]}},
  'bookcase':{assetId:'visual-office.bookcase.standard.v1',name:'ชั้นหนังสือ',category:'furniture',placeable:true,sceneKind:'asset',footprint:[1.5,.75],anchors:{ground:[0,0,0],shelf:[0,.95,.23]}},
  'floor-lamp':{assetId:'visual-office.floor-lamp.standard.v1',name:'โคมไฟตั้งพื้น',category:'decor',placeable:true,sceneKind:'asset',footprint:[.72,.72],anchors:{ground:[0,0,0],light:[0,1.72,0]}},
  'whiteboard':{assetId:'visual-office.whiteboard.standard.v1',name:'ไวท์บอร์ด',category:'decor',placeable:true,sceneKind:'asset',footprint:[1.95,.58],anchors:{ground:[0,0,0],board:[0,1.23,.1]}},
  'coffee-station':{assetId:'visual-office.coffee-station.standard.v1',name:'มุมกาแฟสำนักงาน',category:'decor',placeable:true,sceneKind:'asset',footprint:[1.55,.88],anchors:{ground:[0,0,0],worktop:[0,.99,0]}},
  'elevator-bay':{assetId:'visual-office.elevator.bay.v1',name:'ชุดประตูลิฟต์',category:'decor',placeable:true,sceneKind:'asset',footprint:[2.55,.85],anchors:{ground:[0,0,0],interaction:[1.25,1.2,.3]}},
  'room-starter':{assetId:'visual-office.room.starter.v1',name:'ห้อง Starter',category:'room',placeable:false,sceneKind:'room-template'},
  'room-studio':{assetId:'visual-office.room.studio.v1',name:'ห้อง Studio',category:'room',placeable:false,sceneKind:'room-template'},
  'room-signature':{assetId:'visual-office.room.signature.v1',name:'ห้อง Signature',category:'room',placeable:false,sceneKind:'room-template'},
  'room-signature-wing':{assetId:'visual-office.room.signature-wing.v1',name:'ห้อง Signature · ปีกพักผ่อน',category:'room',placeable:false,sceneKind:'room-template'},
  'plant-movable':{assetId:'visual-office.plant.movable.v1',name:'ต้นไม้กระถาง',category:'decor',placeable:true,sceneKind:'asset'},
  'mannequin-seated':{assetId:'visual-office.display.mannequin-seated.v1',name:'หุ่นจำลองนั่ง',category:'presentation',placeable:false,sceneKind:'presentation-only',presentationOnly:true},
});

const studioGlb=(file,preview,description)=>{
  const key=file.replace(/\.glb$/,'');
  const metadata=STUDIO_MODEL_METADATA[key];
  return Object.freeze({...metadata,key,file:`./assets/models/studio/${file}`,format:'GLB',renderer:'gltf',preview,description});
};

export const OFFICE_ASSETS=Object.freeze([
  Object.freeze({assetId:'visual-office.desk.office.v1',name:'โต๊ะทำงาน Office',category:'furniture',kind:'desk',format:'GLTF',renderer:'native-desk',file:'./assets/models/desk.gltf',preview:'./assets/models/studio/previews/desk-office.svg',description:'โมเดลโต๊ะทำงานเดิมของชั้น 3D'}),
  studioGlb('desk-starter.glb','./assets/models/studio/previews/desk-starter.svg','ชุดโต๊ะทำงานระดับ Starter · GLB'),
  studioGlb('desk-studio.glb','./assets/models/studio/previews/desk-studio.svg','ชุดโต๊ะทำงานระดับ Studio · GLB'),
  studioGlb('desk-signature.glb','./assets/models/studio/previews/desk-signature.svg','ชุดโต๊ะทำงานระดับ Signature · GLB'),
  studioGlb('chair-ergonomic.glb','./assets/models/studio/previews/chair-ergonomic.svg','เก้าอี้สำนักงานพร้อมพนักพิง ที่วางแขน และฐานล้อ · GLB'),
  studioGlb('meeting-table.glb','./assets/models/studio/previews/meeting-table.svg','โต๊ะประชุม 6 ที่นั่งพร้อมขาไม้ · GLB'),
  studioGlb('lounge-sofa.glb','./assets/models/studio/previews/lounge-sofa.svg','โซฟาพักผ่อนสองที่นั่งพร้อมหมอน · GLB'),
  studioGlb('coffee-table.glb','./assets/models/studio/previews/coffee-table-soft.svg','โต๊ะกลางทรงกลมสำหรับมุมนั่งพัก · GLB'),
  studioGlb('storage-cabinet.glb','./assets/models/studio/previews/storage-cabinet.svg','ตู้เก็บเอกสารบานคู่ · GLB'),
  studioGlb('reception-counter.glb','./assets/models/studio/previews/reception-counter.svg','เคาน์เตอร์ต้อนรับพร้อมจอและพื้นที่ทำงาน · GLB'),
  studioGlb('bookcase.glb','./assets/models/studio/previews/bookcase.svg','ชั้นหนังสือสำนักงานพร้อมหนังสือ · GLB'),
  studioGlb('floor-lamp.glb','./assets/models/studio/previews/floor-lamp.svg','โคมไฟตั้งพื้นพร้อมฐานถ่วง · GLB'),
  studioGlb('whiteboard.glb','./assets/models/studio/previews/whiteboard.svg','ไวท์บอร์ดเคลื่อนย้ายได้ · GLB'),
  studioGlb('coffee-station.glb','./assets/models/studio/previews/coffee-station.svg','ตู้กาแฟพร้อมเครื่องชงและแก้ว · GLB'),
  studioGlb('elevator-bay.glb','./assets/models/studio/previews/elevator-bay.svg','ชุดกรอบและประตูลิฟต์สำหรับฉาก 3D · GLB'),
  Object.freeze({assetId:'visual-office.chair.standard.v1',name:'เก้าอี้ทำงาน',category:'furniture',kind:'chair',format:'3D Mesh',renderer:'native-mesh',file:'web/models.js · makeChair',preview:'./assets/office-world/hybrid/props/chair.png',description:'เก้าอี้ 3D ปรับตำแหน่งและวัสดุได้'}),
  Object.freeze({assetId:'visual-office.plant.standard.v1',name:'ต้นไม้กระถาง · mesh',category:'decor',kind:'plant',format:'3D Mesh',renderer:'native-mesh',file:'web/models.js · makeDecoration',preview:'./assets/studio-styles/soft3d/plant.png',description:'ต้นไม้กระถาง 3D สำหรับตกแต่ง'}),
  studioGlb('plant-movable.glb','./assets/studio-styles/soft3d/plant.png','ต้นไม้ตกแต่ง 3D เคลื่อนย้ายได้ · GLB'),
  Object.freeze({assetId:'visual-office.coffee-table.standard.v1',name:'โต๊ะกลาง',category:'furniture',kind:'coffee-table',format:'3D Mesh',renderer:'native-mesh',file:'web/models.js · makeDecoration',preview:'./assets/models/studio/previews/coffee-table.svg',description:'โต๊ะกลางทรงกลมพร้อมของตกแต่ง'}),
  Object.freeze({assetId:'visual-office.cabinet.standard.v1',name:'ตู้เก็บของ',category:'furniture',kind:'cabinet',format:'3D Mesh',renderer:'native-mesh',file:'web/models.js · makeDecoration',preview:'./assets/models/studio/previews/cabinet.svg',description:'ตู้เก็บของพร้อมบานเปิดและมือจับ'}),
]);

export const OFFICE_ASSET_BY_ID=new Map(OFFICE_ASSETS.map(asset=>[asset.assetId,asset]));
export const PLACEABLE_STUDIO_GLBS=Object.freeze(OFFICE_ASSETS.filter(asset=>asset.format==='GLB'));
export const ASSET_CATEGORIES=Object.freeze([
  {id:'all',label:'ทั้งหมด'},
  {id:'furniture',label:'เฟอร์นิเจอร์'},
  {id:'decor',label:'ของตกแต่ง'},
]);
