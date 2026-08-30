# Design

Why the stylesheets look the way they do. Every rule below is a decision that cost something to arrive at
and that a reader cannot recover from the CSS itself. Structural facts you *can* read off the file — which
selector sets which property — are deliberately absent.

The global sheet is `src/styles.css`; everything else is an Angular component stylesheet scoped to its
component.

## Tokens

**Every colour has an RGB companion, and translucency goes through it.** `--color-primary` and
`--color-primary-rgb` are the same colour in two notations, and the second exists so a translucent tint is
written `rgba(var(--color-primary-rgb), .08)` rather than by re-typing the hex with an alpha channel.
Re-typing is how two shades of "the same" tint end up in one page. Keep the pairs in step: adding a colour
means adding both, or the next tint of it silently hardcodes.

**Paddings and margins sit on the `--space-*` steps.** The scale is what makes vertical rhythm consistent
across components written months apart; a one-off `0.9rem` reads as a mistake at the joins even when it
looks right in isolation.

**`.eyebrow` is the small uppercase section label, and it is shared deliberately.** Church-detail section
headings (`<h4>`) and the moderation table's column headers (`<th>`) both wear it, which is why neither
component stylesheet sets its own type for those elements. Restyling `.eyebrow` restyles both.

## Global rules with a reason

**There is deliberately no `html { scroll-behavior: smooth }`.** Smooth scrolling is driven by animation
frames, so anywhere frames are not running — a throttled background tab, a stalled GPU process, a
scroll-hijacking extension — the scroll is dropped entirely rather than degrading to a jump. Anchor
navigation and programmatic scrolls have to land unconditionally, and the animation is not worth making
them fail closed.

**Native form chrome is reset for text, email, tel, number, select and textarea — and not for time or
date.** Those two keep their appearance because the reset also removes the built-in picker icon, which is
the only affordance telling a user the field opens a picker at all.

**The nav CTA needs its own colour rule.** `.nav-links a` sets a dark link colour, and by specificity that
beats `.btn-primary`'s white — so the call-to-action would render dark text on the indigo button and be
unreadable. `.nav-links a.nav-cta` restores white, hover included.

## Grid sizing, where the obvious value is wrong

Three grids are written against a measured failure rather than against the tidiest expression of intent.

**`.church-grid` uses `minmax(min(100%, 300px), 1fr)`, not `minmax(300px, 1fr)`.** The plain form imposes a
300px floor that overflows the padded container on a phone, and the visible symptom is cards rendering
edge-to-edge with no side padding. The `min(100%, …)` lets a single column shrink below the floor when the
container is narrower than it.

**`.mod-add-grid` is forced to one column below 600px** rather than left to `auto-fit`. By the numbers,
`minmax(150px, 1fr)` still fits three columns at that card width — but 150px is too narrow for the real
placeholder text ("e.g. Traditional service", "e.g. North Campus"), so labels and inputs clip. Auto-fit is
counting pixels it has, not text it must hold.

**`.filter-grid`'s minimum is set so filter labels and values never truncate**, and the grid collapses to
fewer columns — down to one — as the search card narrows.

## Component decisions

**The moderation table scrolls horizontally instead of clipping.** `.table-card` carries `overflow-x: auto`
and the table a `min-width`, so on a narrow viewport the right-hand columns move off-screen and can be
reached, rather than being cut off where nothing indicates they exist.

**`.detail-section--full` carries its own horizontal padding.** Full-width sections — the location map — sit
outside the padded `.detail-body` grid, so without it their heading would not line up with Contact and
About above.

**Moderator "add new" forms sit below the read-only rows, separated by a dashed rule.** The dashed border on
`.mod-add` is what distinguishes "records that exist" from "the form that creates one" in a section where
both are plain rows.

**`.btn-ghost.mod-delete` deliberately overrides `.btn-ghost`'s padding.** The delete control is inline
beside an existing row, where the roomier button padding would break the row's rhythm.

**The list view is denser than the card grid on purpose.** `.church-list` is a compact single-column layout
offered alongside `.church-grid`; the two are alternative presentations of the same results, not a
responsive fallback.

**"Near Me" goes full-width below 768px.** Once the search row wraps, the button is on its own line anyway,
and the full width buys a larger tap target for free.
