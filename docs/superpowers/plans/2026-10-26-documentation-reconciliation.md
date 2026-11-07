# Documentation reconciliation plan

**Goal:** reconcile the Office documentation with main `94973644`, make document
families discoverable, and detect nonexistent file/section targets.

**Scope:** Office repository only. Keep existing requirement IDs and approved
design provenance. Do not edit Zuri canonical contracts, runtime behavior, assets,
saved scenes, or unpublished character work. Prior live/provider observations are
historical; current qualification is synthetic.

- [x] Enumerate tracked, untracked and ignored documentation before changing it.
- [x] Compare README, SRS, architecture and UX flows with the current source.
- [x] Add a central documentation index and indexes for dated plans/specs; retain
  current manual families rather than moving approved historical files blindly.
- [x] Validate local Markdown links and section anchors, exact path case and
  portable tracked targets. Classify external design sources and ignored local
  evidence separately, without calling them portable repository documents.
- [x] Repair broken links and stale active claims; retain frozen evidence as history.
- [x] Add a reproducible documentation check and focused regressions, validate
  indexes and the composed patch, and obtain independent review.

Ownership: system-doc worker owns SRS/architecture/UX; entry-doc worker owns
README/domain mapping. Integrator owns all other documents, indexes and checker.
No commit, push or merge is included in this request.

## Findings and disposition

- The initial pass (including this new plan) found 84 Markdown files, 211 links,
  six missing portable targets and 68 missing family-index entries. All six links
  were ignored local screenshots/logs in DESIGN-STUDIO. Their original paths are
  retained as explicitly unavailable historical locators, not download links.
- Added a central docs index and family indexes under superpowers; retained the
  existing game-design package and dated source locations. No approved record or
  asset provenance was moved/deleted. Historical root design-qa remains linked.
- Corrected current README/SRS/system/UX descriptions for the removed dashboard,
  default art versus saved GLB and synthetic dynamic modes, workspace gates,
  route/proxy ownership, per-floor scene formats and optional-client target.
  Updated older editor/art/package guides with explicit precedence/history notes.
- Corrected the shortened duo asset path and retired workspace stylesheet name.
  Upstream Zuri PRODUCT references are qualified as upstream documents. All 40
  existing VO requirement IDs are preserved; no Zuri record/owner/API was created.
- External design-checkout paths are explicit locators, not portable links. Their
  three distinct target files exist on this machine; no copies were invented.
- The separate inline-path scan found three intentionally absent historical
  locators: the retired browser T3 client in two deletion notes, and a missing
  earlier Zuri plan explicitly described as not found. They remain historical
  text, not active file links. This is not an unresolved current-source link.

## Verification and limits

- `npm run docs:check`: 88 Markdown files, 335 links, zero local target/anchor/case
  or family-coverage errors. The checker also rejects physically deleted tracked
  targets and discovers newly added document families. 22 external URLs were
  classified but not fetched; no machine-local hyperlinks remain.
- Twelve focused documentation-check regressions PASS. Missing-tool and later
  deleted-file/missing-index regressions were observed failing before their fixes.
- Full `npm test`: 759 PASS, zero failures/skips. The extra twelve tests validate the
  checker; the previous delivered main suite had 747 tests.
- Mermaid parser: 22/22 diagrams PASS. Initial sequence-diagram semicolon failure
  was corrected; parsing is syntax validation, not rendered visual/user acceptance.
- `node --check scripts/check-docs.mjs` and `git diff --check`: PASS.
- Local evidence is in ignored `reports/docs-audit/`: inventories, initial/final
  link results, inline-path classification, diagram result and test log. No app
  runtime, assets, model work, live APIs or production configuration changed.
- Hosted CI and full asset build were not rerun for this uncommitted docs/tooling
  patch. Office CI now includes docs:check; it has not yet run on this patch.
- Independent composed-patch review and follow-up delta: no blockers. All four
  minor notes were resolved: synthetic/auth wording, frozen-history tense,
  actual HTML anchors (including unquoted IDs), and root-document index coverage.
  The reviewer did not independently execute tests, diagrams or UI checks.
