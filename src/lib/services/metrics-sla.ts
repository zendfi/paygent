import { listAuditRecords } from "@/lib/services/audit";
import { readStore } from "@/lib/storage/store";

function percentage(num: number, den: number): number {
  if (den <= 0) {
    return 0;
  }
  return Number(((num / den) * 100).toFixed(2));
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Number((sorted[idx] ?? 0).toFixed(2));
}

export async function getMetricsDashboard() {
  const store = await readStore();
  const audits = listAuditRecords({ limit: 5000 });

  const executions = store.payoutExecutions;
  const completed = executions.filter((item) => item.status === "completed").length;
  const failed = executions.filter((item) => item.status === "failed").length;

  const webhookProcessed = store.webhookInbox.filter((item) => item.status === "processed").length;
  const webhookIssues = store.webhookInbox.filter((item) => item.status === "ignored" || item.status === "invalid_signature").length;

  const finalizationMs = executions
    .filter((item) => item.status === "completed" || item.status === "failed")
    .map((item) => new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime())
    .filter((value) => Number.isFinite(value) && value >= 0);

  const failuresLast24h = audits.filter((entry) => {
    if (entry.result !== "failure") {
      return false;
    }
    return Date.now() - new Date(entry.at).getTime() <= 24 * 60 * 60 * 1000;
  }).length;

  return {
    totals: {
      businesses: store.businesses.length,
      payoutIntents: store.payoutIntents.length,
      executions: executions.length,
      retriesScheduled: store.retryJobs.filter((job) => job.status === "scheduled").length,
      retriesExhausted: store.retryJobs.filter((job) => job.status === "exhausted").length,
    },
    rates: {
      executionSuccessRatePct: percentage(completed, completed + failed),
      webhookProcessingRatePct: percentage(webhookProcessed, webhookProcessed + webhookIssues),
    },
    latencies: {
      finalizationP95Ms: percentile(finalizationMs, 95),
    },
    incidents: {
      failuresLast24h,
      unmatchedWebhookEvents: webhookIssues,
    },
  };
}

export async function getSlaSummary() {
  const metrics = await getMetricsDashboard();

  const objectives = {
    executionSuccessRatePct: 95,
    webhookProcessingRatePct: 98,
    finalizationP95Ms: 120000,
  };

  const checks = [
    {
      name: "execution_success_rate",
      actual: metrics.rates.executionSuccessRatePct,
      target: objectives.executionSuccessRatePct,
      pass: metrics.rates.executionSuccessRatePct >= objectives.executionSuccessRatePct,
      comparator: ">=",
    },
    {
      name: "webhook_processing_rate",
      actual: metrics.rates.webhookProcessingRatePct,
      target: objectives.webhookProcessingRatePct,
      pass: metrics.rates.webhookProcessingRatePct >= objectives.webhookProcessingRatePct,
      comparator: ">=",
    },
    {
      name: "finalization_p95_ms",
      actual: metrics.latencies.finalizationP95Ms,
      target: objectives.finalizationP95Ms,
      pass:
        metrics.latencies.finalizationP95Ms === 0 ||
        metrics.latencies.finalizationP95Ms <= objectives.finalizationP95Ms,
      comparator: "<=",
    },
  ];

  const failing = checks.filter((check) => !check.pass);

  return {
    status: failing.length === 0 ? "healthy" : failing.length === 1 ? "degraded" : "critical",
    checks,
    objectives,
    observedAt: new Date().toISOString(),
  };
}
