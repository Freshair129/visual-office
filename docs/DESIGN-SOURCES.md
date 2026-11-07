# Visual Office design sources

**Current approved characters (7 November 2026):** the owner approved Zuri face
revision 4, Wangjai and Staff A/B originals and LOD1. See
[runtime scope](game-design/characters/TEMPORARY-RUNTIME.md) and
[character history and sources](game-design/characters/README.md). Existing
approved sheets remain identity references. Other candidates and review assets
remain unapproved. Old Lab-only limits are historical for these four appearances.

**Current reconciliation — 26 October 2026:** the default campus/Lobby retain the
original illustrated assets and logo. The synthetic dynamic-domain view uses
`web/office-art-scene.js` and the same Hybrid floor artwork. A saved GLB edition
and the editors remain supported; the green GLB prototype is not the default theme.
Building-only Fit/zoom-out now covers the viewport with 25% overscan; floor/editor
Fit is unchanged. See [runtime audit](API-ENDPOINT-AUDIT.md) and
[campus framing](superpowers/plans/historical/2026-10-26-campus-overscan.md).
The four character appearances now have the approval specified above; other
candidates do not. Older dated refinements below preserve the design history rather
than authorizing another theme or branding change.

**Latest structural reset — 24 October 2026:** Projects now uses one measured
Scene Sheet. The beauty image is rendered from the actual room/prop geometry;
Dev hides that layer and exposes the same meshes without camera/renderer swaps.
Independent whole-room PNG plus separately authored greybox matching is rejected
for this rebuilt edition. Preserve the logo and warm office palette. See
[unified sheet](superpowers/specs/historical/2026-10-24-unified-scene-sheet-design.md).
Older generated assets and saved imports remain provenance/compatibility, not
active image sources for a sheet-tagged room.

**Owner correction — 24 October 2026:** preserve the original illustrated campus,
Lobby, logo, palette and furniture artwork. 3D supports the image through depth,
collision and walking. Projects is the first scoped adapter; see
[painted skeleton design](superpowers/specs/historical/2026-10-24-projects-painted-skeleton-design.md).
Internal floors use a fullscreen, frameless scene with HUD and contextual details;
portrait screens pan through a large room instead of shrinking it. This direction
supersedes earlier interpretations below that made the GLB greybox a visual replacement.

**Current production brief — 23 October 2026:** [Office Tycoon vertical slice](game-design/README.md) defines the requested sidebar-free building, G Lobby and Projects pilot, modular GLB kit, fixed isometric camera, contextual interactions and production workflow. The package is proposed for design review, not an implementation claim. It records the latest owner request to investigate real Zuri reads/commands while retaining platform contract gates.

Historical direction, recorded 20 October 2026: **Painted 2.5D environments + Soft 3D furniture + 2D Anime characters**, with mobile simulation UI. This page routes to the source; it does not duplicate the full design specification.

**23 October owner refinement (first pass):** generic work-floor characters use articulated 3D adults like the supplied Office Idle reference, alongside real Soft 3D props and the Painted 2.5D room. See the current refinement in [HYBRID-STUDIO.md](HYBRID-STUDIO.md). Garden/City sprites and branded character masters remain intact. The external application profile still records the earlier anime baseline; this explicit owner decision takes precedence for generic work-floor characters.

**Latest 23 October steering:** the owner requested the room structure as an actual Three.js model. Office now uses procedural 3D floors/walls/windows alongside 3D props and characters; the painted room is fallback artwork. The fixed isometric camera and warm palette are retained. See HYBRID-STUDIO.md for editable navigation, data and verification boundaries. This later owner instruction takes precedence over the older painted-environment application profile for Office.

| Topic | Read first |
| --- | --- |
| System requirements, status, acceptance, canon diffs and open dependencies | [Visual Office SRS](VISUAL-OFFICE-SRS.md) |
| System context, components, data/persistence, integration sequences, deployment and asset pipeline | [Architecture and diagrams](ARCHITECTURE.md) |
| Office screens, navigation and end-to-end user flows | [Office UX flows](OFFICE-UX-FLOWS.md) |
| Current brand and character revisions | External checkout: `F:/zuri-product/design/ZURI-BRAND-CURRENT.md` |
| Hybrid composition, camera, light, depth, asset handoff and acceptance | External checkout: `F:/zuri-product/design/application-profiles/visual-office/README.md` |
| Other surface refinements | External checkout: `F:/zuri-product/design/application-profiles/README.md` |
| Current Studio implementation and limitations | [STUDIO-STYLES.md](STUDIO-STYLES.md) |
| Measured S/M/L floor plans, shared metre coordinates and reusable templates | [Office blueprints](OFFICE-BLUEPRINTS.md) |
| Default hybrid room editor, local floor assignment and human/AI exchange | [HYBRID-STUDIO.md](HYBRID-STUDIO.md) |
| Zuri authority, synchronous writes, async events and integration prerequisites | [ZURI-PLATFORM-INTEGRATION-BOUNDARY.md](ZURI-PLATFORM-INTEGRATION-BOUNDARY.md) |
| Component inventory, art-production gaps and generic avatar set | [ART-PRODUCTION-PLAN.md](ART-PRODUCTION-PLAN.md) |
| Original Office 3D scene editing, per-floor transforms and interactions | [NATIVE-STUDIO.md](NATIVE-STUDIO.md) |
| Earlier procedural model | [DESIGN-STUDIO.md](DESIGN-STUDIO.md) |
| Proposed economy and paused platform dependencies | [GAME-DESIGN-V0.1.md](GAME-DESIGN-V0.1.md) |

The `F:/zuri-product` links are machine-local source locations, not hosted URLs or bundled repository assets. On another machine, locate the product design checkout, read its `design/ZURI-BRAND-CURRENT.md`, and follow `design/application-profiles/visual-office/README.md`. If unavailable, explicitly record that source access is missing before source-dependent design changes.

The hybrid sprite room editor and local preview-floor assignment are implemented; see HYBRID-STUDIO.md for exact evidence and remaining animation/3D limits. The three-style editor remains a comparison tab. Earlier model briefs remain useful for geometry budgets and asset construction; the application profile takes precedence for the hybrid visual direction. Canonical platform contracts retain authority over all business and agent semantics.
# Current Projects refinement — 25 October 2026

Owner approved an additional illustrated 2.5D skin layer over each measured
object. The latest source is
[Projects object skins](superpowers/specs/historical/2026-10-25-projects-object-skins-design.md).
The single physical sheet remains authoritative; its solid model beauty image
alone is no longer the requested final art. Keep the established warm Office
illustration, original brand and separate transient skin/model/wire controls.
