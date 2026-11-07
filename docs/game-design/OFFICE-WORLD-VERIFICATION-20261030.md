# Functional floors and dimensions — 30 October 2026

The chair failures and real-time timings below are the pre-fix baseline.
Use [the subsequent chair/performance report](OFFICE-CHAIR-PERFORMANCE-20261030.md)
for current chair lifecycle results and timing limitations. Floor-plan and
identity-package results here remain separate from those runtime changes.

This is local implementation and verification evidence for the revised Office
simulation. It does not record product approval, Zuri registration, production
deployment, an operational Agent roster, or permission grants. Requirements and
the platform boundary remain in the [SRS](../VISUAL-OFFICE-SRS.md) and
[integration contract](../ZURI-PLATFORM-INTEGRATION-BOUNDARY.md).

The working tree is based on `a6fdc7e7edbf902e3f56a5b55dcb8e38cabe21c4`
and contains pre-existing changes. Zuri source was rechecked at
`848e422e32439edae63d9657fcfa2b976c9f8ea4`. Runtime evidence records source
and model hashes; changing-source and interrupted runs are diagnostic only.
This revision remains in the working tree; no commit, push or deployment was
performed for it, and unrelated changes were preserved.

## Floor design and dimensions

All fifteen defaults use a 24 × 16 m plate measured inside the exterior wall
faces: 384 m² before subtracting interior partitions. Exterior walls are 0.20 m
thick, giving a 24.4 × 16.4 m outside envelope. The shared rear lift/service core
has the same datum on every floor. There are 77 named programme areas, with
distinct arrangements including Inventory's count island/loop, Warehouse's
U-flow, Marketing's editing booths, Procurement's public supplier suite,
Customer/People consultation rooms, Operations' control island, and Knowledge's
source preparation and quiet research areas.

The [combined drawing](tycoon-floor-plans.svg), [individual sheets](TYCOON-FLOOR-PLANS.md),
and [drawing archive](C:/Users/suanr/workspace/visual-office/handoff/floor-plans-20261030.zip) include:

- overall inside dimensions, a 0–4 m scale bar, and doorway widths;
- R1–R6 keys with room/zone width, depth, area and dimension basis;
- A1/A2 keys for actual clear aisle cross-sections;
- the actual navigation path between the front entrance and lift lobby.

`clear` subtracts the interior wall faces from a fully enclosed area's authored
wall-center bounds. `zone` retains the authored programme bounds. Nested areas
overlap and must not be summed as additional floor area. Displayed dimensions
round to one decimal; source geometry and the handoff retain their precision.
Individual SVGs preserve 1:100 only at 100% / Actual size printing; use landscape
A3 and check that 24 m measures 240 mm. Physical print output has not been tested.
The 17-entry drawing ZIP passed CRC and byte equality against the current SVGs;
its SHA-256 is `725fca15ca54c5924e279e4c5f6fe1c79b65f526104eb8aae5660ce293f3d8d4`.

SVG tests check the dimension values against the factory, metric wall thickness,
exterior clear-face alignment, marker overlap, doorway widths, aisle spans,
room schedules and physical print scale. The images were rendered and visually
reviewed. Layout tests also check real entrance/lift connectivity and all four
role approaches on every department floor.

Legacy blueprint limits remain the default. The explicit Tycoon profile admits
24 × 16 m, 40 partitions and 20 areas, with separate template storage and bounded
metric navigation. The fixed coordinate translation is unchanged. Existing
saved floors remain authored snapshots: **ลองแปลนแบ่งห้องใหม่** loads an undoable
draft, followed by explicit **บันทึกชั้นนี้**. The room guide shows dimensions,
purpose, proposed roles/workflow steps, subarea containment and actual 3D focus.

## Roles, identity and offline handoff

The [team design](OFFICE-DEPARTMENT-TEAMS.md) contains fifteen proposed teams,
sixty roles, fifteen workflows, sixty-three steps and seventeen cross-team
handoffs. The [space guide](OFFICE-SPACE-FUNCTIONS.md) maps all 77 actual areas to
their proposed uses. These designs do not instantiate Agents or execute work.

The current default package is [office-world-v6](C:/Users/suanr/workspace/visual-office/handoff/office-world-v6/README.md):
1,655 entities across twenty types, seventeen exact GLBs, and twenty-one ZIP
entries. Content hash:
`97599a01b51a93dd88be3a3dd6445ec5be9114bbc9d34e7ee5ce9a7192f343e9`.
Archive SHA-256:
`9c21ab58ae3ca1e0c27f65f2437858443f6ac96ea7dcf05943dc077b8b227933`.

