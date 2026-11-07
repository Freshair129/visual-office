# Continuous character implementation and evidence

Source: [owner correction and design](../../specs/historical/2026-10-25-continuous-character-design.md).

1. Add failing geometry regressions for actual skinned, continuous limbs and
   garment seams. Retain existing pose, feet, seating and disposal tests.
2. Construct a continuous tailored torso/sleeve garment and connected trousers,
   replace segmented limbs/joint balls with weighted ring topology, and retain
   stable rig interfaces and palette/hair variation.
3. Verify deformation through idle, walk, sitting and gestures; inspect bounds
   and pose-specific intersections. Keep the mesh budget modest.
4. Use existing asset generation for actor GLB/manifest; verify skin and bone
   animation export. Run focused actor/navigation and generated-asset tests.
5. Parent integrator performs browser front/side/isometric close-up inspection,
   independent review, composed checks and publication. No commit by this worker.

## Implementation and focused evidence

The source now uses 14 pose bones and two connected indexed SkinnedMesh garments:
the shirt has 458 vertices / 864 triangles and the trousers have 340 vertices /
656 triangles. Actual shared shoulder and crotch edges replace separate rigid
pieces. Blended joint weights bend sleeves and knees; scalp shaping exposes the
face, small triangular collars replace cylindrical pieces, and forward elbow
bends plus pronated working hands correct the pose. Root transforms and the
existing measured seat/sole solver remain caller-owned.

Per-bone influence bounds conservatively enclose the deformed surface without
scanning every vertex each animation frame. Tests inspect the actual deformed
vertices, connected topology, normalized weights, nonzero triangle normals,
root/bind transforms, bounds and rear trouser seat contact. No hidden geometry
proxy supplies seating evidence. Disposal releases each skeleton bone texture
once. The integrator additionally uses skeleton-aware GLB cloning and tests that
instances have independent bones and instance/cache teardown disposes skeletons.

The initial continuous-topology assertion failed against the old capsule model;
the loaded-GLB skin assertion failed against the old export (zero skins). After
implementation and export, both pass. The GLB test loads actual artifact bytes,
runs AnimationMixer walk and seated_work clips, and proves vertices of both
garments move, rather than only checking that animation channel names exist.

Commands executed on the composed working tree on 25 October 2026:

- `node scripts/build-tycoon-assets.mjs`: 24 assets generated; only actor.glb and
  its manifest entry changed. The actor is 328,060 bytes and 7,294 triangles,
  with seven named clips; SHA-256
  `ac93da5b3ab3cd541c1451f728b252e3c0608fec797ef3babd3376b04898bc76`.
- `node --test tests/office-characters.test.mjs tests/office-people.test.mjs
  tests/office-activity.test.mjs tests/office-navigation.test.mjs
  tests/office-scene-sheet.test.mjs tests/painted-office-skeleton.test.mjs
  tests/tycoon-assets.test.mjs tests/tycoon-scene.test.mjs`: 86 passed,
  zero failed or skipped (16.07 seconds).
- `git diff --check`: clean; Git reports only the checkout's LF/CRLF conversion
  notices.

The parent inspected the actual production rig in front, side and office-camera
views for idle, walk, working-seat and sofa poses, plus variants 2, 3, 6 and 12.
V1/V2 inspection exposed folded shoulder sockets and seated hip spikes; correcting
the sleeve ring correspondence and anterior hip weighting resolved these in V3.
The remaining small angular outer-shoulder ridge is a low-poly stylization limit.
Screenshots are retained locally under `reports/dynamic-context/character-v3-*`.
Historical capsule screenshots and earlier mechanical test passes do not count
as visual acceptance of this correction.

This is local source/artifact and close-up evidence. The parent owns the remaining
composed full suite/build, actual app/Worker scene review, independent review and
publication. No live provider, deployed acceptance or photorealism is claimed.
