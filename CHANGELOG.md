# Changelog

## v1.1.0 — unreleased

This entry covers changes after the v1.0.0 baseline and the current working-tree
candidate. Package and lockfile versions are 1.1.0. Publication follows merge and release approval.

### Added

- Progressive first-task onboarding, inline title completion with Tab, and a
  remembered-task picker inside the title field.
- Classic and Ember lighting with animated transitions between workspace modes.
- Settings sections for appearance, language, and data recovery, plus clearly
  marked Music and Notifications placeholders.
- English/Russian interface switching with a saved language preference.
- Validated JSON backup import, export, and confirmed workspace reset.
- Animated deletion notification with Undo and a countdown indicator.

### Improved

- Welcome composition, masked heading animations, and coordinated task-list arrival.
- Task creation/editing presentation, glass controls, responsive task-list scrolling,
  and initial-load stability.
- Timer duration synchronization after task edits.
- Chromium regression coverage for the progressive task workflow, settings,
  localization, recovery, and multi-tab behavior.

### Included in the working-tree candidate

- A first-task hint leading to Start Focus, styled consistently with onboarding.
- Saved empty workspaces return to the task list after reload.
- Theme selection remains locked during onboarding, with a blurred overlay,
  lock indicators, and localized guidance.

### Release preparation

- Versioned SVG favicon URL to refresh cached browser icons and exact FocusFlow tab title.
- Independently constructed two-wave mark and removal of the unverified design collage.
- Repository-local Git noreply identity for future commits.

- Revised English README with actual UI screenshots and an onboarding recording.
- Repository/history, dependency, asset, and license readiness review.
- Public-viewing/no-general-license decision documented; earlier MIT proposal withdrawn.

### Known limitations

- Music, notification sounds, and German localization are upcoming.
- Local-only persistence, separate storage writes, planner wall-clock rollback,
  and Chromium-only E2E coverage remain limitations.
- See the release readiness report for dependency warnings and publication blockers.

## v1.0.0

Initial versioned release preparation for FocusFlow. This entry describes the
implemented application; it does not indicate that a GitHub release has been published.

### Application

- Task creation, editing, completion, deletion, priorities, and drag/keyboard ordering.
- Per-task focus countdowns with pause/resume, reset, extensions, explicit completion,
  overtime recording, and local restoration.
- Remembered task details and title suggestions, with optional adaptive duration
  estimates from reliable completed sessions.
- Session planning with priorities, time budgets, configurable breaks, proposal
  acceptance, and recalculation; productivity analytics from recorded history.
- A desktop-first interface with responsive styles, keyboard affordances, and an
  animated focus arc responding to focus state and workspace mode (PR #9, commit `44ae535`).

### Data integrity and recovery

- Exclusive Web Locks ownership prevents cooperating tabs from writing concurrently.
  Waiting tabs remain read-only, and takeover hydrates the latest workspace before
  enabling edits (PR #5, merge commit `5fb50e8`).
- Backward clock recovery preserves valid tasks, pauses suspicious running timers,
  and retains structurally valid future-dated history. Focus accounting excludes
  overlapping portions and marks affected sessions unreliable (PR #7, commit `278d489`).
- Conflicting observations and session records activate corruption protection,
  preserving original raw storage. Identical duplicates can be safely deduplicated.
- Existing versioned storage formats remain supported; recovery does not bypass
  workspace ownership or storage-error handling.

### Development and verification infrastructure

- Vue 3, TypeScript, Pinia, Vite, and SCSS application structure.
- Vitest, Vue Test Utils, and jsdom regression coverage for domain and component
  behavior, including persistence, clock recovery, and ownership.
- Playwright Chromium smoke tests against production assets, including concurrent
  tabs and ownership transfer.
- GitHub Actions quality gates for TypeScript, unit tests, ESLint, Oxlint, Prettier,
  production builds, and browser tests (CI introduced in PR #3; browser tests in PR #5).

### Known limitations

- **P2: planner wall-clock rollback.** Moving system time backward can increase
  the planner's remaining session budget and affect recalculation. This does not
  undo the separate task-timer recovery fix. Review the plan after correcting time.
- Local-only storage has no cloud synchronization or built-in backup/export.
  Separate storage keys are not transactional; older tabs without Web Locks must
  be closed or reloaded during upgrades.
- Wall-clock recovery cannot determine exact elapsed work, and browser automation
  currently covers Chromium only.

See [README.md](README.md) for setup, verification commands, architecture, and
additional limitations. Future roadmap items are not included in this release.
