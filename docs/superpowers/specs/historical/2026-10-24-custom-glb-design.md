# Custom GLB library and portable sets

Status: owner selected in-app library + portable files and authorized inline implementation without another approval on 24 October 2026.

## Intent and approach

Import user-owned static GLB furniture/decorations into the existing Three.js Studio, name and categorize them, author approach/seat points, preview, place and save per floor, and transfer complete sets between compatible Visual Office apps. This is local presentation, never Agent creation or role assignment.

Selected approach: model binaries in IndexedDB, small library cards and floor references in the existing stores, explicit self-contained file export. A filesystem-linked catalog was considered but requires reauthorization and path repair on each machine. A hosted catalog would require a Zuri-owned contract and is outside this feature.

## Model contract and lifecycle

- Imported props have kind `custom`, a SHA-256 binary identity and a validated descriptor containing name, category, measured dimensions, ground-centered normalization and interaction mode. They do not impersonate a bundled desk or chair.
- Accept GLB 2 with embedded buffers/images only, static meshes and bounded resources. Unsupported compressed/rigged/animated models report a clear error; no silent substitute. Initial budgets: 16 MB GLB, 200k triangles / 2048 primitive instances, 4096 px images. Up axis is glTF Y; normalize bottom to ground and center X/Z, uniform scale selected by physical height in metres.
- Category is display metadata (desk, chair, sofa, equipment, decoration); it grants no business capability. Interaction is none, standing approach, or seat plus approach. Points are authored in model-local metres, transformed with the instance; a placed copy can override approach/seat using existing navigation tools. Seat height and facing are explicit.
- Renderer, thumbnail, footprint blocker, transformations and placement use descriptor dimensions. Conservative rectangular footprints may block empty space in complex shapes; this is disclosed, not a claim of mesh navigation.
- Preview/import is a draft. Save validates the descriptor and binary, awaits thumbnail, writes the binary then adds a card. Storage failure never changes a floor or reports success. An unreferenced binary after interrupted card save is harmless; automatic deletion is outside this slice.
- Immutable binary blobs are deduplicated by SHA-256 in IndexedDB. Descriptor snapshots travel with each instance, so editing a new asset draft cannot silently change existing floors.
- Library custom entries may contain one object; mixed sets may contain up to 40. Existing v1 bundled sets/files still work.

## Portable exchange

Add bundle v2 for custom/mixed sets, embedding every referenced custom binary and required bundled GLBs with textures/preview/anchors. Bound total file to 64 MB. Validate all entries and binaries before adding a library card. Custom-only sets do not depend on installed kit fingerprints; mixed sets validate only their referenced bundled models plus geometry contract. No external URLs, executable interactions, Agent metadata or source-floor identity.

Floor JSON continues to reference custom binaries by identity; it clearly states that portable asset bundles must accompany it on another machine. Missing binaries fail visibly rather than replacing geometry. A full floor archive is not requested here.

## UX

Asset Library contains an Import GLB section: file, name, category, height, interaction mode, local approach X/Z, seat X/Z/height/facing; render preview then Save to library. Preview shows the rendered model and point markers. Cards show category, preview, placement and export. Existing transform/group/texture tools operate on placed props. Navigation editor edits instance points and runs the transient actor test. Save floor remains explicit.

## Verification

Test malformed/external/unsupported/oversized GLB rejection, descriptor bounds, grounded geometry, custom footprint/seat navigation, transforms and duplicate IDs, bundle binary round-trip and missing/tampered blobs, backward compatibility and storage failures. Run full tests/build, browser import/preview/place/save/reload/export/import in separate storage, and independent review. Separate-origin testing is not physical second-machine acceptance.
