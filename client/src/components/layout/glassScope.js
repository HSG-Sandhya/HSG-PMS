// Custom properties that re-point the blur tiers for everything INSIDE a
// surface that is already frosted (the page shell, the sidebar, a menu) or
// already opaque (a dialog).
//
// A backdrop-filter re-blurs whatever is painted beneath it. Inside a frosted
// surface that is the parent's own, already-blurred result — so a nested blur
// costs a full extra render pass per surface per frame and changes almost
// nothing you can see. Inside an opaque dialog it blurs a flat colour, which
// changes nothing at all. AppThemeProvider resolves the `*-nested` values to
// `none` at every glass level except "Everywhere".
//
// Apply it to the frosted surface's CHILDREN (`'& > *': NESTED_GLASS`), never
// the surface itself: custom properties apply to the element that declares
// them, so declaring these on the shell would switch off the shell's own blur.
// An opaque surface with no blur of its own can take them directly.
//
// `--app-blur-overlay` is deliberately not re-pointed. It is for things that
// float over other content (sticky headers, tooltips) — there the blur is what
// keeps the text beneath from showing through.
export const NESTED_GLASS = {
  '--app-blur': 'var(--app-blur-nested)',
  '--app-blur-strong': 'var(--app-blur-strong-nested)',
  '--app-blur-row': 'var(--app-blur-row-nested)',
};
