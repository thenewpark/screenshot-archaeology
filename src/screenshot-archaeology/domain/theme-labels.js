const keyFor = (ids) => [...ids].sort().join("|");

/** Resolve only summaries for the exact current membership and lens/count. */
export function themeLabels(data, lens, count, memberships, fallback) {
  const saved = data.microcosm?.themeSummaries?.[lens]?.[String(count)] || [];
  const byMembers = new Map(saved.map((theme) => [keyFor(theme.itemIds || []), theme]));
  return memberships.map((ids, index) => {
    const theme = byMembers.get(keyFor(ids));
    const support = theme?.supportingIds || [];
    const valid =
      theme &&
      typeof theme.label === "string" &&
      theme.label.trim() &&
      theme.label.length <= 70 &&
      typeof theme.summary === "string" &&
      theme.summary.trim() &&
      support.length &&
      new Set(support).size === support.length &&
      support.every((id) => ids.includes(id)) &&
      (theme.mixed || support.length >= Math.floor(ids.length / 2) + 1);
    if (!valid) {
      return { ...fallback[index], summarySource: "descriptors" };
    }
    return {
      ...fallback[index],
      label: theme.label.trim(),
      summary: theme.summary.trim(),
      supportingIds: [...support],
      mixed: theme.mixed === true,
      summarySource: "cluster-summary",
    };
  });
}
