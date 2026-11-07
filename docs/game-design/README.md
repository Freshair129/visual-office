# Office Tycoon — เริ่มงานจากตรงนี้

**31 October 2026:** the owner accepted the current low-rate slice for MVP and
authorized PR delivery. Read [the acceptance scope and retained limits](OFFICE-MVP-ACCEPTANCE-20261031.md)
before continuing. Main context/privacy protections and the default illustrated
shell described below are preserved. This is local MVP acceptance, not physical
every-frame 33.3 ms, backend or live Zuri qualification.

**สถานะปัจจุบัน 26 ตุลาคม 2026:** [PR #10](https://github.com/Freshair129/zuri-visual-office/pull/10)
รวมที่ main `94973644`; [CI](https://github.com/Freshair129/zuri-visual-office/actions/runs/40326980103)
ผ่าน 747 tests, build และ pinned compatibility. หน้าเริ่มต้นใช้ภาพ campus/Lobby
เดิมพร้อม HUD แบบเกม; dynamic-domain candidate ใช้ภาพชุดเดียวกันผ่าน OfficeArtScene.
GLB/Native/Hybrid เป็น editor และ edition ที่ยังรองรับ ไม่ใช่การบังคับเปลี่ยนทั้งแอป
เป็นต้นแบบสีเขียว ตัวละครใช้ asset ชั่วคราว; งานภาพสุดท้ายยังไม่ผ่านตรวจรับ
ทุกการทดสอบล่าสุดใช้ synthetic; ยังไม่มี live Zuri/Agent หรือ shared scene-save acceptance.
อ่าน [คู่มือแอปปัจจุบัน](../../README.md) และ [ดัชนีเอกสาร](../README.md) ก่อน
รายละเอียดการผลิตและหลักฐานรุ่นก่อนด้านล่าง

## ประวัติ production baseline 23–24 ตุลาคม

สถานะ 24 ตุลาคม 2026: **Marketing P1 รวมเข้า main แล้ว; ใช้ข้อมูล synthetic เท่านั้น**
PR #1 รวมที่ `6de3a4540189837c0f376969f1e07193d93b50e4` ผ่าน 427 tests,
build และ 57 pinned fixtures พร้อมทดสอบแอปหลักและ built Worker ในเครื่อง
ดู [ขอบเขต integration](MARKETING-INTEGRATION-SCOPE.md) และ
[แผนทดสอบจอเล็กต่อจาก P1](../superpowers/plans/historical/2026-10-24-marketing-responsive-acceptance.md)
สถานะ connected slice และการสั่ง Agent จริงยังไม่ผ่าน; รายงานต้นแบบรอบแรกด้านล่างเป็นประวัติ

ต้นแบบ GLB รุ่น23ตุลาคมมีหน้าอาคาร, G Lobby และ Projects พร้อม HUD/dock และแผ่นรายละเอียด
เมื่อกดวัตถุ ตัวแก้ไข Tycoon บันทึกตำแหน่ง/ขนาด/สีแยกชั้นได้ และมี blueprint/navigation,
group/layer/texture, prefab และ custom GLB library แล้ว แต่ยังไม่อ้างครบทุก editor gate
และยังไม่มีการตรวจรับคำสั่ง Zuri Agent จริง

Independent builder review ของ design v0.2 ผ่านการทบทวนซ้ำวันที่23ตุลาคม:
ปิดประเด็น Lobby3D/ไฟล์เก่า และ local sceneคู่กับข้อมูลสดในdesign§9.1–9.2แล้ว
ไม่มีคำถามสำคัญที่ค้างสำหรับผู้พัฒนา; เจ้าของอนุมัติให้เดินตาม workflow แล้ว
ดู [implementation plan และสถานะรายงาน](../superpowers/plans/historical/2026-10-23-office-tycoon.md)
และผลต้นแบบรอบแรกในเอกสาร Integration ด้านล่าง

เป้าหมายที่เจ้าของเลือกคือ **หน้าอาคาร + Lobby + Projects** ที่ใช้งานเหมือนเกม
Office Tycoon: เข้าอาคาร เลือกชั้น แตะวัตถุ ดูงานและสั่งงานจริงผ่าน Zuri
เอา sidebar ประจำออกจาก Office และขยายชั้นอื่นหลังตัวอย่างนี้ผ่านการทดลองใช้

## อ่านตามลำดับ

1. [Design: หน้าจอ, กติกา, มุมกล้อง และการทำงาน](../superpowers/specs/historical/2026-10-23-office-tycoon-design.md)
2. [Workflow: ลำดับการผลิตแบบเกม ตั้งแต่แปลนถึงทดลองใช้จริง](TYCOON-PRODUCTION-WORKFLOW.md)
3. [Asset list: ต้องปั้นอะไร จำนวนเท่าไร กี่มุม และ animate อย่างไร](TYCOON-ASSET-LIST.md)
4. [Integration และ acceptance: สิ่งที่มีจริง สิ่งที่รอ และวิธีตรวจรับ](TYCOON-INTEGRATION-AND-ACCEPTANCE.md)
5. [Wireframes](tycoon-wireframes.svg) — ภาพโครง UI สำหรับสื่อสาร ไม่ใช่ final art หรือหน้าที่รันแล้ว
6. [Implementation plan](../superpowers/plans/historical/2026-10-23-office-tycoon.md) — ไฟล์ที่รับผิดชอบ ลำดับทดสอบ และงานที่ยังค้าง

## การใช้เครื่องมือที่ยังรองรับ

เริ่ม local preview ตาม [README](../../README.md) แล้วเปิด `#office/studio`
เลือกชั้นและแท็บ GLB เพื่อแก้ edition นั้นอย่างชัดเจน; ไม่ใช้ปุ่มสลับธีม prototype
ที่ถอดออกแล้วเป็นทางเข้า ใน dynamic candidate ปุ่ม Studio ปิดรอ scene contract
เครื่องมือ Tycoon ของชั้นที่รองรับให้เลือกวัตถุ แก้ค่า เพิ่ม/ลบ/สำเนา
กด **บันทึกชั้นนี้** แล้ว **เข้าดูชั้นนี้** มี JSON ส่งออก/เปิดไฟล์และ Undo
ตอนนี้บันทึกในเบราว์เซอร์เครื่องนี้; การรีเฟรชไม่ลบสถานะที่บันทึกไว้
เครื่องมือแปลน ทางเดิน จุดนั่ง และประตูใช้กับ Tycoon GLB ได้แล้วใน Lobby/Projects
อ่าน [วิธีใช้และการบันทึก GLB Studio](../OFFICE-BLUEPRINTS.md#glb-studio-adapter--24-october-2026)
GLB รองรับเลือกหลายชิ้น Group/Ungroup ย้าย/หมุน/ปรับขนาด/สำเนาทั้งชุด จัด layer และใส่ texture แล้ว ดู OFFICE-BLUEPRINTS.md ส่วน GLB selection; ยังไม่อ้าง parity ทั้ง Studio

ผู้ใช้ไม่จำเป็นต้องสั่งงานเป็นศัพท์ game dev ให้ใช้คำว่า **“ทำช่วงถัดไปตาม workflow”**
ผู้พัฒนาต้องอ่านผลของช่วงก่อนหน้า ตรวจ dependency แล้วเดินงานที่พร้อมต่อได้เอง
ถ้าติด API ให้ระบุเจ้าของและสิ่งที่ต้องได้ พร้อมเดินงานฉาก/โมเดลที่ไม่ขึ้นกับ API ต่อ
ห้ามข้ามเกณฑ์ทดลองสั่งงานจริงแล้วเรียกทั้ง slice ว่าเสร็จ

## Authority

- [SRS](../VISUAL-OFFICE-SRS.md) ถือ requirement และสถานะของ Office
- Design อธิบายการนำ requirement ไปทำ UX/เกม; workflow และ asset list เป็นรายละเอียดการผลิต
- [Architecture](../ARCHITECTURE.md) ถือ system/data boundary; [integration boundary](../ZURI-PLATFORM-INTEGRATION-BOUNDARY.md) ถือข้อจำกัดของ client
- Zuri เป็นเจ้าของข้อมูล, identity, สิทธิ์, Agent และผลคำสั่ง เอกสารชุดนี้ไม่ประกาศ API แทน Zuri
- `office-evolution-v01.png` และ prompt เดิมเป็นแนวคิด economy รุ่นก่อน เก็บไว้เป็นประวัติ ไม่ใช่ art target ของ slice นี้

## Artifacts ของ package

- [Economy concept image v0.1](office-evolution-v01.png) — historical reference.
- [Original concept prompt](office-evolution-v01.prompt.md) — provenance, not current UI instructions.
- [Marketing integration scope](MARKETING-INTEGRATION-SCOPE.md) — synthetic consumer boundary and open live gates.

รายละเอียดเช่นจำนวน asset, กล้อง, งบ geometry และปุ่ม HUD เป็นข้อเสนอของผู้พัฒนา
ตามการมอบหมายให้กำหนด workflow; การเลือกรูปแบบ Office Tycoon, GLB, Lobby/Projects
และการทำเอกสารก่อนมาจากคำขอของเจ้าของโดยตรง

## Local MVP implementation and evidence additions

- [Chair lifecycle and frame pacing — 30 October 2026](OFFICE-CHAIR-PERFORMANCE-20261030.md)
- [Office department teams and workflow designs](OFFICE-DEPARTMENT-TEAMS.md)
- [Frame deadlines and Studio first use — 30 October 2026](OFFICE-FRAME-DEADLINES-20261030.md)
- [Desk start and scale1.25 departure — 30 October 2026](OFFICE-FRAME-STALLS-20261030.md)
- [Resumable pose solve — 31 October 2026](OFFICE-RESUMABLE-POSE-20261031.md)
- [Office Tycoon space functions](OFFICE-SPACE-FUNCTIONS.md)
- [Studio first-draw trace — 31 October 2026](OFFICE-STUDIO-FIRST-DRAW-20261031.md)
- [Studio submission cadence and hidden draw — 31 October 2026](OFFICE-STUDIO-SUBMISSION-20261031.md)
- [Department world verification — 29 October 2026](OFFICE-WORLD-VERIFICATION-20261029.md)
- [Functional floors and dimensions — 30 October 2026](OFFICE-WORLD-VERIFICATION-20261030.md)
- [Office world: identity and registration handoff](OFFICE-ZURI-REGISTRATION-HANDOFF.md)
- [Local verification: lower-limb collision and office plans](TYCOON-COLLISION-VERIFICATION.md)
- [Office Tycoon — all-floor spatial plans](TYCOON-FLOOR-PLANS.md)
- [Tycoon upper-limb desk contact](TYCOON-UPPER-CONTACT.md)
- [tycoon-domain-floor-candidates.svg](tycoon-domain-floor-candidates.svg)
- [tycoon-floor-plans.svg](tycoon-floor-plans.svg)
- [Measured department floor-plan sheets](floor-plans/README.md)

## Character continuation references

- [README.md](characters/README.md)
