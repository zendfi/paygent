import { getMetricsDashboard, getSlaSummary } from "@/lib/services/metrics-sla";
import { readStore } from "@/lib/storage/store";

type CheckStatus = "pass" | "fail";

type ChecklistCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  details: string;
};

function boolToStatus(value: boolean): CheckStatus {
  return value ? "pass" : "fail";
}

export async function getPilotChecklist(targetCount = 3) {
  const store = await readStore();
  const activeBusinesses = store.businesses.filter((item) => item.status === "active");
  const activeBusinessIds = new Set(activeBusinesses.map((item) => item.id));

  const businessesReady = activeBusinesses.length >= targetCount;
  const subaccountsReady = activeBusinesses.every((item) =>
    store.subaccounts.some((subaccount) => subaccount.businessId === item.id && subaccount.status === "active"),
  );
  const suppliersReady = activeBusinesses.every((item) =>
    store.suppliers.some((supplier) => supplier.businessId === item.id && supplier.enabled),
  );
  const policiesReady = activeBusinesses.every((item) =>
    store.policyVersions.some((policy) => policy.businessId === item.id && policy.status === "active"),
  );
  const pilotModesReady = activeBusinesses.every((item) =>
    store.pilotModes.some((mode) => mode.businessId === item.id),
  );

  const checks: ChecklistCheck[] = [
    {
      key: "business_count",
      label: "At least 3 active pilot businesses",
      status: boolToStatus(businessesReady),
      details: `${activeBusinesses.length} active businesses available`,
    },
    {
      key: "subaccounts",
      label: "Every active pilot business has an active subaccount",
      status: boolToStatus(subaccountsReady),
      details: subaccountsReady
        ? "All active businesses have active subaccounts"
        : "One or more active businesses are missing active subaccounts",
    },
    {
      key: "suppliers",
      label: "Every active pilot business has at least one enabled supplier",
      status: boolToStatus(suppliersReady),
      details: suppliersReady
        ? "Supplier whitelists are available across pilot businesses"
        : "One or more pilot businesses have no enabled suppliers",
    },
    {
      key: "policies",
      label: "Every active pilot business has an active policy",
      status: boolToStatus(policiesReady),
      details: policiesReady
        ? "Policy guardrails are configured for all active businesses"
        : "Missing active policies for one or more businesses",
    },
    {
      key: "pilot_modes",
      label: "Every active pilot business has explicit pilot mode configuration",
      status: boolToStatus(pilotModesReady),
      details: pilotModesReady
        ? "Pilot mode controls are configured for all active businesses"
        : "One or more businesses are missing pilot mode configuration",
    },
  ];

  const failedChecks = checks.filter((check) => check.status === "fail");

  return {
    targetCount,
    activePilotBusinessIds: Array.from(activeBusinessIds),
    status: failedChecks.length === 0 ? "ready" : "not_ready",
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    checks,
    assessedAt: new Date().toISOString(),
  };
}

export async function runIncidentSimulation(input?: {
  scenario?: "webhook_outage" | "provider_partial_failure";
}) {
  const scenario = input?.scenario ?? "webhook_outage";
  const metrics = await getMetricsDashboard();
  const checklist = await getPilotChecklist(3);

  const unresolvedAlerts =
    metrics.incidents.unmatchedWebhookEvents + metrics.totals.retriesExhausted;
  const simulationPassed = unresolvedAlerts === 0 && checklist.status === "ready";

  const timeline =
    scenario === "webhook_outage"
      ? [
          "T+00: Detect webhook processing anomalies from alerts.",
          "T+05: Trigger reconciliation and retry sweep.",
          "T+10: Validate unmatched webhook queue reduction.",
          "T+15: Confirm SLA trend is stable and notify owner.",
        ]
      : [
          "T+00: Detect elevated provider failure responses.",
          "T+05: Confirm retry queue growth and classify transient failures.",
          "T+10: Evaluate safe-launch mode and gate autonomous execution.",
          "T+15: Verify successful retries and post incident summary.",
        ];

  return {
    scenario,
    status: simulationPassed ? "pass" : "attention_required",
    unresolvedAlerts,
    timeline,
    observations: {
      unmatchedWebhookEvents: metrics.incidents.unmatchedWebhookEvents,
      retriesExhausted: metrics.totals.retriesExhausted,
      checklistStatus: checklist.status,
    },
    simulatedAt: new Date().toISOString(),
  };
}

export async function getKpiPostmortemReport() {
  const metrics = await getMetricsDashboard();
  const sla = await getSlaSummary();
  const checklist = await getPilotChecklist(3);
  const store = await readStore();

  const approvalBacklog = store.payoutIntents.filter(
    (intent) => intent.status === "approval_required",
  ).length;

  const kpis = {
    activePilotBusinesses: checklist.activePilotBusinessIds.length,
    executionSuccessRatePct: metrics.rates.executionSuccessRatePct,
    webhookProcessingRatePct: metrics.rates.webhookProcessingRatePct,
    finalizationP95Ms: metrics.latencies.finalizationP95Ms,
    approvalBacklog,
    retriesExhausted: metrics.totals.retriesExhausted,
    unmatchedWebhookEvents: metrics.incidents.unmatchedWebhookEvents,
  };

  return {
    kpis,
    readiness: {
      checklistStatus: checklist.status,
      slaStatus: sla.status,
    },
    postmortemTemplate: {
      summary: "What happened and impact in one paragraph.",
      timeline: ["Detection", "Mitigation", "Recovery", "Follow-up"],
      rootCause: "Primary and contributing causes.",
      customerImpact: "Who was affected and for how long.",
      correctiveActions: ["Short-term fix", "Long-term fix", "Monitoring update"],
      owners: ["Engineering", "Operations"],
      dueDate: "YYYY-MM-DD",
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function getLaunchRecommendation() {
  const checklist = await getPilotChecklist(3);
  const sla = await getSlaSummary();
  const report = await getKpiPostmortemReport();

  const blockers: string[] = [];

  if (checklist.status !== "ready") {
    blockers.push("Pilot checklist is not fully satisfied");
  }
  if (sla.status === "critical") {
    blockers.push("SLA status is critical");
  }
  if (report.kpis.retriesExhausted > 0) {
    blockers.push("One or more retry jobs are exhausted");
  }
  if (report.kpis.unmatchedWebhookEvents > 0) {
    blockers.push("Unmatched webhook events remain unresolved");
  }

  const recommendation =
    blockers.length === 0
      ? "launch_go"
      : blockers.length <= 2 && sla.status !== "critical"
        ? "conditional_go"
        : "no_go";

  return {
    recommendation,
    blockers,
    nextActions:
      recommendation === "launch_go"
        ? [
            "Proceed with controlled rollout to pilot businesses.",
            "Keep assisted mode guardrails for first live window.",
            "Monitor metrics and alerts every 30 minutes.",
          ]
        : [
            "Resolve blockers listed in this report.",
            "Re-run incident simulation and KPI report.",
            "Re-evaluate launch recommendation after mitigation.",
          ],
    context: {
      checklistStatus: checklist.status,
      slaStatus: sla.status,
      kpis: report.kpis,
    },
    generatedAt: new Date().toISOString(),
  };
}
