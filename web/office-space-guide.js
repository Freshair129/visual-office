import OFFICE_DEPARTMENTS from './office-departments.js';

// @spec docs/game-design/OFFICE-SPACE-FUNCTIONS.md — local proposed room uses.
// @tested tests/office-space-guide.test.mjs

const use = (purpose, activities, roleKeys, workflowStepKeys) => Object.freeze({
  purpose,
  activities: Object.freeze(activities),
  roleKeys: Object.freeze(roleKeys),
  workflowStepKeys: Object.freeze(workflowStepKeys),
});

const AREA_USES = Object.freeze({
  lobby: Object.freeze({
    'lobby-public-arrival': use(
      'จุดต้อนรับและบอกทางไปยังแผนกที่เกี่ยวข้อง',
      ['ต้อนรับผู้มาติดต่อ', 'อธิบายจุดหมายที่ Office รองรับ'],
      ['host'], ['capture-request'],
    ),
    'lobby-intake': use(
      'พื้นที่ทำความเข้าใจผลลัพธ์ที่ผู้ร้องขอต้องการ',
      ['สรุปคำขอด้วยถ้อยคำของผู้ร้องขอ', 'ระบุข้อมูลที่ยังต้องถามเพิ่ม'],
      ['intake'], ['clarify-intent'],
    ),
    'lobby-private-meeting': use(
      'พื้นที่ทบทวนบริบทและยืนยันปลายทางก่อนเตรียมส่งต่อ',
      ['ตรวจแหล่งที่มาและข้อจำกัดด้านข้อมูล', 'ยืนยันแผนกกับผู้ร้องขอ', 'เตรียมสรุปสำหรับผู้รับช่วง'],
      ['evidence', 'router'], ['check-context', 'confirm-route', 'prepare-handoff'],
    ),
    'lobby-waiting': use(
      'ที่นั่งรอระหว่างติดต่อเจ้าหน้าที่หรือเลือกปลายทาง',
      ['รอรับการต้อนรับและคำแนะนำจาก Lobby Host'],
      ['host'], ['capture-request'],
    ),
  }),
  projects: Object.freeze({
    'projects-delivery-hub': use(
      'จุดจัดทำชิ้นงานตามแผนและรวบรวมหลักฐานส่งมอบ',
      ['เตรียมชิ้นงานในขอบเขตที่กำหนด', 'รวบรวมหลักฐานและประเด็นส่งต่อ'],
      ['lead', 'delivery'], ['frame-objective', 'prepare-work-item'],
    ),
    'projects-focus-room': use(
      'พื้นที่โฟกัสสำหรับแตกเป้าหมายเป็น workstream และ dependency',
      ['ร่าง workstream และลำดับงาน', 'ระบุ milestone, gate และสิ่งที่ต้องพึ่งพา'],
      ['planner'], ['draft-plan'],
    ),
    'projects-dependency-wall': use(
      'ผนังทบทวนเป้าหมาย งานที่พึ่งพากัน และจุดตัดสินใจ',
      ['จัดความสัมพันธ์ระหว่างงาน', 'ทบทวนขอบเขตและเจ้าของการตัดสินใจ'],
      ['lead', 'planner'], ['frame-objective', 'draft-plan'],
    ),
    'projects-review-room': use(
      'ห้องตรวจแผนส่งมอบ หลักฐาน และความเสี่ยงที่ยังค้าง',
      ['ตรวจเกณฑ์ acceptance', 'บันทึกช่องว่างและข้อเสนอรับมอบ'],
      ['review'], ['review-plan'],
    ),
  }),
  customer: Object.freeze({
    'customer-public-wait': use(
      'ที่นั่งรอรับบริการโดยไม่แสดงรายละเอียดเคสลูกค้าในพื้นที่เปิด',
      ['รอเริ่มการสนทนากับ Customer Care'],
      ['care'], ['summarize-request'],
    ),
    'customer-intake': use(
      'จุดรับเรื่องและรวบรวมบริบทลูกค้าที่ได้รับอนุญาต',
      ['สรุปคำขอหรือบทสนทนา', 'ตรวจบริบทลูกค้าที่มีสิทธิ์เข้าถึง'],
      ['care', 'crm'], ['summarize-request', 'check-customer-context'],
    ),
    'customer-relations': use(
      'พื้นที่วางแผนความสัมพันธ์และการติดตามลูกค้า',
      ['ทบทวนบริบทลูกค้า', 'ร่างเส้นทาง lifecycle', 'เสนอ next action สำหรับผู้รับผิดชอบ'],
      ['crm', 'lifecycle', 'sales'], ['check-customer-context', 'draft-lifecycle-response', 'propose-follow-up'],
    ),
    'customer-private-case': use(
      'พื้นที่หารือรายละเอียดเคสลูกค้าและตรวจขอบเขตการตอบกลับ',
      ['สรุปคำขอและบริบทลูกค้าที่ได้รับอนุญาต', 'ทบทวนร่างคำตอบก่อนส่งต่อให้ผู้รับผิดชอบ'],
      ['care', 'crm'], ['summarize-request', 'check-customer-context', 'review-response'],
    ),
    'customer-private-consult-1': use(
      'ห้องนัดหารือรายละเอียดเคสลูกค้า',
      ['สรุปคำขอและบริบทลูกค้าที่ได้รับอนุญาต', 'ทบทวนร่างคำตอบก่อนส่งต่อให้ผู้รับผิดชอบ'],
      ['care', 'crm'], ['summarize-request', 'check-customer-context', 'review-response'],
    ),
    'customer-private-consult-2': use(
      'ห้องนัดหารือรายละเอียดเคสลูกค้า',
      ['สรุปคำขอและบริบทลูกค้าที่ได้รับอนุญาต', 'ทบทวนร่างคำตอบก่อนส่งต่อให้ผู้รับผิดชอบ'],
      ['care', 'crm'], ['summarize-request', 'check-customer-context', 'review-response'],
    ),
  }),
  market: Object.freeze({
    'market-signal-wall': use(
      'ผนังจัดกลุ่มสัญญาณตลาดก่อนสรุปผลกระทบต่อธุรกิจ',
      ['เปรียบเทียบข้อสังเกตที่มีวันที่และแหล่งที่มา', 'สังเคราะห์ผลกระทบและระดับความเชื่อมั่น'],
      ['analyst', 'insight'], ['compare-observations', 'synthesize-implication'],
    ),
    'market-research-pods': use(
      'พื้นที่ค้นคว้าและจัดระเบียบข้อสังเกตจากแหล่งที่อนุญาต',
      ['รวบรวม source references', 'จัดข้อสังเกตตามคำถามวิจัยและวันที่'],
      ['research', 'analyst'], ['organize-sources', 'compare-observations'],
    ),
    'market-source-library': use(
      'จุดเก็บและตรวจแหล่งอ้างอิงสำหรับงานวิเคราะห์ตลาด',
      ['จัดรายการแหล่งข้อมูลและวันที่ตรวจ', 'สังเกตข้อมูลที่ล้าสมัยหรือขัดแย้ง'],
      ['research', 'review'], ['organize-sources', 'review-evidence'],
    ),
    'market-evidence-review': use(
      'ห้องตรวจที่มา ความสดใหม่ และข้อขัดแย้งของหลักฐาน',
      ['ตรวจ provenance ของข้อสรุป', 'ทำเครื่องหมายข้อมูลที่ยังไม่ยืนยัน'],
      ['review'], ['review-evidence'],
    ),
  }),
  growth: Object.freeze({
    'growth-content-studio': use(
      'สตูดิโอร่างสารหลัก เนื้อหา และแนวทางสร้างสรรค์ของแคมเปญ',
      ['ร่าง content plan และข้อความ', 'เตรียม creative direction สำหรับตรวจทาน'],
      ['content', 'creative'], ['draft-content', 'prepare-creative'],
    ),
    'growth-campaign-bay': use(
      'พื้นที่วาง brief และลำดับงานแคมเปญ',
      ['กำหนดเป้าหมายและช่องทางที่เสนอ', 'รวบรวมประเด็นที่รอการตัดสินใจ'],
      ['lead'], ['frame-campaign', 'collect-decision'],
    ),
    'growth-performance': use(
      'พื้นที่วางการทดลอง สมมติฐานงบ และตัวชี้วัด',
      ['ร่าง media plan', 'กำหนดวิธีวัดผลและสมมติฐานสำหรับทบทวน'],
      ['performance'], ['draft-measurement'],
    ),
    'growth-campaign-review': use(
      'ห้องทบทวนชุดแคมเปญก่อนการตัดสินใจของมนุษย์',
      ['ตรวจ brief, เนื้อหา และแผนวัดผล', 'รวบรวมประเด็นอนุมัติที่ยังค้าง'],
      ['lead', 'performance'], ['draft-measurement', 'collect-decision'],
    ),
    'growth-edit-booth-a': use(
      'บูธย่อยสำหรับร่างและปรับแก้ข้อความของแคมเปญ',
      ['เขียนและปรับข้อความตาม brief', 'จัด content draft สำหรับ creative review'],
      ['content'], ['draft-content'],
    ),
    'growth-edit-booth-b': use(
      'บูธประกอบแนวทางภาพและเตรียมชิ้นงานสร้างสรรค์',
      ['จัดทำ creative direction', 'เตรียม creative draft ให้มนุษย์ตรวจ'],
      ['creative'], ['prepare-creative'],
    ),
  }),
  'line-oa': Object.freeze({
    'line-oa-flow-lab': use(
      'ห้องออกแบบเส้นทางบทสนทนาและข้อความตอบกลับ',
      ['กำหนดขอบเขต journey', 'ร่างข้อความ ตัวเลือก และ fallback'],
      ['lead', 'design'], ['bound-journey', 'draft-messages'],
    ),
    'line-oa-channel-ops': use(
      'พื้นที่เตรียมรายการตรวจความพร้อมของช่องทาง LINE',
      ['ทบทวน checklist การตั้งค่าที่รออนุมัติ', 'บันทึกกรณีที่ยังไม่พร้อม'],
      ['ops'], ['check-readiness'],
    ),
    'line-oa-preview-bay': use(
      'พื้นที่ดูตัวอย่าง flow และทดสอบทางเลือกก่อนตรวจ QA',
      ['ไล่ข้อความและ fallback ตาม flow ที่ร่าง', 'บันทึกกรณีทดสอบที่ต้องตรวจต่อ'],
      ['design', 'review'], ['draft-messages', 'review-flow'],
    ),
    'line-oa-qa-room': use(
      'ห้องตรวจคุณภาพ flow, handoff และกรณีผิดพลาด',
      ['ทดสอบกรณีขอบและเส้นทาง handoff', 'จัดชุดผลตรวจสำหรับผู้อนุมัติ'],
      ['review'], ['review-flow'],
    ),
  }),
  commerce: Object.freeze({
    'commerce-order-coordination': use(
      'จุดรวบรวมบริบทคำสั่งซื้อและข้อยกเว้นที่ต้องตรวจ',
      ['สรุป snapshot คำสั่งซื้อที่ได้รับอนุญาต', 'ระบุคำถามเรื่องราคา การชำระเงิน หรือการส่งมอบ'],
      ['lead'], ['assemble-order'],
    ),
    'commerce-pricing': use(
      'พื้นที่คำนวณข้อเสนอราคาโดยอิงข้อมูลที่อนุมัติ',
      ['คำนวณราคาในรูปแบบร่าง', 'แสดงเงื่อนไขและสมมติฐานที่ต้องตรวจ'],
      ['pricing'], ['check-pricing'],
    ),
    'commerce-fulfilment': use(
      'พื้นที่วางแผนขั้นตอนส่งมอบโดยใช้หลักฐาน Inventory',
      ['ตรวจหลักฐาน stock และกำหนดส่ง', 'ร่างขั้นตอนถัดไปสำหรับผู้รับผิดชอบ'],
      ['fulfilment'], ['check-fulfilment'],
    ),
    'commerce-exception-room': use(
      'ห้องตรวจข้อยกเว้นและความครบถ้วนทางการเงิน',
      ['บันทึกความต่างและทางเลือกจัดการ', 'ส่งประเด็นที่ต้องอนุมัติให้ผู้มีอำนาจ'],
      ['review'], ['review-exception'],
    ),
    'commerce-exception-triage': use(
      'จุดจัดกลุ่มข้อยกเว้นและเตรียมประเด็นส่งให้ผู้รับผิดชอบพิจารณา',
      ['รวบรวมหลักฐานประกอบข้อยกเว้น', 'เตรียมประเด็นที่ต้องให้ผู้มีอำนาจทบทวน'],
      ['review'], ['review-exception'],
    ),
  }),
  inventory: Object.freeze({
    'inventory-stock-position': use(
      'จุดทบทวนยอดคงเหลือและหลักฐานความเคลื่อนไหวสินค้า',
      ['สรุป stock position จาก ledger view ที่ได้รับอนุญาต', 'ระบุข้อมูลที่ยังไม่ครบหรือไม่สดใหม่'],
      ['lead'], ['verify-stock-view'],
    ),
    'inventory-reservation': use(
      'พื้นที่ร่างทางเลือกการจองหรือเติมสินค้า',
      ['เปรียบเทียบความต้องการกับยอดที่ตรวจได้', 'เตรียม reservation หรือ replenishment proposal'],
      ['reserve'], ['draft-options'],
    ),
    'inventory-count-bench': use(
      'โต๊ะตรวจนับและเปรียบเทียบหลักฐานกับยอดใน ledger',
      ['จัดผลนับตาม SKU', 'แยกจำนวนที่ตรงและต่างจาก ledger'],
      ['count'], ['compare-count'],
    ),
    'inventory-variance-room': use(
      'ห้องทบทวนความต่างจากการนับและคุณภาพข้อมูล SKU',
      ['ตรวจหลักฐานของรายการที่คลาดเคลื่อน', 'ระบุช่องว่างด้านหน่วยหรือข้อมูล catalog'],
      ['count', 'quality'], ['compare-count', 'review-catalog'],
    ),
    'inventory-count-loop': use(
      'เส้นทางสัญจรรอบจุดนับสินค้าส่วนกลาง',
      ['เข้าถึงจุดนับจากหลายด้าน', 'เชื่อมการเดินระหว่างพื้นที่นับกับจุดทบทวน'],
      [], [],
    ),
    'inventory-replenishment': use(
      'พื้นที่ร่างทางเลือกเติมสินค้าและทบทวนการปล่อยรายการจอง',
      ['เปรียบเทียบความต้องการกับยอดที่ตรวจได้', 'เตรียมข้อเสนอเติมหรือคืนรายการจองให้ผู้รับผิดชอบตรวจ'],
      ['reserve'], ['draft-options'],
    ),
  }),
  warehouse: Object.freeze({
    'warehouse-inbound-plan': use(
      'พื้นที่ร่างขั้นตอนรับเข้าและแนวทาง put-away',
      ['วางลำดับงาน inbound ตามสมมติฐานที่ระบุ', 'ชี้ข้อมูลพื้นที่คลังที่ยังต้องยืนยัน'],
      ['lead', 'inbound'], ['frame-process', 'draft-inbound-outbound'],
    ),
    'warehouse-pick-pack-plan': use(
      'พื้นที่วางแผนหยิบและแพ็กสินค้าเชิงแนวคิด',
      ['ร่าง pick-and-pack flow', 'ทบทวนข้อยกเว้นและสมมติฐานด้านสถานที่'],
      ['outbound'], ['draft-inbound-outbound', 'review-outbound-flow'],
    ),
    'warehouse-capacity-board': use(
      'จุดจัดระเบียบสมมติฐานพื้นที่และกำลังรองรับของคลัง',
      ['ทำรายการข้อสมมติเรื่องพื้นที่และตำแหน่ง', 'เตรียมคำถามให้เจ้าของคลังตรวจ'],
      ['lead'], ['frame-process'],
    ),
    'warehouse-process-review': use(
      'ห้องตรวจ checklist และข้อยกเว้นของกระบวนการคลัง',
      ['ทบทวนความปลอดภัยและขั้นตอนที่เสนอ', 'ทำเครื่องหมายเรื่องที่ต้องให้เจ้าของคลังยืนยัน'],
      ['review'], ['review-process'],
    ),
    'warehouse-outbound-plan': use(
      'พื้นที่ร่างแผนรอบหยิบและลำดับการส่งออกสำหรับเจ้าของคลังตรวจ',
      ['จัดกลุ่มสมมติฐานของ outbound wave', 'ทบทวน flow หยิบและแพ็กที่เสนอ'],
      ['outbound'], ['review-outbound-flow'],
    ),
    'warehouse-inbound-staging': use(
      'พื้นที่จัดลำดับแผนรับเข้าในสำนักงาน',
      ['ร่างลำดับนัดรับและขั้นตอนเตรียม put-away', 'ระบุสมมติฐานที่เจ้าของคลังต้องยืนยัน'],
      ['inbound'], ['draft-inbound-outbound'],
    ),
  }),
  procurement: Object.freeze({
    'procurement-supplier-comparison': use(
      'โต๊ะเปรียบเทียบข้อมูลและเงื่อนไขซัพพลายเออร์',
      ['เทียบข้อเสนอ ราคา และ lead time ที่มีหลักฐาน', 'บันทึกข้อมูลที่ยังขาดก่อนตัดสินใจ'],
      ['supplier'], ['compare-suppliers'],
    ),
    'procurement-purchase-plan': use(
      'พื้นที่จัดกรอบความต้องการซื้อและแผนเติมสินค้า',
      ['สรุปความต้องการที่ได้รับอนุมัติ', 'ระบุรายการที่ต้องให้เจ้าของตรวจ'],
      ['lead'], ['frame-purchase-need'],
    ),
    'procurement-po-coordination': use(
      'จุดเตรียมร่างรายการใบสั่งซื้อและติดตามบรรทัดค้าง',
      ['จัดร่าง order lines', 'รวบรวมข้อยกเว้นก่อนส่งให้ผู้อนุมัติ'],
      ['po'], ['draft-order'],
    ),
    'procurement-receipt-review': use(
      'ห้องเปรียบเทียบหลักฐานรับสินค้ากับคำสั่งซื้อ',
      ['ตรวจหลักฐานรับและรายการสั่งซื้อ', 'ระบุ variance ที่ต้องให้มนุษย์แก้ไข'],
      ['receipt'], ['review-receipt-plan'],
    ),
    'procurement-staff-zone': use(
      'พื้นที่ทำงานทีมจัดซื้อสำหรับเตรียมความต้องการและร่างใบสั่งซื้อ',
      ['จัดกรอบความต้องการซื้อ', 'เตรียม order lines ให้ผู้มีอำนาจตรวจ'],
      ['lead', 'po'], ['frame-purchase-need', 'draft-order'],
    ),
    'procurement-award-board': use(
      'ผนัง scorecard สำหรับเตรียมข้อมูลเปรียบเทียบซัพพลายเออร์ให้ผู้ตัดสินใจ',
      ['เปรียบเทียบหลักฐานและเงื่อนไขซัพพลายเออร์', 'สรุปประเด็นประกอบการตัดสินใจของมนุษย์'],
      ['supplier'], ['compare-suppliers'],
    ),
  }),
  assets: Object.freeze({
    'assets-intake-inspection': use(
      'พื้นที่ตรวจสภาพและจัดหลักฐานทรัพย์สินที่รับเข้า',
      ['ทบทวนหลักฐาน intake', 'ร่างรายการข้อมูลที่ต้องยืนยันก่อนลงทะเบียน'],
      ['receive'], ['inspect-intake'],
    ),
    'assets-register-wall': use(
      'จุดทบทวนทะเบียนและความสัมพันธ์ด้านผู้ดูแลทรัพย์สิน',
      ['รวบรวมหลักฐาน identity และ custody', 'ชี้ข้อมูลทะเบียนที่ยังต้องตรวจ'],
      ['lead'], ['assemble-review'],
    ),
    'assets-lifecycle': use(
      'พื้นที่วางคำแนะนำด้านบำรุงรักษาและวงจรชีวิตทรัพย์สิน',
      ['จัดเตรียมทางเลือกดูแลหรือจัดสรร', 'บันทึกเงื่อนไขที่ต้องให้เจ้าของอนุมัติ'],
      ['lifecycle'], ['prepare-lifecycle'],
    ),
    'assets-audit-room': use(
      'ห้องตรวจหลักฐานนับและข้อยกเว้นในทะเบียนทรัพย์สิน',
      ['เปรียบเทียบหลักฐานนับกับทะเบียน', 'สรุปความต่างให้ผู้ดูแลตรวจ'],
      ['audit'], ['compare-count'],
    ),
    'assets-intake-bench': use(
      'โต๊ะตรวจสภาพและเตรียมป้ายกำกับทรัพย์สินที่รับเข้า',
      ['จัดรายการสภาพและหลักฐานรับเข้า', 'เตรียมข้อมูลที่ต้องยืนยันก่อนลงทะเบียน'],
      ['receive'], ['inspect-intake'],
    ),
  }),
  people: Object.freeze({
    'people-private-service': use(
      'จุดรับคำขอบริการบุคลากรในพื้นที่หารือที่เป็นส่วนตัว',
      ['ระบุวัตถุประสงค์และขอบเขตคำขอ', 'ส่งประเด็นที่ต้องทบทวนให้ผู้รับผิดชอบ'],
      ['lead'], ['triage-request'],
    ),
    'people-directory': use(
      'จุดตรวจข้อมูล directory ที่ได้รับอนุญาตและการแก้ไขที่เสนอ',
      ['ตรวจเฉพาะฟิลด์ที่มีสิทธิ์เข้าถึง', 'ระบุข้อมูลที่ต้องให้เจ้าของยืนยัน'],
      ['directory'], ['check-directory'],
    ),
    'people-onboarding': use(
      'พื้นที่จัดรูปแบบ checklist จากรายละเอียดที่เจ้าของอนุมัติแล้ว',
      ['จัดรายการขั้นตอนเริ่มงาน', 'ทำเครื่องหมายข้อมูลที่ยังต้องถามจากมนุษย์'],
      ['onboard'], ['format-checklist'],
    ),
    'people-privacy-room': use(
      'ห้องทบทวนวัตถุประสงค์ ขอบเขตข้อมูล และผู้รับ',
      ['ตรวจความจำเป็นและขอบเขตข้อมูล', 'ส่งคำขอสิทธิ์ให้เจ้าของ Identity พิจารณา'],
      ['review'], ['review-privacy'],
    ),
    'people-consult-room-1': use(
      'ห้องหารือคำขอบริการบุคลากรเป็นรายกรณี',
      ['ทำความเข้าใจคำขอและบริบทที่ได้รับอนุญาต', 'ทบทวนขอบเขตข้อมูลก่อนส่งต่อผู้รับผิดชอบ'],
      ['lead', 'review'], ['triage-request', 'review-privacy'],
    ),
    'people-consult-room-2': use(
      'ห้องหารือคำขอบริการบุคลากรเป็นรายกรณี',
      ['ทำความเข้าใจคำขอและบริบทที่ได้รับอนุญาต', 'ทบทวนขอบเขตข้อมูลก่อนส่งต่อผู้รับผิดชอบ'],
      ['lead', 'review'], ['triage-request', 'review-privacy'],
    ),
  }),
  operations: Object.freeze({
    'operations-dispatch': use(
      'จุดจัดกรอบปัญหาบริการและเตรียมข้อเสนอปรับปรุง',
      ['บันทึกผลกระทบและเจ้าของกระบวนการ', 'จัดลำดับคำถามที่ต้องแก้ก่อนวางแผน'],
      ['lead'], ['frame-service'],
    ),
    'operations-schedule': use(
      'พื้นที่ร่างมุมมองเวลาและทรัพยากรสำหรับบริการ',
      ['จัดร่างช่วงเวลาและทรัพยากร', 'แยกข้อจำกัดที่ยังต้องให้เจ้าของยืนยัน'],
      ['schedule'], ['draft-schedule'],
    ),
    'operations-triage': use(
      'จุดวิเคราะห์ข้อยกเว้นและคอขวดในกระบวนการ',
      ['ทำแผนที่ขั้นตอนและคอขวด', 'ร่างทางเลือกปรับปรุงโดยอิงหลักฐาน'],
      ['process'], ['map-process'],
    ),
    'operations-quality-room': use(
      'ห้องตรวจหลักฐานและข้อยกเว้นของข้อเสนอปรับปรุง',
      ['ทบทวนหลักฐานและสมมติฐาน', 'รวบรวมประเด็นที่รอเจ้าของบริการตัดสินใจ'],
      ['quality'], ['review-quality'],
    ),
    'operations-control-island': use(
      'จุดประสานแผนบริการและหารือเปลี่ยนเวร',
      ['ทบทวนประเด็นบริการที่ทีมส่งมา', 'ร่างตารางและทรัพยากรให้เจ้าของบริการตรวจ'],
      ['lead', 'schedule'], ['frame-service', 'draft-schedule'],
    ),
    'operations-incident-room': use(
      'ห้องประสานการทบทวนเหตุขัดข้องและทางเลือกปรับปรุง',
      ['จัดลำดับข้อมูลเหตุการณ์ที่ได้รับ', 'ทบทวนแผนผังกระบวนการและข้อเสนอแก้ไข'],
      ['process', 'quality'], ['map-process', 'review-quality'],
    ),
  }),
  knowledge: Object.freeze({
    'knowledge-ingest-prep': use(
      'จุดคัดเลือกแหล่งข้อมูลและเตรียมรายการสำหรับ pipeline',
      ['คัด source references ที่เข้าเกณฑ์', 'ระบุข้อจำกัดของแหล่งข้อมูลก่อนนำเข้า'],
      ['lead', 'pipeline'], ['select-sources', 'summarize-pipeline-evidence'],
    ),
    'knowledge-pipeline': use(
      'พื้นที่ทบทวนหลักฐานการรับเข้าและผล pipeline',
      ['สรุปหลักฐาน admission และ run', 'ระบุขั้นตอนที่ยังไม่มีหลักฐานยืนยัน'],
      ['pipeline'], ['summarize-pipeline-evidence'],
    ),
    'knowledge-quiet-research': use(
      'พื้นที่ค้นคว้าเงียบสำหรับร่างคำตอบพร้อมอ้างอิง',
      ['สังเคราะห์คำตอบจากแหล่งที่อนุมัติ', 'คงคำถามที่หลักฐานยังตอบไม่ได้'],
      ['research'], ['draft-answer'],
    ),
    'knowledge-citation-review': use(
      'ห้องตรวจการรองรับของ citation ความสดใหม่ และขอบเขตแหล่งข้อมูล',
      ['ตรวจแต่ละ claim เทียบกับแหล่งอ้างอิง', 'ส่งคำตอบที่ไม่รองรับกลับไปเติมหลักฐาน'],
      ['review'], ['review-citations'],
    ),
    'knowledge-library-aisle': use(
      'แนวชั้นอ้างอิงสำหรับค้นและหยิบแหล่งข้อมูลที่เลือกไว้',
      ['ค้นรายการอ้างอิงตามคำถาม', 'รวบรวม source references เพื่อส่งเข้าขั้นคัดเลือก'],
      ['lead'], ['select-sources'],
    ),
  }),
  platform: Object.freeze({
    'platform-integration-workbench': use(
      'โต๊ะวิเคราะห์หลักฐานการเชื่อมต่อและข้อผิดพลาด',
      ['สรุปอาการและแหล่งหลักฐานที่ได้รับอนุญาต', 'ชี้สัญญาหรือการตั้งค่าที่ต้องตรวจ'],
      ['integrate'], ['diagnose-integration'],
    ),
    'platform-readiness-wall': use(
      'จุดจัดกรอบปัญหา readiness และระบุเจ้าของระบบ',
      ['บันทึกขอบเขตผลกระทบ', 'ระบุ domain owner และหลักฐานที่ต้องใช้'],
      ['lead'], ['frame-issue'],
    ),
    'platform-access-review': use(
      'ห้องเตรียมคำขอสิทธิ์แบบจำกัดขอบเขตและทบทวนความเสี่ยง',
      ['ร่างคำขอให้ Identity owner พิจารณา', 'ตรวจหลักฐานและความเสี่ยงก่อนส่งต่อ'],
      ['access', 'audit'], ['prepare-access-request', 'review-audit-evidence'],
    ),
    'platform-audit-room': use(
      'ห้องตรวจหลักฐาน audit และความเสี่ยงที่ยังค้าง',
      ['ตรวจ lineage ของหลักฐาน', 'สรุปความเสี่ยงที่ต้องให้เจ้าของรับทราบ'],
      ['audit'], ['review-audit-evidence'],
    ),
  }),
});

