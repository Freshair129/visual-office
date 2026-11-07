# Visual Office documentation index

Reconciled against Office main `949736446824d4803f9109a20830202494abd7b7`
(26 October 2026). This is navigation and document ownership guidance, not a
second requirements registry. Start at the [repository guide](../README.md).

## Product, system and integration

| Document | Responsibility and status |
| --- | --- |
| [SRS](VISUAL-OFFICE-SRS.md) | Office requirements and implementation/dependency status; preserve existing VO IDs |
| [System gap analysis](SYSTEM-GAP-ANALYSIS.md) | 27 October functional audit, priorities, temporary-model baseline and separate local/live acceptance gaps |
| [Architecture](ARCHITECTURE.md) | Current components, data flow, storage and deployment boundaries; target diagrams are labeled |
| [UX flows](OFFICE-UX-FLOWS.md) | Current shell, routes, Lobby/directory and object-to-workspace flows |
| [Domain/floor mapping](DOMAIN-OFFICE.md) | Static illustrative directory versus the synthetic authorized-domain candidate |
| [Zuri platform boundary](ZURI-PLATFORM-INTEGRATION-BOUNDARY.md) | Optional web-client target, ownership and contracts still required from Zuri |
| [Office execution contract v1](ZURI-OFFICE-EXECUTION-CONTRACT-V1.md) | Office-side proposal/schema; not a published or adopted Zuri API |
| [API endpoint audit](API-ENDPOINT-AUDIT.md) | Dated Office method/consumer audit; source existence is separate from live acceptance |
| [T3 capability inventory](T3-CAPABILITY-INVENTORY.md) | Pinned execution/parity baseline; T3 bridge remains active |

## Scenes, editors and assets

| Document | Responsibility and status |
| --- | --- |
| [Design sources](DESIGN-SOURCES.md) | Latest art precedence, external brand-source location, preserved logo/palette |
| [External assets and RustFS](EXTERNAL-ASSETS.md) | Public checkout behavior, external asset manifest and local store commands |
| [Hybrid Studio](HYBRID-STUDIO.md) | Local Hybrid room state, interaction, navigation and applied-floor behavior |
| [Native Studio](NATIVE-STUDIO.md) | Original editable 3D edition and backward-compatible snapshots |
| [Measured blueprints / GLB Studio](OFFICE-BLUEPRINTS.md) | Metric plans, doors/walking/seats, GLB tools, groups/textures and portable assets |
| [Design Studio prototype](DESIGN-STUDIO.md) | Original model-preview history and links to the later editor tools |
| [Style comparison](STUDIO-STYLES.md) | Historical three-style comparison, retained as an editor/reference |
| [Art production inventory](ART-PRODUCTION-PLAN.md) | Asset families and earlier inventory; provisional art does not prove character approval |
| [3D art brief v0.1](3D-ART-BRIEF-V0.1.md) | Earlier model-construction brief; follow current design-source precedence |
| [Game/economy design v0.1](GAME-DESIGN-V0.1.md) | Proposal, not an implemented economy or business authority |
| [Office Tycoon production package](game-design/README.md) | Game workflow, asset list, integration gates and wireframe artifacts |

## Asset sources, licenses and provenance

| Index or record | Responsibility |
| --- | --- |
| [Blender inspection and QA evidence](../asset-source/blender/README.md) | Derived Blender imports and local geometry/runtime evidence |
| [Editable character sources](../assets-source/characters/README.md) | Character source models, revisions and build references |
| [Character Lab model licenses](../web/assets/models/characters/candidates/LICENSES.md) | Third-party candidate attribution and license boundaries |
| [Bundled font sources and licenses](../web/assets/fonts/README.md) | Local font package and license references |
| [Office-world prompt and provenance index](../web/assets/office-world/README.md) | Background, furniture and skin prompts/provenance |

## Implementation history and evidence

- [Complete document inventory](DOCUMENT-INVENTORY.md): purpose, status, inbound
  links, ownership, canonical location and a phase 2 move proposal.

- [Owner-accepted low-rate MVP, 31 October](game-design/OFFICE-MVP-ACCEPTANCE-20261031.md):
  accepted local scope, measured performance limits and separate integration checks.

- [Dated designs and implementation plans](superpowers/README.md), with separate
  [plan index](superpowers/plans/README.md) and [design index](superpowers/specs/README.md).
- [Historical local design QA](../design-qa.md): dated observations, not a current
  production sign-off. Its root path is retained for existing citations.
- [Pinned Marketing fixtures](../tests/fixtures/marketing-office/README.md) and
  [execution parity acceptance](../tests/golden-e2e-parity.md).
- Latest delivered runtime baseline: [PR #10](https://github.com/Freshair129/zuri-visual-office/pull/10),
  [exact-main CI](https://github.com/Freshair129/zuri-visual-office/actions/runs/40326980103):
  747 tests, build and pinned compatibility passed. This is synthetic/code evidence,
  not production deployment, live Zuri qualification or native hidden/focus acceptance.

## Document families and maintenance

Keep current feature/system guides directly under `docs/`; the production package
under `docs/game-design/`; dated design decisions under `docs/superpowers/specs/`;
and implementation plans/round-specific evidence summaries under
`docs/superpowers/plans/`. Retain approved historical sources in their existing
family; a folder name is not evidence of approval or implementation. Asset prompts,
licenses and provenance stay beside the assets. [AGENTS.md](../AGENTS.md) routes contributors to
these documents; it does not replace the SRS. Do not create Zuri canonical records here.

After adding, moving or renaming a document, update its family index and inbound
references in the same patch. Run `npm run docs:check` (also in Office CI). It checks
all Git-tracked and nonignored Markdown, local links/images, Markdown/HTML section
anchors, exact path case and family-index coverage. `--json` on
`node scripts/check-docs.mjs` gives detailed results. This checks navigation, not
semantic correctness, every plain-text code example or remote URL availability.
Root-level Markdown must also be linked from this central index; each `docs/`
folder indexes its direct documents/artifacts and child-family README files.

`reports/` and `.local/` are ignored local evidence. A path there is a locator for
an earlier machine/run, not a downloadable repository artifact. Missing evidence
must remain marked unavailable; never fabricate a screenshot/log or promote an
old observation to current PASS. External design paths listed in
[Design sources](DESIGN-SOURCES.md) belong to a separate checkout and are not
portable repository links. Online citations are not fetched by the local checker.
