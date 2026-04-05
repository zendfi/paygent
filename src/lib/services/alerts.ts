import { getSlaSummary } from "@/lib/services/metrics-sla";
import { readStore, writeStore } from "@/lib/storage/store";
import type { AlertRecord } from "@/lib/storage/types";

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function evaluateOperationalAlerts(): Promise<{
  alerts: AlertRecord[];
  generatedAt: string;
}> {
  const store = await readStore();
  const sla = await getSlaSummary();

  const alerts: AlertRecord[] = [];

  if (sla.status !== "healthy") {
    alerts.push({
      id: makeId("alert"),
      severity: sla.status === "critical" ? "critical" : "warning",
      source: "sla",
      message: `SLA status is ${sla.status}`,
      status: "open",
      metadata: { failingChecks: sla.checks.filter((check) => !check.pass) },
      createdAt: nowIso(),
    });
  }

  const exhaustedRetries = store.retryJobs.filter((job) => job.status === "exhausted").length;
  if (exhaustedRetries > 0) {
    alerts.push({
      id: makeId("alert"),
      severity: "critical",
      source: "retry",
      message: `${exhaustedRetries} retry jobs exhausted`,
      status: "open",
      metadata: { exhaustedRetries },
      createdAt: nowIso(),
    });
  }

  const unmatchedWebhooks = store.webhookInbox.filter(
    (item) => item.status === "ignored" || item.status === "invalid_signature",
  ).length;
  if (unmatchedWebhooks >= 3) {
    alerts.push({
      id: makeId("alert"),
      severity: "warning",
      source: "webhook",
      message: `${unmatchedWebhooks} unmatched webhook events detected`,
      status: "open",
      metadata: { unmatchedWebhooks },
      createdAt: nowIso(),
    });
  }

  if (alerts.length > 0) {
    store.alerts.push(...alerts);
    await writeStore(store);
  }

  return {
    alerts,
    generatedAt: nowIso(),
  };
}

export async function listAlerts(limit = 100): Promise<AlertRecord[]> {
  const store = await readStore();
  return store.alerts
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
