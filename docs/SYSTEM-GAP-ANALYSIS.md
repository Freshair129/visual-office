# Visual Office system gap analysis — 27 October 2026

Authority: owner accepted the current human model as a temporary baseline and
asked to finish functional systems before returning to asset polish. Audience:
Office engineering, QA and the Zuri integration owner. This is a dated analysis
of the working tree, not a second requirements registry or release approval.

Baseline: `a9226669c6a5b4471ce57947b8f35471b78e892e` plus the pre-existing staged
character integration/R4 patch. At the time of writing those changes were not
published on main; they were integrated on 6 November (see below). Use
[SRS](VISUAL-OFFICE-SRS.md) for requirement meaning and
[API audit](API-ENDPOINT-AUDIT.md) for transport ownership.

## Main-branch reconciliation — 6 November 2026

This 27 October gap snapshot predates the accepted mainline integration. The
31 October low-rate MVP limits and the Office-to-Zuri handoff in the current SRS
and handoff contract remain authoritative; this analysis does not reopen or
expand their acceptance. Measured floor plans and their current source remain
authoritative over values recorded by the older checkpoint.

The current Tycoon probe keeps `TYCOON_FACTORY_ASSETS` and the rig-v3 actor/desk
descriptors used by the checked pose, collision and seat-contact path. The WIP
appearance replacement in Tycoon Studio is not integrated because that runtime
character does not satisfy those measured rig descriptors. R4, Wangjai
and Staff A/B appearances remain available in Hybrid runtime and Character Lab;
their use is presentation-only and does not assign Agents or change roles. The
prototype-kit `actor.glb` and its manifest stay separate from the rig-v3 factory
assets and retain hash/animation checks. At this 6 November checkpoint no mobile,
native lifecycle, live or final-art acceptance was implied; the later art decision
is recorded below.

Main's desk/chair generation in `web/tycoon-models.js` remains on the
Tycoon-specific factory descriptors and measured chair variant. The only WIP
change to that file, the bone-track (`isBone`) update in actor clip baking, is
kept; it affects the prototype-kit actor only. The regenerated prototype
`web/assets/models/tycoon/actor.glb` now carries two skins (skinned garments
from `web/office-characters.js`). Nothing on main loads it at runtime: Tycoon and
the Zuri handoff package resolve `actor` through `TYCOON_FACTORY_ASSETS` to
`tycoon-factory/actor-rig-v3.glb`.

Hybrid floors now render avatars through the GLB character library instead of
procedural geometry, using the LOD1 derivatives measured below. The
31 October MVP performance acceptance covered Tycoon only, so this Hybrid path
has no performance qualification. Current focused seat-contact tests load both
original and LOD GLB geometry/skins/animations in Node, with image/material
decoding omitted; browser rendering and physical-device performance remain open.