The JavaScript graph/archive verifier and independent Python ZIP/UUIDv5/hash
check passed. All fifteen current default snapshots match the packaged snapshots.
Compared with v5, all 1,092 shared semantic keys retain their IDs; the redesigned
structure adds 563 keys and removes 238. Removal is a design difference, not
authorization to delete registered records. Canonical Tenant/Business/Workspace
and Agent mappings remain null. See the [receiver boundary](OFFICE-ZURI-REGISTRATION-HANDOFF.md).

## Contact and lifecycle changes

Desk travel first prepares the arms at a fixed, collision-checked spawn, then
allows root movement after the measured narrow target and a real capsule sweep
both succeed. A new activity cannot reuse prior readiness. An acquisition that
does not finish within eight seconds stops visibly. Renderer-independent
activities retain their existing behavior.

Wrist targets follow root translation and yaw during controlled transit. The
staged pose and root frame participate in safe-pose rollback and reset. Skinned
mesh regressions cover fresh and carried approach/walk/turn paths at 30/60 Hz,
including early transition frames and a moving/rotating root. They retain the
measured bind-pose elbow overlap noted below; they do not claim zero self-collision.

When a terminal thigh/shin pose meets a chair edge, bounded knee-pole and hip
offset candidates keep the ankle targets fixed and are accepted only by the
existing swept limb test. Hip offsets are at most 20 mm and reset each update;
measured leg lengths and collision thresholds are unchanged. Worst-case search
can add twelve knee sweeps and up to 210 hip sweeps.

Desk departure candidates now also need walkability at sixteen points on a
0.20 m world-space ring. This rejects the Inventory endpoint that let a leg
touch a wall end while settling. The ring is a bounded planning precheck;
the actual limb/foot sweep still decides safety. The exact wall GLB regression
reproduced the old failure at 30/60 Hz and verifies more than two seconds of
clear settled pose after the correction.

Departure now enters an explicit local `settling` phase before `done`. The scene
requires a successful collision result and both feet ready before releasing the
station and reporting completion. The first completed frame and every subsequent
two-second hold frame are checked against actual skinned shoe vertices within
3 mm of the floor at both 30 and 60 Hz. A bounded timeout visibly refuses a pose
that cannot settle.

The real-time profiler also exposed an async scene-loading race: an actor could
finish loading before the furniture, allowing the frame loop to create contact
controllers with a null collision world. A 240 ms furniture-load delay reproduced
that ordering in hardware WebGL. Probe updates now wait for scene readiness;
rebinding a changed world restores authored bone poses, clears safe poses and
arm targets, and binds both leg and arm controllers before earning readiness
again. The regression uses the actual actor and plant GLBs and real sweeps.

## Verification

Recorded logs and browser JSON are in the [local evidence bundle](C:/Users/suanr/workspace/visual-office/handoff/office-world-verification-20261030/README.md).

`node --test --test-concurrency=4 tests/*.test.mjs` passed **584/584** tests,
with zero failures, skipped or cancelled tests (285,520 ms). This includes actual
GLB transit, endpoint and rebinding regressions, floor geometry/navigation,
metric validation, dimensions, identities and archive checks.

`npm run build` passed in an isolated source copy, producing a Worker with 505
embedded assets. Its copied browser JavaScript hashes match the final source;
the build did not regenerate assets in the working checkout.

Actual `index.html` / `app.js` UI navigation verified fifteen floor choices,
the Knowledge guide's five areas and dimensions, four role design IDs, four
workflow steps and 3D area focus. Hardware WebGL was RTX 3060/D3D11, with no
page errors, no non-GET backend writes and unchanged source hashes.

The browser download test separately exercised saved People edits and a real
external chair imported through IndexedDB: 1,657 entities and 22 ZIP entries,
with independent graph, binary hash and ZIP checks. It recorded no page errors
or backend writes. That export run preceded the final loading/settling fixes;
the exporter and handoff schema were unchanged by those fixes. Its 179,867 ms
measurement combines export and independent verification under concurrent
functional GPU load; it is not an isolated UI export latency measurement.

