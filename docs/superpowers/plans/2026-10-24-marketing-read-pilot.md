# Marketing read pilot — Office execution

Owner approved 24 October 2026 after read-only profile review. Source profile:
`C:/Users/suanr/.codex/worktrees/marketing-gap-20261024/zuri.ai/docs/change-requests/integration/visual-office-marketing-read-pilot-20261024.md` v0.1.0.

Use executing-plans inline with TDD and one independent review. Preserve the existing
dirty feature branch; no commit, platform edits, auth activation or deployment.

## Tasks

1. Align trimmed Ask question limit to 400 and validate response scope/version/state.
2. Add Marketing reads and Ask state with request fencing on Business/floor changes.
3. Add a labeled Marketing pilot GLB floor, campaign board and Ask object using existing assets.
4. Verify consumer tests/build/browser; distinguish synthetic compatibility from joined/live acceptance.

## Review focus

Scope confusion, late responses, private fields, null/unknown metrics, disabled dispatch,
question boundaries, legacy Projects and saved floors. No new endpoint or auth protocol.

## Ledger

Ruling: use the existing working feature branch to preserve dependent uncommitted GLB/editor work; new checkout from HEAD would omit it. No shared platform edits.
Ruling: live activation remains gated by the named environment/revision handoff; approval advances Office implementation without inventing credentials or protocol.
Pre-flight: connector projection feeds TycoonData; use growth only for Marketing and retain Projects defaults. Scene intents remain presentation-only.
Tasks 1–3 implemented locally. Targeted RED evidence: missing Marketing data/floor behavior and 400-character guard, missing safe provenance, startup discovery cancellation, and stale authorization data. Each reproduced before its fix.

Task 4: full consumer suite `npm test` 414 passed, zero failed/skipped; `npm run build` passed with 370 embedded assets. Browser preview at :4182 verified the actual GLB Marketing room, object directory, Ask form and disabled submission without Business; console error log empty. Data rendering and scope changes were tested with synthetic adapters, not authenticated browser data.

Remaining external gates: same producer-generated fixture vectors and source hashes on both sides; approved environment/revision handoff and authenticated live read. No hosted acceptance, provider effects, Agent dispatch, shared persistence, commit or push.

Evidence: reports/office-tycoon-design/marketing-{tests-final,build-final}.log and marketing-{floor,ask}-preview.png. Independent review completed; reviewer did not rerun tests.
Final: fixed expanded source provenance — narrowed to the revised candidate source/state/reasonCode allowlist; rejection regression RED→GREEN and full suite rerun.
Final: Ruling: retain upstream denial status/sourceCode until shared denial fixtures settle the mapping, as the platform peer explicitly requested; no whole-payload indistinguishability claim. Cost: normalization acceptance remains open, so this is not a fully qualified live pilot.
Final: minor (deferred): textarea limits raw input to 400 while service accepts trimmed 400; whitespace-padded 400-character questions require trimming in the UI first. No producer bound is widened.
Ruling costs: preserving the existing working tree means revision identity requires working-file hashes; restricting this turn to local preview leaves live acceptance open until platform handoff.