const departmentsByKey = new Map(OFFICE_DEPARTMENTS.map(department => [department.key, department]));

function validateAreaUseReferences() {
  for (const [floorKey, areas] of Object.entries(AREA_USES)) {
    const department = departmentsByKey.get(floorKey);
    if (!department) throw new Error(`Office space guide references unknown department ${floorKey}`);
    const roleKeys = new Set(department.roles.map(role => role.key));
    const workflowStepKeys = new Set(department.workflows.flatMap(workflow => workflow.steps.map(step => step.key)));
    for (const [areaId, areaUse] of Object.entries(areas)) {
      if (!areaId || areaUse.roleKeys.some(key => !roleKeys.has(key))) {
        throw new Error(`Office space guide ${floorKey}/${areaId} references an unknown role`);
      }
      if (areaUse.workflowStepKeys.some(key => !workflowStepKeys.has(key))) {
        throw new Error(`Office space guide ${floorKey}/${areaId} references an unknown workflow step`);
      }
    }
  }
}

validateAreaUseReferences();

const OBJECT_KIND_NAMES = Object.freeze({
  board: 'บอร์ด',
  cabinet: 'ตู้เก็บของ',
  chair: 'เก้าอี้',
  'coffee-table': 'โต๊ะกลาง',
  coffee: 'จุดกาแฟ',
  desk: 'โต๊ะทำงาน',
  kiosk: 'จุดข้อมูล',
  meeting: 'โต๊ะประชุม',
  plant: 'ต้นไม้',
  reception: 'เคาน์เตอร์ต้อนรับ',
  sofa: 'โซฟา',
});

