# Asset Factory Vertical Slice Implementation Plan

**Goal:** Extend the existing Tycoon office with reproducible, inspectable Blender asset production without replacing its scene or inventing a Zuri runtime contract.

**Architecture:** The existing Three.js Tycoon scene, blueprint/navigation, GLB manifest and local simulation remain the integration baseline. Blender work is an additive, versioned pipeline: import existing prototype GLBs as explicitly derived editable starting points, inspect and render them, and produce new candidate assets only after source and visual review. Zuri remains authoritative for identity, state, questions and approvals; missing Office-facing contracts block live binding and actions.

**Constraints:** Metres; current 45°/31.33° orthographic camera; no automatic floor migration, fabricated states, shared writes, or replacement of user-authored assets. Existing prototype animation is rigid-node animation, not a skinned rig. OFFICE_STANDARD and OFFICE_HERO are quality targets, not declarations of readiness. A derived Blender file does not become the original authoring source.

1. Inventory current scene, GLBs, manifests, animation and contracts; preserve the dirty checkout and existing editable floor state.
2. Build a Blender-based inspection and preview workflow for the existing actor, desk, chair and room modules. Record input hashes, Blender version, geometry, materials, animation and evidence gaps. Keep generated files separate from the existing kit.
3. Produce and visually review a genuinely reusable avatar rig and the requested clips, plus polished room and workstation assets, from editable sources. QA geometry and deformation, export and independently inspect GLB, and record manifests and previews. Do not declare a technical pass to be art approval.
4. Integrate reviewed candidates through the existing Tycoon loader and blueprint/seat anchors with backwards compatibility, isolation, caching and cleanup; test selection, camera, seating, animations and reduced motion.
5. Bind operational status, questions and approvals only to an owner-approved scoped contract and actual authorized backend responses. Distinguish unavailable, disconnected, stale and unknown; never infer live activity from animation.
6. Run targeted asset and scene checks, full integration checks at milestone, independent patch review, and 60-second device/browser profiling with draw calls, frame time, loading and memory. Record each unrun gate explicitly.

The artifact-inspection stage is evidence and a starting point, not completion of steps 3–6. Original three.js procedural source remains authoritative for existing prototype GLBs; imported `.blend` copies are derived and may not preserve the original rig structure or all clip semantics.

## Follow-up: quality, contact and hardware profiling

1. Classify the existing Blender geometry warnings against source topology, UVs, materials and intentional contact. Repair in candidate generators, preserve anchors and compare shaded and wireframe renders; do not suppress failed checks. Re-export with a new revision and verify the GLB and rig independently.
2. Correct bilateral joint alignment/roll, then validate all weights and mirrored poses. Sample complete idle, walk, sit, typing and wave clips; measure shoe-floor contact and per-cycle drift, and inspect animation frames at office scale. Record any remaining failures instead of treating clip names as proof.
3. Add an accessible 30 FPS render option to the existing Tycoon scene. Test frame pacing, accumulated simulation time, mode changes, reduced motion and cleanup. It is display-only and must not change business state or saved floors.
4. Profile the resulting scene on the actual hardware renderer, recording GPU identity, browser, device pixel ratio, load time, frame intervals, render calls and triangles separately for each mode. If hardware WebGL cannot be admitted, record the failure; software rendering is not GPU evidence.
5. Run targeted checks, independent patch review, full tests and an isolated build. Keep live status, questions and approval blocked unless an existing authorized contract supplies them.
