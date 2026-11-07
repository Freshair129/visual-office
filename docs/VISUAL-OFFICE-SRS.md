---
title: Visual Office Software Requirements Specification
status: draft-reconciled-to-local-source
version: 0.2.0
updated_at: 2026-11-06
scope: visual-office-browser-surface-and-design-studio
---

# Visual Office — Software Requirements Specification

31 October 2026 owner decision: the measured local low-rate slice is accepted
for MVP within the [recorded scope and retained limits](game-design/OFFICE-MVP-ACCEPTANCE-20261031.md).
This does not approve the whole SRS, grant business/Agent authority, or qualify
physical every-frame 33.3 ms, backend health or live Zuri integration. The
illustrated main shell and Business-scoped privacy controls remain in force.

เอกสารนี้เป็นจุดรวมข้อกำหนดของ Visual Office ฝั่งเรา ใช้ตรวจสิ่งที่มีในโค้ด,
สิ่งที่กำหนดเป็นประสบการณ์ผลิตภัณฑ์ และสิ่งที่ยังต้องรอ Zuri platform ก่อนเชื่อมจริง
รหัส `VO-FR` และ `VO-NFR` เป็นรหัส traceability ภายใน Visual Office ไม่ใช่รหัส
requirement ของ Zuri และไม่ได้เพิ่มข้อกำหนดให้ platform

สถานะ `draft-reconciled-to-local-source` หมายถึงตรวจเทียบกับ source tree ที่อ่านได้
และระบุช่องว่างแล้ว ยังไม่ใช่การอนุมัติ SRS, acceptance จากผู้ใช้ หรือหลักฐานว่า
Zuri live integration ผ่าน

## 1. วัตถุประสงค์และผู้ใช้เอกสาร

27 October functional continuation: the owner accepted current human models
temporarily and deferred art polish. [System gap analysis](SYSTEM-GAP-ANALYSIS.md)
maps all existing IDs to source/tests and separates local completion from live,
shared-save, accessibility/device and performance gates. It adds no requirement
identity or Zuri contract; this SRS retains requirement authority.

