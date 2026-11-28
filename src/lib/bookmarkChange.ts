// An edit changes a bookmark outside the list hook's own state, so the hook listens here and
// refetches. Search results, tag pages, and title sorting then all agree with the server.
type BookmarkChangeListener = () => void;

const listeners = new Set<BookmarkChangeListener>();

const notifyBookmarkChanged = (): void => {
    listeners.forEach((listener) => {
        listener();
    });
};

const onBookmarkChanged = (listener: BookmarkChangeListener): (() => void) => {
    listeners.add(listener);

    return (): void => {
        listeners.delete(listener);
    };
};

export { notifyBookmarkChanged, onBookmarkChanged };
