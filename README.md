# FocusFlow

FocusFlow is a minimalist, desktop-first productivity application for organizing
tasks, focusing on one task at a time, and reviewing recorded work. It runs in the
browser and stores its workspace locally, without a backend or user account.

## Features

- Create, edit, complete, delete, and reorder tasks with estimated duration,
  category, and priority. Reordering supports dragging and keyboard controls.
- Start, pause, resume, reset, and extend a task countdown. Reaching zero does not
  complete the task automatically: focus recording can continue into overtime.
- Restore tasks, paused timers, and running countdowns from local storage.
- Reuse remembered task details through title suggestions and manage remembered entries.
- Receive optional duration estimates based on comparable reliable completed
  sessions. Estimates remain editable and do not change an existing countdown.
- Generate and explicitly accept session plans using selected tasks, priorities,
  available time, and configurable breaks. Recalculate the remaining schedule.
- View recorded focus time, recent daily activity, categories, completion counts,
  and planned-versus-actual accuracy in the analytics panel.
- Use a dedicated focus view with an animated arc that responds to workspace mode
  and active focus recording.

## Technology and architecture

The application uses Vue 3 Composition API, TypeScript, Pinia, Vite, and SCSS.
Vitest, Vue Test Utils, and jsdom cover domain and component behavior; Playwright
provides Chromium browser regression tests. ESLint, Oxlint, and Prettier provide
static checks and formatting.

| Location                                                   | Responsibility                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/main.ts`, `src/App.vue`                               | Application setup, workspace lifecycle, and top-level views                    |
| `src/components/`                                          | Task forms and lists, timer, planner, analytics, floating panels, and backdrop |
| `src/stores/`                                              | Shared task, timer, focus-history, memory, planner, and workspace-access state |
| `src/persistence.ts`                                       | Versioned storage validation, restoration, and guarded subscriptions           |
| `src/workspace.ts`, `src/workspaceOwnership.ts`            | Web Lock ownership and page lifecycle coordination                             |
| `src/estimation.ts`, `src/planning.ts`, `src/analytics.ts` | Estimation, schedule generation, and history aggregation                       |
| `src/assets/`                                              | Shared visual tokens and foundational styles                                   |
| `src/__tests__/`, `src/e2e/__tests__/`                     | Unit/component tests and browser tests                                         |

Component-only interaction state stays local; shared behavior belongs in stores
or plain TypeScript modules. See [DESIGN.md](DESIGN.md) for design direction and
[ROADMAP.md](ROADMAP.md) for planned milestones. The roadmap includes future work
and is not a list of shipped features.

## Requirements and setup

- Node.js matching `^22.18.0 || >=24.12.0` and npm. CI uses Node.js 24.
- A browser with Web Locks support, served over HTTPS or a trusted local origin
  such as localhost. Editing is disabled when safe ownership cannot be established.

From the repository directory:

```sh
npm ci
npm run dev
```

Use the local URL printed by Vite.

## Production build and preview

```sh
npm run build
npm run preview
```

The build runs TypeScript checking and generates static assets in `dist/`.
Preview serves those assets locally; it is not a production deployment service.

## Testing and code quality

Run the unit and component suite once:

```sh
npm run test:unit -- --run
```

Use `npm run test:unit` for watch mode. Tests cover task operations, timers,
estimation, planning, analytics, storage recovery, clock rollback, and ownership.

Browser tests run against a production build using Vite preview on port 4173:

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

On Linux, browser installation may require `npx playwright install --with-deps chromium`.
The suite exercises task flows, restoration, and shared-storage ownership across
tabs. See [the browser testing guide](src/e2e/README.md) for installation details,
diagnostics, negative controls, and coverage limitations.

Additional checks:

```sh
npm run type-check
npm run lint
npx prettier --check .
```

`npm run lint` runs Oxlint and ESLint with automatic fixes; ESLint also creates a
cache. Review the resulting diff. `npm run format` rewrites formatting under `src/`.

## Continuous integration

[GitHub Actions](.github/workflows/ci.yml) runs on pull requests targeting `master`
and pushes to `master`. It installs the locked dependencies, checks TypeScript,
runs unit tests, ESLint, Oxlint, and Prettier, builds the application, then installs
Chromium and runs browser smoke tests. Browser tests use two workers and no retries.
Failure diagnostics are uploaded with seven-day retention.

## Persistence and multi-tab safety

LocalStorage holds separate versioned keys for tasks/timer/focus history,
remembered tasks, and planner state. Data belongs to the browser profile and origin;
it is not synchronized between devices. Clearing site data removes it.

One tab holds an exclusive Web Lock and may edit the workspace. Other tabs wait in
read-only mode. A newly opened waiting tab does not load the saved task list until
it acquires ownership. The new owner reads all storage keys before enabling edits;
the former owner cannot continue mutating or saving the workspace after release.

Restoration validates stored data. Recognized corruption, including conflicting
history records with the same identifier, protects the original raw workspace
from overwrite. Storage errors are reported; do not assume unsaved changes survive
a reload. If storage cannot be read safely, the workspace remains read-only.

Detectable backward clock changes pause affected running countdowns, preserve
their recorded remaining time, and require explicit resume. Valid tasks and
future-dated history are retained. Affected measurements remain unreliable and
are excluded from adaptive estimates. Recovery writes remain subject to ownership
and corruption protection.

## Accessibility and responsive behavior

The interface includes labeled controls, visible keyboard focus, keyboard task
reordering, Escape dismissal, and focus restoration for workspace panels. Analytics
provide text values alongside charts. Styles adapt to narrow and short viewports,
and the focus arc honors reduced-motion preferences.

These are implemented affordances, not a claim of formal accessibility certification
or exhaustive browser and viewport testing. The browser suite currently targets Chromium.

## Known limitations

- **Planner clock rollback (P2, non-blocking):** the planner's remaining session
  budget still uses wall-clock time. Moving the clock backward can increase the
  displayed available budget and affect recalculation. For example, a 30-minute
  plan with 20 minutes left can show 30 minutes again. Review the schedule after
  correcting system time. This is distinct from the fixed task-timer recovery,
  which pauses detectable anomalous running countdowns rather than adding time.
- Wall-clock timestamps cannot reconstruct true elapsed work across clock changes
  or reloads. Small backward adjustments may be undetectable; uncertain focus
  measurements are not treated as reliable learning samples.
- The three storage keys are separate writes, not a database transaction. There
  is no cloud sync or built-in backup/export workflow.
- Tabs running older versions without the ownership protocol can still write.
  Close or reload those tabs when upgrading.
- Browser automation does not cover Firefox, Safari/WebKit, renderer crashes,
  or exhaustive accessibility and visual regression checks.
- Music, appearance customization, and AI planning described in the roadmap are
  not part of v1.0.0.

See [CHANGELOG.md](CHANGELOG.md) for the v1.0.0 release notes.
