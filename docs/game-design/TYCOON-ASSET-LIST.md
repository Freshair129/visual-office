---
status: proposed-production-specification
version: 0.1.0
date: 2026-10-23
---

# ต้องปั้นอะไร กี่ชิ้น กี่มุม

**26 October note:** counts/budgets below are the dated slice production brief,
not a fresh asset census or art acceptance. Active defaults retain illustrated
skins over physical geometry; explicit GLB editing is supported. Character assets
are temporary, with final visual approval open. Read [current design sources](../DESIGN-SOURCES.md)
and [the package status](README.md) before producing another revision.

Spec สำหรับ [Office Tycoon slice](../superpowers/specs/historical/2026-10-23-office-tycoon-design.md)
รายการนี้เป็นเป้าหมายผลิต ไม่ใช่สต็อกโมเดลใหม่ที่เสร็จแล้ว
ไฟล์เก่าตรวจจาก `web/assets/models/studio/manifest.json` revision `office-models/v1`
พบ20 GLB entries; renderer Officeปัจจุบันยังสร้างบางส่วนจากfactoryโดยตรง

## กลยุทธ์จำนวนชิ้น

**24 asset definitions:** อาคาร3 + โครงห้อง8 + props12 + character master1
การวาง100เก้าอี้คือ100instancesของassetเดียว ไม่ต้องปั้น100ไฟล์
appearance3แบบเป็นmaterial/hair presetsร่วมrig ไม่เพิ่มจำนวนAgent

| ID การผลิต | ชิ้นส่วน / สัดส่วนอ้างอิงเมตร | จำนวนต้นแบบ | สถานะที่ตรวจ / งานที่ต้องทำ |
| --- | --- | --- | --- |
| T01 | ฐานอาคาร/ทางเข้า 16×12×0.3 | 1 | ใหม่; ใช้texture/สีอ่อน ไม่มีข้อมูลธุรกิจ |
| T02 | facade floor band กว้าง12 ลึก8 สูง3.2 | 1 | ใหม่; วางซ้ำG+Projects; sidecutawayและlabelanchor |
| T03 | roof cap 12×8×0.4 | 1 | ใหม่; ซ่อนเมื่อเข้าfloor |
| A01 | floor tile 1×1×0.1 | 1 | ใหม่; repeat material/UVไม่ยืดtextureตามขนาดห้อง |
| A02 | wall solid 1×0.2×2.8 | 1 | ใหม่จากarchitecture; ปรับความยาว; frontcutawayตามrenderer |
| A03 | window module ช่องกว้าง1.8 | 1 | ใหม่; frame/glassแยกnodes; sill/topตามblueprint |
| A04 | door frame ช่องกว้าง1.2 สูง2.25 | 1 | ใหม่จากarchitecture; collisionเป็นช่องว่างเมื่อเปิด |
| A05 | door leaf 1.2×0.06×2.2 | 1 | ใหม่; hinge/slide pivotชัด; closed blockerตรงตำแหน่ง |
| A06 | glass divider 1×0.08×2.0 | 1 | ใหม่; glassผิวโปร่งแต่collisionยังกันเดิน |
| A07 | column 0.3×0.3×2.8 | 1 | ใหม่; ใช้เฉพาะไม่รบกวนdoor/aisle |
| A08 | skirting 1×0.03×0.12 | 1 | ใหม่; ตามwallsegment; ไม่เชื่อมข้ามช่องประตู |
| P01 | reception counter 2.55×1.1 | 1 | มี `reception-counter.glb`; ตรวจfootprint/material/picking |
| P02 | elevator bay 2.55×0.85 | 1 | มี `elevator-bay.glb`; แยกdoor nodesและยึดผนัง; ห้ามลอย |
| P03 | directory kiosk 0.6×0.5×1.4 | 1 | ใหม่; screenanchorเป็นDOMtext ไม่bakeชื่อfloor |
| P04 | project/notice board 1.95×0.58 | 1 | reuse/refine `whiteboard.glb`; วัตถุเดียวใช้คนละintentในLobby/Projects |
| P05 | workstation desk 1.6×0.8 สูง0.75 | 1 | refine desk-studio เป็นrevisionใหม่ไม่มีเก้าอี้ฝัง; จอ/keyboardรวมได้ |
| P06 | office chair footprint0.9×0.95 | 1 | มี `chair-ergonomic.glb`; ตรวจseatheightกับdeskใหม่; ไม่ทับrevisionเดิม |
| P07 | meeting table 2.7×1.45 | 1 | มี `meeting-table.glb`; ตรวจheight/seat alignment |
| P08 | lounge sofa 2.05×1.05 | 1 | มี `lounge-sofa.glb`; ใช้2seatanchors+approach |
| P09 | coffee table footprint1.65×1.35 | 1 | มี `coffee-table.glb`; ตรวจสัดส่วนกับsofa |
| P10 | coffee/water station 1.55×0.88 | 1 | มี `coffee-station.glb`; refineจุดinteraction; ยังไม่เพิ่มdrinkclipในชุดแรก |
| P11 | storage cabinet 1.55×0.85 | 1 | มี `storage-cabinet.glb`; projectartifactentryเมื่อAPIพร้อม |
| P12 | potted plant footprintประมาณ0.6×0.6 | 1 | มี `plant-movable.glb`; no business action |
| C01 | generic office adult สูงอ้างอิง1.7 | 1rig | มีproceduralcharacterในJS; ต้องexportGLB+7clipsและตรวจjoint |

