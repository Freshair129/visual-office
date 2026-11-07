# Design Studio — three visual styles

Direction refinement, 20 October 2026: the user chose the hybrid direction (Painted background + Soft 3D props + 2D Anime characters). Read [design source routing](DESIGN-SOURCES.md) and its application profile before further art work. [Hybrid Studio](HYBRID-STUDIO.md) is now the default tab with editable room, saves, local floor assignment and manual AI handoff. This document preserves the evidence for the separate-style comparison tab.

Delivered locally on 20 October 2026 at `http://127.0.0.1:4181/#office/studio`.

The user selected **all three directions for an interactive comparison**, while preserving the existing rounded office language and 2D character identity. This comparison is now under **เทียบ 3 สไตล์**. The previous rotatable procedural room remains available under **โมเดลต้นแบบ 3D เดิม**; it is not the approved final art direction.

## What works

- Soft 3D, Painted 2.5D and 2D Anime swap separate desk/chair, lift and plant images while retaining the current composition.
- Zuri and Wangjai use one shared 2D anime sprite across the three styles.
- Select objects on the canvas or in the inspector, drag them, nudge with buttons or arrow keys, and resize from 75–125%.
- Change the canvas background, show/hide the character pair, reset positions, Undo, restore the saved design and explicitly Apply.
- Preferences persist in browser-local `zuri-office:art-studio:v1`. They contain only art style, canvas tone, visibility and positions. No API call, canonical domain change, role assignment or reward is involved.
- Leaving the legacy model tab disposes its WebGL scene. The default art editor requires no WebGL.

## Rendering scope

All three new directions are **2.5D compositions of separate transparent raster assets**. “Soft 3D” describes the rendered art; these new components are not rotatable 3D meshes. The stage is a component assembly workbench, not a replica of the art board's complete room backdrop. “ใช้สไตล์นี้” saves the Studio design only; it does not reskin all business floors.

No collision/aisle validation, grid snapping, automatic character motion, rigging, economic purchase, tenant synchronization or physical-mobile performance certification is claimed.

## Source and asset provenance

- UI: `web/studio-art.js`, `web/studio-art.css`; state: `web/studio-art-state.js`.
- Entry integration: `web/design-studio.js`, `web/index.html`.
- Assets: `web/assets/studio-styles/{soft3d,painted,anime}/{desk,lift,plant}.png` and `web/assets/studio-styles/shared/duo.png`.
- Ten individually generated RGBA PNG assets, copied into the project with original transparency; no CSS furniture substitutes or cropped concept boards.
- Built-in ImageGen was used with the actual preceding three concept images attached. Original render outputs remain under the local Codex generated-images folder.
- Character reference: `F:/zuri-product/design/zuri-character-kit-v0.9.4/boards/03-DUO-SYSTEM.png`.
- Environment reference: `web/assets/office-world/lobby-desktop.png`.

Prompt specification used per component: isolate one complete component on a transparent background with subtle contact shadow, approximately 30-degree downward orthographic view, no floor plate, text or UI; match the relevant concept's rounded cream/wood/amber/sage furniture and blue elevator glass. Soft 3D uses smooth volumetric lighting; Painted uses visible brush texture; Anime uses controlled outlines and cel shading. The shared character prompt preserves the reference duo, presenting pose, clothes, facial identity and 2D rendering. Output dimensions are 1254×1254 for furniture despite the requested 1024 canvas; no pixel scaling or alpha editing was applied.

## Verification

- `npm test`: **177 passed, 0 failed, 0 skipped**.
- `npm run build`: passed, **223 embedded assets**.
- `git diff --check`: passed (line-ending notices only).
- Automated coverage includes normalization, corrupt storage, save failure, no business context, cross-style position preservation, explicit save/reload, Undo/cancel, keyboard movement, pointer gesture transaction/cancellation, RGBA asset presence and lazy WebGL lifecycle.
- In-app browser: all styles/assets loaded, selection, slider, canvas tone, character toggle, real pointer drag, keyboard nudge, save/reload, Undo, legacy tab disposal and Lobby round trip.
- Desktop viewport 1440×1024, mobile 390×844 and 320×780. At 320, content width and scroll width both measured 305px after the scrollbar; no horizontal overflow.
- Console review at final runtime returned no error/warning entries.

Evidence: `reports/studio-styles-20261020/` contains `soft3d-desktop.png`, `painted-desktop.png`, `anime-desktop.png`, `anime-mobile.png`, `tests.log`, `build.log`. See root docs/records/design-qa.md` for visual comparison and remaining polish limits.

Local work only; no hosted deployment, PR or commit.
