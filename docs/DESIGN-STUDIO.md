# Design Studio — ห้องทดลอง 3D ชุดแรก

**สถานะเอกสาร 26 ตุลาคม 2026:** ส่วนต้นเป็นประวัติ model-preview รอบ20ตุลาคม
ไม่ใช่ข้อจำกัดของ Studio ทั้งระบบในปัจจุบัน ใช้ [Hybrid Studio](HYBRID-STUDIO.md),
[Native Studio](NATIVE-STUDIO.md) และ [Blueprint / GLB Studio](OFFICE-BLUEPRINTS.md)
สำหรับเครื่องมือแก้ฉากปัจจุบัน; dynamic context ยังปิด Studio รอ scene contract
ตาม [ขอบเขต Zuri](ZURI-PLATFORM-INTEGRATION-BOUNDARY.md).

อัปเดต 20 ตุลาคม 2026: หน้าแรกของ Studio เปลี่ยนเป็น [ตัวเลือกสไตล์สามแบบที่จัดวางได้](STUDIO-STYLES.md) แล้ว ห้อง procedural ด้านล่างยังอยู่ในแท็บ **โมเดลต้นแบบ 3D เดิม** และยังไม่ใช่งานภาพที่อนุมัติ

สถานะ: ต้นแบบใช้งานในเครื่อง · 20 ตุลาคม 2026

เปิด `#office/studio` หรือกด **ลองแต่งออฟฟิศ** จากชั้น G

## ใช้งานได้แล้ว

- ห้องสำนักงาน 3D แบบ cutaway พร้อมชุดโต๊ะและเก้าอี้ Starter / Studio / Signature
- เปลี่ยนชุดทุกโต๊ะหรือเลือกทีละโต๊ะได้ ทั้งจากภาพ 3D และปุ่มรายชื่อ
- เปลี่ยนวัสดุห้อง เพิ่ม/ถอดมุมพักด้านข้าง และย้ายต้นไม้ระหว่างสามจุดที่จัดไว้
- เปิดหุ่นจำลองท่านั่งที่โต๊ะ 1 เพื่อตรวจสัดส่วน เก้าอี้ทุกระดับใช้ seat anchor เดียวกัน
- ลองก่อนบันทึก มี Undo, คืนแบบที่บันทึก และ Apply; รีโหลดแล้วยังได้แบบที่บันทึก
- หมุน ซูม และคืนมุมกล้อง; ถ้า WebGL ไม่พร้อมยังเลือกและบันทึกแบบด้วยปุ่มได้

ทุกอย่างอยู่ใน art sandbox ไม่มี Business, tenant, domain, agent จริง หรือยอดแต้ม ข้อมูลตกแต่งบันทึกเฉพาะ localStorage ของเบราว์เซอร์ด้วย key `zuri-office:design-sandbox:v1` แยกจาก preference/assignment เดิม ไม่ส่งไป server การเปลี่ยน domain/module/API และ economy จริงยังพักอยู่

## ไฟล์และการสร้าง

แหล่งโมเดลที่แก้ไขได้: [`web/studio-models.js`](../web/studio-models.js)

GLB ยี่สิบชิ้นอยู่ใน [`web/assets/models/studio/`](../web/assets/models/studio/):

- `desk-starter.glb`, `desk-studio.glb`, `desk-signature.glb`
- `room-starter.glb`, `room-studio.glb`, `room-signature.glb`
- `room-signature-wing.glb`, `plant-movable.glb`, `mannequin-seated.glb`
- `chair-ergonomic.glb`, `meeting-table.glb`, `lounge-sofa.glb`, `coffee-table.glb`
- `storage-cabinet.glb`, `reception-counter.glb`, `bookcase.glb`, `floor-lamp.glb`
- `whiteboard.glb`, `coffee-station.glb`, `elevator-bay.glb`

[`manifest.json`](../web/assets/models/studio/manifest.json) มีขนาดไฟล์ จำนวนสามเหลี่ยม หน่วย แกน และ anchors โมเดลเป็น procedural geometry ที่สร้างสำหรับ Visual Office ไม่ใช้ texture หรือโมเดลภายนอก ชุด GLB เป็น export ของต้นฉบับเดียวกับที่ฉากใช้ประกอบ ไม่ต้องดาวน์โหลดโมเดลจากบริการภายนอก

สร้างเฉพาะชุดนี้:

```sh
node scripts/build-studio-assets.mjs
```

`npm run assets` และ `npm run build` รวมการสร้างชุดนี้แล้ว ตัวอย่างพอร์ต 4181 ใช้ `PORT=4181` กับ `node scripts/serve.mjs --preview` โดยไม่เปิด Zuri connector หรือโหลด bridge credentials

## การตรวจสอบ

