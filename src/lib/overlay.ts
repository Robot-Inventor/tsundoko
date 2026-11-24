// The dialog, the hamburger-menu sheet, the drawer and their backdrops share
// one timing so they finish together: Base UI unmounts each portal when its
// popup transition ends, which would cut off a longer backdrop fade.
const overlayDuration = "duration-250";
const overlayTransition = `${overlayDuration} ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none`;

// The overlay backdrop style shared by the dialog and the hamburger menu sheet.
// Dimming lives in the background alpha, never in `opacity`: Chromium drops
// backdrop-filter while an element's opacity is below 1, so an opacity fade
// would make the blur pop in instead of fading. The blur transitions together
// with the alpha because backdrop-filter keeps blurring at alpha 0 — without
// its own fade it would linger until the element unmounts.
const overlayBackdropClass = `fixed inset-0 z-50 bg-black/10 transition-[background-color,backdrop-filter] ${overlayTransition} supports-backdrop-filter:backdrop-blur-xs supports-backdrop-filter:data-starting-style:backdrop-blur-[0px] supports-backdrop-filter:data-ending-style:backdrop-blur-[0px] data-starting-style:bg-black/0 data-ending-style:bg-black/0`;

export { overlayBackdropClass, overlayDuration, overlayTransition };
