# Design

Why the templates look the way they do. Styling is Tailwind v4 utilities in the templates, the shared
directives from `@crgolden/modules/primitives`, and this app's directives in `src/shared/primitives`.
`src/styles.css` holds only the `@theme` tokens and type-selector element defaults in `@layer base`;
there are no component stylesheets, and any other authored declaration is a code-style catalog row
(rule 14). Leaflet's own stylesheet is the one third-party sheet, loaded ahead of `styles.css` by
`angular.json`.

## Tokens

**Every color is an `@theme` token, and translucency is the color with an opacity modifier.**
`bg-accent/8` is the accent at 8%, compiled to `color-mix()`, so a tint can never drift from its base
color. The shared directives name the contract tokens (`accent`, `accent-hover`, `on-fill`, `line`,
`line-strong`, `surface`, `canvas`, `text-muted`, `danger`, `danger-hover`), and every one is defined
even where Churches uses no directive that reads it: Tailwind scans the shared package, so a missing
token fails the design gate. This palette fills them with the indigo primary and neutral grays, and adds
`accent-deep` (the hero gradient's second stop) and `amber` / `amber-dark` (the accent tag).

**`line` is a divider and `line-strong` is a control's edge**, and they are different values: an input
or ghost button outline must clear WCAG 1.4.11's 3:1 against the surface, which gray-500 does on white
and the gray-200 divider does not.

**Spacing is Tailwind's own scale.** A card's inner padding is `p-6`; a one-off `0.9rem` reads as a
mistake at the joins even when it looks right in isolation.

**Font sizes are named by role** (`text-hero`, `text-brand`, `text-detail`, `text-meta` and the rest in
`@theme`), so a size is chosen from the scale rather than typed as a number, and the design gate fails
a size token nothing uses.

**`appEyebrow` is the small uppercase section label, and it is shared deliberately.** Church-detail
section headings (`<h4>`) and the moderation table's column headers (`<th>`) both wear it, so neither
restates its type. Changing the directive changes both.

## Element defaults with a reason

**There is deliberately no `scroll-behavior: smooth`.** Smooth scrolling is driven by animation frames,
so anywhere frames are not running (a throttled background tab, a stalled GPU process, a
scroll-hijacking extension) the scroll is dropped entirely rather than degrading to a jump. Anchor
navigation and programmatic scrolls have to land unconditionally, and the animation is not worth making
them fail closed.

**Native form chrome is reset for text, email, tel, number, select and textarea, and not for time or
date.** Those two keep their appearance because the reset also removes the built-in picker icon, which is
the only affordance telling a user the field opens a picker at all.

## Grid sizing, where the obvious value is wrong

Three grids are written against a measured failure rather than against the tidiest expression of intent.

**The church grid uses `minmax(min(100%,300px),1fr)`, not `minmax(300px,1fr)`.** The plain form imposes a
300px floor that overflows the padded container on a phone, and the visible symptom is cards rendering
edge-to-edge with no side padding. The `min(100%, …)` lets a single column shrink below the floor when the
container is narrower than it.

**The moderator add grid is forced to one column below 600px (`max-compact:grid-cols-1`)** rather than
left to `auto-fit`. By the numbers, `minmax(150px,1fr)` still fits three columns at that card width, but
150px is too narrow for the real placeholder text ("e.g. Traditional service", "e.g. North Campus"), so
labels and inputs clip. Auto-fit counts pixels it has, not text it must hold.

**The filter grid's minimum is set so filter labels and values never truncate**, and the grid collapses
to fewer columns, down to one, as the search card narrows.

## Component decisions

**The moderation table scrolls horizontally instead of clipping.** Its card carries `overflow-x-auto`
and the table a `min-w-[640px]`, so on a narrow viewport the right-hand columns move off-screen and can
be reached, rather than being cut off where nothing indicates they exist.

**The full-width detail section carries its own horizontal padding.** Full-width sections, the location
map, sit outside the padded detail body grid, so without it their heading would not line up with Contact
and About above.

**Moderator "add new" forms sit below the read-only rows, separated by a dashed rule.** The dashed border
is what distinguishes "records that exist" from "the form that creates one" in a section where both are
plain rows.

**The inline delete control is its own directive, `appInlineDeleteButton`, not a ghost button with its
padding overridden.** It sits beside an existing row, where the ghost button's roomier padding would break
the row's rhythm, and two utilities setting the same padding on one element would be decided by
stylesheet order rather than by intent.

**The list view is denser than the card grid on purpose.** The list is a compact single-column layout
offered alongside the card grid; the two are alternative presentations of the same results, not a
responsive fallback.

**"Near Me" goes full-width below 768px.** Once the search row wraps, the button is on its own line
anyway, and the full width buys a larger tap target for free.

**A selected state keys on the element's own state.** The active view toggle and the current page number
style themselves through `aria-pressed:` / `aria-current:` variants on the attribute they already carry,
never through a toggled class, because a toggled utility competing with a directive's own color is
decided by stylesheet order.
