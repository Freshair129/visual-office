// Navigation keys are projected from zuri.ai's DOMAINS registry, not new grants.
// Role designs are proposals for this simulation, not approved AgentVersions.
export const domainSource = Object.freeze({
  repository: 'Freshair129/zuri.ai',
  revision: '30911f98e12d535133e77dbe3c3bd42ed6ee9864',
  path: 'apps/server/src/config/domains.js',
  lobbyKey: 'business-home',
});

const role = (key, name, title, responsibility, output, sourceAgentId = null) =>
  ({key, name, title, responsibility, output, sourceAgentId});
const floor = (key, label, thai, color, mission, roles, reserved = false) =>
  ({key, label, thai, color, mission, roles, reserved});

export const domainFloors = [
  floor('projects', 'Projects & Work', 'ทีมโครงการ', '#d29552', 'เปลี่ยนเป้าหมายให้เป็นแผนงานที่มีเจ้าของและหลักฐานส่งมอบ', [
    role('lead', 'Atlas', 'Project Lead', 'จัดลำดับเป้าหมายและประสานเจ้าของงาน', 'แผนส่งมอบและรายการตัดสินใจ'),
    role('planner', 'Plan', 'Work Planner', 'แตก workstream ตาม execution mode และจัด dependency', 'แผนงานพร้อม milestone และ gate'),
    role('delivery', 'Dev', 'Delivery Specialist', 'ทำงานในขอบเขตที่ได้รับและเก็บหลักฐาน', 'ชิ้นงานและผลการตรวจสอบ'),
    role('review', 'Vera', 'Delivery Reviewer', 'ตรวจ acceptance และความครบถ้วนอย่างเป็นอิสระ', 'ข้อค้นพบและข้อเสนอรับมอบ'),
  ]),
  floor('customer', 'Customer', 'ทีมดูแลลูกค้า', '#8ba5c1', 'เข้าใจลูกค้า ดูแลบทสนทนา และส่งต่องานขายอย่างมีบริบท', [
    role('crm', 'Pim', 'CRM Specialist', 'วิเคราะห์กลุ่มลูกค้าและคุณภาพข้อมูล CRM', 'เกณฑ์แบ่งกลุ่มและแผน CRM', 'pim'),
    role('lifecycle', 'Nara', 'Lifecycle Specialist', 'วางเส้นทาง onboarding และการรักษาลูกค้า', 'Lifecycle flow พร้อมเงื่อนไข', 'nara'),
    role('care', 'June', 'Customer Care', 'สรุปความต้องการและจัดคิวการตอบกลับ', 'ร่างคำตอบและรายการส่งต่อ'),
    role('sales', 'Lin', 'Sales Coordinator', 'ติดตามโอกาสขายและสิ่งที่ต้องดำเนินการต่อ', 'Sales task และ next action'),
  ]),
  floor('market', 'Market Intelligence', 'ทีมข่าวกรองตลาด', '#a59fc8', 'แปลสัญญาณจากตลาดเป็นข้อมูลที่ตรวจสอบแหล่งที่มาได้', [
    role('analyst', 'Beam', 'Marketing Analyst', 'เปรียบเทียบตลาดและคู่แข่งด้วยหลักฐาน', 'รายงานวิเคราะห์พร้อมแหล่งอ้างอิง', 'beam'),
    role('research', 'Scout', 'Market Researcher', 'รวบรวมสัญญาณภายนอกตามคำถามวิจัย', 'Market observation พร้อมวันตรวจสอบ'),
    role('insight', 'Vale', 'Insight Strategist', 'สังเคราะห์ผลกระทบและระดับความเชื่อมั่น', 'Insight brief สำหรับ domain ผู้ใช้'),
    role('review', 'Sage', 'Evidence Reviewer', 'ตรวจที่มา ความสดใหม่ และข้อขัดแย้ง', 'รายการหลักฐานและข้อจำกัด'),
  ]),
  floor('growth', 'Marketing', 'ทีมการตลาด', '#e7a568', 'วางกลยุทธ์ สร้างเนื้อหา และวัดผลแคมเปญของธุรกิจ', [
    role('lead', 'Mira', 'Marketing Lead', 'วางกลยุทธ์และจัดลำดับงานของทีม', 'Campaign brief และแผนดำเนินงาน', 'mira'),
    role('content', 'Kai', 'Content Strategist', 'วางสารหลัก น้ำเสียง และปฏิทินเนื้อหา', 'Content plan และร่างข้อความ', 'kai'),
    role('performance', 'Theo', 'Performance Marketer', 'ออกแบบการทดลอง งบ และตัวชี้วัด', 'Media plan พร้อมสมมติฐาน', 'theo'),
    role('creative', 'Juno', 'Creative Producer', 'แปลง brief เป็นแนวทางภาพและชิ้นงาน', 'Creative draft สำหรับตรวจรับ'),
  ]),
  floor('line-oa', 'LINE OA Studio', 'ทีม LINE OA', '#8cac89', 'ออกแบบประสบการณ์ LINE และดูแลการส่งต่อบทสนทนา', [
    role('lead', 'Lime', 'LINE Experience Lead', 'ออกแบบ flow และขอบเขตการตอบของบัญชี', 'Conversation journey'),
    role('design', 'Moss', 'Conversation Designer', 'เขียนข้อความและทางเลือกในบทสนทนา', 'Message flow และ fallback'),
    role('ops', 'Fern', 'Channel Operator', 'เตรียมการตั้งค่าและตรวจสุขภาพช่องทาง', 'รายการตั้งค่าที่รออนุมัติ'),
    role('review', 'Reed', 'Conversation QA', 'ทดสอบข้อความ การส่งต่อ และกรณีผิดพลาด', 'ผลทดสอบก่อนเผยแพร่'),
  ]),
  floor('commerce', 'Order Management', 'ทีมคำสั่งซื้อ', '#cc9b83', 'ดูแลคำสั่งซื้อ ราคา และการส่งต่องาน fulfilment', [
    role('lead', 'Otto', 'Order Coordinator', 'ติดตามวงจรคำสั่งซื้อและข้อยกเว้น', 'Order action list'),
    role('pricing', 'Penny', 'Pricing Analyst', 'ตรวจสูตรราคาและเงื่อนไขเชิงพาณิชย์', 'Price calculation draft'),
    role('fulfilment', 'Finn', 'Fulfilment Planner', 'ประสาน stock และกำหนดส่ง', 'แผนส่งมอบตามคำสั่งซื้อ'),
    role('review', 'Quinn', 'Order Reviewer', 'ตรวจความครบถ้วนก่อนเปลี่ยนสถานะ', 'Exception report'),
  ]),
  floor('inventory', 'Inventory', 'ทีมสินค้าคงคลัง', '#9fb9af', 'ดูแลยอดคงคลัง การจอง และหลักฐานเคลื่อนไหวสินค้า', [
    role('lead', 'Ivy', 'Inventory Controller', 'ตรวจยอดคงเหลือและรายการเคลื่อนไหว', 'Stock position report'),
    role('reserve', 'Rin', 'Reservation Planner', 'วิเคราะห์ความต้องการและการจองสินค้า', 'Reservation proposal'),
    role('count', 'Cato', 'Stocktake Analyst', 'เทียบผลนับกับบัญชีสินค้า', 'Variance report'),
    role('quality', 'Kit', 'SKU Data Steward', 'ตรวจ SKU ซ้ำ หน่วย และข้อมูลนำเข้า', 'รายการแก้ไขคุณภาพข้อมูล'),
  ]),
  floor('warehouse', 'Warehouse', 'ทีมคลังสินค้า', '#a9b8a0', 'แบบทีมสำหรับพื้นที่จัดเก็บและการเคลื่อนย้ายภายในคลัง', [
    role('lead', 'Wren', 'Warehouse Coordinator', 'วางแผนงานคลังและพื้นที่', 'Warehouse work plan'),
    role('inbound', 'Dock', 'Inbound Planner', 'เตรียมจุดรับและจัดเก็บสินค้า', 'Put-away proposal'),
    role('outbound', 'Pack', 'Outbound Planner', 'เตรียมแผนหยิบและแพ็ก', 'Pick-and-pack plan'),
    role('review', 'Bay', 'Warehouse QA', 'ตรวจขั้นตอนและข้อยกเว้น', 'Warehouse checklist'),
  ], true),
  floor('procurement', 'Procurement', 'ทีมจัดซื้อ', '#b6a0bb', 'ดูแลซัพพลายเออร์ ใบสั่งซื้อ และสิ่งที่รับเข้าจริง', [
    role('lead', 'Priya', 'Procurement Planner', 'รวบรวมความต้องการและแผนจัดซื้อ', 'Purchase proposal'),
    role('supplier', 'Sol', 'Supplier Analyst', 'เปรียบเทียบราคา เงื่อนไข และ lead time', 'Supplier comparison'),
    role('po', 'Poe', 'Purchase Order Coordinator', 'เตรียมใบสั่งซื้อและติดตามรายการค้าง', 'PO draft และ outstanding lines'),
    role('receipt', 'Rhea', 'Receiving Reviewer', 'ตรวจสิ่งที่มาถึงกับ PO และหลักฐานรับ', 'Goods receipt review'),
  ]),
  floor('assets', 'Asset Management', 'ทีมทรัพย์สิน', '#c7b98b', 'ติดตามทะเบียน สถานะ และหลักฐานตรวจนับทรัพย์สิน', [
    role('lead', 'Ari', 'Asset Custodian', 'ดูแลทะเบียนและผู้รับผิดชอบ', 'Asset register review'),
    role('receive', 'Nova', 'Receiving Inspector', 'ตรวจสภาพและรายละเอียดของที่รับ', 'Inspection record draft'),
    role('audit', 'Trace', 'Asset Auditor', 'เทียบผลสแกนกับทะเบียน', 'Stocktake exceptions'),
    role('lifecycle', 'Remy', 'Lifecycle Planner', 'เตรียมแผนบำรุงรักษาและการใช้งาน', 'Lifecycle recommendation'),
  ]),
  floor('people', 'HR / People', 'ทีมบุคลากร', '#c29eaa', 'ดูแลข้อมูลบุคลากรและการประสานงานตามสิทธิ์ที่ได้รับ', [
    role('lead', 'Hana', 'People Coordinator', 'ประสานคำขอและขั้นตอนบริการบุคลากร', 'People service plan'),
    role('directory', 'Dot', 'Directory Steward', 'ตรวจความครบถ้วนข้อมูลที่มีสิทธิ์เข้าถึง', 'Directory correction draft'),
    role('onboard', 'Ona', 'Onboarding Coordinator', 'เตรียมขั้นตอนเริ่มงานตามคำสั่ง', 'Onboarding checklist'),
    role('review', 'Noor', 'Privacy Reviewer', 'ตรวจขอบเขตข้อมูลและผู้รับ', 'Access and privacy review'),
  ]),
  floor('operations', 'Operations', 'ทีมปฏิบัติการ', '#a1b7c3', 'แบบทีมสำหรับงานประจำ การบริการ และการติดตามข้อยกเว้น', [
    role('lead', 'Opal', 'Operations Lead', 'จัดลำดับงานประจำและมาตรฐานบริการ', 'Operations plan'),
    role('schedule', 'Tempo', 'Schedule Planner', 'จัดตารางงานและทรัพยากร', 'Service schedule draft'),
    role('process', 'Flow', 'Process Analyst', 'ทบทวนขั้นตอนและคอขวด', 'Process improvement brief'),
    role('quality', 'Cleo', 'Quality Reviewer', 'ตรวจหลักฐานและข้อยกเว้น', 'Quality checklist'),
  ], true),
  floor('knowledge', 'Knowledge (GKS)', 'ทีมความรู้', '#9bafc6', 'จัดแหล่งความรู้และตอบคำถามพร้อมหลักฐานอ้างอิง', [
    role('lead', 'Kora', 'Knowledge Curator', 'คัดแหล่งข้อมูลและดูแลวงจรเอกสาร', 'Curated source list'),
    role('pipeline', 'Piper', 'Pipeline Operator', 'ตรวจสถานะการนำเข้าและ generation', 'Pipeline run review'),
    role('research', 'Lex', 'Knowledge Researcher', 'สังเคราะห์คำตอบจากแหล่งที่อนุมัติ', 'Cited answer draft'),
    role('review', 'Proof', 'Citation Reviewer', 'ตรวจว่าแหล่งอ้างอิงรองรับคำตอบ', 'Citation and freshness review'),
  ]),
  floor('platform', 'Platform', 'ทีมแพลตฟอร์ม', '#8e9da9', 'ดูแลความพร้อม การเชื่อมต่อ และหลักฐานตรวจสอบระบบ', [
    role('lead', 'Core', 'Platform Coordinator', 'ติดตาม readiness และประสานเจ้าของระบบ', 'Readiness brief'),
    role('integrate', 'Link', 'Integration Specialist', 'วิเคราะห์สัญญาเชื่อมต่อและเหตุขัดข้อง', 'Integration diagnosis'),
    role('access', 'Gate', 'Access Administrator', 'เตรียมข้อเสนอสิทธิ์ตามคำขอเจ้าของ', 'Access change proposal'),
    role('audit', 'Echo', 'Audit Reviewer', 'ตรวจเหตุการณ์และหลักฐานการเปลี่ยนแปลง', 'Audit findings'),
  ]),
].map((domain, index) => Object.freeze({...domain, number: index + 1}));

export const floorByKey = key => domainFloors.find(domain => domain.key === key) || null;

export function floorAgents(domain, connected = [], mode = 'live') {
  return domain.roles.map((role, index) => {
    const source = role.sourceAgentId && connected.find(agent => agent.id === role.sourceAgentId);
    const live = mode === 'live' && !!source?.sessionId;
    return {
      ...source,
      id: `${domain.key}:${role.key}`, name: role.name, role: role.title,
      focus: role.responsibility, output: role.output, sourceAgentId: role.sourceAgentId,
      sessionId: live ? source.sessionId : null,
      status: live ? source.status : 'idle', connected: live, blueprint: !live,
      lastLog: live ? source.lastLog : role.responsibility,
      avatar: source?.avatar || {outfit: ['#F5EFE4', '#1F2937', '#D6ECFA', '#C6A052'][index % 4], skin: ['#dfaf8c', '#f1c8a6', '#82573e', '#b9825b'][index % 4], hair: ['bob', 'short', 'bun', 'short'][index % 4], glasses: index === 0},
    };
  });
}
