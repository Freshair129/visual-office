# Native loader: embedded buffers under synthetic containment

Owner scope: fix the Native loader error, then retest navigation and refresh in
the source app and built Worker. Retain current models; synthetic only.

## Diagnosis

The per-floor Native Studio reproduces a failed model load. `Office.loadScene`
uses GLTFLoader for the existing room/desk/floor-tile glTF JSON files. Their mesh
buffers are base64 data URIs. GLTFLoader delegates them to FileLoader/fetch;
synthetic `connect-src 'self'` blocks that request. A real GLTFLoader parse with
data fetch denied reproduces the same buffer error. Model bytes are valid.

## Implementation and acceptance

1. Add a failing real-loader regression under denied data-URI fetch, including
   buffer offsets and existing asset parsing.
2. Register a Native-only GLTFLoader bufferView extension that decodes embedded
   binary buffers in memory. Cache per parser; validate lengths/ranges; preserve
   normal external buffers and GLB handling. Keep model files and CSP unchanged.
3. Run loader/lifecycle regressions and the complete test suite. Rebuild the
   Worker bundle without regenerating or changing current character assets.
4. Exercise the real Native editor, Projects, Lobby, Chat, Work and refresh on
   both source app and Worker; inspect fresh console output and fixture logs.
   Do not Save/Apply a floor. Verify zero live calls and unchanged model hashes.
5. Record evidence and review the bounded diff. Commit/push/PR/merge are separate
   delivery actions when requested.

This plan adds no feature, scene migration, Agent change or artwork approval.

## Verified implementation

`web/native-gltf.js` now provides the Native-only registration used by
`Office.loadScene`. The real-loader regression failed first with the original
data-URI fetch error, then passed with the inline decoder. Tests cover separate
buffers, nonzero offsets, malformed length/range/encoding, normal external
buffers and GLB binary chunks. The scoped loader/lifecycle/Studio set passed
33 tests; the combined checkout suite passed 804, with 0 failures or skips.
`node scripts/build-worker.mjs` passed with 451 embedded assets, including the
unchanged local temporary characters. No asset-generation command ran.

Source app and built Worker passed 12 recorded UI checks: actual Native editor
readiness after refresh, Lobby refresh, Work refresh, Chat refresh, return to
Office, and Projects reached through the elevator followed by refresh. Fresh
console errors were zero on both surfaces. Harness snapshots recorded zero
fixture violations and zero real upstream calls. Both served loader modules
matched the tested working files. All 150 pre-existing dirty/untracked file
hashes stayed unchanged. The synthetic policy stayed unchanged.

Independent read-only review found no actionable findings and independently
passed 14 loader/lifecycle tests. The browser-vendored and installed GLTFLoader
copies have identical SHA256 values. Full UI execution remains coordinator
evidence, separate from that review.

Evidence: `reports/native-loader-fix/` (local ignored output), including the
red/green/full-suite logs, browser acceptance JSON, screenshots, fixture logs,
served parity and before/after hashes. This supersedes the open Native-buffer
caveat in `reports/merged-scene-acceptance/ACCEPTANCE.md` for the tested patch.
The earlier report remains preserved as the failed baseline. Publication checks
use a clean export containing only this patch; its test/build results and the
commit-specific hosted CI are recorded in the pull request. The local combined
checkout results above do not imply that the pending character work is published.
