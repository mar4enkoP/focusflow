# FocusFlow design direction

## Reference and intent

Use [references/focusflow-design.png](references/focusflow-design.png) as the primary
visual reference. It depicts six separate states: task creation, focus, task management,
music, appearance, and statistics. Translate them into one full-viewport application
with contextual floating panels. Never reproduce the image as a six-panel collage.

The product should feel like a premium, calm, minimalist desktop productivity tool.
Optimize first for 1440×900 and 1920×1080 screens. Avoid tablet-sized controls,
oversized cards, and a mobile interface stretched across a desktop.

## Full-viewport composition

- Fill the browser viewport with a nearly black canvas. Use a small, quiet brand mark
  and restrained top navigation; do not place the whole application inside a large card.
- Position the timer in the upper-middle region, approximately 30–40% down the usable
  screen. Keep its thin numerals visually prominent, with a short muted status label.
- Place understated start/pause and session controls below the timer. Preserve generous
  negative space around this primary focus area.
- Anchor a compact task dock near the bottom center, approximately 32–48 px above the
  viewport edge. Show the active task icon, a truncated title, duration, and subtle
  progress. Start around 320–440 px wide on desktop and constrain it to available space.
- Place music and appearance controls as two independent small circular buttons beside
  the task dock, separated by 8–12 px gaps. Do not merge them into a large shared panel.
- Render a soft, blurred elliptical orange-red glow in the lower focus screen, behind
  and above the bottom controls. Let it fade gently into black, with subdued intensity;
  it must not compete with the timer or reduce control contrast.

## Visual language and starting tokens

These values are implementation starting points; tune them against the reference at
both target viewport sizes while preserving the composition above.

| Element  | Direction                                                                  |
| -------- | -------------------------------------------------------------------------- |
| Canvas   | Nearly black, around `#09090b`                                             |
| Surfaces | Soft translucent charcoal, roughly `rgba(24, 23, 26, 0.72)`                |
| Borders  | Delicate 1 px white at roughly 8–12% opacity                               |
| Text     | Off-white primary (`#eeeeef`), muted gray secondary (`#a5a2a8`)            |
| Accent   | Restrained orange-red, around `#f05236`, used sparingly                    |
| Blur     | Subtle background blur, roughly 12–20 px on floating surfaces              |
| Corners  | 10–16 px panels; pill-shaped docks and appropriate compact controls        |
| Spacing  | Consistent 4 px base; use 8, 12, 16, 24, 32, and 48 px steps               |
| Type     | System sans-serif initially; small, refined labels and thin timer numerals |
| Sizes    | Body 13–14 px, labels 11–12 px, panel titles 15–18 px                      |
| Timer    | Roughly 88–120 px desktop numerals; tabular figures to prevent shifting    |
| Controls | Standard desktop buttons approximately 28–36 px high; icons 14–18 px       |

Use subtle glassmorphism, shallow shadows, and delicate highlights. A primary timer
button may be slightly larger (around 40 px), but remain understated. Keep normal text
readable against translucent backgrounds. Do not use large colorful gradients, heavy
glows, oversized panels, or continuous decorative animation.

## Tasks and task creation

Task creation uses a compact floating form with:

- A clearly labeled task title field.
- An estimated duration input or selector, with units and positive-value validation.
- A category or icon selector with an understandable text label.
- A compact primary action and a clear cancel/close action.

Show validation near its field and retain entered values on errors. Provide a quiet,
actionable empty state for the first task. Task management uses compact rows with
consistent icon, title, duration, and edit/delete affordances. Long titles truncate in
the dock but remain accessible in task management. Avoid relying on color or icons
alone to communicate task or timer state.

## Floating panels

Task management, music, appearance, and statistics share the same translucent surface,
border, blur, corner radius, padding, title row, close affordance, and motion patterns.
Use content-sized desktop panels, approximately 340–480 px wide as a starting point,
with bounded height and internal scrolling. Anchor them logically to their entry point
without covering essential timer controls unnecessarily.

Prefer one active utility panel at a time to preserve calm and prevent overlap. Music
and appearance remain separate panels opened by their separate circular buttons.
Use compact rows, restrained segmented controls, and consistent sliders. Statistics
should emphasize legible summaries and subtle monochrome charts. Do not reproduce the
reference's individual screen frames as permanent dashboard cards.

## Interaction, responsiveness, and accessibility

- Use subtle 120–200 ms opacity/color transitions and at most a small panel translation.
  Honor reduced motion; never animate the glow continuously by default.
- Provide clear hover, pressed, disabled, and keyboard-focus states without bright
  decorative effects. Give icon-only buttons accessible names and concise tooltips.
- Support keyboard operation and Escape dismissal. Restore focus to the opening control
  when a panel closes; modal panels manage focus and expose dialog semantics.
- Keep ordinary text at least 4.5:1 contrast and essential control boundaries/focus
  indicators at least 3:1 against adjacent colors. Validate actual composited surfaces.
- At smaller widths, reduce margins and timer scale, constrain panels to viewport width,
  and let dense content scroll. Keep music and appearance as separate buttons even if
  the dock arrangement wraps. Increase hit areas for touch layouts as needed.
- In short windows or at increased zoom, allow content scrolling and adjust anchoring
  so the dock, timer controls, and panel actions never overlap or become unreachable.
- Verify 1440×900, 1920×1080, a narrow screen, a short window, and keyboard/reduced-motion
  states. The timer remains the visual priority and controls retain laptop proportions.

## Implementation guidance

Use reusable Vue components and scoped SCSS where appropriate, with shared tokens for
spacing, colors, typography, borders, and animation. Keep task/timer behavior separate
from visual components. Implement visual states as their roadmap milestones arrive;
this document specifies future design and does not authorize feature implementation.