const GENERIC_ACTIVITIES = Object.freeze({
  meeting: 'หารือและทบทวนงานในพื้นที่ที่กำหนด',
  rest: 'พักระหว่างงานตามการจัดพื้นที่ที่บันทึกไว้',
  work: 'ทำงานตามการจัดพื้นที่ที่บันทึกไว้',
});

function floorKeyOf(floor) {
  return typeof floor === 'string' ? floor : (typeof floor?.key === 'string' ? floor.key : '');
}

function localObjectCenter(object, plan, room) {
  if (!Number.isFinite(object?.x) || !Number.isFinite(object?.z)) return null;
  const width = Number.isFinite(plan?.width) ? plan.width : room?.width;
  const depth = Number.isFinite(plan?.depth) ? plan.depth : room?.depth;
  const worldOriginX = Number.isFinite(plan?.originX) ? plan.originX + 2 : (Number.isFinite(width) ? -width / 2 : 0);
  const worldOriginZ = Number.isFinite(plan?.originZ) ? plan.originZ + 2 : (Number.isFinite(depth) ? -depth / 2 : 0);
  return {x: object.x - worldOriginX, z: object.z - worldOriginZ};
}

function objectIsActor(object) {
  return object?.kind === 'actor'
    || object?.type === 'actor'
    || object?.intent === 'agent'
    || Object.hasOwn(object || {}, 'agentId');
}

