# External chair lifecycle fixtures

These files supply external custom-GLB regression inputs. They are not a runtime catalog or a default room inventory.

The three static meshes come from Kenney's **Furniture Kit**, downloaded from [OpenGameArt](https://opengameart.org/content/furniture-kit). The package identifies Kenney as author and carries the included CC0 1.0 license. `source/Models/` and `source/License.txt` preserve the selected original OBJ, MTL, and license files byte-for-byte. The source archive's SHA-256 and the individual source, material, license, and GLB hashes are recorded in `fixtures.json`; the archive itself is not duplicated here.

## Conversion and descriptors

The GLBs use glTF 2.0, Y-up, embedded geometry, no images or unsupported extensions. Blender 5.2.2 converted the OBJ axis, applied uniform metric scale, centered the model on X/Z, and set the bottom to Y=0. The source geometry is retained; the original MTL specular value is mapped to the core PBR dielectric default because the application loader does not accept `KHR_materials_specular`. Unused source UVs are omitted because the MTL files contain flat colors and no image textures. The original OBJ and MTL remain alongside the fixtures.

`fixtures.json` contains the exact conversion command, per-file provenance, GLB hashes, measured dimensions, seat anchor, approach point, heading, and Blender QA results. `interaction.heading` is π radians so the seated character faces the chairs' −Z front. The approach point is 0.60 m beyond the front half-footprint.

The swivel chair is 1.18 m tall, 0.03 m above the preferred 1.15 m ceiling, so its measured upholstered seat reaches 0.453 m. The two wooden chairs are 1.00 m and 1.05 m tall, with seats at 0.511 m and 0.508 m.

The Blender previews are in `previews/`; QA reports are in `qa/`. The source meshes retain degenerate faces and duplicated vertices: the QA reports record those findings, and no geometry was altered to hide them or to satisfy collision behavior. The swivel chair also has four back-to-back face pairs. These are regression fixtures, not an asset-quality approval.

Regenerate from the extracted source package with the command stored in `fixtures.json` or the portable `commandTemplate` there. The Blender factory runs in a separate background process; it does not use or save a live Blender scene.
