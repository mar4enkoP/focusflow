# Recovery, deletion and production security

## Error handling

`errorRecovery.ts` installs an app-local Vue handler, browser error listener and
unhandled-rejection listener. Errors are logged locally; no diagnostics or user
snapshots are transmitted. The first failure opens `AppBoundary`'s fallback and
suppresses cascading log floods on that screen. Recovery requires an explicit
click and is limited to two attempts per application lifetime. There is no retry
timer or automatic reload.

Recovery remounts the interface only. Pinia, persistence scopes and Web Lock
ownership stay alive, retaining unsaved workspace changes after storage failures.
Unsubmitted component form drafts can be lost; the fallback explains this.
Recovery does not replay failed actions or roll back a partially executed action.
The export button remains outside the workspace boundary and catches download
errors locally. App unmount/HMR removes global listeners and workspace resources.

## Undo

The latest deletion can be undone for ten seconds. Another deletion replaces that
recovery record. Deletion is saved immediately; Undo is intentionally not persisted.
Reload, ownership loss and hydration generation changes discard the record, so a
stale tab cannot reintroduce a task into another owner's workspace.

The recovery record holds the original task, ID, ordering anchor, paused countdown
and measured session. Deletion does not remove observations, memory or planner
references, so those need no reconstruction. Undo restores the deleted session
paused and does not overwrite subsequent work on another task. Synchronous
multi-store changes use `access.batch`; persistence writes the completed state at
the outer boundary rather than intermediate timer/history/task combinations.
This is synchronous batching, not rollback or a cross-key LocalStorage transaction.

## Emergency export

Export is available during normal operation and on the fallback screen, including
read-only or storage-denied states. It never writes, deletes or repairs LocalStorage.
The JSON envelope has `format: focusflow-recovery`, `version: 1`, an export timestamp,
warnings, `current` in-memory snapshots and `stored` exact raw strings by storage
key. Current task/timer/history uses schema v2; memory and plan use schema v1.
Legacy v1 and damaged raw strings are retained verbatim when readable.

The archive is explicitly `validated: false`; it is not an automatically importable
workspace or a guarantee of complete recovery. Every failed capture/read adds a
warning. Review the separate current and stored copies before manual restoration;
never overwrite an original damaged snapshot with a partial recovered copy.
An exported file contains private task names and history; keep it locally or share
it deliberately. Blob URLs are revoked after the browser has consumed the download.

## CSP and deployment

Vite adds a CSP meta tag only to production builds, before resource declarations.
It denies resources by default and permits same-origin scripts, CSS, fonts, images
and connections. Inline scripts, event attributes, eval, inline style attributes,
objects, forms and base tags are prohibited. There are no unsafe-inline/unsafe-eval
exceptions. Vue SFC CSS is extracted by Vite; menu and visualization positioning
uses individual DOM style properties, permitted by CSP (see
[MDN style-src-attr](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr)).
Task titles remain escaped Vue text interpolation; CSP is additional protection.
Development keeps Vite's style injection and HMR without applying the production
meta policy. Browser regression tests run against the actual production build.

At deployment also send the following response headers. `frame-ancestors` cannot
be enforced through a meta tag, and hosting configuration is outside this repository:

```text
Content-Security-Policy: default-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; style-src-attr 'none'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

Serve through HTTPS (localhost is supported for development). Web Locks remains
required for safe editing. No schema migration or lock protocol change is introduced.

## Verification — 2026-11-13

- 170 unit/integration tests passed in 17 files.
- 11 Chromium production E2E tests passed, runner exit code 0.
- Production build including vue-tsc, ESLint, Oxlint, Prettier and git diff --check passed.
- Chromium was downloaded into the repository's ignored node_modules cache. The
  sandbox run completed all scenarios but stalled stopping the preview process;
  running outside that sandbox completed normally in 29.7 seconds.
- CI retains npm ci, production build, browser installation with OS dependencies,
  two workers, zero retries, and failure diagnostics. Missing browsers fail launch.
- No new dependencies or Git commits were introduced. Firefox/WebKit, deployment
  headers and exhaustive visual/accessibility audits remain outside these checks.
