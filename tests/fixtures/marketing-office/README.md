# Synthetic producer vectors

Owner-authorized integration copy from Freshair129/zuri.ai, commit
75ff96a9d05f12b58cbda908e42b9ea573b39d5b, path
apps/server/tests/fixtures/marketing-office/read-v1.json. Contains synthetic data
only, not user/business exports. SHA256 bytes:
7cd8b312704a75822c0495faa5c216f8536dc125aca0d9ee588ce5647fc8e101.
Producer source hashes/provenance are embedded; retain them. This copy grants no
new license to upstream source code; no upstream implementation is vendored.
Do not regenerate or mutate vectors in this repository; replace only by an
explicit producer handoff and review. CI consumes this copy without another checkout.
# Dynamic context candidate

`domain-context-v1.json` is an exact-byte producer copy, SHA256
`68aae4bddcb5fd737945974a40cdf815e739426603e0d5b8a0ce3b4c1c4d6a7b`.
Source: Marketing isolated Zuri worktree, authority rules revision
`c13acf55405326df14c1b8f18390ae1e7bb58356`; generator hashes are separately pinned
inside the envelope. It is a reviewed subset/candidate, not a public producer API
or complete domain catalogue. 96 vectors distinguish source-rule projections,
hypothetical extensions, malformed mutations and transport boundaries.
Do not regenerate this consumer copy. `tests/office-context-compatibility.test.mjs`
uses the actual bounded decoder and strict parser; accepted DTOs and wire bodies
must deep-equal the fixture. Existing read-v1 remains byte-identical.
