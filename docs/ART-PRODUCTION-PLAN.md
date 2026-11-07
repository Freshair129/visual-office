---
title: Visual Office hybrid art production plan
status: active-design-plan
updated_at: 2026-10-20
---

# Visual Office hybrid art production plan

**26 October status:** use [current design sources](DESIGN-SOURCES.md) for visual
precedence. The illustrated campus/Lobby and painted object skins remain the
presentation; real geometry supports depth, navigation and editor interactions.
GLB tools are implemented locally, but the generic/brand character models remain
provisional and final visual approval is open. The inventories and 20/23 October
production directions below are dated baselines, not a new art sign-off or proof
of a live Zuri roster. See [current documentation index](README.md).

**23 October production override for Office:** The next Building/Lobby/Projects slice uses actual modular GLBs and a reusable 3D character rig. Start with [Tycoon asset list](game-design/TYCOON-ASSET-LIST.md) and [production workflow](game-design/TYCOON-PRODUCTION-WORKFLOW.md). The older hybrid inventory below is historical background and still applies to retained sprite scenes; it is not the target art format or proof that the new rig/GLB runtime is complete.

## Art direction

Keep the selected hybrid visual language as refined by [Design sources](DESIGN-SOURCES.md), presented through a readable mobile-simulation interface. The external application profile at `F:/zuri-product/design/application-profiles/visual-office/README.md` defines camera, lighting, palette, contact shadows, depth and source authority; it is not bundled in this repository. These are layers of one scene, not competing themes.

Soft 3D describes appearance, not file format. Mark each delivery accurately as a rendered sprite, editable mesh or GLB. Keep the existing Zuri and Wangjai designs sourced from their character kit. The generic avatars below are separate placeholders and must not imitate either character.

Keep proposed rewards and upgrades aligned with [Game Design v0.1](GAME-DESIGN-V0.1.md), and use the [Zuri platform boundary](ZURI-PLATFORM-INTEGRATION-BOUNDARY.md) for every decision that touches real domains, agents or business state. Neither proposal grants new business authority.

## Component inventory

| Game component | Visual pieces to produce or finish | Current baseline | Next art work |
| --- | --- | --- | --- |
| Building overview | Office tower silhouette, visible floor bands, domain occupancy lights, entrance and overview controls | A floor-based Office exists; the all-domain tower view is a product direction | Create a calm isometric/2.5D tower overview with selectable floors; bind labels/counts to Zuri responses later |
| G / Lobby | Reception desk, visitor area, elevator, company directory board, wayfinding and work notice board | Lobby route and elevator flow exist; native Lobby is 2D | Refine as the clear starting room; directory rows are live data slots, not text baked into art |
| Domain floor kit | Room shell, work zones, agent stations, meeting nook, status/interaction anchors | Existing room editor and original 3D scenes; Hybrid scenes are local previews | Produce a reusable painted room shell and placement templates; number of occupants follows the actual platform roster |
| Painted environment | Wall, floor, window, outside view, foreground masks, contact shadows, warm/cool lighting variants | Two hybrid painted backgrounds are available | Add the missing interior shell, window and floor materials; keep clickable props higher contrast than the background |
| Soft 3D furniture | Desk, chair, sofa, meeting table, storage, lamp, plants, reception furniture and lift parts | The core furniture/fixture set now ships as placeable GLBs with preview cards; room shells and desk tiers are included | Add finish variants and modular room pieces after visual review; current procedural assets have no custom texture maps |
| Characters | Zuri and Wangjai source identities; generic office avatar base set; later expression and pose sheets | Duo sprite exists; **12 generic avatar sprites are now in the Hybrid catalog** | Review the base set, then make consistent expressions, idle/walk/sit poses and a rig/animation plan if required |
| Simulation interactions | Elevator directory, selectable stations, pop-up anchors, status bubbles and agent detail cards | Local prop interactions and floor directory prototypes exist | Design readable states for available, working, waiting, paused and attention-needed only when supplied by Zuri |
| Business-facing UI | Mobile-friendly floor cards, clear selected-floor state, real operational details and command confirmation | Studio controls are available; platform data is not connected | Keep game affordances easy to learn while preserving readable business details and explicit write outcomes |
| Asset pipeline | Stable asset ID, preview card, renderer type, source revision, dimensions, anchor and version | Studio asset cards and model manifest prototypes exist | Keep the inventory searchable and previews honest; distinguish sprite from editable GLB/mesh |

