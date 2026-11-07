# Visual Office low-rate MVP — owner acceptance, 31 October 2026

The owner explicitly accepted the current low-rate baseline for the MVP and
requested commit, push, a pull request and merge to `main` in this chat on
31 October 2026: “เอา lowrate เท่านี้ก่อน ถือว่าผ่านสำหรับ MVP”. This records that
actual decision. It does not create a business approval, Agent permission or
Zuri registration record.

## Accepted scope

The local Visual Office slice includes the articulated GLB actor and desk,
validated walking/turning/seat/work/stand/exit poses, supported bundled/scaled
and external-chair layouts, 15 measured floor plans (Lobby plus 14 domain floors), local role and
workflow designs, and linked export IDs. The low-rate renderer may submit the
last fully checked pose before solving the next pose. Existing illustrated
campus/Lobby defaults and Business-scoped context/privacy behavior on main are
retained; the Tycoon scene remains an editor and explicitly selected edition.
Studio exposes a 30 FPS control and starts in that accepted mode. Toggling the
rate or retrying its renderer preserves the draft, saved room and Undo history.
MVP desk/chair builders live in `web/tycoon-furniture-models.js`; the legacy
Studio source and its painted-artwork registration remain byte-stable. The
source split was checked by exporting matching desk/chair GLB bytes before and
after the split. The existing Tycoon module graph is still imported on the
default route; module-startup cost has no new performance qualification here.

The accepted performance baseline was measured on RTX 3060 through Chrome
ANGLE/D3D11 at 30 FPS. Final RAF maxima were 33.7 / 33.6 / 33.9 ms; CPU draw-entry
maxima were 36.2 / 35.1 / 36.6 ms. Load draw submission was 20.6–23.8 ms and
draw/fence completion 31.6–38.2 ms. A separate instrumented trace retained a
38.8 ms CPU draw-entry gap. The owner accepted these limits for MVP; no claim of
physical presentation at 33.3 ms on every frame is made.

The pre-integration source passed 757 tests and an isolated build, 96 actual-GPU
lifecycle cases across 15 floors, and four Studio cancellation cases. Those
results bind their original source snapshots. Integration with newer main is
verified separately; a prior pass is not silently promoted to the merged tree.
See [the submission report](OFFICE-STUDIO-SUBMISSION-20261031.md),
[floor functions](OFFICE-SPACE-FUNCTIONS.md), [teams/workflows](OFFICE-DEPARTMENT-TEAMS.md)
and [ID/export boundary](OFFICE-ZURI-REGISTRATION-HANDOFF.md).

## Limits retained after acceptance

- One rendered interval of extra visual latency can occur at 30 FPS. A pending
  solve reuses the last checked pose; a new animation pose every frame is not
  guaranteed. Solver budgets remain soft and native work may exceed them.
- Shared-host measurements included Dota 2 and Ollama. Exclusive GPU, fixed
  clocks, first-install/power-on cold start, hardware timestamps and physical
  scanout remain unqualified. Worst draw/fence completion remains 38.2 ms.
- Real preview API 503 responses remain genuine errors. This decision does not
  accept backend health, production deployment, live Agent execution or Zuri DB
  registration. Design IDs and role/workflow proposals do not grant authority.
- Unsupported furniture arrangements still refuse movement safely. Arbitrary
  meshes, moving furniture, 60 Agents, complete self/torso/head/finger/balance
  collision and the documented inherited art/rig limits remain open.

## Evidence preservation and subsequent work

The original sealed submission archive remains local and unchanged:
`office-studio-submission-20261031-evidence.zip`, 89,833,139 bytes, SHA-256
`60bd114573babaf532c319c206cd85dab813119e101f0e7e0151259ee286624c`.
It contains 636 verified payloads. The large traces, raw screenshots and archive
payload copies are local evidence, not Git source. Source, tests, measured plans,
asset provenance and this decision are reviewable in Git.

Run `npm run docs:check`, the full test suite, build and pinned compatibility
before merging an integration change. Keep local GPU functional evidence,
wall-clock timing, owner MVP acceptance, hosted CI and production/live proof
distinct. Later performance improvements may proceed without rewriting these
historical measurements or inventing an additional approval.
