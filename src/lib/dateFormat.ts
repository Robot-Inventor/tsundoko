const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium"
});

const formatDate = (isoDate: string | null, emptyLabel = "不明"): string =>
    isoDate ? dateFormatter.format(new Date(isoDate)) : emptyLabel;

export { formatDate };