## Core office model kit

The Native 3D Studio catalog now contains 20 assets, including 15 placeable GLBs. The new Soft 3D family covers an ergonomic office chair, meeting table, two-seat sofa, coffee table, storage cabinet, reception counter, bookcase, floor lamp, whiteboard, coffee station and elevator bay. Existing GLBs cover three desk tiers, three room shells plus the lounge wing, a movable plant and a presentation-only seated mannequin. Five existing native-mesh/GLTF entries remain available for backward compatibility.

The models are original editable procedural geometry in `web/studio-models.js`; `scripts/build-studio-assets.mjs` exports local GLBs and rebuilds `web/assets/models/studio/manifest.json`. Every placeable model has a stable Asset ID, card preview, metre units, footprint and ground/interaction anchors. The Native Studio loads these models as movable scene props that can be resized, recolored/textured, grouped, duplicated, saved per floor and exported. They do not create or alter agent seats or roles.

This completes the common office furniture and fixture inventory, not every planned visual layer: the Painted 2.5D interior shell/foreground masks and character animation poses remain separate art work. Generic avatars are still 2D Anime sprites, not 3D character models.

Avoid baking domain names, role names, headcounts, metrics, permissions or business statuses into artwork. Those labels and values must come from platform data. Furniture upgrades are cosmetic until a real business/economy model authorizes more effects.

## Generic avatar base set

The first set consists of 12 unassigned adult office-avatar illustrations in one consistent 2D Anime style. They vary in appearance, age, skin tone, hair and office-casual clothing. They share a neutral standing pose and scale so a designer can test room composition before role-specific character production is known.

| Field | Value |
| --- | --- |
| IDs | `avatar-01` through `avatar-12` |
| Catalog | Characters group in the Hybrid Design Studio |
| Source | `web/assets/office-world/hybrid/characters/avatar-atlas-12.png` |
| Cell presentation | Twelve SVG viewBox wrappers, one per cell in a 4×3 atlas |
| Canvas | 1182×1330 PNG, RGBA |
| Renderer type | 2D sprite illustration; not a GLB model or a rig |
| Runtime role | Generic scene composition only; no agent, role, permission, identity or status binding |
| Pose coverage | One standing neutral pose per avatar |
| Not included yet | Names, expression sheets, walk/sit/desk poses, animation, 3D/GLB models or platform mapping |

The existing default Hybrid room is unchanged; designers add an avatar explicitly from the Characters group. Do not reinterpret the numeric asset index as a role or domain. When Zuri AgentDefinitions become available, preserve their exact count and roles; choosing which art asset illustrates a record will be a separate presentation mapping reviewed against the character source.

## Production order

1. Review the 12 sprites at the intended room scale and correct cell spacing, transparency or style issues without changing Zuri/Wangjai identity.
2. Finish the common Painted 2.5D room shell: wall, floor, window, depth masks and shadow/contact anchors.
3. Review the complete Soft 3D office model kit in the Native Studio and refine its materials and room-fit based on visual QA. Store editable source plus preview and a real GLB where that is the delivered renderer type.
4. Extend the avatar base set with expression and pose sheets; keep each avatar's silhouette, palette and anchor consistent. Decide on rigging only after the rendered runtime requirement is clear.
5. Compose the tower overview and lobby directory around dynamic data slots. Use mock content only in labeled visual previews.
6. Validate asset IDs, preview cards, dimensions, anchors, mobile readability and scene layering before attaching art to a floor.

## Asset handoff checklist

Every added component should record:

- stable asset ID, category and display label;
- source/revision and original editable file or prompt provenance;
- actual renderer type (`sprite`, `mesh` or `glb`), file path, dimensions and file format;
- camera, light direction, ground/contact anchor, footprint and depth/occlusion behavior;
- material/texture variants and supported interaction affordance;
- animation/pose coverage, accessibility label and reduced-motion behavior where relevant;
- known limitation and whether it is design-preview only or loaded in the runtime scene.

The generic avatar set has only base sprites today. Do not report 12 completed character models or animated agents; the next character-production deliverable is pose and expression coverage, while 3D asset modeling remains a separate furniture/environment pipeline.