ขนาดตารางเป็นauthoring targetใหม่ ไม่ใช่คำกล่าวว่าmeshเก่าตรงแล้ว
measure bounding boxจากGLBจริงทุกตัว; ปรับrevisionใหม่ถ้าผิด
เฉพาะwindow/doorframe/leafต้องรองรับความกว้างblueprintด้วยparametersและanchorร่วม
การยืดpanelอาจทำได้ แต่ห้ามยืดhandle/ลูกบิดจนเสียสัดส่วน

## จำนวนวางในฉากเริ่มต้น

| Asset | Lobby ใหม่ | Projects ใหม่ | เหตุผล |
| --- | --- | --- | --- |
| reception counter | 1 | 0 | เปลี่ยนBusiness/การเชื่อมต่อ |
| elevator bay | 1 | 1 | เชื่อมfloor-directory; ต้องเข้ากับผนัง |
| directory kiosk | 1 | 0 | ป้ายเลือกชั้น |
| board | 1 | 1 | Lobbyคำแนะนำ, Projectsงานจริง |
| workstation | 0 | 4 | จุดเปิดงาน; ไม่ใช่จำนวนAgent |
| chair | 0 | 6 | โต๊ะ4 + meeting2 |
| meeting table | 0 | 1 | จุดเปิดแผนProject |
| sofa | 2 | 1 | พื้นที่พัก |
| coffee table | 1 | 1 | พื้นที่พัก |
| coffee station | 1 | 1 | prop/approachpoint |
| cabinet | 0 | 1 | entryผลงาน |
| plant | 3 | 2 | จุดเน้นและกรอบห้อง |
| character | 0ในliveหากไม่มีroster | Nตามauthorizedroster | demo4ตัวเฉพาะฉากที่ติดป้ายdemo |

ตัวเลขนี้เป็นdefault composition; ไม่เปลี่ยนของในsnapshotที่มีแล้ว
จำนวนmodularwalls/tilesคิดจากblueprintจริง ไม่ทำเป็น20assetใหม่เพราะวาง20ชิ้น
เลือกถอดdecorก่อนหากfootprintบังทาง ไม่ลดระยะเดินเพื่อยัดinventory

## ต้องทำกี่มุม

- **หนึ่งโมเดลเต็มสามมิติ/ชิ้น** มีด้านหน้า หลัง ข้าง และบนจริง
- **กล้องใช้งานหนึ่งมุม**: azimuth45°, elevation≈31.33°, orthographic, pan/zoom
- **QA screenshots5มุมต่อasset**: heroใช้งาน + front + side + back + top
  เพื่อจับpivot/ทะลุ/normal/รายละเอียดด้านที่ไม่เห็น; ไม่ใช่5โมเดล
- **asset card2ภาพ**: heroและtop footprint ใช้โมเดลrevisionเดียวกับruntime
- **characterQA8ทิศ** รอบตัวจากrigเดียวสำหรับการเดินเปลี่ยนทิศ
- **animation7clips** ไม่ใช้spriteเดิน8ทิศแทนGLB; เปลี่ยนheadingของrootตามpath

## Animation list

