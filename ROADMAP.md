# FocusFlow roadmap

Build on the existing Vue 3 Composition API, TypeScript, Vite, SCSS, Pinia, Vitest,
ESLint, and Prettier foundation. Implement milestones in order, with small reviewable
changes. Each milestone must leave a usable application with all earlier workflows
working. Deliver a basic usable interface from M1; M4 completes its visual refinement.
Persistence begins in M3; earlier milestones may keep data in memory.

For every implementation milestone, run relevant Vitest tests in one-shot mode,
`npm run build` (including type checking), and lint/format review of changed code.
Manually verify the affected user flow. The requirements below add milestone-specific
checks; do not introduce test dependencies solely to satisfy this document.

## M1 — Task management

**Features:** Create, edit, delete, and list tasks. Include a title, estimated duration,
and category or icon selection. Provide a clear empty state.

**Acceptance criteria:** Valid tasks immediately appear in the list. Edits update the
correct task; deletion removes only the selected task. Reject blank titles and invalid
or nonpositive durations with clear inline feedback. Task identifiers remain stable.

**Testing requirements:** Test task operations, validation, and component form/list
interactions. Manually complete the full create → edit → delete flow and empty state.

## M2 — Focus timer

**Features:** Select a task, start its focus timer, pause/resume, and complete a session.
Show the active task and remaining time.

**Acceptance criteria:** Only one session runs at once. Pause preserves remaining time;
resume continues it. Completion occurs once and leaves the UI ready for another
session. Switching or deleting an active task requires an explicit resolution of its
session. Time remaining derives from elapsed time rather than interval tick counts.

**Testing requirements:** Use fake time for start, pause, resume, completion, delayed
ticks, and repeated actions. Test active-task changes and manually check background-tab
behavior and control states.

## M3 — LocalStorage and session restoration

**Features:** Persist tasks, session history, and active timer state locally using a
versioned storage format. Restore state on reload.

**Acceptance criteria:** Reload restores tasks and paused sessions. Running sessions
reconcile elapsed time using timestamps; an elapsed session completes only once.
Missing, malformed, or unsupported stored data falls back safely. Storage denial or
quota failure leaves the app usable in memory and communicates that saving failed.

**Testing requirements:** Mock storage for round trips, corrupt data, version handling,
write failures, paused restoration, and running sessions restored before/after expiry.
Manually reload during both running and paused sessions.

## M4 — Complete desktop UI and responsive design

**Features:** Apply DESIGN.md across focus, task management, and existing interactions.
Establish reusable floating-panel, control, spacing, and typography patterns. Reserve
consistent panel patterns for later music, appearance, and analytics features without
displaying nonfunctional controls as available actions.

**Acceptance criteria:** The full viewport works at 1440×900 and 1920×1080. The timer
occupies the upper-middle area; the compact task dock sits near the bottom. Music and
appearance entry points, when functional, are separate circular buttons beside it.
Smaller screens remain usable without horizontal overflow. Keyboard navigation, visible
focus, panel dismissal, reduced motion, and readable contrast are supported.

**Testing requirements:** Test panel and keyboard interactions. Visually review both
target desktop sizes, a narrow viewport, short windows, and reduced-motion behavior.
Recheck task and timer flows after styling changes.

## M5 — Smart task memory and time suggestions

**Features:** Remember previously used task titles, categories, and durations. Suggest
reusable task details from local history.

**Acceptance criteria:** Suggestions are optional, editable, and based on recognizable
past tasks. New users retain the normal creation flow. Choosing a suggestion never
creates a task until the user submits it. Memory survives reload via M3 persistence.

**Testing requirements:** Test history matching, duplicate handling, empty history,
persistence, and applying/overriding suggestions. Verify keyboard selection manually.

## M6 — Adaptive time estimation

**Features:** Refine duration suggestions using comparable completed sessions and actual
time spent. Indicate the historical basis and limited-data state.

**Acceptance criteria:** Estimates use a documented, deterministic local algorithm.
Sparse or anomalous data has a safe fallback. Users can override every estimate;
adaptation never silently changes a running timer or an existing task's duration.

**Testing requirements:** Test no/sparse history, representative history, outliers,
interrupted sessions, estimate bounds, and manual overrides. Verify persistence and
regressions in M5 suggestions.

## M7 — Daily planning and productivity analytics

**Features:** Assign tasks to a day and order the daily plan. Show focus time, completed
session counts, and day/week/month summaries from recorded history.

**Acceptance criteria:** Planned work can be reordered and carried forward explicitly.
Metrics use documented definitions and local-date boundaries, without duplicate session
counts. Empty periods are understandable; summaries agree with underlying history.
Charts have readable labels and a textual equivalent.

**Testing requirements:** Test plan changes, aggregation, empty periods, midnight,
week/month boundaries, and daylight-saving transitions. Manually compare displayed
totals with sample session records and check panel usability.

## M8 — Music, sounds, and personalization

**Features:** Add optional music/ambient audio, volume and mute controls, completion
sounds, and appearance preferences using the established floating-panel system.
Choose bundled or otherwise permitted assets without adding paid integrations.

**Acceptance criteria:** Separate music and appearance buttons open their own panels.
Audio starts through user interaction, can always be stopped, and fails gracefully.
Preferences persist. Theme and glow changes preserve readability and reduced-motion
support. Focus sessions work without audio or remote media availability.

**Testing requirements:** Mock media APIs to test play/pause, mute, volume, playback
failure, and preference restoration. Manually verify browser audio restrictions,
completion sounds, theme contrast, and separate panel controls.

## M9 — AI-powered task planning

**Features:** Offer optional planning assistance that turns a goal into a proposed task
breakdown and estimated durations. Choose the integration approach during this milestone;
obtain explicit permission before integrating any paid API.

**Acceptance criteria:** Users review, edit, and explicitly accept proposals before tasks
are created. Manual planning remains fully functional. Explain what data would leave
the device before transmission; never embed service secrets in client code. Handle
unavailable services, malformed responses, cancellation, and failures without losing
existing work. Persist only accepted tasks through normal task management.

**Testing requirements:** Use mocked responses for valid/invalid proposals, errors,
cancellation, duplicate submissions, and accept/reject flows. Confirm no tasks are
created without acceptance and verify the complete manual fallback without a service.
