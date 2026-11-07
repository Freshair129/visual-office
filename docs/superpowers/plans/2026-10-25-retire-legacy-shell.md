# Retire Legacy Shell Implementation Plan

> Use superpowers:executing-plans for inline implementation and a final independent review.

**Goal:** physically remove obsolete dashboard UI and ship one Office-style workspace.
**Architecture:** retain working feature controllers, replace the shell and shared
presentation CSS, and create scene hosts where they are owned.
**Tech Stack:** native browser modules, CSS design tokens, Three.js, Node tests.
**Spec:** ../specs/2026-10-25-retire-legacy-shell-design.md

## Constraints and review focus

Preserve dirty unrelated work, logo/art/floor snapshots, Agent count/roles and API
boundaries. Synthetic only. Review direct route boot, native saved rooms, chat
draft/attachment preservation, mobile overflow and retired selector/asset references.

- [x] Add failing assertions for physical absence and fresh route restoration.
- [x] Recompose index, shared token-based shell, permanent chat and feature pages.
- [x] Remove rail/dashboard/quick-chat handlers and duplicate task-list rendering;
  retain active native editor renderer and lazy-load its floor fallback.
- [x] Replace obsolete CSS files; audit imports and embedded Worker output.
- [x] Run tests/build, independent patch review, and all-floor browser reload matrix.
- [x] Record evidence and any remaining platform-dependent limitations.

## Delivery evidence

`npm test`: 689 passed, 0 failed/skipped. Full suite log:
`reports/dynamic-context/shell-suite-final.log`. Reviewer requested the fifth retired
CSS assertion (`chat-rich.css`); focused physical-removal tests reran 2/2 after
adding that assertion (`shell-removal-final.log`). Runtime product code was already
included in the full pass. Build embeds 409 assets; old five CSS files are absent.

Publication review found a cold-load saved-native-floor gesture ownership gap.
`attachFloorViewport.setNativeControls` now transfers late OrbitControls touches
without recreating the viewport or resetting pan/zoom. BuildingView binds it on
renderer attachment. Two regressions cover late/repeated binding, disposal,
saved-native restoration and restoring native touch mappings on leaving. Focused
viewport/domain checks: 22 passed (`pr-native-touch-green.log`). Hosted CI is
required on the resulting PR head, not the earlier reviewed revision.

Built Worker at :4185 with `--legacy-art`: browser navigated then reloaded all 14
domain floors, Lobby, building and Studio (17 routes); all finished startup with
no retired DOM. `shell-reload-matrix.json` records the DOM checks. Six supporting
pages also reloaded with title/header/dock visible at top, one composer and no
retired DOM (`workspace-reload-matrix.json`). Screenshots: `workspace-chat-new.png`,
`workspace-work-new.png`. Chat drafts and dirty Knowledge survive page navigation;
saved native renderer fallback and default Tycoon More navigation have regressions.

Independent review resolved missing Tycoon workspace access through a More menu,
and corrected a minor physical-removal test coverage gap. No Important/Critical
findings remain in assigned scope. Parent also fixed header scroll and SVG strokes
found in browser review after removing the old shared stylesheet.

Only local synthetic acceptance: `shell-fixture-audit.json` reports 0 upstream calls,
0 fixture violations. No live Agent dispatch contract, production publish, shared
scene service, commit, push or merge is claimed. Existing supported Chat/Work API
controllers are retained; their live availability depends on the configured service.