`node scripts/asset-factory/verify-office-world.cjs .local/functional-world-full-final-6`
with PowerShell `$env:PREVIEW_PORT='4197'` covered all **96/96** cases on hardware
RTX 3060/D3D11 in Chrome 156. It completed **86** and refused **10**. All fifteen
floors loaded with no navigation issues; there were zero page errors and source
hashes stayed unchanged. Every simulated frame was rendered, using controlled
30/60 Hz time steps. This is lifecycle evidence, not an FPS benchmark.

All 56 default department desks completed at 30 Hz; the first desk on each of
the fourteen departments also completed at 60 Hz. Three floor routes completed
at both rates. Supported external chairs at 0.9 scale, the authored compatible
four-leg arrangement and the default bundled chair also completed their tested
lifecycles. Checks include actual palm vertices/desktop support, pelvis/seat
support, measured arm lengths, actual shoe vertices, planted-foot movement and
more than two seconds of grounded completed pose.

The following five variants failed at **both** 30 and 60 Hz (ten cases total):

| Fixture | Observed refusal |
| --- | --- |
| `kenney-chair-four-leg-1.1` | Left thigh intersects the external chair |
| `kenney-chair-rounded-back-1.1` | Left thigh intersects the external chair |
| `kenney-chair-swivel-1.1` | Left thigh intersects the external chair |
| `bundled-0.75` | Left thigh intersects the chair |
| `bundled-1.25` | No admitted safe seat/approach; refused before animation |

The command exits 1 and the report's `acceptance.passed` remains **false**.
Those refusals have not been relabeled as successful lifecycles.

`node scripts/asset-factory/profile-gpu.cjs 120000` with the same preview port
then measured each mode for at least 120 seconds, after the other task-owned
GPU browsers and test processes had closed. Source hashes remained unchanged,
with zero page errors and zero motion failures. Each mode completed six
sequences: the initial route followed by repeated complete desk lifecycles.
The profiler's phase-coverage check is true; it is not a steady-FPS pass.

| Mode | Observed FPS | p95 / p99 interval | Longest interval | Intervals over 100 ms |
| --- | ---: | ---: | ---: | ---: |
| Display cadence | 53.30 | 33.30 / 50.00 ms | 1,083.5 ms | 15 |
| 30 FPS cap | 28.26 | 34.00 / 50.50 ms | 1,550.1 ms | 11 |

Both modes used Chrome 156, NVIDIA GeForce RTX 3060 via ANGLE/D3D11, at
1280 × 800, DPR 1. Peak reported draw calls were 222 and triangles 70,466.
Scene-load durations were 9.81 s and 21.09 s respectively, excluded from the
timed samples. These are observed renderer frame intervals, not GPU timestamp
queries or a windowed-display benchmark. The cap limits cadence; **a constant
30 FPS has not been achieved**. Long frames need further profiling; this run
does not establish their cause.

Independent review found no remaining defect in the scoped loading, rebinding,
settling and verifier changes. The reviewer did not execute tests. See the
[review scope](C:/Users/suanr/workspace/visual-office/handoff/office-world-verification-20261030/independent-review.md)
and the recorded command results for those separate forms of evidence.

## Remaining boundaries

- The rig's bind-pose elbow/forearm meshes overlap shirt/pelvis geometry by
  14.20 mm left and 16.13 mm right. The transit regression rejects increases
  beyond the measured baseline plus 2 mm; palm meshes must stay over 2 mm clear.
  This is not a complete anatomical or continuous self-collision solver.
- Arbitrary chair shapes, scales and authored anchors can be incompatible with
  this rig and desk. Unsupported cases must remain refused with a visible reason.
- Existing chair QA retains fourteen warnings: repeated primitive UVs and
  coincident-position export seams. See the [asset evidence](OFFICE-WORLD-VERIFICATION-20261029.md).
  The current task does not change those model bytes or certify texture baking.
- These are simulation plans. The service reserve does not implement stairs,
  toilets, building-code/accessibility compliance or elevator travel. Warehouse
  is an office planning concept. “Private” area labels do not enforce access.
- Hardware measurements cover one transient probe in headless Chrome, not sixty
  concurrent Agents, physical devices, every GPU, or production performance.
  The 30 FPS cap averaged 28.26 FPS and retained a 1.55 s longest frame interval;
  frame pacing and load time remain open performance work.
- Hosted CI, deployment, real business commands and a Zuri registration receiver
  remain outside this local verification. No DB registration or Agent activation
  has been performed.

Evidence links with a Windows drive prefix are machine-local locators in the original
qualification checkout. Raw traces and archive payloads are not portable Git files;
their measurements retain their original source binding.
