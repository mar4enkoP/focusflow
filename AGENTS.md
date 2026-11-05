# FocusFlow development rules

FocusFlow is a minimalist, desktop-first productivity application. Follow
[ROADMAP.md](ROADMAP.md) for incremental scope and [DESIGN.md](DESIGN.md) for visual requirements.

- Keep architecture simple and maintainable; introduce abstractions only when needed.
- Use Vue 3 Composition API with TypeScript and reusable single-file components.
- Separate business logic from presentation: keep task, timer, and estimation logic in
  focused stores, composables, or plain TypeScript modules as appropriate.
- Use Pinia for shared state; keep component-only UI state local.
- Use scoped SCSS where appropriate; share design tokens and foundational styles centrally.
- Use the existing Vite, Vitest, ESLint, Oxlint, and Prettier tooling. Avoid unnecessary
  dependencies; prefer existing tools and browser capabilities.
- Preserve existing functionality and keep the application usable after each milestone.
- Run relevant tests and build checks for implementation changes:
  `npm run test:unit -- --run` and `npm run build` (includes type checking).
  Use `npm run type-check` when a separate type check is useful.
- Follow the existing lint and formatting configuration. `npm run lint` applies fixes
  and creates an ESLint cache; `npm run format` rewrites files under `src/`.
  Review their changes and avoid unrelated edits. Documentation-only changes need
  content and link review rather than an application build.
- Do not create Git commits automatically.
- Do not modify files outside this repository.
- Do not integrate paid APIs without explicit permission. Keep manual workflows usable
  when optional services are unavailable.

## Existing foundation

The project uses ESM, Vite's Vue plugin, the `@` alias for `src`, and TypeScript
configurations for application, Node tooling, and tests. Pinia is registered in
`src/main.ts`. Vitest uses jsdom and Vue Test Utils. Sass is installed, but the starter
does not yet use SCSS. ESLint uses a flat TypeScript configuration with Vue, Vitest,
Oxlint integration, and Prettier compatibility. Prettier uses single quotes, no
semicolons, and a 100-character print width.

The source currently contains a starter `App.vue`, an example counter store, and one
component smoke test. The roadmap describes future work, not implemented features.
Keep tests inside `src/**/__tests__/` with files directly in each such directory to
match the current TypeScript and ESLint test patterns.
