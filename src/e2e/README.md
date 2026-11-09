# Browser regression tests

The Chromium smoke suite runs against the production build served by Vite preview.
Each test gets an isolated browser context. Concurrent tabs share that context and
the same origin, so they use the real shared LocalStorage and Web Locks service.

Install dependencies with `npm ci`, then install Chromium and run:

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

On Linux CI, use `npx playwright install --with-deps chromium`. CI runs the suite
after the production build with two workers and no retries. Failure traces,
screenshots, and the HTML report are uploaded for seven days.

To keep browser downloads inside this repository on Windows, set
`$env:PLAYWRIGHT_BROWSERS_PATH='0'` in PowerShell before **both** installing Chromium
and running tests. CI also uses this setting. Generated reports and browser files
are ignored by Git.

## What is checked

- Simultaneous startup exposes exactly one writable tab.
- Secondary task, timer, memory, and planning actions do not mutate stores or storage.
- Planner inputs remain guarded even when a synthetic input event is dispatched.
- Owner closure reloads all three latest keys before editing becomes available.
- Owner reload, navigation, and repeated tab creation preserve saved changes.
- Missing Web Locks support remains read-only.
- A populated former owner cannot mutate its stores or write when its stale timer
  passes its deadline. This uses explicit lifecycle events in Chromium and a
  controlled clock, supplementing the real navigation tests.
- Task editing, ordering, completion, deletion, paused timer recovery, extensions,
  and forgetting remembered tasks still work.

Test-only initialization scripts observe native lock callbacks, LocalStorage
operations, and editable DOM controls. They fail on writes or editable controls
without ownership and three-key reads. Store-action checks inspect Vue's existing
mounted-app Pinia registry; no test hook is shipped in the application. A change to
Vue's internal registry may require updating that helper.

## Negative control

To verify that the concurrency assertions detect a broken protocol, deliberately
give each document a different lock name in the test instrumentation:

```powershell
$env:FOCUSFLOW_E2E_BREAK_LOCKS='1'
npm run test:e2e -- --grep simultaneous
Remove-Item Env:FOCUSFLOW_E2E_BREAK_LOCKS
```

This run **must fail**: both tabs become writable. It changes neither application
source nor the production build. Run the normal suite again after clearing the
variable. For POSIX shells, prefix the command with
`FOCUSFLOW_E2E_BREAK_LOCKS=1` instead.

## Secondary-tab snapshot limitation

A newly opened secondary tab displays a read-only waiting screen rather than the
saved task list. It loads the latest workspace only after acquiring the lock.
The browser suite captures this screen as `secondary-ux.png`.

The current restore path is not a pure snapshot decoder: it reconciles focus time,
seeds task memory, restores planner state, and installs persistence subscriptions.
Reusing it without ownership would require relaxing the guards this work verifies.
A safe viewer would require separating read-only decoding/presentation from owner
recovery across those stores. That exceeds a small Phase C integration fix, so this
suite preserves and documents the safe waiting behavior. No live synchronization
or read-only snapshot feature is claimed.

## Limits

Only Chromium is configured. Navigation tests exercise real navigation and return,
but do not assert that a browser chose BFCache rather than reloading. Renderer
crashes, OS suspension, Firefox, Safari/WebKit, and exhaustive visual regression
coverage remain outside this smoke suite. Older application versions that do not
use the shared lock can still write; users must close or reload pre-fix tabs.
LocalStorage's three keys also remain separate writes rather than one transaction.
