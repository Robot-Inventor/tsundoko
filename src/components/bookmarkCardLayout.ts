// Loaded cards and their skeletons share these wrappers so the loading rows reserve
// exactly the space the real cards occupy; changing a card's geometry here updates both.
const cardLayoutClass =
    "relative flex h-21 flex-row gap-3 overflow-visible rounded-none bg-transparent ring-0 sm:h-full sm:flex-col sm:gap-4 sm:overflow-hidden sm:rounded-xl sm:bg-card sm:border sm:border-foreground/10";

const thumbnailLayoutClass =
    "relative w-2/5 shrink-0 self-stretch overflow-hidden rounded-lg sm:w-full sm:rounded-none";

const contentLayoutClass = "flex min-w-0 flex-1 flex-col sm:gap-4";

// Two title lines plus the gap and three description lines. Reserving it on real cards
// too keeps rows the same height when a title is short or a description is missing.
const headerLayoutClass = "px-0 sm:px-4 sm:min-h-[6.875rem]";

const footerLayoutClass = "mt-auto border-t-0 bg-transparent p-0 sm:border-t sm:bg-muted/50 sm:p-4";

export { cardLayoutClass, contentLayoutClass, footerLayoutClass, headerLayoutClass, thumbnailLayoutClass };
