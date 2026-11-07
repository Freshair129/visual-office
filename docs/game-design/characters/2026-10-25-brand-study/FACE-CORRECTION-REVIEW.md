# Human face correction and Tripo handoff

Date: 25 October 2026. Scope: Zuri + Staff A/B in Character Lab only.

The owner rejected the previous procedural faces. A further local correction
replaced the row-based jaw with a continuous oval, refined almond eyes/irises,
softened the nose and lips, and added warm cheek colour. Hair has shorter tucked
ends; Zuri and Staff A have continuous swept fringe surfaces. An original hair
fibre albedo is embedded in each human GLB; Zuri retains its separate knit map.
Small facial details no longer cast coarse shadow-map wedges over the face.
The Lab honours exported per-node shadow preferences.

These are still **model-review candidates**: the faces/hair remain simpler than
the approved illustrations. Passing tests is not visual acceptance. The owner
then selected [Tripo generation from the approved sheets](tripo/README.md) as the
next production route. Preserve the local candidate work without adopting it
into floors or treating its appearance as the new brand target.

## Verification of the final local code

- Sequential `npm run build` then `npm test`: 429 embedded Worker assets;
  **750 tests passed, zero failed/skipped**. An earlier overlapping-generation
  run was provisional and is not the evidence for the final tree.
- Independent reviewer: focused source/GLB/reference **16/16**; embedded PNG
  CRCs, decompressed dimensions and material references verified; final source
  mesh counts match manifests. No code blocker found. Last fringe correction
  was checked from source/GLB, not visually approved by that reviewer.
- Integrator inspected actual source Lab faces against the sheets, and refreshed
  the user's existing Worker Lab tab. That tab had retained the first-pass
  118,276-triangle Zuri; latest Zuri is 113,600 triangles, 124 meshes, 4,594,664
  bytes. This reload does not grant art acceptance.
- Existing root placement, walking soles, seated contact and five-clip tests pass.
  No floor, Agent ID/count/role, logo, or live business connection was changed.
- Local logs/screenshots are in ignored `reports/character-face-polish/`.
  No commit, push, CI or production deployment was performed in this pass.

## Next action

Follow the Tripo pilot's account/credit boundary and actual mesh review workflow.
The owner subsequently authorized one Public H3.1 Zuri pilot at a ceiling of
55 credits. That job completed and charged 55 credits (200 → 145). Actual GLB
export is blocked by an account upgrade dialog, so no model bytes have been
downloaded or imported into Character Lab. See the linked pilot's result section
and JSON record for its identity, visual inspection and remaining gates.