function objectIdsInArea(area, objects, plan, room) {
  const x = area?.x;
  const z = area?.z;
  const width = area?.width;
  const depth = area?.depth;
  if (![x, z, width, depth].every(Number.isFinite) || width <= 0 || depth <= 0) return [];

  const ids = [];
  const seen = new Set();
  for (const object of objects) {
    if (typeof object?.id !== 'string' || !object.id || objectIsActor(object) || seen.has(object.id)) continue;
    const center = localObjectCenter(object, plan, room);
    if (!center || center.x < x || center.x > x + width || center.z < z || center.z > z + depth) continue;
    seen.add(object.id);
    ids.push(object.id);
  }
  return ids;
}

function fallbackUse(area, objects) {
  const type = typeof area?.type === 'string' ? area.type : '';
  const kindNames = [...new Set(objects
    .map(object => typeof object?.kind === 'string' && Object.hasOwn(OBJECT_KIND_NAMES, object.kind) ? OBJECT_KIND_NAMES[object.kind] : null)
    .filter(Boolean))].slice(0, 3);
  if (kindNames.length) {
    const joined = kindNames.join('และ');
    return {
      purpose: `${type === 'work' ? 'พื้นที่ทำงาน' : type === 'meeting' ? 'พื้นที่หารือ' : type === 'rest' ? 'พื้นที่พัก' : 'พื้นที่ใช้งาน'}ทั่วไปสำหรับ${joined}`,
      activities: [
        type === 'rest'
          ? `พักใกล้${joined}ที่จัดวางไว้`
          : type === 'work'
            ? `ทำงานกับ${joined}ที่จัดวางอยู่ในพื้นที่`
            : type === 'meeting'
              ? `หารือใกล้${joined}ที่จัดวางอยู่ในพื้นที่`
              : `ใช้งาน${joined}ที่จัดวางอยู่ในพื้นที่`,
      ],
      roleKeys: [],
      workflowStepKeys: [],
    };
  }
  return {
    purpose: `พื้นที่${type === 'work' ? 'ทำงาน' : type === 'meeting' ? 'หารือ' : type === 'rest' ? 'พัก' : 'ใช้งาน'}ทั่วไป`,
    activities: [GENERIC_ACTIVITIES[type] || 'ใช้งานพื้นที่ตามแปลนที่บันทึกไว้'],
    roleKeys: [],
    workflowStepKeys: [],
  };
}

