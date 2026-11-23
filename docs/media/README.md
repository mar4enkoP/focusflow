# Release visuals

Captured from the local production build on 2026-11-20 using Chromium, 1440×900,
English, Classic lighting, and synthetic task data. Base commit c2d472b plus the
existing uncommitted onboarding/theme-lock changes. These are real rendered UI
captures, without compositing or invented controls.

- `tasks.png` — README hero, first task and focus guidance.
- `welcome.png` — first onboarding step.
- `focus.png` — focus timer, before starting.
- `settings.png` — unlocked theme selection.
- `onboarding.webm` — onboarding, lighting transitions, focus view, and settings.

The recording is linked because GitHub README playback support varies by viewer.
A GIF conversion was not produced because no system ffmpeg was available.
The source recording is approximately 1.3 MB.

The capture script is in `../release/capture.mjs`. Start the local production preview
on port 4175 and run it with Node after installing Playwright Chromium. The script
uses an isolated browser context and synthetic data.

Suggested social preview is `social-preview.png`, a 1280×640 crop of the actual task
workspace. Upload it manually through GitHub repository settings after approval.
