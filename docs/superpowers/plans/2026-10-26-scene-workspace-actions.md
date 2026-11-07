# Scene to workspace actions — synthetic completion

Authority: owner request on 2026-10-26 to finish Chat, Work and character/desk/board interactions, using temporary characters. This is a bounded continuation of [Office experience gaps](../specs/2026-10-25-office-experience-gaps-design.md), not a Zuri API contract or visual approval.

## Audit and design

| Observed gap | Decision / acceptance |
|---|---|
| Characters expose only simulation actions; desks only offer walking to a seat | Add a separate workspace action section to the existing object popup. Resolve only exact canonical `role-N-avatar/desk/chair` IDs against the current floor roster. Show the existing role, its binding state, floor board, and Chat/Work entry points. Unbound roles open an explicitly labelled recipient chooser; never infer an Agent from appearance, position or a duplicated object. |
| Board always reports unavailable with Zuri enabled, even in the opt-in synthetic workspace | The explicit synthetic workspace may project its own fixture jobs, labelled Synthetic. Seed jobs carry exact domain keys. Production Zuri remains unavailable without its contract. Unscoped jobs stay unscoped; no inferred ownership. |
| Board omits `waiting` jobs and leaves its modal open on navigation | Include waiting; dispose the board before opening Work/detail, preserving late-response guards. |
| Unknown Work deep links spin indefinitely; filter changes can leave detail on another job | Render loading/unavailable/not-found from snapshot readiness, offer retry/back, and keep detail/list selection consistent. Never call unavailable data an empty result. |
| Chat has single composer, thread drafts, retry/idempotency and history already | Exercise these flows with existing tests and source + Worker UI. Fix only reproduced defects; do not invent additional provider capabilities. |
| Worker UI: Work → Pim chat → refresh silently returns to Mira because URL is only `#chat` | Retain the selected thread in `#chat/<id>`. Resolve it only through current profile conversation choices; unknown/ambiguous IDs disable the composer and never fetch an invented thread. Profile/thread switching updates the URL. This is presentation navigation, not a new API or grant. |
| Review follow-up: unbound actions inherited the global recipient; empty profiles retained the previous Chat URL | `#chat/choose` is neutral with a disabled composer until a profile is chosen. Empty profiles use `#chat/agent:<allowlisted ID>`. Unbound task creation requires an explicit recipient and clears preset team selections. |
| Missing Work recovery could reopen a late record after Back; Demo retry could call the service | Back abandons the pending detail, filtering an unresolved route returns to the list, and Demo retry is disabled and guarded. |
| Source browser: review save toast succeeded but inline text stayed “saving” | Settle feedback after save; ignore late feedback/control updates belonging to a different selected job. |

## Implementation order

1. Add failing regressions for exact object-role resolution, popup routing and closure, synthetic floor projection/fixture scoping, Work missing/detail states.
2. Implement shared presentation helpers and wire BuildingView → HybridScene using current workspace readiness. Keep simulation buttons separate from workspace commands. Custom popup/elevator interactions retain precedence; Studio without workspace callbacks stays a scene editor.
3. Exercise Chat send/history/draft switching, Work create/detail/review/chat/result, character and desk shortcuts, board to exact job, unknown job recovery, and refresh on source app and built Worker. Use only synthetic fixture state; record real upstream count.
4. Run relevant and full tests/build, independent review of this patch, fix findings, retain screenshots and test evidence. Preserve saved floor snapshots, model bytes, logo, palette, roster counts/roles and live gates.

## Limits

Synthetic jobs/messages/reviews are in-memory harness data. A queued request is not proof of an Agent response. Creating a workspace task does not assign a domain without the owner contract. Current characters remain provisional art. No live connection, deployment, PR or merge is included.

## Implementation evidence (before PR packaging)

Completed on the working tree based on `4523bf0392c027a98aee297bddd7ac3633b35060`, branch `codex/office-experience-gap`. Prior character work and unrelated dirty files were retained. No commit, push, PR, live connection or deployment was performed.

