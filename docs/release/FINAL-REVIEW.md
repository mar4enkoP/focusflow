# Final publication review

> Superseded findings are retained below as audit history. See [resolved implementation](RESOLVED.md) for the current v1.1.0 state.

> Continuation status, 2026-11-23: email and reference/asset decisions are settled.
> See [final verification](VERIFICATION.md) for the current working-tree checks;
> the publication gates below describe the earlier review.

> Favicon follow-up: the current application now uses public/favicon-v1.1.0.svg, with
> the current two-wave header path in white on #09090b. The Vue ICO was removed.
> The browser title is exactly FocusFlow. The ICO findings below describe the
> earlier audit and historical Git copies, not the current shipped asset.

Reviewed 2026-11-20. Documentation-only follow-up to the release readiness audit.

## Decision on licensing

Public viewing and portfolio review are intended. No general commercial or other
reuse license is granted. MIT remains inactive and its previous proposal is marked
withdrawn. README no longer links to that proposal. The intended copyright holder
is **Pavlo Marchenko**, pending passport-spelling confirmation.

Public GitHub repositories allow viewing and forking through GitHub under its
platform terms. A no-license decision does not revoke those platform permissions.
[GitHub licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).

## Logo and favicon provenance

There are no standalone logo or favicon SVG files in the current source tree.

| Asset                           | Evidence                                                                                                                                                          | Assessment                                                                                                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FocusFlow header mark           | Inline SVG path in src/components/AppIcon.vue, brand entry, two cubic wave strokes. Introduced in effbe55. No icon library import or external resource reference. | Custom inline implementation. Whether independently drawn, AI-generated, or adapted from an external sample cannot be established from the repository. Owner confirmation remains needed. |
| public/favicon.ico              | Single 32×32 ICO, green Vue mark. Introduced by initial scaffold commit ed2b8c4. SHA-256 DB74AB0B78338C1F778F8398C45F4103C99AEA0E845A3118A7750B4EEAFD3445.        | Byte-identical to the official create-vue template favicon fetched during this review. It is a Vue scaffold asset, not a custom FocusFlow favicon.                                        |
| references/focusflow-design.png | Added in 0beab61 and referenced by DESIGN.md. No creator/license metadata documented.                                                                             | Redistribution rights remain unconfirmed, including historical copies.                                                                                                                    |

The favicon comparison used the
[official Vue template file](https://github.com/vuejs/create-vue/blob/main/template/base/public/favicon.ico).
A byte match establishes the shared asset, not the exact route by which it was copied.
Confirm appropriate branding/asset permission or approve a separate replacement
before publication. No application asset was replaced during this review.

## Historical email exposure

All local refs were inspected, covering remote tracking branches, backups, tags,
and experiments. Twenty-five unique reachable commits use the personal address
as author and committer. Other identities use GitHub noreply addresses.

- Personal author/committer address is a personal email address (intentionally omitted).
- GitHub author identity is Pavel Marchenko with the account noreply address.
- Merge committer identity is GitHub with noreply at github.com.

The historical display name is evidence of past attribution, not confirmation of
passport spelling. Making reachable history public exposes that metadata. Owner
acceptance of this exposure remains a publication decision. History was not rewritten.

## Dependency findings and compatible paths

The inspected tree has glob 13.0.6 and minimatch 10.2.6, all through development
tooling. The saved audit reports 13 moderate affected package entries from two
underlying advisories; production-only audit reports zero findings.

- glob is pulled through @vue/test-utils 2.5.1 → js-beautify 2.0.3 → glob ^13.0.6.
  The advisory fixes the cancellation issue in 14.0.2. The available 13.0.7 is still
  inside the advisory's affected range. js-beautify latest still requests glob 13.
  There is no verified compatible upgrade path that clears this finding today.
  Wait for an upstream parent update or separately test an explicitly approved
  major migration. Do not force glob 14 through an override or use audit fix --force.
  [glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4).
- minimatch 11.0.1 fixes the reported pattern-amplification issue. Current consumers
  include ESLint, @eslint/config-array, typescript-estree, editorconfig, and glob.
  Registry metadata confirms ESLint 10.15.0 and config-array 0.23.6 accept ^11.0.5,
  and typescript-estree 8.73.0 accepts ^11.0.1. Updating these parents within their
  declared compatible ranges is a reasonable candidate, followed by Node 24 CI,
  lint, unit tests, build, and E2E. It will not clear older minimatch copies retained
  through glob/editorconfig. editorconfig 4.0.1 is a major upgrade, so do not force it
  into the current js-beautify dependency tree.
  [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).

Both fixed dependency majors declare Node 18 || 20 || >=22, compatible with the
project's Node engine range. Engine compatibility alone does not establish API
compatibility with their parents. These are upgrade candidates, not tested upgrades.
Package manifests and the lockfile were not changed.

## Documentation and media accuracy

README now describes the no-license decision and distinguishes existing English/
Russian support from upcoming German, music, and notification sounds. CHANGELOG
continues to describe v1.1.0 as planned/unreleased, with package version 1.1.0.

The four PNG screenshots and WebM recording were captured from the current local
application with synthetic task data. The screenshot source flow was inspected
again against capture.mjs and the application entry points. No application changes
were made after those captures in this review. The recording demonstrates onboarding,
lighting, focus entry, and settings, without claiming music or audio features.
It is a WebM link, not an embedded GIF. The social image is a crop/rescale of the
actual task workspace. Local media files and documentation links are present.

Previously completed verification for this unchanged application candidate remains
193 passing unit tests, 23 passing Chromium E2E tests, build/type-check, ESLint,
Oxlint, and Prettier. This follow-up checks documentation formatting and links.
Browser support outside Chromium and hosted commit parity remain unverified.

## Final publication gates

- Confirm the intended copyright-holder spelling.
- Accept historical personal-email visibility.
- Confirm design-reference rights and inline-logo provenance.
- [x] Replace the Vue scaffold favicon with the existing FocusFlow wave geometry.
- Record acceptance of dev-tool advisories or complete compatible upstream upgrades
  and rerun the release checks.
- Run CI on the exact approved release commit and verify demo parity before tagging.

No commits, pushes, tags, releases, visibility changes, or application changes were
performed as part of this final review.
