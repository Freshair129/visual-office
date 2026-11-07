# Zuri face correction, revision 4

Owner feedback rejects revision3's asymmetric crown, inflated cheeks and
pinched/pouting mouth/nose. The owner then rejected the first flattened revision4
profile and specified a natural three-dimensional nose bridge, tip, philtrum,
lips and chin. The current correction follows that later direction; it does not
interpret a flat anime drawing as permission to remove the nasal bridge.

This is a separate corrective Lab candidate, not approved final art or a floor
appearance replacement. Existing Zuri/Wangjai/staff and Agent roles are unchanged.

Later decision, 27 October: the owner accepted this geometry for temporary use
while functional systems are completed. Stable runtime appearance `zuri` now
selects this R4 file; the original Lab-only statement above records the review
stage. Model bytes and original metadata remain unchanged, R3 is preserved, and
final art polish is deferred. See [temporary runtime](../TEMPORARY-RUNTIME.md).

## Source and shape correction

The existing CC0-base Zuri adaptation retains base-author3dquads blender credit.
The old25mm sideways crown shift is removed on its existing closed shell. The
old53% horizontal/73% vertical mouth pinch is replaced with gentler shaping.
Original head-control correspondence is recovered exactly, preserving continuous
topology, UVs, weights, wardrobe, eyes, skeleton and the three animation clips.

The rejected ellipse/flat-face experiment is not used in the final geometry.
The evaluated facial centerline is measured first. A shared smooth displacement
then arranges bridge → nose tip → philtrum → lips → chin, with lips ahead of the
chin and behind the nose tip. The field moves the surrounding tissue together
and retains inner/outer lip depth rather than collapsing surfaces onto a plane.
These are asset-specific design targets, not a universal anatomy standard.

## Sources and comparison

- [Editable revision](../../../../assets-source/characters/candidates/zuri-face-r4.blend)
- [Portable GLB](../../../../web/assets/models/characters/candidates/zuri-face-r4.glb)
- [Metadata and final SHA-256](../../../../web/assets/models/characters/candidates/zuri-face-r4.json)
- Builder: `scripts/blender/build-zuri-face-r4.py`.
- Actual exported-file review: `scripts/blender/review-zuri-face-r4.py`.

Lab defaults to the new candidate (`?model=zuri-face-r4`). **Zuri · รุ่นก่อนแก้หน้า**
opens revision3; the two review choices retain the same camera/light for comparison.
At the original review stage the floor catalog remained on revision3. The owner
made the temporary R4 adoption choice on 27 October, as recorded above. The baseline GLB
hash remains `c76729078169d44da377e3df3fb3f29d0d0013e14b362a627b3ff75ee9e82cce`.

## Verification and limits

Matched front/quarter/profile and wire renders are reviewed from exported bytes.
Intermediate results, including the owner-rejected flat profile, remain under
ignored `reports/zuri-face-r4/iteration-*/`. Final checks are recorded in the
[execution plan](../../../superpowers/plans/historical/2026-10-26-zuri-face-r4.md).

Structural QA does not establish likeness or art approval. Source seam vertices,
mirrored/stacked UVs, color-atlas reuse and hidden back-to-back contact remain
documented Lab limitations; no unique-lightmap bake or production cleanup is
claimed. Geometry remains about203ktriangles/10.5MB. Mobile performance, facial
expression rigging and final visual acceptance remain open.

Final QA has36asset warnings and zero errors. A restored-bridge/head-to-glasses
hidden contact is documented alongside source UV/seam/contact findings; it is
not a z-fighting error. The earlier empty-slot/lowest-point findings belonged to
Blender's imported bone-display Icosphere, not any of the21GLB meshes. The final
hash-bound check excludes that helper and retains its earlier report for context.