- RED → GREEN: new scene/action, board source/waiting/modal, Work recovery/filter, Chat routing and review feedback cases. Review findings received additional failing regressions before fixes.
- Final `npm run build`: PASS, 450 embedded assets. Final `npm test`: **795 passed, 0 failed, 0 skipped**. The first full-run failure (`Missing DOM target task-source`) is retained in `reports/scene-workspace-actions/full-tests-first-failure.log`; the source notice was moved into the entry HTML, then the build and suite were rerun successfully.
- Independent GPT-6 Luna Max review: Critical 0, Important 0, Minor 0 remaining. Reviewer inspected the scoped working patch and did not independently rerun the tests.
- Source app `:4184`: pointer clicks on character/desk; exact role card; explicit task recipient, create/queued task → matching Chat; draft survives recipient switch; Chat refresh retains Beam; board includes only the Projects waiting fixture → exact Work detail; review metadata save; existing Customer/Pim binding; unknown Chat disables composer.
- Built Worker `:4185`: pointer clicks on character/desk; neutral recipient chooser → Pim; older history, message queue, refresh stays on Pim; create task with explicit Beam → exact Work and Chat; review acceptance → Results; unknown Work retry/back; unknown Chat disables composer. Browser document reloaded after the final Worker rebuild (hash navigation alone retains old modules).
- Both harness logs: **0 real upstream calls**, no fixture violations; no request for the invalid Chat thread. Writes observed only against `synthetic-workspace-memory` (job creation, chat queue, work review).
- Nine changed runtime modules served by both ports are byte-identical to current source; hashes in `reports/scene-workspace-actions/runtime-verification.json`. Four temporary character GLB hashes match the prior runtime baseline (`asset-hashes.json`). No model, floor layout, role definition or logo edit belongs to this patch.

Local evidence: `reports/scene-workspace-actions/` contains full tests/build logs, source/Worker fixture logs, runtime and model hash checks, `app-floor-board.png`, and `worker-character-actions.png`.

Remaining boundaries: live Zuri scope/auth/Agent contracts, domain assignment for newly created workspace tasks, shared production persistence, mobile performance and visual approval remain outside this synthetic slice. The harness stores synthetic writes in memory; restarting it resets those records. A queued message/job is not an Agent response or completed work.

## PR packaging — 26 October 2026

The owner subsequently authorized commit, push, a PR and hosted CI for this slice.
PR #7 (`codex/office-experience-gap`, `4523bf0392c027a98aee297bddd7ac3633b35060`)
is still open against main, so this delivery is stacked on that branch. It must
follow #7; it does not merge or alter that PR. Only the scene/workspace changes,
regressions and this document's navigation hook are included. Existing dirty
character/art/runtime experiments stay in the original checkout and are not
part of this PR. No GLB, image, model builder, roster or live configuration is
changed by this slice.

The 795-test/450-asset results above describe the combined development checkout.
Delivery verification runs again from a clean export of the staged files plus
the pinned PR #7 base, without the uncommitted character experiments. Record its
own counts and exact-head hosted checks in the PR; do not reuse the combined
checkout totals as delivery evidence.

Packaging review also found that the neutral Chat page's New chat button could
inherit the last selected recipient. Both `choose` and unknown-thread routes now
open task creation with mandatory recipient selection; their regressions failed
with the old handler selecting Mira before the fix. The active profile flow
retains its existing recipient behavior.

Existing preferences allow two profiles to share a manually assigned conversation.
Selecting a profile in that case now retains both the explicit profile and thread
in `#chat/agent:<profile>:<thread>` (URL-encoded) across refresh and dropdown
switching. Resolution still requires that thread in the current profile's choices;
a bare ambiguous thread or a foreign profile/thread URL still requires selection.
Focused refresh/dropdown regressions reproduce the old loss of context before
the fix. This changes navigation only, not the API or Agent assignment records.

Clean delivery export verification after the review fixes: `npm test` **737
passed, 0 failed, 0 skipped**; `npm run build` passed with **412 embedded assets**;
the pinned Marketing compatibility fixture passed **57 cases** with `live: false`.
The four focused recipient/shared-thread regressions also pass. These totals
exclude the unrelated character experiments present in the combined checkout.
Delivery logs are local under `reports/scene-workspace-delivery/`; hosted CI and
the final commit are recorded on the PR after push, not inferred from local tests.
