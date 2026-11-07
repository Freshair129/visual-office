# Articulated collision and office plans

User requested implementation and local testing on 29 October 2026. This is an execution plan, not an invented approval record.

## Scope and design

Keep the existing Three.js scene, snapshot formats and local probe. Add geometry-aware lower-limb collision to the procedural contact solver. Check both legs and shoes against assembled furniture, including the occupied chair; never exempt the entire chair. Plan clearance before committing a step, and stop explicitly if no supported pose/path exists. Preserve planted feet and validate sit/work/stand/leave as well as walking. No Agent or approval records are created.

Use a consistent service core, lift lobby, connected circulation and enclosed rooms in new default Lobby, Projects and Marketing layouts. Preserve saved layouts and present an explicit way to apply new defaults in Studio. All remaining directory floors receive a documented spatial programme only, not invented runtime floors or grants. Dimensions are design choices for a stylized office, not building-code certification.

References: Herman Miller Design Yard actual office and qualitative zoning/planning workshop (https://www.hermanmiller.com/en_eur/stories/why-magazine/work-in-progress/); 360 North Green developer brochure page 15, measured office floor plan (https://360northgreen.com/wp-content/uploads/2024/01/360NG-Digital-Brochure.pdf). Both images were inspected locally. The Herman Miller image is a workshop collage, not a measurable drawing. Interpret adjacency/circulation, do not copy the drawings.

## Work and verification

- Collision: own web/tycoon-contact.js, web/tycoon-scene.js, web/tycoon-activity.js, web/tycoon-blueprint.js and new collision module/tests. Reproduce current intersections, add regressions, implement bounded solver/sweep and explicit failure. Validate narrow obstacles and chair transitions.
- Plans: own web/tycoon-state.js, new floor-plan module, tests and architectural design document. Use shared blueprintPlan partitions/doors and real navigation. Keep stable object IDs and legacy saved-room behavior. Verify reachability and room connectivity.
- External fixtures: independently published CC0 chairs, original package/license/hash provenance retained; use actual custom GLB/IndexedDB loader with measured anchors. Fixtures do not become a new default catalog.
- Integrate: full tests, isolated build, hardware WebGL complete lifecycle at 30/60 Hz, all three floor overview captures and explicit collision rejection cases. Record exact source/asset hashes and measured clearance, and independent review of the composed patch.
- Commit only task-owned changes; retain unrelated dirty work. No deployment implied by local verification.