/**
 * Describe the real, saved blueprint areas for a local Tycoon floor.
 * The returned role and workflow keys point to design proposals only; they do
 * not identify occupants, create assignments, or grant actions.
 */
export function buildFloorSpaceGuide(floor, room) {
  const plan = room?.blueprintPlan;
  if (!Array.isArray(plan?.areas)) return [];
  const objects = Array.isArray(room?.objects) ? room.objects : [];
  const floorKey = floorKeyOf(floor);
  const floorUses = Object.hasOwn(AREA_USES, floorKey) ? AREA_USES[floorKey] : null;

  return plan.areas
    .filter(area => area && typeof area.id === 'string' && area.id)
    .map(area => {
      const objectIds = objectIdsInArea(area, objects, plan, room);
      const actualObjects = objectIds.map(id => objects.find(object => object?.id === id)).filter(Boolean);
      const mappedUse = floorUses && Object.hasOwn(floorUses, area.id) ? floorUses[area.id] : null;
      const areaUse = mappedUse || fallbackUse(area, actualObjects);
      return {
        areaId: area.id,
        name: typeof area.name === 'string' && area.name ? area.name : area.id,
        type: typeof area.type === 'string' ? area.type : 'unknown',
        purpose: areaUse.purpose,
        activities: [...areaUse.activities],
        roleKeys: [...areaUse.roleKeys],
        workflowStepKeys: [...areaUse.workflowStepKeys],
        objectIds,
      };
    });
}
