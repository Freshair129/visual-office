# Character runtime reconciliation plan

> **Superseded in part (6 November 2026):** the Tycoon/GLB Studio probe no longer
> uses the character runtime. Main's rig-v3 factory actor is authoritative there;
> see [system gap analysis](../../../SYSTEM-GAP-ANALYSIS.md#main-branch-reconciliation--6-november-2026).
> Statements below about the GLB probe are historical checkpoint evidence.

**Goal:** complete the pending temporary-character work on merged main without losing the original editable models or changing business/Agent identity.

**Authority:** the owner's instruction to merge PR11 and continue pending model work, and the existing [temporary runtime plan](2026-10-26-temporary-character-runtime.md). The earlier owner decision defers final art polish; this continuation introduces no new character design or paid generation.

**Approach:** preserve the original dirty checkout by hashes, bring its existing character assets, authoring sources, Lab and runtime into this isolated branch, reconcile against current main and the new documentation guard. Keep Zuri, Wangjai and staff distinct. Retain attribution, provisional art status and current collision/seat/status ownership. No live integration.

- [x] Merge PR11 normally after exact-head/base/check inspection; main is `a9226669` and its tree equals reviewed head `e34181e2`.
- [x] Snapshot all 150 pending source files before copying; preserve the original checkout. Reapply its source changes with a three-way merge against current main.
- [x] Reconcile character documentation/indexes and Lab/runtime links with current source; inspect selected GLB hashes, clips and independent pose/seat behavior.
- [x] Run focused regressions, full tests, docs check, build and pinned synthetic compatibility with isolated installed dependencies.
- [x] Exercise Character Lab and actual floor/Studio in Codex browser, then the built synthetic Worker, including motion, saved appearances and navigation boundaries. Do not equate historical evidence with a fresh run.
- [x] Obtain independent review of the composed patch, repair important findings, and record actual results and remaining art/performance gates.

No automatic commit/push/PR of the character continuation is included. Historical failed visual trials remain explicitly historical; current usable models are not final art approval. Main merge CI is tracked separately from this branch's local checks.

## Fresh reconciliation evidence

- PR11 merged normally as `a9226669`; exact merge tree equals reviewed head
  `e34181e2`. Main workflow `40348217130` passed. Character continuation remains
  local on `codex/character-runtime-reconcile-20261026`, without a new commit/PR.
- All150 original pending files remain unchanged in their original checkout.
  Selected Zuri/Wangjai/Staff A/B GLBs retain their bytes and SHA-256; source
  app4202 and built Worker4203 return the same four hashes. No new sculpt,
  paid generation or Blender geometry QA run is claimed by this integration.
- Lab now defaults to the current temporary Zuri, supports explicit known model
  query choices and correctly labels temporary runtime use. Historical rejected
  faces remain explicit comparisons. The new opening/caption tests were RED
  before implementation and GREEN after it.
- Independent composed review found no Critical and one Important seat finding.
  The Wangjai regression was RED before the fix and GREEN afterward: its shell
  contacts the seat at .34/.41/.50/.57 m, scales .8/1/1.12 and three headings;
  fixed-length short robot legs naturally dangle. It neither stretches limbs nor
  moves the navigation root. Human sole/IK checks remain separate. This resolves
  the generic foot-contact wording for the short mascot rather than applying
  human anatomy to it. The reviewer independently ran47 focused tests.
- Full final `npm test`: **826 passed, zero failures/skips**. Full build passed
  with450 embedded assets; Worker was rebuilt after the seat fix. Pinned
  compatibility:57 synthetic cases passed. `docs:check`:121Markdown/443links,
  zero internal target/anchor/index errors;36 external URLs are not fetched.
- Codex browser source and Worker: current Lab loaded/played walk/seated clips;
  embedded Worker Lab loaded under its exact CSP exception and closing it kept
  the Studio draft. Projects export before/after differs at only two appearance
  values, preserving16objects/4avatars. Refresh and Worker import/export match
  the saved file exactly. Source Zuri reached the sofa; GLB Studio probe completed
  approach/sit/return. Layer controls retain the same scene. Browser warning/error
  lists were empty. Synthetic fixtures reported zero real upstream calls and no
  violations. Geometry/path regressions provide collision evidence; a screenshot
  alone does not prove every possible route or mobile behavior.
- At one occluded character position, pointer picking selected the front desk;
  keyboard Enter opened the intended avatar action menu. This preserves the
  existing depth-aware pointer policy, not a new guarantee of picking hidden
  characters through furniture.
- Runtime audit now discovers root-level HTML module entrypoints (app and Lab):
  27route families,222reachable modules, no root-level orphan module. Two new
  discovery tests were RED then GREEN and independently passed in delta review.
  **Deferred minor:** nested developer HTML under `web/tools/`, including its
  `<base>` semantics, is outside this discovery scope; the count is not a claim
  to enumerate every developer-tool entrypoint. No runtime defect was found in
  that bounded delta review.
- Ignored local evidence is in `reports/character-reconcile/`: original snapshot,
  preservation/hash receipts, RED/GREEN logs, final tests/build, source/Worker
  round-trip and HTTP checks, screenshots and execution ledger. Original brand,
  room art, logo and Agent identity/role are unchanged.

Final art likeness, natural transition/gesture polish and mobile LOD/performance
remain open. Zuri is still about203ktriangles/10.5MB; these checks do not qualify
production delivery, shared persistence, live authorization or complete art.
