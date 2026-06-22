export function formatUsageSummary(records) {
  const summary = {
    totalTutorMessages: 0,
    statusCounts: {
      success: 0,
      failed: 0,
      blocked: 0
    },
    latestEventAt: null
  };

  for (const record of records) {
    summary.totalTutorMessages += 1;

    if (record?.status === "success" || record?.status === "failed" || record?.status === "blocked") {
      summary.statusCounts[record.status] += 1;
    }

    if (typeof record?.created_at === "string" && (!summary.latestEventAt || record.created_at > summary.latestEventAt)) {
      summary.latestEventAt = record.created_at;
    }
  }

  return summary;
}