| Clip | Target duration | Loop | Trigger / ข้อจำกัด |
| --- | --- | --- | --- |
| `idle` | 3s | yes | ยืน/รอ; ไม่เท่ากับAgentว่าง |
| `walk` | 0.9s | yes | in-place; navigationขยับrootประมาณ1.1m/s แล้วปรับspeedให้เท้าไม่ไถ |
| `sit_down` | 0.8s | no | ถึงapproach, reserveที่นั่ง, turn→seat; ห้ามwarpทะลุโต๊ะ |
| `seated_work` | 2.4s | yes | handsไปkeyboard/โต๊ะ; tooltipธุรกิจใช้sourceจริงแยกจากclip |
| `stand_up` | 0.8s | no | ออกseatไปapproachที่ยังเดินได้แล้วrelease |
| `talk` | 2.5s | yes | เปิดcharacterdetailหรือpresentationalidle; ไม่อ้างกำลังเรียกLLM |
| `gesture_point` | 1.2s | no | feedbackเมื่อเลือกboard/สถานี |

crossfadeประมาณ0.15s, no root translationในclips, reduced-motionใช้poseคงที่
ข้ามนั่งหากapproach/seatblocked; กดงานได้โดยไม่รอanimation
door open/closeเป็นprop motion0.35sที่controllerขับจากsavedstate ไม่ใช่clipตัวละคร
collisionปิดทันทีเมื่อยอมรับcloseและตรวจoccupied; เปิดให้เดินเมื่อบานพ้นช่องจริง
prototypeปัจจุบันเปลี่ยนสถานะทันที ดังนั้นtransitionนี้ต้องมีregressionใหม่ก่อนเรียกพร้อม

## งบเทคนิคเริ่มต้นสำหรับ slice

งบนี้เป็นเป้าหมายออกแบบ ต้องวัดจริงก่อนอ้างperformance:

| รายการ | Budget |
| --- | --- |
| propsทั่วไป | ≤8,000 triangles/asset; ≤8materials; รวมmeshที่ใช้materialเดียวเมื่อไม่ต้องขยับแยก |
| actor | ≤15,000triangles, ≤32bones, ≤4materials,1rig3presets |
| texture | shared atlasส่วนใหญ่1024²; สูงสุด2048²เฉพาะจำเป็น; ขนาดบอกในmanifest |
| visible scene | ≤250,000triangles และ ≤180drawcalls ที่desktopเริ่มต้น |
| GLB+textureโหลดครั้งแรกของpilot | ≤12MiBไม่รวมJS/font; วัดnetworkbytes ไม่ใช้จำนวนไฟล์เดา |
| active renderer | canvasเดียวต่อOffice view; inactivefloordispose/pause; ไม่renderทุกชั้นเต็มdetailพร้อมกัน |
| motion | desktopเป้า60fps; mobileเป้า30fps; ระบุdevice/viewport/DPR/dataก่อนสรุป |

หากไม่ถึงงบ ให้instanceเฟอร์นิเจอร์, sharematerials, จำกัดshadowcasters/DPR,
pauseoffscreenและลดdecorก่อนลดความชัดของinteraction
ตัวเลขperformanceไม่ผ่านด้วยunit test; ต้องเก็บtimingsจริงอย่างน้อย60วินาทีหลังwarmup

## Deliverable ของ asset แต่ละ revision

1. Editable sourceหรือdeterministicgenerator พร้อมsourcehash
2. GLBที่parse/importได้; `meters`, `Y-up`, `+Z forward`สำหรับpropsใหม่,
   groundpivot[0,0,0]; ระบุcorrectionสำหรับlegacyassetชัดเจน
3. Metadata: stableassetId,revision,file,sha256,byteLength,category,dimensions,
   bounds,footprint,ground/seat/approach/UIanchor,materialslotsและanimationnames
4. License/provenanceที่ถูกต้อง; originalgeometryระบุเช่นนั้น ห้ามเดาlicenseทรัพย์สินภายนอก
5. Previewhero/topและinspection5มุมที่ผูกhashเดียวกัน
6. Validation: noNaN/negativeunintendedscale/badnormals/missingtextures;
   bounds/pivotตรง,triangle/materialbudget, GPUimport/occlusion/animation
7. Catalogcard + explicit load into scene; loading/failureplaceholderไม่เปลี่ยนbusinessbinding

Asset dataไม่เก็บTenant/Business/Agent ID, permissionหรือcommandendpoint
instance IDที่duplicateต้องใหม่; role/Agent bindingไม่ถูกcopyเป็นcanonicalrecord
เก็บGLB revisionเก่าที่saved floorยังอ้างไว้; migrationต้องexplicitและย้อนกลับได้