The 6 November owner decision authorized additive LOD optimization. The lead
qualified C: storage (at most 1 GiB peak, 50 GiB operational floor, no planned
concurrent checkout writer); fresh free space exceeded 133 GiB at generation.
Blender 5.2.2 generated all four derivatives with the 2% skin-influence guard.
Original → LOD1 triangles/bytes: R4 202,880 / 10,498,996 → 81,438 / 5,515,484;
Wangjai 61,646 / 1,930,704 → 24,992 / 1,065,284; Staff A 101,544 / 4,095,188 →
33,264 / 2,133,460; Staff B 97,048 / 3,971,668 → 31,600 / 2,066,940. Only
Wangjai meets both guidance targets. Textures/materials/meshes are unchanged;
source SHA-256, skeleton/rest poses and all animation samples are preserved.
Hybrid defaults to LOD1; Lab keeps full-detail originals and historical choices.
Saved appearances and Agent identities remain unchanged. See
[temporary runtime LOD evidence](game-design/characters/TEMPORARY-RUNTIME.md#lod-optimization--6-november-2026)
for exact inventory, retained meshes, commands, visual/QA findings and checks.
Focused in-process tests pass 33/33; standard test spawning was sandbox-blocked.
Art was unapproved at this 6 November checkpoint; see the later decision below.
Physical-device and mobile performance remain unmeasured.

## Character approval and Hybrid performance follow-up — 7 November 2026

The owner approved the current Zuri R4, Wangjai, Staff A and Staff B art,
including their full-detail originals and Hybrid LOD1 files, on 7 November 2026,
as relayed by the lead. The `anime`, `rain`, and `zuri-anime` candidates and
rejected or review assets are excluded. This decision approves the specified
art; it does not certify performance, accessibility, all animations or live
roster integration. Existing Studio/Lab copy and the runtime catalog still carry
older unapproved-art labels; those need a separate UI/catalog update. The LOD
manifest records generation-time provenance and is unchanged.

The worker built a repeatable, loopback-only Hybrid browser measurement
(`npm run perf:hybrid`). Its sandbox could not launch Chrome, so the lead fixed a
frame-sampling defect in the harness page script and ran the full measurement on
7 November 2026: report `reports/perf-hybrid/2026-11-06T20-47-24-463Z-17472.json`
(local, ignored), `status: complete`, 0 errors, no software-renderer cases and
no source change during the run. Hardware: NVIDIA GeForce RTX 3060 via ANGLE/D3D11,
headless Chromium. Each of the 12 cases sampled 120 seconds after a 1-second warmup.

| Tier | Avatars | Variant | Ready ms | Rendered fps | p50 / p95 / p99 / max frame ms | Frames >50 ms | Max triangles | Draw calls | JS heap MB |
| --- | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| Desktop | 4 | original | 2,495 | 56.6 | 17.6 / 18.2 / 18.6 / 19.0 | 0 | 492,526 | 491 | 72 |
| Desktop | 4 | LOD1 | 1,013 | 56.6 | 17.6 / 18.2 / 18.6 / 18.9 | 0 | 200,702 | 491 | 54 |
| Desktop | 12 | original | 1,755 | 56.4 | 16.7 / 18.6 / 33.4 / 446.6 | 4 | 1,456,106 | 1,223 | 75 |
| Desktop | 12 | LOD1 | 1,628 | 58.6 | 16.7 / 16.8 / 33.4 / 33.5 | 0 | 580,634 | 1,223 | 76 |
| 4× CPU proxy | 4 | original | 6,000 | 21.2 | 50.0 / 66.7 / 83.4 / 100.1 | 664 | 492,526 | 491 | 82 |
| 4× CPU proxy | 4 | LOD1 | 5,083 | 19.8 | 50.0 / 66.8 / 83.4 / 150.1 | 841 | 200,702 | 491 | 79 |
| 4× CPU proxy | 12 | original | 9,696 | 7.4 | 133.3 / 200.1 / 250.0 / 616.7 | 880 | 1,456,106 | 1,223 | 79 |
| 4× CPU proxy | 12 | LOD1 | 13,059 | 7.9 | 99.9 / 266.6 / 333.4 / 499.9 | 662 | 580,634 | 1,223 | 76 |
| 6× CPU proxy | 4 | original | 12,980 | 11.9 | 50.0 / 216.6 / 250.1 / 333.3 | 708 | 492,526 | 491 | 68 |
| 6× CPU proxy | 4 | LOD1 | 9,427 | 13.1 | 33.4 / 216.7 / 566.7 / 1,316.7 | 592 | 200,702 | 491 | 46 |
| 6× CPU proxy | 12 | original | 13,904 | 4.1 | 233.3 / 516.7 / 1,133.4 / 1,583.4 | 429 | 1,456,106 | 1,223 | 108 |
| 6× CPU proxy | 12 | LOD1 | 17,777 | 3.9 | 250.0 / 333.4 / 383.3 / 416.7 | 469 | 580,634 | 1,223 | 63 |

Findings:

- On desktop both variants hold the scene's ~57 fps cadence. LOD1 halves character
  bytes (20,496,556 → 10,781,168), cuts drawn triangles by about 60%, loads four
  avatars 2.5× faster, and removes the 12-avatar frame spikes (max 446.6 → 33.5 ms).
- The CPU-throttled mobile proxies are **CPU-bound, and LOD1 does not fix them**.
  Draw calls are identical for both variants (491 for four avatars, 1,223 for
  twelve) because LOD1 kept every mesh and material; Staff A/B alone have
  113/110 meshes. Triangle reduction does not reduce per-mesh skinning, animation
  and submission cost. The next lever is draw-call reduction (mesh/material
  merging per character), not further decimation.
- The proxies run on a desktop GPU with a throttled CPU. They are not phone
  evidence; physical-device qualification remains open.

One low-risk source fix shares the LOD manifest request and JSON parse among
concurrent appearances in the same character library. A focused Node test
observed one manifest request for four distinct appearances instead of four;
each GLB retains its own size and SHA-256 verification. Failed requests or
asset validation evict the cached manifest for retry, and disposal clears it.
No browser load-time or transferred-byte improvement has been measured.

To repeat the measurement, with an already installed Playwright and Chrome,
run `npm run perf:hybrid` from the repository. On this machine the runner can use
the existing Codex-runtime Playwright package; elsewhere set `PLAYWRIGHT_MODULE`
to an existing package path and, if needed, `CHROME_PATH` to Chrome. It writes a
timestamped JSON report under ignored `reports/perf-hybrid/`, serves only local
repository files, blocks non-loopback page requests and shuts down its own server
and browser. The default samples each of 12 combinations for 120 seconds after
a 1-second warmup: desktop 1280×800 DPR 1 and 4× / 6× CPU-throttled 390×844
DPR 1.5 mobile-viewport proxies, each with originals and LOD1 at four avatars
and a synthetic twelve-role floor. The scene canvas is 1728×1152 CSS pixels,
matching the immersive floor's default map width. Four is the size of each
current starter floor; twelve is the role/desk/chair generator's upper bound,
not a current roster. This is an unsourced automatic-activity observation, not
a forced walking/seat lifecycle, a physical phone, or physical scanout evidence.
Software rendering is reported separately and cannot qualify hardware GPU
performance. A short diagnostic can use `npm run perf:hybrid -- --duration-ms
1000`; it is not a 120-second measurement. Recheck the report's `status`, source
hashes, errors and renderer before using any numbers.

### G6 performance budget — accepted 7 November 2026

The owner delegated the budget to the lead's proposal from measurements
(7 November 2026). The lead set this budget from the measurements above. It is
the acceptance target for Hybrid character performance; proxy results remain
indicative until physical devices are measured.

| Budget item | Limit | Current LOD1 | Result |
| --- | --- | --- | --- |
| Bytes per character file | ≤ 6,000,000 | max 5,515,484 (Zuri) | Pass |
| Triangles per character | ≤ 85,000 | max 81,438 (Zuri) | Pass |
| Distinct character bytes per floor | ≤ 11,000,000 | 10,781,168 | Pass |
| Meshes per character (each skinned mesh is at least one draw call) | ≤ 30 | Staff A 113, Staff B 110, Wangjai 39, Zuri 21 | **Fail** (Staff A/B, Wangjai) |
| Desktop, 4 and 12 avatars | p95 ≤ 20 ms, p99 ≤ 34 ms, no frame > 100 ms | 12 avatars: 16.8 / 33.4 / max 33.5 | Pass |
| Desktop time to all characters ready, 4 avatars | ≤ 2,000 ms | 1,013 ms | Pass |
| 4× CPU proxy, 4 avatars | p95 ≤ 40 ms (25 fps floor) | 66.8 ms | **Fail** |
| 6× CPU proxy, 4 avatars | p95 ≤ 66.7 ms (15 fps floor) | 216.7 ms | **Fail** |
| Physical mid-range phone, 4 avatars | p95 ≤ 40 ms | not measured | Deferred (owner, 7 November 2026) |

The ceiling test checks bytes, hashes and triangles in the actual LOD1 GLBs. The
draw-call and frame-time rows are measured with `npm run perf:hybrid`; they are
not yet enforced by a test.

Disposition: **desktop qualified; mobile not qualified.** Remaining G6 work, in
order: (1) reduce per-character draw calls by merging meshes/materials in an LOD
pass and re-measure the proxies; (2) measure a physical mid-range phone;
(3) update Studio/Lab copy and the runtime catalog `artApproved` labels to match
the 7 November art approval. Accessibility and the complete activity lifecycle
remain separate gaps.

## Integration verification — 6 November 2026

Run on the integration commit in the primary checkout with the standard
entrypoints: `npm test` **1,173 passed, 0 failed, 0 skipped**; `npm run build`
exit 0 (Worker with 483 embedded assets); `npm run docs:check` 0 errors outside
the local, unversioned `handoff/` evidence store. The build also regenerates
`web/vendor/rich` chunks from the locally installed Mermaid; that drift is
environmental and was not committed. Browser, mobile, native lifecycle, live and
final-art checks were not repeated for this integration.

Checkpoint status: owner requested a stop through the coordinating thread on
27 October. Development, review and testing are stopped. G1/G2/G3/G7 have local
code/regression and bounded browser evidence; this is a WIP checkpoint, not full
system, mobile, live, hosted CI or release acceptance. No merge/deployment.

## Findings and disposition

| Gap | Priority / owner | Evidence and disposition |
| --- | --- | --- |
| G1: Lab/runtime model mismatch | Closed locally / Office | Stable `zuri` selects unchanged R4 file/metadata. Saved IDs, roster, geometry, brand and historical R3 are unchanged. The owner approved R4 and the other three specified full-detail/LOD1 appearances on 7 November 2026, as relayed by the lead. |
| G2: stale review form overwrite | Closed locally / Office | UI now sends `baseUpdatedAt`; Worker rejects different stale edits before writes/outbox. Draft and explicit reload remain available. Identical retries and ETag CAS retain their separate protections. Legacy callers omitting the optional base retain prior behavior. |
| G3: nested HTML/base URL audit omission | Closed locally / Office | Recursive discovery resolves local bases, excludes external-base scripts and traces asset-builder inputs separately. Final static audit: 5 HTML documents, 4 module entries, 224 reachable modules, 3 build-only modules, 0 unclassified authored modules, 27 route families. |
| G4: accessibility/lifecycle evidence remains partial | P1 QA / lead | 7 November work adds focused DOM/unit checks for hidden-tab scheduling and reduced-motion changes, names the storage-recovery confirmation, and exposes the Building loading message as a status. This is partial source/test evidence, not a completed WCAG audit or browser/device acceptance; the remaining checks and known lifecycle gaps are below. |
| G5: business contracts and durable shared scenes remain unavailable | Zuri owner | No published Office auth/client registration, authorized roster/actions, shared scene/version/audit or asset service contract. Do not invent endpoints or enable live. |
| G6: asset/performance quality | Art approved; desktop qualified / Office; mobile performance open | Owner approved R4, Wangjai and Staff A/B originals and LOD1 on 7 November 2026, relayed by the lead; other candidates/review assets excluded. Lead-set [G6 budget](#g6-performance-budget--accepted-7-november-2026): LOD1 bytes/triangles and desktop frame/load targets pass on an RTX 3060; 4×/6× CPU proxies fail because draw calls (491 for four avatars) are unchanged by LOD1. Next: per-character draw-call reduction, a physical-phone measurement (deferred by the owner on 7 November 2026), and catalog/UI art labels. |
| G7: reserved-floor board/actions imply an active department | Closed locally / Office | Browser reproduced empty feed and creation actions despite RESERVED. Board now states preparation without a feed read, refresh or Work link; object menus omit Chat/create. Role inspection, illustrative actors and navigation remain. |

G4 disposition: **ACTIVE / handoff; browser and device acceptance open.**
`tests/g4-accessibility-lifecycle.test.mjs` exercises the shared frame scheduler,
Tycoon loop/pacer, dynamic Lab reduced-motion listener, CloudClient polling,
recovery dialog name, safe initial-focus markup and status updates, plus language
attributes on the five HTML entries. `tests/office-lifecycle.test.mjs` adds a Native integration
case; it still requires an environment where esbuild can start. DOM simulation
does not verify native dialog focus trapping, Escape or focus return. Existing
Hybrid activity and Studio scene source already listen for visibility changes;
these findings do not establish every editor, timer or route as covered.

The Native avatar preview now redraws only when its appearance changes; its
integration test requires esbuild. CloudClient pauses its scheduled polling while
hidden and refreshes an active connection on return. A known remaining source
gap is that the Zuri panel interval does not pause on document visibility. The
handoff popup close watcher also runs while
hidden; its interruption and retry semantics must be preserved when addressing
it. Focus/blur behavior and state retention need an edition-by-edition audit.
The complete keyboard, canvas alternative, language-of-parts, contrast and touch
target audit remains open; a language attribute alone is not WCAG conformance.

Lead acceptance checks, using a real browser and a separate physical phone:

- Keyboard-only: visit Building, Lobby, each saved Hybrid and Native floor,
  Design/Hybrid/Native/GLB Studio, and Character Lab. Tab and Shift+Tab through
  every control; verify a visible focus indicator, meaningful names and states,
  and a keyboard alternative for every canvas-only operation. Open and close
  each dialog, including storage recovery and the Office handoff flow; verify
  focus enters it, stays inside, Escape closes it where appropriate, and focus
  returns to the invoking control. Check popup behavior in both origins.
- Reduced motion: enable the OS/browser preference before opening each edition,
  then change it while the Lab and scenes are open. Verify ambient movement stops,
  controls and status remain available, and deliberate user playback is clear.
- Hidden tab and focus: begin an activity or draft in each edition; switch tabs
  for at least 30 seconds and return, then blur/refocus the browser without
  hiding the document. Inspect render callbacks and polling in developer tools;
  expect no hidden animation work, no elapsed-time jump or lost draft, and
  correctly refreshed status. Record any continuing timer separately.
- Screen reader: with NVDA or VoiceOver, walk the same routes, announce dialog
  titles, controls, selected/disabled states, loading and save/recovery failures,
  and verify that a meaningful scene summary or equivalent actions exist without
  seeing the canvas. Verify Thai/English pronunciation for language changes.
- Physical phone: at 100% and enlarged text, walk the same flows using touch;
  measure primary controls against the project's 44 CSS px target and inspect
  clipping, focus visibility and portrait/landscape behavior. Measure text and
  non-text contrast against WCAG 2.2 AA thresholds in each actual state/theme.

## Requirement and feature coverage

`CODE` means an implementation was inspected; it does not imply fresh browser
acceptance. `LOCAL` includes local browser persistence/synthetic Worker behavior.
`DEPENDENCY` needs an owner contract; `PARTIAL` needs broader evidence.

| SRS IDs / subsystem | Current source / regression entry points | Remaining gap |
| --- | --- | --- |
| VO-FR-001/002/007: building, Lobby, directory, reserved | `building-view.js`, `lobby-view.js`, `tycoon-domain-view.js`; workspace-navigation, domain-context tests | CODE/LOCAL; real authorized directory is dependency; recheck reserved navigation by keyboard |
| VO-FR-003/004, VO-NFR-001/008: domain/context availability and expiry | `office-domain-context.js`, `office-context-data.js`; context, data and compatibility tests | Synthetic scoped candidate only; live grants not implemented |
| VO-FR-005/006/008: Agent identity, roster and role | `domain-office.js`, `scene-workspace-actions.js`, `office-agent-state-view.js` | DEPENDENCY; illustrative slots/T3 profiles are not Zuri Agent identities |
| VO-FR-009/010/025: reads, object actions | `zuri-connector.mjs`, `worker/zuri-read.js`, `floor-tasks.js`; scene-workspace-actions and Marketing tests | Synthetic Marketing reads and workspace actions exist; real Projects/WorkItems/Agent actions await Zuri |
| VO-FR-011/012: business writes/events | platform boundary document | DEPENDENCY; local Worker review writes are a separate resource, not Business CRUD/Event Bus |
| VO-FR-013/014/015/020/028: Studio and per-floor editions | Hybrid/Native/Tycoon stores/editors; state, studio, transform tests | LOCAL; shared save/publishing remains gated, dynamic Studio intentionally disabled |
| VO-FR-016/017, VO-NFR-002/003/004: files, isolation, failure | `tests/save-quota-isolation.test.mjs`; versioned floor/prefab/custom-asset codecs and stores | CODE/JSDOM with injected faults: Hybrid and Native share one key, Tycoon and individual prefab entries use separate keys, and custom GLBs use IndexedDB; tests cover per-floor preservation, invalid-record isolation, byte-preservation of untouched records, strict write validation, tolerant display of normalizable legacy Hybrid floors, and incompatible/foreign file rejection. Invalid JSON envelopes can be removed only after raw backup and confirmation; parseable but unsupported envelopes are backup-only, and Hybrid/Tycoon duplicate section keys are rejected. Real browser/device quota, IndexedDB and private-mode behavior, cross-device sync and shared persistence remain unqualified. |
| VO-FR-018: Asset Library, custom GLB, portable sets | `custom-assets.js`, `tycoon-prefabs.js`, `tycoon-prefab-files.js` and tests | LOCAL; custom asset bundles must accompany floor files; no shared asset service |
| VO-FR-019: save failure and recovery | `tests/save-quota-isolation.test.mjs`; RoomStore/Native/Tycoon conditional saves and Asset Library | CODE/JSDOM with injected quota, rejected writes, denied reads, corruption and stale revisions verifies specific failure notices, retained drafts, floor JSON export, raw backup before confirmed corruption removal, and previous-save preservation; whole-key discard is limited to invalid JSON, parseable unsupported envelopes remain backup-only, and Tycoon discard rechecks under its write lock. The Hybrid assignment's two-write failure also retains its library copy. Simultaneous Hybrid/Native cross-tab writes lack atomic CAS; a failed custom-model card write may leave an unreferenced IndexedDB blob, and an unsaved custom GLB/descriptor has no bundle export. Actual browser-engine quota/private-mode and device recovery evidence remains open. |
| VO-FR-021/024, VO-NFR-005/006/007: fullscreen navigation/accessibility | workspace shell/navigation, floor viewport, dialog and reduced-motion tests | PARTIAL browser/device/assistive-technology evidence; retired sidebar must stay absent |
| VO-FR-022/023: blueprint/walk/seat/door | blueprint/navigation/door editor and collision tests | LOCAL; arbitrary imported layouts and physical-device interactions need wider acceptance |
| VO-FR-026/027, VO-NFR-009/012: assets, rig, depth/collision, cleanup | character runtime, scene models, native loader, navigation/lifecycle tests | Owner approved the four specified original and LOD1 appearances on 7 November 2026, relayed by the lead; Hybrid performance, accessibility/device evidence and live roster parity remain open |
| VO-NFR-010/011: offline/source provenance | connector/workspace gates, local schema revision and source labels | CODE/LOCAL; canonical business audit/versioning remains Zuri-owned |
| Chat: selection, history, composer, files, queue | `chat-ui.js`, `chat-selection.js`, `worker/chat.js`; chat UI/view/runner tests | Synthetic queue acknowledgement is not an Agent reply; live Zuri Chat unavailable |
| Work: task selection, filters, cancel, review, handoff | `work-view.js`, `task-ui.js`, `worker/work-review.js`; work-view/review tests | G2 closed locally; created workspace tasks still have no canonical Business-domain assignment contract |
| Results, Knowledge, Team, Inbox and remaining menus | `results-view.js`, `knowledge-view.js`, `team-page.js`, app routing; associated tests | Existing T3/Worker workspace functionality, not provider-neutral Zuri APIs; synthetic smoke required |
| Refresh/route/loading and model errors | app/workspace routing, `native-gltf.js`, `characters/runtime.js` | No legacy dashboard/flash; Native loading fix is separate from browser lifecycle acceptance |

All 28 VO-FR and 12 VO-NFR IDs are covered above; the two FR rows numbered 021/022
retain their existing identities. No percentage of product completion is inferred
from test counts. This report does not exhaustively audit the Zuri backend.

## Execution order and exit criteria

1. Freeze model geometry; adopt R4 by the existing presentation ID only.
2. Reproduce G2 in API and UI tests, add stale preconditions and recovery, verify
   idempotent retries and ETag races. No silent last-writer-wins from the new UI.
3. Fix G3 audit discovery with nested/base/escaping regressions; run endpoint audit.
4. Run the full suite, then build serially. Check documentation and compatibility.
5. Exercise source app and built Worker: Office/Lobby/Projects, object actions,
   Chat/Work and remaining menus, refresh, synthetic review, keyboard/reserved and
   viewport checks where supported. Record failures and tool limits honestly.
6. Independent scoped review; retain previous staged asset work. No live, paid
   generation, upstream messaging, commit/push or deployment is part of this run.

## Verification record

Evidence collected before the stop, under `reports/system-gap-20261027/`
(ignored; not portable repository artifacts):

- `tests-final.log`: 836 passed, zero failures/skips; `build-final.log`: 452
  embedded Worker assets. Tests and build ran serially. Work handoff final
  focused tests: 10 passed, including null-base replay/concurrent handoff cases.
- Earlier failing reproduction: `red.log`; intermediate conflict-form test
  exposed hidden reload controls and was corrected. Reserved red/green records
  retain the initial defect and an intermediate test that accidentally matched
  the explanatory phrase “not opening Chat”; final assertions inspect buttons.
- Last documentation check before stop: 125 Markdown, 463 links, zero internal
  errors; 36 external URLs not fetched. Checkpoint-only status prose was added
  after the stop; no subsequent test/governance run was started.
- Pinned Marketing compatibility: 57 PASS, `live:false`. Current static audit:
  all 27 Office route families have existing owners/consumers. No upstream live
  API or whole Zuri-backend qualification is inferred.
- Source `:4204`: two-tab review conflict retains draft and explicit reload gets
  the confirmed other revision; six workspace route smoke checks. Source and
  final Worker `:4205`: reserved board/desk, keyboard Enter/Escape verified.
- Worker: character/desk/board actions, exact board-to-Work-to-Chat navigation,
  synthetic chat queue/history, task creation, review save/refresh, Results,
  Knowledge, Team, Inbox, Lobby/building refresh. Newly queued work is explicitly
  not completed by a live Agent. Source/Worker console warn/error lists were empty.
- Viewport tool accepted a request for 390x844, but the inspected page reported
  1280x720. The screenshot is named `worker-reserved-actual-1280.png`; mobile
  acceptance is NOT established. Override was reset. Native hidden/focus and
  physical-device/accessibility/performance qualification remain open.
- Independent scoped review: no remaining Critical/Important code findings;
  reviewer ran 33 core focused tests and 62 board/workspace tests. Pending report
  status and stale R3 wording were reconciled for this checkpoint. Art/live/CI
  acceptance was not reviewed. The pre-existing 168-file character patch was not
  re-reviewed wholesale in this continuation.
- 37 prior GLB/Blend/PNG/JPG assets were hash-checked unchanged. No sculpting or
  paid generation. Hosted CI, new PR and deployment were not run.
