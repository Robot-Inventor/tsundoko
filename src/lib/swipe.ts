// The card's slide-out/return duration and the offset the card rests at, shared by the swipe
// gesture (BookmarkListItem) and its reveal background (SwipeReveal).
const exitAnimationMs = 200;
const restingOffsetPx = 0;

// Touch-only gestures are the row swipe and the empty-space menu swipe; pointer devices use buttons.
const touchPointerType = "touch";

export { exitAnimationMs, restingOffsetPx, touchPointerType };