ระบุ behavior, UI, data boundary, quality requirements และ acceptance ของ Visual
Office ให้ Product, Design, Engineering, QA และทีม Zuri platform ใช้ร่วมกัน
เอกสารนี้รวมข้อกำหนดระดับระบบ ไม่แทนรายละเอียด editor หรือ design rationale
ของเอกสารเฉพาะทางที่ระบุไว้ใน [แผนผังเอกสาร](#15-โครงสร้างเอกสารและ-traceability)

รูปแบบเอกสารยืมหลักการจาก ISO/IEC/IEEE 29148:2018 เรื่อง requirement ที่ชัด,
ตรวจสอบได้และเชื่อมโยงได้ และใช้มุมมองสถาปัตยกรรมตาม concern/stakeholder จาก
ISO/IEC/IEEE 42010:2022 ไม่อ้างว่าเอกสารนี้ได้รับการรับรองตามมาตรฐานทั้งฉบับ

## 2. ขอบเขตระบบ

Visual Office คือ browser-based visual surface สำหรับสำรวจออฟฟิศ ดูข้อมูลที่ได้รับ
อนุญาต และแก้ presentation state ของฉาก รายละเอียดธุรกิจ, Tenant/Business/Workspace/
domain identity, Agent definitions, role, permission, Agent commands และ business CRUD
ยังเป็นอำนาจของ Zuri platform

ณ source revision `949736446824d4803f9109a20830202494abd7b7` มี renderer selection
สามกรณีที่ต้องไม่รวมเป็น default เดียว:

1. **เส้นทางปกติ** ใช้ `BuildingView` และ presentation mapping แบบ pinned จาก
   `web/domain-office.js` ซึ่งมี 14 ชั้นตัวอย่างและ role blueprint ประกอบภาพ
   รายการนี้ไม่ใช่ domain ที่ได้รับอนุญาตของ Business ปัจจุบันหรือ Agent roster.
2. **edition ที่ผู้ใช้เลือกและบันทึกไว้** เลือก `TycoonView`/GLB ได้เฉพาะชั้นที่มี
   `tycoon3d` ใน local `TycoonStore`; GLB/Native Studio ยังเป็นความสามารถ local ที่ใช้งาน
   อยู่ ไม่ใช่ artwork default ของเส้นทางปกติ.
3. **dynamic-context candidate** เป็น local synthetic harness profile ที่เลือก
   `TycoonDomainView` และ `OfficeArtScene`. ใช้ campus/Lobby artwork และ painted
   HybridScene ที่มีอยู่; มันไม่แทน artwork ด้วย green GLB prototype และไม่ยืนยัน
   production Zuri authorization.

Legacy CRM/Marketing dashboard/sidebar ไม่ได้เป็นส่วนหนึ่งของ current app แล้ว.
Shared workspace header/dock ปัจจุบันยังใช้กับ workspace routes; `web/app.js` ซ่อน
ส่วนนี้เมื่ออยู่ใน Office route. Office navigation ภายในตัวฉากยังมี directory, dock หรือ contextual sheet
ตาม renderer ที่เลือก. Generic character/art ไม่ใช่ Agent record. ดูรายละเอียด route
selection และ art framing ใน §6.2 และ [production brief](game-design/README.md).

| อยู่ในขอบเขต Visual Office | อยู่นอกอำนาจหรือยังรอ Zuri |
| --- | --- |
| ภาพรวมตึก, Lobby ชั้น G, directory/ลิฟต์, floor scene และ navigation | สร้างหรือเปลี่ยน Tenant, Business, Workspace, domain หรือ membership |
| อ่านและนำเสนอข้อมูลของ Business ที่ session มีสิทธิ์เข้าถึง | ประกาศ domain registry หรือ role/Agent roster ให้เป็น canon |
| แก้ฉากตกแต่งและบันทึก draft แยกชั้น | เพิ่ม/ลบ Agent, เปลี่ยน role, assignment, permission หรือความสามารถ |
| Asset catalog ที่ bundle มากับเว็บ, preview และไฟล์ scene แบบมี version | shared asset storage, hosted scene persistence และ collaboration ข้ามอุปกรณ์ |
| แสดงผลการอ่านและคำสั่งที่ API รองรับ | generic Agent dispatch และการเขียน CRUD สำเร็จโดยไม่มีผลยืนยันจาก owner API |

## 3. แหล่งอ้างอิงและ authority

| ประเด็น | แหล่งอ้างอิง / อำนาจ |
| --- | --- |
| Visual Office behavior ที่ตรวจจากโค้ด | source ใน `web/`, `scripts/`, `tests/` ของ repository นี้ |
| Wireframe, wireflow และ user journey | [OFFICE-UX-FLOWS.md](OFFICE-UX-FLOWS.md) |
| Component/system views และ data ownership | [ARCHITECTURE.md](ARCHITECTURE.md) |
| ขอบเขตเชื่อม platform | [ZURI-PLATFORM-INTEGRATION-BOUNDARY.md](ZURI-PLATFORM-INTEGRATION-BOUNDARY.md) และ [DOMAIN-OFFICE.md](DOMAIN-OFFICE.md) |
| Art direction และ source of truth | [DESIGN-SOURCES.md](DESIGN-SOURCES.md), external Visual Office application profile |
| Hybrid editor | [HYBRID-STUDIO.md](HYBRID-STUDIO.md) |
| Original 3D editor | [NATIVE-STUDIO.md](NATIVE-STUDIO.md) |
| โมเดล/ภาพ/งานศิลป์ที่มีและขาด | [ART-PRODUCTION-PLAN.md](ART-PRODUCTION-PLAN.md) |
| ข้อเสนอ simulation/economy | [GAME-DESIGN-V0.1.md](GAME-DESIGN-V0.1.md), ยังไม่ใช่ธุรกิจจริง |
| Zuri product/domain/agent canon | upstream `zuri.ai/AGENTS.md` plus `zuri.ai/docs/PRODUCT.md` (upstream file last changed 2026-10-21 in `393c6387`; read from Zuri checkout revision `0f8ce05d3a54bd1c58d26b8b759ca50a650c3aa6` on 2026-10-26), ADRs, domain charters and canonical requirements at their named Zuri revisions; none is a local Visual Office document |

ถ้าเอกสาร Visual Office ขัดกับ Zuri contract ที่อนุมัติภายหลัง ให้ Zuri เป็นเจ้าของ
business semantics; reconcile SRS และ adapter ก่อนเปลี่ยน behavior

### 3.1 Terms

| คำ | ความหมายในเอกสารนี้ |
| --- | --- |
| Tenant | ขอบเขต isolation ของ Zuri; ไม่ใช่สาขา และ Office ไม่กำหนดค่าเอง |
| Business | ธุรกิจที่ผู้ใช้เลือกและ Zuri อนุญาตให้เข้าได้ |
| Domain | Business-scoped leaf domain returned by an owner-approved Zuri source; an Office floor may project it but grants no access. A module/service is not automatically a domain. |
| Domain group | Navigation grouping เช่น SCM/CRM; groups/modules/services do not create a Business domain, floor หรือ access grant. |
| Floor | presentation route/scene ที่ Visual Office map ให้กับ domain key หรือ `G` Lobby; ไม่ใช่ database partition |
| AgentDefinition / AgentVersion | นิยามและเวอร์ชัน Agent ที่ Zuri เป็นเจ้าของ; ห้ามสร้างจาก character art |
| Agent roster | Agent instances ที่ platform ผูกให้ Business/domain พร้อม role และ allowed actions; ยังรอ contract สำหรับ Office |
| Role blueprint | เนื้อหา role ตัวอย่างใน `domain-office.js`; ไม่ใช่ roster, permission หรือ executor binding |
| Local preview | state ที่อยู่ใน browser/JSON และยังไม่ถูก publish เป็น canonical Business configuration |
| Dynamic-context candidate | `office-domain-context/v1-candidate` จาก local synthetic seam; ไม่ใช่ Zuri API/auth contract หรือ live grant |
| Edition | วิธี render/edit floor เช่น original, hybrid sprite room หรือ native3d |
| Asset ID | stable key ใน local catalog ที่ชี้ไปยัง asset bundle revision; ไม่ใช่ asset service/database ID |

## 4. ผู้ใช้และบริบทการใช้งาน

| ผู้ใช้ | เป้าหมายหลัก | สิทธิ์ที่ระบบนี้สมมติ |
| --- | --- | --- |
| Business owner / manager | ดูภาพรวม เข้าแผนก อ่านข้อมูล และทำงานต่อใน Zuri | ใช้ได้เฉพาะ Business และ actions ที่ session/API อนุญาต |
| Operator | ตรวจสถานะ connector, source, error และความสดของข้อมูล | ไม่ได้สิทธิ์เพิ่มจากการเปิดหน้า Office |
| Office designer | แก้ฉากและ preview แยก floor | แก้ visual draft; ไม่มีสิทธิ์แก้ Business หรือ agent records |
| Developer / QA | ตรวจ contract, state isolation, accessibility และ integration evidence | ใช้ local mocks ได้ แต่ต้องระบุว่าเป็น mock |

## 5. สมมติฐานและข้อจำกัด

1. **Hosted target:** Browser UI ทำงานใน context ของ Business ที่ Zuri ยืนยันสิทธิ์แล้ว;
   Office ไม่สร้าง canonical ID หรือ membership ขึ้นเอง. Current default navigation is
   pinned presentation, and the dynamic candidate is synthetic rather than authenticated.
2. ก่อน platform contract พร้อม directory ในแอปเป็น pinned presentation projection
   ไม่ใช่ dynamic registry ของ Business ทุก tenant.
3. Lobby `business-home` เป็นจุดเริ่ม/พื้นที่กลาง ไม่ใช่ชั้นแผนกเพิ่ม; group เช่น
   `SCM`/`CRM` เป็น navigation grouping ไม่ควรถูกนับเป็น floor.
4. Opt-in Zuri development connector uses allowlisted loopback APIs and a Zuri session.
   The `--dynamic` candidate and `--workspace` profiles are separate synthetic fixtures.
   None establishes hosted service registration or production integration.
5. ข้อเสนอ event/write flow ในเอกสาร boundary เป็น target; ไม่มีหลักฐานว่ามี shared
   deployed Event Bus ระหว่าง Office กับ Zuri.
6. Role/avatar ที่อยู่ใน domain projection ไม่ใช่ AgentDefinition, AgentVersion หรือ
   permission grant.
7. `localStorage` เป็น preview persistence บน browser/origin เดียว มี quota และอาจ
   ถูกล้างได้; JSON export เป็นไฟล์กู้คืน/แลกเปลี่ยน ไม่ใช่ฐานข้อมูลร่วม.

## 6. ข้อกำหนดเชิงหน้าที่

ระดับสถานะ:

- **มีในโค้ด** — behavior อยู่ใน source ปัจจุบัน; ไม่ได้แปลว่า hosted/live ผ่าน.
- **มีเฉพาะ local** — ทำงานใน prototype/editor แต่ข้อมูลยังไม่ canonical หรือ durable.
- **รอ platform** — ต้องใช้ contract, identity, permission หรือ operation จาก Zuri.
- **ข้อกำหนด/ข้อเสนอ** — ต้องรักษาไว้ใน product design; implementation ยังไม่ครบ.

| ID | ข้อกำหนดและเกณฑ์ตรวจรับ | สถานะ / หลักฐาน |
| --- | --- | --- |
| VO-FR-001 | ระบบต้องมี overview ของตึกและทางเข้า Lobby ชั้น G; ผู้ใช้เข้า Lobby ได้จากปุ่มตึก/“เข้าออฟฟิศ” | มีในโค้ด — `web/building-view.js`, `web/workspace-navigation.js` |
| VO-FR-002 | ผู้ใช้ต้องเปิด elevator directory จาก Lobby และเลือก Lobby หรือ floor ผ่านรายการที่กดได้ ไม่พึ่งการแตะภาพตึกอย่างเดียว | มีในโค้ด — `web/building-view.js`, `web/lobby-view.js` |
| VO-FR-003 | Office ต้องแสดง floor หนึ่งรายการต่อ operational leaf domain ที่ selected Business มีสิทธิ์เข้าถึง โดยคง floor key/label จาก owner-approved Business-scoped source; navigation groups, modules และ services ไม่สร้าง floor หรือ access grant เอง | เส้นทางปกติยังเป็น 14-key pinned presentation ใน `web/domain-office.js`; candidate แสดงรายการจาก synthetic context ที่ผ่าน schema validation เท่านั้น; live per-Business registry ยังรอ contract |
| VO-FR-004 | เมื่อเชื่อม Zuri รายการ floor, Business context และข้อมูลบน floor ต้องแสดง provenance, checked time และสถานะ loading/empty/forbidden/unavailable แยกจากกัน; ห้ามแปลง unknown/error เป็นเลขศูนย์ | Candidate path ตรวจ Business, context revision, source revision, เวลา, availability และ read hints ใน `web/office-domain-context.js`; เป็น synthetic seam เท่านั้น ไม่ใช่ live acceptance |
| VO-FR-005 | Floor scene ต้องอ่าน roster, จำนวน Agent, identity, role และสถานะจาก canonical Zuri response; ห้ามอนุมานจากจำนวนโต๊ะ/ภาพ/role blueprint | ยังไม่ผ่าน: default `BuildingView` ใช้ illustrative role blueprints; candidate `OfficeArtScene` ไม่สร้าง Agent actor; ยังไม่มี canonical Office roster contract |
| VO-FR-006 | ถ้า platform ตอบ roster จำนวน N และ roles N รายการ UI ต้องแสดง N รายการตรงตาม source โดยไม่มี padding, merge, rename หรือ role ที่คิดขึ้นเอง | รอ Agent/roster contract และ role mapping; candidate schema ไม่มี roster และ fixture ที่อนุมัติจาก platform |
| VO-FR-007 | Domain ที่ Zuri ระบุ reserved/unavailable ต้องติดสถานะดังกล่าว และไม่มี UI ที่สื่อว่าทำงานจริงได้ | Default mapping ระบุ Warehouse/Operations เป็น reserved แบบ pinned; candidate รองรับ `ACTIVE`/`RESERVED`/`UNAVAILABLE` จาก synthetic context; live status ยังรอ contract |
| VO-FR-008 | การกด Agent แสดง role, responsibility และ status พร้อมที่มา; avatar เป็น presentation เท่านั้น ไม่ใช่ identity/permission | Default role cards เป็น blueprint/T3 presentation; candidate scene ไม่มี Agent actor. Identity, role, permission และ status ของ Zuri Agent ยังรอ roster API |
| VO-FR-009 | Business read ต้องใช้ Business ที่ผู้ใช้เลือกจาก authenticated Zuri scope และ endpoint ที่ allowlist; Office ห้ามอ่าน database/broker โดยตรง | มี dev allowlist connector และ local synthetic candidate seam; ทั้งสองอย่างไม่ยืนยัน production service auth/authorization หรือ live Business reads |
| VO-FR-010 | Office แสดง action ได้เฉพาะเมื่อ owner API ประกาศและอนุญาต action นั้น; success แสดงหลังได้ผลยืนยันจาก owner | Candidate เปิดเฉพาะ Marketing reads ที่ `ACTIVE` + `ALLOW` (`marketing.campaigns.read`, `marketing.overview.read`); `actions` ว่าง; generic Agent dispatch ไม่มี |
| VO-FR-011 | การเขียน Business CRUD ในอนาคตต้องส่ง command ไป API แบบ synchronous request/response พร้อม scope และ version precondition; ห้าม optimistic success หรือ overwrite เงียบ | รอ platform contract; proposal ใน `ZURI-PLATFORM-INTEGRATION-BOUNDARY.md` |
| VO-FR-012 | Event/stream ใช้ปรับ projection หลัง commit เท่านั้น ไม่ใช้แทน write acknowledgement; consumer ต้องรองรับ duplicate, gap และ retry ตาม contract | รอ platform contract; ไม่มี shared Event Bus ที่ยืนยันใน source ปัจจุบัน |
| VO-FR-013 | Design Studio ต้องเปิด state ของ floor/Edition ที่เลือกจริง และแสดง dirty/saved state ก่อนออกหรือเปลี่ยนชั้น | มีเฉพาะ local — `web/hybrid-studio.js`, `web/native-studio.js`, `web/hybrid-state.js` |
| VO-FR-014 | Native editor ต้องเพิ่ม/ลบ/duplicate/move/resize/group/ungroup/reorder furniture/decor, ปรับ material/texture/interaction และบันทึกแยก floor ได้; ห้ามเปลี่ยน agent slot/role | มีเฉพาะ local — `web/native-state.js`, `web/native-studio.js`, `web/office.js`; รายละเอียดและ limit ใน `NATIVE-STUDIO.md` |
| VO-FR-015 | Hybrid editor ต้องแก้พื้นหลัง/องค์ประกอบแบบ sprite, preview, undo/redo และทำ human/AI JSON handoff ผ่าน schema allowlist; ห้ามรับ script, URL หรือ canonical business data จากไฟล์ | มีเฉพาะ local — `web/hybrid-state.js`, `web/hybrid-studio.js`; schema `office-room/v1` |
| VO-FR-016 | Local floor snapshot ต้องมี versioned schema และระบุ scope เป็น `local-preview`; export/import ต้อง validate version, floor, edition, field allowlist และขนาดก่อนใช้ | มีในโค้ด — `office-floor/v1`, `office-3d/v1`; ดู `web/hybrid-state.js`, `web/native-state.js` |
| VO-FR-017 | การ save visual state ต้องไม่เปลี่ยนจำนวน Agent, role, assignment, permissions, Business data หรือเศรษฐกิจจริง | มีในโค้ด/มี regression tests — `web/hybrid-state.js`, `web/native-state.js`, `tests/office-lifecycle.test.mjs` |
| VO-FR-018 | Asset library ต้องแสดงหมวด, stable asset ID, preview และ renderer/file type; การวาง asset อ้างอิง catalog item และไม่สร้าง Agent | มีเฉพาะ local bundle — `web/office-assets.js`, `web/assets/models/studio/manifest.json`, `docs/NATIVE-STUDIO.md`; ยังไม่มี shared asset service |
| VO-FR-019 | ถ้า local storage quota/parse/write ล้มเหลว ต้องแจ้งผลไม่สำเร็จและคง draft/export path; ห้ามแสดง “saved” เมื่อ write ไม่ผ่าน | ต้องยืนยันทุก save path ใน acceptance; `RoomStore` ตรวจ `setItem` result และ docs ระบุ fallback |
| VO-FR-020 | Back/route/refresh ต้องรักษา route context ที่ตั้งใจไว้ และไม่โหลด floor snapshot ของชั้นอื่นมาแทน | มี route และ floor key separation; verify ทุก editor edition ตามชุด integration/local tests |
| VO-FR-022 | Studio ต้องแก้บลูพริ้นต์ห้องสี่เหลี่ยมด้วยการลากผนัง/ช่องเปิดหรือกรอกระยะ รวมถึงผนังกั้นภายใน ประตูเชื่อมห้อง พื้นที่ประชุม/ทำงาน/พัก และลองเดินตามแนวชนจริง ให้แปลน โมเดล Three.js และแนวชนใช้ข้อมูลเดียวกัน; พรีวิวต้องยกเลิกได้ มี Undo/Redo เก็บเทมเพลตโครงห้องแยกจากการบันทึกชั้น และคงไอเท็ม/ตัวละครเดิมเมื่อแก้เฉพาะโครง | มีเฉพาะ local — `web/office-blueprint-state.js`, `web/office-blueprint-editor.js`; ขอบเขตและการทดสอบใน `OFFICE-BLUEPRINTS.md` |
| VO-FR-021 | Overview, elevator และ floor roster ต้องมี text/list navigation เข้าถึงได้; keyboard, focus state, screen-reader name และ reduced-motion ต้องไม่ขึ้นกับ canvas อย่างเดียว | ออกแบบไว้ใน `OFFICE-UX-FLOWS.md`; acceptance ระดับแอปยังต้อง run accessibility check |
| VO-FR-023 | ประตูในแปลน Office ต้องกดเปิด/ปิดได้ โมเดลและทางเดินใช้สถานะเดียวกัน ประตูปิดต้องกั้นทางเดินและตรวจเส้นทางที่กำลังเดิน ห้ามปิดทับตัวละคร; บันทึกสถานะเฉพาะชั้นพร้อมตรวจ revision/ความผิดพลาดของ storage โดยไม่เปลี่ยนไอเท็มหรือ Agent | มีเฉพาะ local — `office-door-save.js`, `hybrid-scene.js`, `hybrid-office-3d.js`; tests และข้อจำกัดใน `OFFICE-BLUEPRINTS.md` |

### 6.1 Office Tycoon vertical slice — 23 October 2026

แถวเหล่านี้เก็บ scope และ requirement IDs ที่เริ่มจาก vertical-slice design.
สถานะด้านล่างปรับตาม source วันที่ 26 ตุลาคม; design target, local implementation,
CI evidence และ live acceptance เป็นคนละสถานะ.

| ID | ข้อกำหนดและเกณฑ์ตรวจรับ | สถานะ / แหล่งรายละเอียด |
| --- | --- | --- |
| VO-FR-024 | หน้าอาคาร, G Lobby และ Projects ต้องใช้ฉากเป็นหน้าหลัก มี HUD/dock และ context sheet เมื่อแตะวัตถุ; ไม่มี sidebar/roster ค้างข้างฉากหรือ focus target ของ rail ที่ซ่อนอยู่บน Office routes; ใช้ mouse/touch/keyboard และ Back/refresh ได้ | Legacy Marketing/CRM dashboard/sidebar was removed from the app; current shared workspace header/dock remains on workspace pages and is hidden on Office routes. Default `BuildingView` and saved Tycoon edition retain Office-owned navigation; dynamic candidate uses scene + context sheet. Source behavior only; user acceptance not run |
| VO-FR-025 | บอร์ด/โต๊ะ/ตัวละครของ Projects ต้องเปิดข้อมูลและ action ตาม binding/scope/capability จริง; แยก Project list, WorkItems และ Agent operation; ส่งคำสั่งผ่าน approved Zuri API และแสดงผล owner-confirmed เท่านั้น; missing contract, denied, stale, conflict, unknown ต้องมี recovery | Target / platform dependencies. Current candidate has synthetic domain context and Growth read-only operations; no Project/WorkItems/Agent binding or Zuri action API — [integration and acceptance](game-design/TYCOON-INTEGRATION-AND-ACCEPTANCE.md) |
| VO-FR-026 | อาคาร, Lobby และ Projects ต้องประกอบ modular GLB ที่ runtime โหลดจริงจาก versioned manifest โดยใช้กล้อง/หน่วย/แสงร่วม; asset card, footprint/anchors, bounds และ hashes ต้องตรง revision; missing/corrupt assets ต้องมี fallback ที่ยังเข้าถึงงานผ่านข้อความได้ | Local GLB/Native Studio remains active. `app.js` uses GLB `TycoonView` only when an eligible floor has a saved `tycoon3d` edition; it is not the normal default and not the dynamic candidate renderer. Shared scene/publishing contract remains open |
| VO-FR-027 | Generic actor ใช้ reusable 3D rig/clips และ navigation จริง; จำนวน/role ของ live actorsตรง authorized roster; art animationไม่ใช่Agent status; มี reachable approach/seat, occupied guard, closed-door collision และ reduced motion | Local Office simulation/navigation features are separate from Agent identity; candidate `OfficeArtScene` deliberately creates no Agent actor. Live roster parity and cross-profile acceptance remain gated |
| VO-FR-028 | การเปลี่ยน Office shell/asset runtime ต้องคง Studio ต่อชั้น, edition, legacy imports, groups/layers/materials/textures/navigation/door state และ Undo; Lobby/Projects GLB ใช้ edition/store/file version ใหม่ที่เลือกสลับกับ legacy ได้; preset ไม่ทับ saved floors อัตโนมัติ; local presentation ที่ใช้กับ live dataต้องแยกauthorized viewer/tenant/Business/floor และไม่exportbusinessbindings; local saveยังไม่ใช่shared Zuri save | Local editors and explicitly saved edition remain active with browser-local state; dynamic candidate Studio is disabled, and `OfficeContextData` is transient/non-exported. Shared scene persistence, auth and live binding are gated |

### 6.2 Current runtime reconciliation — 26 October 2026

ตรวจ source ที่ `949736446824d4803f9109a20830202494abd7b7`. `web/app.js` selects
the Office route mode; this table describes current local behavior, not a release
or live-service claim:

| Route mode | Current selection and presentation | Data boundary |
| --- | --- | --- |
| Default | `BuildingView`; the campus image, local 14-floor `domain-office.js` map and local floor renderers remain the ordinary path. The map's four role blueprints are examples. | `RoomStore`/Design Studio presentation snapshots are browser-local; authenticated Zuri data is not implied by the floor map. |
| Saved GLB edition | `TycoonView`/GLB runtime is selected only for eligible floors with a saved `tycoon3d` edition in `TycoonStore`. | Local edition and floor state; no shared scene service or automatic migration. |
| Dynamic-context candidate | The local `--dynamic` harness injects `office-domain-context/v1-candidate`, then selects `TycoonDomainView` + `OfficeContextData` + `OfficeArtScene`. Directory rows come from the validated candidate context; supported availability values are `ACTIVE`, `RESERVED`, and `UNAVAILABLE`. | Context is synthetic, held in memory, expires after 60 seconds, and is purged on hidden/context changes. It is not a live authorization grant or Zuri API contract. The candidate Studio button is disabled. |

`OfficeArtScene` reuses the existing campus and Lobby art and `HybridScene` with
`paintedArt: true`; it does not make the green GLB prototype the default. The
campus viewport uses `framing: 'cover'` with `overscan: 1.25`; floor scenes retain
the shared `contain` whole-scene Fit. `tests/office-art-scene.test.mjs` checks the
campus overscan, Lobby artwork, painted floor and absence of generated Agent actors.

The Work/Chat/Results/Knowledge/Team/Inbox workspace routes have a separate
`workspaceAccess` gate in `web/workspace-context.js`. When Zuri is enabled but its
workspace API is unavailable, those routes report unavailable rather than empty.
The `--workspace` loopback profile is isolated synthetic in-memory Worker data;
it does not enable Zuri live access. T3's retained bridge and `/api/runner/*`
routes are server-side and excluded from the browser proxy. Scene editing and
workspace records are separate state owners.

Transport inventory and runtime limitations are recorded in
[API-ENDPOINT-AUDIT.md](API-ENDPOINT-AUDIT.md). `shared/office-api-routes.js`
defines the 27 route families; `scripts/office-proxy.mjs` forwards browser routes
with method/origin/body checks while keeping runner routes unavailable to the
browser. Handler-owned authorization and payload rules remain in their owners.

Current source/CI snapshot: main source `949736446824d4803f9109a20830202494abd7b7`,
CI run `40326980103` (747 tests, build with 412 embedded assets, compatibility
check `PASS`). This is CI evidence for that source revision. It does not establish
live Zuri authorization, Agent roster parity, business commands, shared scene
persistence, production deployment or user/device acceptance.

## 7. ข้อกำหนดข้อมูลและ state ownership

| ข้อมูล | เจ้าของ | ที่อยู่ปัจจุบัน | ขอบเขต |
| --- | --- | --- | --- |
| Tenant/Business/Workspace/domain IDs และสิทธิ์ | Zuri platform | Opt-in development connector may read through authenticated API; dynamic candidate and `--workspace` use separate synthetic fixtures | ห้ามเป็นตัวตนที่สร้างหรือแก้จาก scene editor |
| Agent identity, AgentDefinition/Version, role, permission, run state | Zuri platform | ยังไม่มี roster/dispatch contract ครบสำหรับ Office | ห้าม derive จาก asset/seat/blueprint |
| T3 threads/jobs/results/preferences | T3 / owning app service | Worker-owned `/api/*`; server-side bridge uses runner routes, excluded from browser proxy | ไม่ถือเป็น Zuri Agent record หรือ Zuri domain API |
| Hybrid room | Visual Office | browser `localStorage`, key `zuri-office:hybrid-studio:v1` | local preview, จำกัดจำนวน/ขนาดตาม schema |
| Native room/floor edition | Visual Office | key เดียวกัน, keys `preview:<floor>` | local preview ต่อชั้น; save ไม่ publish |
| Tycoon edition/floor | Visual Office | `TycoonStore` browser-local edition and floor store | GLB selection is explicit per eligible floor; not the normal default |
| Dynamic candidate context | local synthetic connector / `OfficeContextData` | in-memory only; no scene export or durable save | candidate data only; expiry/purge enforced, no live grant |
| Workspace synthetic fixture | local loopback Worker harness | isolated in-memory fixture profile | separate `workspaceAccess` gate; never a Zuri business/Agent record |
| Exported floor file | ผู้ใช้ | ไฟล์ JSON `office-floor/v1` | explicit exchange/backup; ไม่มีสิทธิ์ในการ apply เข้า platform |
| GLB/PNG/SVG/model source และ preview | Visual Office repository/build | bundled files + manifest | ไม่ใช่ server model store; scene อ้าง stable asset ID |

ข้อมูลฉากขั้นต่ำประกอบด้วย schema/version, floor key, edition, object/asset identity,
transform, finish/material, layer order, group และ declarative interaction ตาม
edition ที่เลือก ข้อมูลเหล่านี้เป็น design state ไม่ใช่ Business record

## 8. ข้อกำหนดคุณภาพที่ไม่ใช่หน้าที่

ค่าเป้าหมายที่ยังไม่ได้รับรองจาก owner ระบุเป็น **TBR**; อย่านำเสนอว่าเป็น acceptance
ที่ผ่านแล้ว

| ID | ข้อกำหนด | วิธีตรวจ / สถานะ |
| --- | --- | --- |
| VO-NFR-001 | Business scope ทุก request ต้องผูกกับ authenticated session และ selected authorized Business; เปลี่ยน Business ต้องยกเลิก request เก่า/ล้างผล domain เก่า | security/integration tests; code ปัจจุบัน abort request ตาม context revision |
| VO-NFR-002 | ไม่เก็บ session credential, provider secret หรือ agent prompt ใน localStorage, scene JSON หรือ asset metadata | source/schema scan และ export tests |
| VO-NFR-003 | Unknown schema/field, external URL, script, invalid scope และ oversized import ต้องถูกปฏิเสธก่อน apply | import/schema tests; limits ตาม editor contracts |
| VO-NFR-004 | Local scene save ต้องเขียน snapshot ด้วย `localStorage.setItem` ครั้งเดียว; ถ้าพื้นที่ไม่พอต้องรายงาน failure; ผู้ใช้ต้องมี JSON export เป็น recovery path | quota/failure tests; ไม่มี claim ว่าเป็น multi-writer/database durability |
| VO-NFR-005 | Touch target หลักต้องไม่น้อยกว่า 44 CSS px ตาม UX design; directory, floor selection และ dialogs ต้อง keyboard-operable | browser accessibility checks; document target ไม่เท่ากับ audit ผ่าน |
| VO-NFR-006 | Mobile portrait และ desktop/tablet ต้องรักษา scene controls, roster, text contrast และ navigation โดยไม่พึ่ง hover | responsive checks ที่ 320×640 และ 390×844 มีในเอกสาร QA; physical-device test ยังไม่ยืนยันจากเอกสารนี้ |
| VO-NFR-007 | เมื่อ prefers-reduced-motion เปิด ระบบต้องลด/ปิด motion ที่ไม่จำเป็นโดยไม่ซ่อนสถานะหรือ interaction | browser accessibility test; ต้องตรวจ runtime จริง |
| VO-NFR-008 | UI ต้องแยก fresh, stale, loading, empty, forbidden, unavailable, reserved, local/demo และ unsaved state ด้วยข้อความ ไม่ใช้สีอย่างเดียว | state/UI tests และ visual review |
| VO-NFR-009 | 3D scene, asset-load และ interaction ต้องตอบสนองตาม baseline desktop/mobile device ที่ตกลงร่วมกัน; ค่า FPS, first-interactive และ memory budget เป็น TBR ก่อน release | ต้องกำหนด device/browser baseline และเก็บ profiler evidence |
| VO-NFR-010 | Local preview build ต้องทำงานได้โดยไม่ต้องเชื่อม Zuri; connector ปิด/ผิดพลาดแล้วต้องไม่ทำให้ editor state สูญหรือข้อมูล demo ถูกแสดงเป็น live | offline/connector tests |
| VO-NFR-011 | เก็บ provenance/version ที่จำเป็นต่อการตรวจย้อนหลังสำหรับ platform reads และการแก้ design; audit ทางธุรกิจยังเป็นหน้าที่ platform | local preview เก็บ edition/state; format audit/business actor รอ API contract |
| VO-NFR-012 | Browser รองรับ WebGL สำหรับ Native Studio หรือแจ้ง fallback ที่ใช้งานได้; scene resources ต้องถูก release เมื่อเปลี่ยน/ปิด editor | WebGL/browser test และ lifecycle tests |

## 9. Interface requirements

### 9.1 Browser/user interfaces

- Routes หลัก: `#office` (building overview), `#office/lobby`, `#office/<floor>` และ
  `#office/studio`; route renderer ขึ้นกับ default, local saved edition หรือ explicit
  synthetic candidate profile. Current shared workspace header/dock remains on workspace
  pages and is hidden while an Office route is active.
- Overview ต้องสื่อว่าเป็น mobile idle/simulation interface แต่ตัวเลขธุรกิจ/งานต้อง
  มีแหล่งข้อมูลและ semantics แบบ business UI.
- Scene canvas ไม่ใช่ช่องทางเดียว: directory/list, toolbar, dialogs และ detail
  ต้องเข้าถึงได้โดยไม่ต้องคลิก object ในภาพ. Workspace pages มี feature gate แยกจาก
  Office scenes.

### 9.2 Zuri interface — current vs target

**ปัจจุบัน:** มี dev connector แบบ opt-in และ candidate context แบบ synthetic ใน
local harness; ทั้งสองอย่างแยกจาก production acceptance. Candidate profile ตรวจ
selected Business, context/source revisions, freshness และ availability จาก
`office-domain-context/v1-candidate`. มีเพียง Growth reads ที่เปิดได้เมื่อ operation
hint เป็น `ALLOW` และ domain เป็น `ACTIVE`; candidate actions ว่าง. Static default
floor mapping ยังคงเป็น local presentation. T3 chat/work bridge เป็น adapter แยกจาก
Zuri domain APIs — ดู [API-ENDPOINT-AUDIT.md](API-ENDPOINT-AUDIT.md).

**ก่อน hosted integration ต้องมี:** service registration, auth/caller identity,
Tenant + Business scope, authorized domain registry, Agent roster/role payload,
action allowlist, idempotency/version/conflict semantics, error model, audit fields,
asset/scene persistence decision และ contract/e2e test data. ระบุ operation, schema,
version และ owner จาก source platform จริง ห้ามเดา endpoint ใน SRS นี้.

### 9.3 Asset/model interface

Editor ใช้ bundled asset catalog; scene stores stable ID/asset reference + transforms
และ finishes. Pipeline ปัจจุบันคือ editable source/build script → local GLB/preview/
manifest → browser catalog. ไม่มี remote model storage/catalog API หรือ collaboration
sync; ดู architecture diagram 6 และ Native Studio.

## 10. Error, recovery และ concurrency

- API read error ต้องแยก auth required, forbidden, reserved, unavailable และ response
  contract mismatch; แสดงเวลาตรวจล่าสุดและปุ่ม retry ตาม context.
- Local import ที่ไม่ผ่าน validation ต้องไม่เปลี่ยน state ที่กำลังใช้.
- Quota/write failure ต้องไม่ทำเครื่องหมาย saved; คง draft ไว้ให้ export/retry.
- Browser storage ไม่มี transaction ข้ามแท็บและไม่มี optimistic concurrency/version
  compare ที่เป็น shared authority; การแก้พร้อมกันหลายแท็บอาจ last-write-wins.
- Platform CRUD ในอนาคตใช้ owner API synchronous acknowledgement + expected version
  + idempotency key; event consumer ทำ projection/reconcile หลัง commit. ถ้า stale ให้
  reload/compare แล้วให้ผู้ใช้ตัดสิน ห้าม silent overwrite.
- ไม่มี WAL ฝั่ง Visual Office สำหรับ local preview; durability และ WAL ของข้อมูล
  canonical เป็นหน้าที่ service/platform ที่ถือ persistence.

## 11. Verification และ acceptance

| Test tier | ต้องพิสูจน์ | แหล่งตรวจ |
| --- | --- | --- |
| Schema/unit | normalize, allowlist, bounds, duplicate IDs, floor isolation, quota/error behavior | `tests/hybrid-studio.test.mjs`, `tests/native-studio.test.mjs`, `tests/office-lifecycle.test.mjs` |
| Asset/build | GLB/manifest/preview consistency, stable ID resolution, renderer type | `tests/assets.test.mjs`, `npm run build` |
| Browser flow | overview → G → elevator → floor → roster/detail; Studio save/export/import/reload/undo and mobile layout | browser tests and evidence in `reports/`; check current report revision before reuse |
| Accessibility | keyboard, focus, touch sizing, screen reader names, reduced motion, contrast | automated accessibility + human assistive-tech review |
| Platform contract | selected real Business, authorized per-domain reads, exact domain/agent/role counts, cross-Business isolation, audit, conflict handling, permitted command behavior | blocked until approved platform contracts and real authorized test fixture exist |
| Performance | agreed low/high device scene frame time, time-to-interactive, asset memory | blocked until baseline devices and target budgets are agreed |

Documentation states and old report receipts are not fresh test results. An unrun,
mock-only or old-revision check must be labeled `NOT_RUN`, `MOCK_ONLY` or `STALE`.

## 12. Canon parity audit and resolved differences

The following is a frozen 21 October snapshot, not the status of every renderer in
the 26 October source. Its conclusions remain provenance for the named revisions;
§6.2 is the current implementation summary and does not change the Zuri-side audit
inputs or authority.

Source-path clarification: the upstream reference is `zuri.ai/docs/PRODUCT.md`, not
`Visual Office/docs/PRODUCT.md`. It was read on 26 October from Zuri checkout
`0f8ce05d3a54bd1c58d26b8b759ca50a650c3aa6`; the file's last change is commit
`393c638732d48e218e832b267441019fd31ea656` dated 21 October. The hierarchy wording
in the frozen row below is retained as its earlier comparison and is not a current
claim about that upstream file. This document does not resolve Zuri canon.

Audit baseline: Visual Office source tree and Zuri `apps/server/src/config/domains.js`
at Visual Office's pinned source revision `30911f98e12d535133e77dbe3c3bd42ed6ee9864`;
the source file blob was also compared with Zuri `origin/main` `18008b774fc54febd23ca675d142f15da7d67db5` and is identical. Zuri working checkout at pinned revision is not equivalent to a published release.

| Topic | Comparison | Disposition |
| --- | --- | --- |
| Domain navigation keys | 14 operational keys in Visual Office match the 14 non-shell registry keys. `business-home` maps to G/Lobby; `SCM`/`CRM` groups do not create duplicate floors. | **Key parity PASS for audited snapshot.** Mapping is still pinned, not derived dynamically from each authorized Business. |
| Domain labels/order/status | Office stores presentation labels/order locally; Warehouse and Operations are fixed as reserved. | **Partial.** refresh mapping when registry changes; future UI must use Business-authorized domain response and status. |
| Role/agent roster | Office currently defines four illustrative roles on every domain floor and renders blueprints when no matching T3 session exists. Zuri Agent charter's Business Agent Factory contract describes five role/tool/policy snapshots, explicitly denies dynamic delegation in v1, and does not mean five running provider agents. | **Mismatch/blocker.** Four illustration roles are not canonical. Template config is not an active roster. Remove role-count claims from live mode or replace with exact approved Agent roster contract before claiming parity. |
| Tenant/Business hierarchy | At this frozen audit's named revisions, Zuri `AGENTS.md` stated Portfolio/Business Group → Tenant → Business → Workspace → Project → Workstream; upstream `zuri.ai/docs/PRODUCT.md` showed Portfolio → Tenant → Business and called Portfolio a group of businesses. | **Conflict recorded in the upstream snapshot.** Keep Office identity-neutral and require the owner-confirmed current hierarchy contract before encoding Tenant/Business selectors or keys. This row does not assert today's upstream conflict remains unresolved. |
| Read connectivity | Local proxy is allowlisted, scoped by chosen Business and does real GETs if the authorized local Zuri service responds; some domains are reserved and unavailable. | **Local adapter only.** Does not prove hosted service integration, all-domain reads or live state acceptance. |
| Agent commands / CRUD / event bus | Current generic department Agent dispatch is explicitly unavailable; Visual Office has no canonical write service or shared bus. | **Not integrated.** Read-only queries and target write/event proposal must stay distinct. |
| Scene persistence / asset storage | Scene drafts use browser localStorage + explicit JSON export; assets are bundled with the web app and referenced by IDs. | **Local only.** No durable shared floor service, WAL, server asset inventory or remote GLB storage. |

## 13. Risks and open decisions

| Key | Open item | Owner / exit evidence |
| --- | --- | --- |
| GAP-01 | Obtain the owner-confirmed current hierarchy contract for this client; the earlier conflict is recorded only as provenance | Zuri product/domain owner publishes the applicable canonical contract/reference |
| GAP-02 | Publish dynamic authorized domain/module contract and service registration | Zuri platform owner; schema/version/auth/error model + test fixture |
| GAP-03 | Publish actual assigned Agent roster/AgentDefinition/role and action capabilities per Business/domain | Zuri Agent owner; do not treat five factory templates as running agents |
| GAP-04 | Decide how reserved/unsupported domains are returned per Business | Domain registry/API owner |
| GAP-05 | Choose shared scene-state service, versioning/audit, persistence and offline conflict rules | Visual Office + platform architecture decision; browser JSON/localStorage is not the production answer |
| GAP-06 | Select model/asset storage and publishing pipeline for GLB/source/preview metadata | Visual Office asset owner; include access, immutable revision/hash, lifecycle and CDN/load policy |
| GAP-07 | Set performance and supported-browser/device baseline | Product/QA; profile real scene on agreed lowest supported device |
| GAP-08 | Complete per-route visual/accessibility acceptance and generic character coverage without conflating painted art, local GLB editions or Agent state | Art/design and QA; verify each renderer against its selected source profile. CI and synthetic scene tests are not user/device acceptance |
| GAP-09 | Decide whether and when economy/upgrade proposals can use real business evidence | Product + Zuri metric/event owners; no simulated reward may imply business productivity |

## 14. Completion statement

The requirements and source-status view is reconciled to Visual Office revision
`949736446824d4803f9109a20830202494abd7b7`. The 26 October CI evidence is limited to
that revision; it does not close the separate synthetic/live, user/device or platform
acceptance gates. The SRS is **not ready for platform implementation sign-off** while
GAP-01..GAP-06 remain open, and several NFR values require an agreed device baseline.
This is an explicit upstream dependency, not a reason to invent platform contracts.

## 15. โครงสร้างเอกสารและ traceability

| เอกสาร | เป็นเจ้าของเรื่อง |
| --- | --- |
| `VISUAL-OFFICE-SRS.md` | Requirements, scope, acceptance status, platform gaps and requirements trace |
| `ARCHITECTURE.md` | System/context/container/data/persistence/sequence/deployment diagrams |
| `OFFICE-UX-FLOWS.md` | Screen wireframes, wireflow, business-manager user flow, designer user flow |
| `ZURI-PLATFORM-INTEGRATION-BOUNDARY.md` | Data authority, transactions/events, platform prerequisites |
| `DOMAIN-OFFICE.md` | Pinned domain-floor projection and local read connector evidence/limits |
| `API-ENDPOINT-AUDIT.md` | 26 October Office route inventory, proxy/bridge boundary and synthetic/live limits |
| `HYBRID-STUDIO.md` / `NATIVE-STUDIO.md` | Editor interaction, schemas, transforms, local save/export and limits |
| `DESIGN-SOURCES.md` / `STUDIO-STYLES.md` | Approved art/design-source routing and sprite editor inventory |
| `ART-PRODUCTION-PLAN.md` / `3D-ART-BRIEF-V0.1.md` | Asset inventory, production gaps and handoff |
| `GAME-DESIGN-V0.1.md` | Proposed idle simulation/economy; no canonical Business side effects |
| `T3-CAPABILITY-INVENTORY.md` | T3/browser capability parity inventory; not Zuri platform authority |

Requirement trace: `VO-FR` rows link behavior to implementation/docs; `VO-NFR` rows
link quality constraints to verification. `ARCHITECTURE.md` diagram register names the
structural views. Product surface journeys remain in OFFICE-UX-FLOWS to avoid duplicating
wireframes in the SRS.


### 23 October work-floor presentation refinement

This dated design refinement records the selected work-floor character direction;
the 26 October route split in §6.2 defines which renderer currently uses each art path.

Owner-selected generic work-floor characters are now articulated 3D adults, replacing the earlier anime sprites only on the `office` background. The painted architectural backdrop remains. The shared renderer must use common projected ground coordinates, depth-aware furniture/wall occlusion, permitted walk polygons and expanded furniture obstacles. Desk, water and sofa actions require reachable approach points; blocked or reserved targets report failure. Local activity must not mutate authored floor JSON or business/Agent state. Editing stops ambient movement; reduced motion preserves a stationary pose. The task board requires fresh explicitly floor-scoped live data or displays unavailable. See [Hybrid Studio current refinement](HYBRID-STUDIO.md#current-refinement--23-october-2026-actual-3d-work-floor-activity) and the navigation/rig/controller tests. This does not unblock platform API contracts or certify arbitrary imported-room collision.


### Latest 23 October refinement: room structure and editable paths

The 23 October steering described actual Three.js room structure and a shared isometric camera/depth for walls, windows, floors, furniture and generic characters, with painted art treated as fallback. On 26 October, `OfficeArtScene` uses the existing painted campus/Lobby and HybridScene skin for the synthetic context candidate, while a saved local Tycoon edition may select GLB; see §6.2 for current routing. Studio must author validated route/area/station data for editions that support it and keep walk probes non-persistent. Invalid imports are rejected; blocked geometry must not walk through walls/furniture or silently substitute a station. See HYBRID-STUDIO.md and OFFICE-BLUEPRINTS.md for schema and per-edition limits.

Reusable GLB furniture sets are implemented as a local extension of VO-FR-014/VO-FR-028:
Asset Library cards carry selected visual objects, finishes/textures and relative seat anchors;
placing a set creates fresh grouped objects in a floor draft. This status does not expand
shared catalog, tenant isolation or platform authority. See OFFICE-BLUEPRINTS.md reusable sets.
The same local scope now supports portable set-file export/import: embedded model bytes,
finishes/textures, preview and seat anchors, validated against the receiving app's compatible
kit before adding a library card. Import alone must not modify any floor or Agent roster.
The custom-prop extension supports user-owned static GLB import, metadata, metric normalization,
approach/seat authoring, actual-model thumbnail, local binary persistence and self-contained v2
set transfer. Legacy v1 acceptance remains kit-bound. Floor files reference custom binary IDs;
the corresponding asset bundle must accompany transfer to another browser. Categories and
interaction markers confer no Agent or business authority. See OFFICE-BLUEPRINTS custom GLB scope.
