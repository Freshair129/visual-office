# Office Tycoon — all-floor spatial plans

เอกสารนี้บันทึกแปลนเริ่มต้นสำหรับ Lobby และ floor keys ทั้ง 14 ชั้นของ Office Tycoon ใน Visual Office แปลนเหล่านี้เป็นฉากจำลองเฉพาะ local preview ไม่สร้าง Zuri business domain, role, permission, agent roster หรือ live workflow

## ขอบเขตและการอนุมาน

- [360 North Green digital brochure, หน้า 15](https://360northgreen.com/wp-content/uploads/2024/01/360NG-Digital-Brochure.pdf) ให้แนวคิดเรื่อง lift/service core ที่เชื่อมกับพื้นที่เข้าและพื้นที่ทำงานรอบนอกเท่านั้น ไม่มีการคัดลอกขนาดหรือเส้นผัง
- [Herman Miller — Work in Progress](https://www.hermanmiller.com/en_eur/stories/why-magazine/work-in-progress/) และ [ภาพ workshop floor-plan collage](https://www.hermanmiller.com/content/dam/hmicom/page_assets/stories/why_magazine/work_in_progress/it_why_work_in_progress_04.jpg.rendition.480.480.jpg) เป็นข้อมูลเชิงคุณภาพสำหรับการจัดพื้นที่ทำงาน โฟกัส และทบทวน ไม่ใช่แบบวัดระยะ
- Visual Office profile ให้แนวทางโทนอุ่นและเฟอร์นิเจอร์นุ่ม งานนี้ใช้ geometry จากโมเดล Three.js ที่มีอยู่; SVG ใช้ตรวจขนาดและความสัมพันธ์ของพื้นที่

## ขนาดและแกนร่วม

### อ่านมิติและพิมพ์แปลน

[ภาพรวมครบ 15 ชั้น](tycoon-floor-plans.svg) แสดงขนาดภายในชั้น ขนาดพื้นที่แต่ละห้อง/โซน พื้นที่ตารางเมตร ความกว้างช่องประตู และจุดวัดทางเดิน A1/A2 พร้อมสเกลบาร์ 0–4 เมตร ป้าย R1–R6 อ้างอิงชื่อพื้นที่และมิติในตารางกำกับใต้แปลนของชั้นนั้น เพื่อลดการทับกันของข้อความในพื้นที่ย่อยที่ซ้อนกัน ตัวเลขดึงจากพิกัดเดียวกับ geometry ของฉาก ไม่มีการประมาณจากภาพหน้าจอ ป้ายอ่านแบบปัดทศนิยมหนึ่งตำแหน่ง; พิกัดต้นฉบับและค่าใน manifest เก็บความละเอียดเดิม

`clear` คือระยะใช้สอยถึงผิวผนังภายในห้องที่ล้อมด้วยผนังจริง โดยหักครึ่งความหนาผนังกั้น 0.20 เมตรจากขอบพื้นที่ตามแนวศูนย์กลางผนังแต่ละด้าน ส่วน `zone` คือกรอบพื้นที่ใช้งานตามแบบซึ่งไม่จำเป็นต้องปิดล้อม บางโซนใหญ่มีพื้นที่ย่อยซ้อนอยู่ จึงห้ามนำทุกค่า ตร.ม. มาบวกรวมกัน เส้นประสีฟ้าเป็นเส้นทางจากทางเข้าไปโถงลิฟต์ที่หาได้จาก navigation ไม่ใช่เส้นบอกความกว้างทางเดิน

ไฟล์ SVG แยกชั้นด้านล่างมีขนาดกระดาษเป็นมิลลิเมตรและสเกล **1:100 เฉพาะเมื่อพิมพ์ 100% / Actual size** โดย 24 เมตรต้องวัดบนกระดาษได้ 240 มิลลิเมตร การเลือก Fit to page จะเปลี่ยนสเกล ควรใช้ A3 แนวนอนที่ไม่ย่อขยาย; ยังไม่ได้ตรวจงานพิมพ์จริง

| ชั้น | แปลนมีมิติ |
|---|---|
| G · Lobby | [SVG](floor-plans/lobby.svg) |
| 01 · Projects | [SVG](floor-plans/projects.svg) |
| 02 · Customer | [SVG](floor-plans/customer.svg) |
| 03 · Market Intelligence | [SVG](floor-plans/market.svg) |
| 04 · Marketing | [SVG](floor-plans/growth.svg) |
| 05 · LINE OA | [SVG](floor-plans/line-oa.svg) |
| 06 · Commerce | [SVG](floor-plans/commerce.svg) |
| 07 · Inventory | [SVG](floor-plans/inventory.svg) |
| 08 · Warehouse | [SVG](floor-plans/warehouse.svg) |
| 09 · Procurement | [SVG](floor-plans/procurement.svg) |
| 10 · Assets | [SVG](floor-plans/assets.svg) |
| 11 · People | [SVG](floor-plans/people.svg) |
| 12 · Operations | [SVG](floor-plans/operations.svg) |
| 13 · Knowledge | [SVG](floor-plans/knowledge.svg) |
| 14 · Platform | [SVG](floor-plans/platform.svg) |

พื้นจำลองทุกชั้นกว้าง 24 เมตร ลึก 16 เมตร รวม 384 ตารางเมตร ใช้ base ขนาด large ที่ขยายขอบเขตของแปลน Tycoon โดยไม่มีการเปลี่ยน schema ของ room snapshot พิกัดแปลนเป็น local x=[0,24], z=[0,16] และแปลงเป็น world ด้วย x-12, z-8 ประตูทางเข้าอยู่กึ่งกลางผนังด้านหน้า กว้าง 1.6 เมตร

ทุกชั้นใช้ core ชุดเดียวกัน:
- ผนัง core อยู่ local x=[9,15], z=[0.2,4.2] หรือ world x=[-3,3], z=[-7.8,-3.8]
- ลิฟต์อยู่ world (0,-5.6), หันเข้าหาประตู core ทางด้านหน้า
- service reserve เป็นพื้นที่ปิดใน mockup ไม่มีบันได ไม่มีห้องน้ำ และไม่มีการจำลองการเดินทางของลิฟต์
- หน้าต่างสองบานอยู่ผนังหลัง โดยเว้นช่วง core

ตำแหน่งและขนาดผนัง ประตู เฟอร์นิเจอร์ และพื้นที่มาจาก floor-plan factory เดียวกัน ผนังกั้นมีช่องเปิดจริงในข้อมูล geometry; เส้นทางเดินตรวจจาก geometry และ footprint เฟอร์นิเจอร์ ไม่มีแกนทางเดินตรงแบบเดียวบังคับทุกชั้น บางชั้นใช้ loop, U-flow, ห้องรับคำปรึกษาหลายห้อง หรือ control island ตามหน้าที่

Warehouse คงผนัง U-flow ไว้ แต่เพิ่มช่องเปิดกว้าง 1.8 เมตรที่กึ่งกลาง rear crossbar ให้ตรงกับประตูเข้า shared core จึงเดินจากทางเข้าด้านหน้าผ่าน U และต่อถึง lift lobby ได้

### ขนาดทางเดินที่แสดง

ตัวเลขในแบบและ guide มาจาก cross-section ที่วัดระหว่างผิวเฟอร์นิเจอร์หรือผนังจริง แต่ละ probe เป็นแนวแกนตรง อยู่ในกรอบ 24×16 เมตร และตัดการชนกับเฟอร์นิเจอร์หรือผนังปิดออก ขนาดเหล่านี้เป็นค่าของ simulation geometry ไม่ใช่เกณฑ์อาคารหรือ accessibility

| ชั้น | จุดวัด | ความกว้าง |
|---|---|---:|
| Lobby | ช่องระหว่างผนัง lounge กับขอบโซฟา | 2.78 ม. |
| Projects | ช่องระหว่างโต๊ะทำงานคู่ใน delivery hub | 1.90 ม. |
| Customer | ช่องระหว่างผนัง waiting room กับขอบโซฟา | 2.58 ม. |
| Market | ช่องระหว่างโต๊ะ research pod | 1.90 ม. |
| Growth | จากช่องประตู performance room ถึงขอบโต๊ะ | 3.00 ม. |
| LINE OA | ช่องระหว่างโต๊ะ flow lab | 1.90 ม. |
| Commerce | จากผนัง pricing room ถึงขอบโต๊ะ | 2.30 ม. |
| Inventory | รอบ count island สองด้าน | 2.55 ม. ต่อด้าน |
| Warehouse | ระหว่างขอบ capacity board กับผนัง U-flow | 2.93 ม. |
| Procurement | ช่องระหว่างโต๊ะใน staff planning row | 2.60 ม. |
| Assets | จากผนัง inspection bay ถึงขอบโต๊ะ | 3.30 ม. |
| People | จากผนัง consultation room ถึงขอบโต๊ะ | 2.30 ม. |
| Operations | ระหว่าง control table กับผนังด้านตะวันออก | 2.55 ม. |
| Knowledge | ช่องในชั้นหนังสืออ้างอิงด้านหลัง | 1.95 ม. |
| Platform | ช่องระหว่างโต๊ะ integration workbench | 1.90 ม. |

## โปรแกรมและ topology ของแต่ละชั้น

ชื่อต่อไปนี้อธิบายการจัดพื้นที่ในฉากเท่านั้น ไม่ได้ระบุความสามารถหรือสถานะจริงของ Zuri

| Floor key | พื้นที่และ topology | จำนวนห้องปิด |
|---|---|---:|
| Lobby | Reception และ intake อยู่ด้านหน้า, visitor meeting room ปิด, waiting lounge ปิดและแยกจากทางเข้า | 2 |
| Projects | Delivery hub แบบเปิด, ห้อง focus และห้อง review แยกกัน, planning screen จบก่อนช่องประตู | 2 |
| Customer | Public intake/waiting แยกจากความสัมพันธ์ลูกค้า; มีห้อง consult ส่วนตัวสองห้องและห้อง case review | 4 |
| Market | Research pods และ evidence library เป็น open bays; มีห้อง evidence review | 1 |
| Growth | Content studio และ campaign bay; แยก performance room กับ editing booths สองห้องและ campaign review | 4 |
| line-oa | Flow lab, channel operations และ preview bay เชื่อมกัน; มี QA room ปิด | 1 |
| Commerce | Order coordination และ pricing room; แยก fulfilment จาก exception triage และ exception review | 2 |
| Inventory | Count island อยู่กลางห้อง count loop ที่เดินอ้อมได้; stock position และ reservation อยู่คนละ bay กับ variance review | 2 |
| Warehouse | Inbound → capacity → outbound planning เรียงเป็น U-shaped loop; ช่องเปิดหลัง U ต่อถึง lift lobby; process review อยู่ในห้องปิด | 1 |
| Procurement | Supplier comparison เป็นห้องประชุมด้าน public; staff planning/PO zone อยู่แยกกัน และมี receipt review room | 2 |
| Assets | Inspection bay ปิดแยกจาก register wall และ lifecycle bay; มี audit room แยก | 2 |
| People | ห้อง consult ส่วนตัวสองห้องและ privacy room; directory กับ onboarding อยู่ใน open service bays | 3 |
| Operations | Dispatch/schedule/triage รอบ central control-huddle island; incident room และ quality room แยกกัน | 2 |
| Knowledge | Source prep อยู่ด้านหน้า, pipeline bay อยู่กลาง, quiet research และ library aisle อยู่ด้านหลัง; citation review แยกห้อง | 2 |
| Platform | Integration workbench และ readiness wall; access review และ audit evidence แยกห้อง | 2 |

อย่างน้อยหก topology มีโครงสร้างเฉพาะ: Inventory ใช้ central count loop, Warehouse ใช้ U-flow, People ใช้ private consult suite, Procurement แยก public suite กับ staff zone, Operations ใช้ control island, Knowledge วาง source prep ไว้ด้านหน้าและ reference aisle ไว้ด้านหลัง, Growth ใช้ editing booths, และ Customer แยก consultation rooms เป็นรายห้อง

พื้นที่ใช้ชนิดที่มีอยู่แล้ว ได้แก่ work, rest และ meeting ทุกพื้นที่ที่ตั้งชื่อใน default plan มีเฟอร์นิเจอร์จริงในฉาก พื้นที่ชื่อ private หรือ audit ไม่ได้บังคับสิทธิ์ข้อมูล

## สถานีงานและข้อมูลเดิม

แต่ละ department floor มีโต๊ะทำงานสี่ตำแหน่งและเก้าอี้คู่กัน โดยเว้นระยะศูนย์กลางโต๊ะถึงเก้าอี้ 1.20 เมตร รักษา ID เดิมของ Projects/Growth เป็น desk-1..4 และ chair-1..4; ชั้นอื่นคง station IDs ปัจจุบันไว้ ตำแหน่ง station สามารถเปลี่ยนตามพื้นที่ ส่วน rig และรูปทรงเก้าอี้ยังใช้ catalog เดิม

ค่าเริ่มต้นใหม่มีผลเฉพาะ floor ที่ไม่มี Tycoon room บันทึกไว้ การโหลดหรือเลือก snapshot เดิม 12×8 เมตรจะไม่ย้าย ไม่ปรับขนาด และไม่เขียนทับข้อมูลนั้น การแก้ค่าเริ่มต้นเป็น draft ที่ undo ได้ และบันทึกหลังผู้ใช้เลือกบันทึกชั้นเท่านั้น

## ตรวจสอบและขีดจำกัด

การทดสอบเฉพาะชั้นตรวจ:
- ขนาด 24×16, core/lift datum ร่วมกัน และ partition geometry ที่แตกต่างครบ 15 แบบ โดยตัด labels กับ common core ออกจากการเปรียบเทียบ
- topology/room count ที่แตกต่างและพื้นที่มีเฟอร์นิเจอร์จริง
- ขอบเขต, การไม่ทับกันของเฟอร์นิเจอร์กับเฟอร์นิเจอร์/ผนัง, ช่องประตู, side entry และ dimension probes
- เส้นทางจากประตูหน้าถึง lift lobby และจากทั้งสองจุดไปยัง 4 station approaches ของทุก department floor; Lobby ต้องเชื่อมประตูถึง lift lobby ด้วย
- navigation ของทุก station ทั้ง 14 department floors และการรักษา 12×8 snapshot ที่บันทึกไว้

ใช้คำสั่ง node --test tests/tycoon-floor-plans.test.mjs เพื่อรันชุดตรวจ floor-plan การตรวจนี้เป็นหลักฐานของ local simulation geometry เท่านั้น

แปลนไม่ใช่แบบก่อสร้าง, การตรวจ building code, accessibility certification, ผังสำนักงานจริง หรือผังคลังสินค้าจริง ไม่มีข้อมูลพนักงาน, agent, live dispatch, external data, grant, role assignment หรือ business record อยู่ใน floor plan และไม่มีการเขียนข้อมูลเหล่านั้น