- ตรวจซ้ำ 23 ตุลาคม 2026: `npm test` ผ่าน 225/225 ไม่มีข้าม
- ตรวจซ้ำ 23 ตุลาคม 2026: `npm run build` ผ่าน พร้อมฝัง assets 286 รายการใน Worker build; ยังไม่ได้เผยแพร่หรือ deploy
- GLB ทั้งยี่สิบชิ้นโหลดกลับผ่าน Three GLTFLoader จริงได้; โมเดล placeable มี stable Asset ID, footprint และ anchors ใน manifest
- Browser smoke ใน local preview: เปิดแท็บแก้ฉาก 3D ของชั้น Projects & Work ได้จริง; พบ 14 ตัวเลือกชั้น, Asset Library 20 รายการ และของเดิมในฉาก โดยไม่มี console error การทดสอบนี้ไม่เปิด Zuri connector และไม่ใช่ live platform acceptance
- tests ตรวจ preview/save/undo/cancel, corrupt storage, storage failure, WebGL fallback และการปิดห้อง/late import
- tests ตรวจคืน geometry/material หลังเปลี่ยนฉาก, หยุด render ขณะซ่อนหน้า, ยกเลิกงานหลัง dispose และ context loss
- ทดสอบใน in-app browser: เข้า Lobby → Studio → กลับ Lobby, เปลี่ยนทั้งห้อง/ทีละโต๊ะ, บันทึกแล้ว reload, Undo/Cancel, ย้ายต้นไม้, room style, lounge wing และ mannequin
- ตรวจที่ viewport 1280×900, 390×844 และ 320×780; ที่ 320px มีพื้นที่เนื้อหา 305px หลังหัก scrollbar และไม่มี horizontal overflow
- ฉาก Signature + lounge wing + mannequin: 9,712 triangles, 70 draw calls จาก renderer บนเครื่องนี้ (ก่อน batch เป็น 122 calls)

หลักฐานเฉพาะเครื่องในรอบนั้น (ไม่ได้เก็บใน Git และไม่มีไฟล์เหล่านี้ใน clean checkout;
รายการนี้เป็น historical locator ไม่ใช่ลิงก์ดาวน์โหลดหรือผลตรวจซ้ำ):

- `reports/design-studio-20261020/signature-desktop.png`
- `reports/design-studio-20261020/starter-desktop.png`
- `reports/design-studio-20261020/studio-desktop.png`
- `reports/design-studio-20261020/signature-mobile.png`
- `reports/design-studio-20261020/tests.txt` และ `reports/design-studio-20261020/build.txt`

การปรับฉากใช้ render เมื่อมีการเปลี่ยนแปลง ไม่วน animation ตลอดเวลา ตัวเลขข้างต้นไม่ใช่ผลวัด FPS บนอุปกรณ์มือถือจริง

## ขอบเขตของต้นแบบ

ห้องนี้มีสี่โต๊ะสำหรับเทียบงานศิลป์ ไม่กำหนดจำนวน role ของ domain ยังไม่มี drag-and-drop อิสระ การเดินของตัวละคร หรือเครื่องมือประกอบห้องหลายจำนวนโต๊ะ จุดย้ายต้นไม้และมุมพักเป็นตำแหน่งทดลองที่จัดไว้ ผนังเป็น cutaway แบบคงที่

ขั้นถัดไปที่ต่อได้โดยไม่รอ platform คือ snapping/placement ของเฟอร์นิเจอร์กับทางเดิน และ modular lobby/lift kit ใช้โครงสร้างจาก [art brief](3D-ART-BRIEF-V0.1.md) ส่วน roster จริงและการขยายองค์กรต้องรอ Zuri


## Additive Tycoon GLB tools — 24 October 2026

The historical prototype limitations above describe the original model-preview tab. The
**แต่ง Tycoon GLB** tab now uses saved Lobby/Projects state with blueprint, partition, opening,
walk-path, forbidden-zone, seat and door authoring. It includes transient GLB probes, explicit
floor save, structural templates, JSON exchange and Undo/Redo. Start with the
[GLB Studio workflow](OFFICE-BLUEPRINTS.md#glb-studio-adapter--24-october-2026).
GLB multi-selection, groups, layers and local textures are implemented; connected Zuri operations remain gated.

GLB Asset Library now includes **ชุดของฉัน**: save selected furniture with an actual 3D
thumbnail, then place a fresh group in another supported floor. Details, limits and local-only
persistence are in [Reusable furniture sets](OFFICE-BLUEPRINTS.md#reusable-furniture-sets-in-asset-library-24-october-2026).
Cards also export portable `.office-set.json` bundles with model bytes, textures, preview and
seat anchors. Import into another compatible-kit installation adds a fresh personal card;
placing and saving a destination floor remain explicit actions.
The **นำเข้าโมเดล GLB ของฉัน** section now accepts supported user GLBs with names/categories,
measured dimensions, point-marked previews and authored standing/seating interactions. Models
are stored in IndexedDB and included in custom/mixed v2 portable sets; see OFFICE-BLUEPRINTS.
