"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Business = {
  id: string;
  name: string;
  businessType: string;
  ownerPhone: string;
  status: string;
};

type Supplier = {
  id: string;
  supplierName: string;
  bankId: string;
  accountNumber: string;
  accountName: string;
};

type ActivePolicy = {
  id: string;
  maxPerTxNgn: number;
  dailyCapNgn: number;
  approvalThresholdNgn: number;
  activeDaysUtc: number[];
  activeStartTimeUtc: string;
  activeEndTimeUtc: string;
};

type BusinessDetailResponse = {
  business: Business;
  subaccount?: {
    zendfiSubaccountId: string;
    walletAddress: string;
  };
  subaccountBalance?: {
    availableUsdc: number;
    pendingUsdc: number;
    totalUsdc: number;
  };
  suppliers: Supplier[];
  activePolicy?: ActivePolicy;
  spentTodayNgn: number;
  pilotMode?: {
    mode: "assisted" | "autonomous";
    maxAutoExecutions: number;
    autoExecutedCount: number;
  };
};

type AiParseResponse = {
  success: boolean;
  parsed: {
    parsed: {
      supplierId?: string;
      amountNgn?: number;
      reason: string;
    };
    decision: {
      action: "execute" | "needs_approval" | "defer";
      confidence: number;
      explanation: string;
      reasonCodes: string[];
    };
  };
  submission?: {
    intentId: string;
    status: string;
    execution?: {
      id: string;
      status: string;
    };
  };
};

type PayoutIntent = {
  id: string;
  supplierId: string;
  amountNgn: number;
  status: string;
  reason?: string;
};

type Execution = {
  id: string;
  intentId: string;
  status: string;
  providerOrderId?: string;
};

type RetryJob = {
  id: string;
  intentId: string;
  attempt: number;
  maxAttempts: number;
  status: string;
  nextRunAt: string;
};

type OwnerNotification = {
  id: string;
  intentId: string;
  eventType: string;
  channel: string;
  status: string;
  message: string;
  createdAt: string;
};

type ActivityEvent = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

type ActivityResponse = {
  events: ActivityEvent[];
  intents: PayoutIntent[];
  executions: Execution[];
  retryJobs: RetryJob[];
  notifications: OwnerNotification[];
};

export function PaymentsConsole() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("");
  const [selectedBusinessDetail, setSelectedBusinessDetail] =
    useState<BusinessDetailResponse | null>(null);
  const [responseLog, setResponseLog] = useState<string>("No actions yet.");
  const [lastErrorMessage, setLastErrorMessage] = useState<string>("");
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"onboarding" | "payouts" | "operations" | "logs">(
    "onboarding",
  );
  const [activity, setActivity] = useState<ActivityResponse | null>(null);

  const [newBusinessName, setNewBusinessName] = useState("Sani Retail");
  const [newBusinessType, setNewBusinessType] = useState("retail");
  const [newBusinessPhone, setNewBusinessPhone] = useState("+2348012345678");

  const [supplierName, setSupplierName] = useState("Alhaji Musa");
  const [supplierBankId, setSupplierBankId] = useState("OPAY");
  const [supplierAccountNumber, setSupplierAccountNumber] = useState("0123456789");
  const [supplierAccountName, setSupplierAccountName] = useState("Musa Farms");

  const [topupAmount, setTopupAmount] = useState("50000");
  const [policyMaxPerTx, setPolicyMaxPerTx] = useState("30000");
  const [policyDailyCap, setPolicyDailyCap] = useState("100000");
  const [policyApprovalThreshold, setPolicyApprovalThreshold] = useState("30000");
  const [policyDays, setPolicyDays] = useState("1,2,3,4,5,6");
  const [policyStartTime, setPolicyStartTime] = useState("07:00");
  const [policyEndTime, setPolicyEndTime] = useState("19:00");

  const [payoutSupplierId, setPayoutSupplierId] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("20000");
  const [payoutReason, setPayoutReason] = useState("Restock tomatoes");
  const [selectedIntentId, setSelectedIntentId] = useState("");
  const [ownerCommand, setOwnerCommand] = useState("Pay Alhaji Musa NGN 15000 for tomatoes");
  const [submitParsedCommand, setSubmitParsedCommand] = useState(true);
  const [pilotMode, setPilotMode] = useState<"assisted" | "autonomous">("assisted");
  const [pilotAutoLimit, setPilotAutoLimit] = useState("3");
  const [rotationCredentialType, setRotationCredentialType] = useState<
    "owner_api_token" | "zendfi_api_key" | "zendfi_webhook_secret"
  >("owner_api_token");
  const [rotationRequestedBy, setRotationRequestedBy] = useState("ops-owner");
  const [rotationReason, setRotationReason] = useState("scheduled_monthly_rotation");
  const [rotationIdToComplete, setRotationIdToComplete] = useState("");
  const [rotationCompletionNotes, setRotationCompletionNotes] = useState("rotated_and_verified");
  const [incidentScenario, setIncidentScenario] = useState<
    "webhook_outage" | "provider_partial_failure"
  >("webhook_outage");

  const selectedBusiness = useMemo(
    () => businesses.find((business) => business.id === selectedBusinessId),
    [businesses, selectedBusinessId],
  );

  const approvalIntents = useMemo(
    () => (activity?.intents ?? []).filter((intent) => intent.status === "approval_required"),
    [activity],
  );

  const quickStats = useMemo(
    () => [
      {
        label: "Suppliers",
        value: String(selectedBusinessDetail?.suppliers.length ?? 0),
      },
      {
        label: "Pending approvals",
        value: String(approvalIntents.length),
      },
      {
        label: "Active retries",
        value: String((activity?.retryJobs ?? []).filter((job) => job.status === "pending").length),
      },
      {
        label: "Available USDC",
        value: String(selectedBusinessDetail?.subaccountBalance?.availableUsdc ?? 0),
      },
    ],
    [activity, approvalIntents.length, selectedBusinessDetail],
  );

  const writeLog = useCallback((payload: unknown) => {
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
    ) {
      const maybeMessage = (payload as { message?: unknown }).message;
      const message = typeof maybeMessage === "string" ? maybeMessage : "Request failed.";
      setLastErrorMessage(message);
    } else {
      setLastErrorMessage("");
    }

    setResponseLog(JSON.stringify(payload, null, 2));
  }, []);

  const requireBusinessSelection = useCallback(() => {
    if (!selectedBusinessId) {
      setLastErrorMessage("Choose a business first before running this action.");
      return false;
    }
    return true;
  }, [selectedBusinessId]);

  const requireIntentSelection = useCallback(() => {
    if (!selectedIntentId) {
      setLastErrorMessage("Choose a payment from the approval list first.");
      return false;
    }
    return true;
  }, [selectedIntentId]);

  const runAction = useCallback(async (actionKey: string, fn: () => Promise<void>) => {
    setActiveAction(actionKey);
    try {
      await fn();
    } finally {
      setActiveAction((current) => (current === actionKey ? null : current));
    }
  }, []);

  const isActionActive = useCallback(
    (actionKey: string) => activeAction === actionKey,
    [activeAction],
  );

  const refreshBusinesses = useCallback(async () => {
    const response = await fetch("/api/businesses", { cache: "no-store" });
    const data = (await response.json()) as { businesses: Business[] };
    setBusinesses(data.businesses);

    if (!selectedBusinessId && data.businesses.length > 0) {
      setSelectedBusinessId(data.businesses[0].id);
    }

    return data;
  }, [selectedBusinessId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshBusinesses();
    }, 0);

    return () => clearTimeout(timer);
  }, [refreshBusinesses]);

  const refreshBusinessDetail = useCallback(async () => {
    if (!requireBusinessSelection()) {
      return;
    }

    const response = await fetch(`/api/businesses/${selectedBusinessId}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as BusinessDetailResponse;
    setSelectedBusinessDetail(data);

    if (!payoutSupplierId && data.suppliers.length > 0) {
      setPayoutSupplierId(data.suppliers[0].id);
    }

    if (!selectedIntentId) {
      setSelectedIntentId("");
    }
  }, [payoutSupplierId, requireBusinessSelection, selectedBusinessId, selectedIntentId]);

  const refreshActivity = useCallback(async () => {
    if (!requireBusinessSelection()) {
      return;
    }

    const response = await fetch(`/api/businesses/${selectedBusinessId}/activity?limit=30`, {
      cache: "no-store",
    });
    const data = (await response.json()) as ActivityResponse;
    setActivity(data);

    if (!selectedIntentId) {
      const firstPending = data.intents.find((intent) => intent.status === "approval_required");
      if (firstPending) {
        setSelectedIntentId(firstPending.id);
      }
    }
  }, [requireBusinessSelection, selectedBusinessId, selectedIntentId]);

  useEffect(() => {
    if (!selectedBusinessId) {
      return;
    }

    const timer = setTimeout(() => {
      void refreshBusinessDetail();
      void refreshActivity();
    }, 0);

    return () => clearTimeout(timer);
  }, [refreshActivity, refreshBusinessDetail, selectedBusinessId]);

  const createBusiness = useCallback(async () => {
    const response = await fetch("/api/businesses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: newBusinessName,
        businessType: newBusinessType,
        ownerPhone: newBusinessPhone,
      }),
    });

    const data = await response.json();
    writeLog(data);
    await refreshBusinesses();
  }, [newBusinessName, newBusinessPhone, newBusinessType, refreshBusinesses, writeLog]);

  const initSubaccount = useCallback(async () => {
    if (!requireBusinessSelection()) {
      return;
    }

    const response = await fetch(`/api/businesses/${selectedBusinessId}/subaccount/init`, {
      method: "POST",
    });
    const data = await response.json();
    writeLog(data);
    await refreshBusinessDetail();
  }, [refreshBusinessDetail, requireBusinessSelection, selectedBusinessId, writeLog]);

  const addSupplier = useCallback(async () => {
    if (!requireBusinessSelection()) {
      return;
    }

    const response = await fetch(`/api/businesses/${selectedBusinessId}/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        supplierName,
        bankId: supplierBankId,
        accountNumber: supplierAccountNumber,
        accountName: supplierAccountName,
      }),
    });

    const data = await response.json();
    writeLog(data);
    await refreshBusinessDetail();
  }, [
    refreshBusinessDetail,
    selectedBusinessId,
    supplierAccountName,
    supplierAccountNumber,
    supplierBankId,
    supplierName,
    requireBusinessSelection,
    writeLog,
  ]);

  const createTopupLink = useCallback(async () => {
    if (!requireBusinessSelection()) {
      return;
    }

    const amount = Number(topupAmount);
    const response = await fetch(`/api/businesses/${selectedBusinessId}/topup-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount }),
    });

    const data = await response.json();
    writeLog(data);
  }, [requireBusinessSelection, selectedBusinessId, topupAmount, writeLog]);

  const freezeBusiness = useCallback(async () => {
    if (!requireBusinessSelection()) {
      return;
    }

    const response = await fetch(`/api/businesses/${selectedBusinessId}/freeze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "owner_control_test" }),
    });

    const data = await response.json();
    writeLog(data);
    await refreshBusinesses();
    await refreshBusinessDetail();
  }, [refreshBusinessDetail, refreshBusinesses, requireBusinessSelection, selectedBusinessId, writeLog]);

  const unfreezeBusiness = useCallback(async () => {
    if (!requireBusinessSelection()) {
      return;
    }

    const response = await fetch(`/api/businesses/${selectedBusinessId}/unfreeze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "owner_control_test" }),
    });

    const data = await response.json();
    writeLog(data);
    await refreshBusinesses();
    await refreshBusinessDetail();
  }, [refreshBusinessDetail, refreshBusinesses, requireBusinessSelection, selectedBusinessId, writeLog]);

  const activatePolicy = useCallback(async () => {
    if (!requireBusinessSelection()) {
      return;
    }

    const activeDaysUtc = policyDays
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value));

    const response = await fetch(`/api/businesses/${selectedBusinessId}/policies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        maxPerTxNgn: Number(policyMaxPerTx),
        dailyCapNgn: Number(policyDailyCap),
        approvalThresholdNgn: Number(policyApprovalThreshold),
        activeDaysUtc,
        activeStartTimeUtc: policyStartTime,
        activeEndTimeUtc: policyEndTime,
      }),
    });

    const data = await response.json();
    writeLog(data);
    await refreshBusinessDetail();
  }, [
    policyApprovalThreshold,
    policyDailyCap,
    policyDays,
    policyEndTime,
    policyMaxPerTx,
    policyStartTime,
    refreshBusinessDetail,
    requireBusinessSelection,
    selectedBusinessId,
    writeLog,
  ]);

  const evaluatePayoutIntent = useCallback(async () => {
    if (!requireBusinessSelection()) {
      return;
    }

    if (!payoutSupplierId) {
      setLastErrorMessage("Choose a supplier first before checking a payment.");
      return;
    }

    const response = await fetch("/api/payout-intents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessId: selectedBusinessId,
        supplierId: payoutSupplierId,
        amountNgn: Number(payoutAmount),
        reason: payoutReason,
        source: "dashboard_action",
        idempotencyKey: `dash_${Date.now()}`,
      }),
    });

    const data = await response.json();
    writeLog(data);
    await refreshBusinessDetail();
    await refreshActivity();
  }, [
    payoutAmount,
    payoutReason,
    payoutSupplierId,
    refreshBusinessDetail,
    refreshActivity,
    requireBusinessSelection,
    selectedBusinessId,
    writeLog,
  ]);

  const approveIntent = useCallback(async () => {
    if (!requireIntentSelection()) {
      return;
    }

    const response = await fetch(`/api/payout-intents/${selectedIntentId}/approve`, {
      method: "POST",
    });

    const data = await response.json();
    writeLog(data);
    await refreshBusinessDetail();
    await refreshActivity();
  }, [refreshActivity, refreshBusinessDetail, requireIntentSelection, selectedIntentId, writeLog]);

  const rejectIntent = useCallback(async () => {
    if (!requireIntentSelection()) {
      return;
    }

    const response = await fetch(`/api/payout-intents/${selectedIntentId}/reject`, {
      method: "POST",
    });

    const data = await response.json();
    writeLog(data);
    await refreshBusinessDetail();
    await refreshActivity();
  }, [refreshActivity, refreshBusinessDetail, requireIntentSelection, selectedIntentId, writeLog]);

  const runReconciliation = useCallback(async () => {
    const response = await fetch("/api/reconciliation/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ staleAfterMinutes: 0, limit: 30 }),
    });

    const data = await response.json();
    writeLog(data);
    await refreshActivity();
  }, [refreshActivity, writeLog]);

  const runRetries = useCallback(async () => {
    const response = await fetch("/api/retries/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 20 }),
    });

    const data = await response.json();
    writeLog(data);
    await refreshActivity();
  }, [refreshActivity, writeLog]);

  const runAiParse = useCallback(async () => {
    if (!requireBusinessSelection()) {
      return;
    }

    if (!ownerCommand.trim()) {
      setLastErrorMessage("Type a payment command first.");
      return;
    }

    const response = await fetch("/api/ai/parse-intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        businessId: selectedBusinessId,
        command: ownerCommand,
        submit: submitParsedCommand,
      }),
    });

    const data = (await response.json()) as AiParseResponse;
    writeLog(data);
    await refreshBusinessDetail();
    await refreshActivity();
  }, [ownerCommand, refreshActivity, refreshBusinessDetail, requireBusinessSelection, selectedBusinessId, submitParsedCommand, writeLog]);

  const updatePilotMode = useCallback(async () => {
    if (!requireBusinessSelection()) {
      return;
    }

    const response = await fetch(`/api/businesses/${selectedBusinessId}/pilot-mode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: pilotMode,
        maxAutoExecutions: Number(pilotAutoLimit),
      }),
    });

    const data = await response.json();
    writeLog(data);
    await refreshBusinessDetail();
  }, [pilotAutoLimit, pilotMode, refreshBusinessDetail, requireBusinessSelection, selectedBusinessId, writeLog]);

  const runLoadCheck = useCallback(async () => {
    const response = await fetch("/api/admin/load-check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ iterations: 120 }),
    });
    writeLog(await response.json());
  }, [writeLog]);

  const expandPilot = useCallback(async () => {
    const response = await fetch("/api/pilots/expand", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetCount: 3, dryRun: false }),
    });
    writeLog(await response.json());
    await refreshBusinesses();
  }, [refreshBusinesses, writeLog]);

  const fetchMetrics = useCallback(async () => {
    const response = await fetch("/api/admin/metrics", { cache: "no-store" });
    writeLog(await response.json());
  }, [writeLog]);

  const fetchSla = useCallback(async () => {
    const response = await fetch("/api/admin/sla", { cache: "no-store" });
    writeLog(await response.json());
  }, [writeLog]);

  const evaluateAlerts = useCallback(async () => {
    const response = await fetch("/api/admin/alerts/evaluate", {
      method: "POST",
    });
    writeLog(await response.json());
  }, [writeLog]);

  const fetchAlerts = useCallback(async () => {
    const response = await fetch("/api/admin/alerts?limit=25", { cache: "no-store" });
    writeLog(await response.json());
  }, [writeLog]);

  const requestRotation = useCallback(async () => {
    const response = await fetch("/api/admin/credentials/rotations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        credentialType: rotationCredentialType,
        requestedBy: rotationRequestedBy,
        reason: rotationReason,
      }),
    });
    writeLog(await response.json());
  }, [rotationCredentialType, rotationReason, rotationRequestedBy, writeLog]);

  const listRotations = useCallback(async () => {
    const response = await fetch("/api/admin/credentials/rotations?limit=20", {
      cache: "no-store",
    });
    writeLog(await response.json());
  }, [writeLog]);

  const completeRotation = useCallback(async () => {
    if (!rotationIdToComplete.trim()) {
      return;
    }
    const response = await fetch(
      `/api/admin/credentials/rotations/${rotationIdToComplete.trim()}/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes: rotationCompletionNotes }),
      },
    );
    writeLog(await response.json());
  }, [rotationCompletionNotes, rotationIdToComplete, writeLog]);

  const fetchRunbooks = useCallback(async () => {
    const response = await fetch("/api/admin/runbooks", { cache: "no-store" });
    writeLog(await response.json());
  }, [writeLog]);

  const fetchPilotChecklist = useCallback(async () => {
    const response = await fetch("/api/admin/pilot-checklist?targetCount=3", {
      cache: "no-store",
    });
    writeLog(await response.json());
  }, [writeLog]);

  const runIncidentSimulation = useCallback(async () => {
    const response = await fetch("/api/admin/incident-simulation/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scenario: incidentScenario }),
    });
    writeLog(await response.json());
  }, [incidentScenario, writeLog]);

  const fetchKpiReport = useCallback(async () => {
    const response = await fetch("/api/admin/kpi-report", { cache: "no-store" });
    writeLog(await response.json());
  }, [writeLog]);

  const fetchLaunchRecommendation = useCallback(async () => {
    const response = await fetch("/api/admin/launch-recommendation", {
      cache: "no-store",
    });
    writeLog(await response.json());
  }, [writeLog]);

  return (
    <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Live Console</h2>
        <button
          type="button"
          className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-300"
          disabled={Boolean(activeAction)}
          onClick={() =>
            void runAction("refresh_data", async () => {
              const data = await refreshBusinesses();
              writeLog(data);
              await refreshBusinessDetail();
              await refreshActivity();
            })
          }
        >
          {isActionActive("refresh_data") ? "Processing..." : "Refresh Data"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-100">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setActiveTab("onboarding")}
          className={`rounded-md px-3 py-2 text-sm font-semibold ${
            activeTab === "onboarding"
              ? "bg-emerald-300 text-slate-950"
              : "border border-slate-600 text-slate-200"
          }`}
        >
          Setup
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("payouts")}
          className={`rounded-md px-3 py-2 text-sm font-semibold ${
            activeTab === "payouts"
              ? "bg-emerald-300 text-slate-950"
              : "border border-slate-600 text-slate-200"
          }`}
        >
          Payments
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("operations")}
          className={`rounded-md px-3 py-2 text-sm font-semibold ${
            activeTab === "operations"
              ? "bg-emerald-300 text-slate-950"
              : "border border-slate-600 text-slate-200"
          }`}
        >
          Controls
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={`rounded-md px-3 py-2 text-sm font-semibold ${
            activeTab === "logs"
              ? "bg-emerald-300 text-slate-950"
              : "border border-slate-600 text-slate-200"
          }`}
        >
          Activity
        </button>
      </div>

      {lastErrorMessage ? (
        <div className="mt-4 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
          {lastErrorMessage}
        </div>
      ) : null}

      {activeTab === "onboarding" ? (
        <>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
          <p className="text-sm font-semibold text-slate-200">Add business</p>
          <div className="mt-3 grid gap-2">
            <input
              value={newBusinessName}
              onChange={(event) => setNewBusinessName(event.target.value)}
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              placeholder="Business name"
            />
            <input
              value={newBusinessType}
              onChange={(event) => setNewBusinessType(event.target.value)}
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              placeholder="Business type"
            />
            <input
              value={newBusinessPhone}
              onChange={(event) => setNewBusinessPhone(event.target.value)}
              className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              placeholder="Owner phone"
            />
            <button
              type="button"
              disabled={Boolean(activeAction)}
              onClick={() => void runAction("add_business", createBusiness)}
              className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950"
            >
              {isActionActive("add_business") ? "Processing..." : "Add business"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
          <p className="text-sm font-semibold text-slate-200">Choose business</p>
          <select
            className="mt-3 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            value={selectedBusinessId}
            onChange={(event) => {
              setSelectedBusinessId(event.target.value);
              setSelectedBusinessDetail(null);
            }}
          >
            <option value="">Select...</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name} ({business.id})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("view_business_details", refreshBusinessDetail)}
            className="mt-3 rounded-md border border-slate-600 px-3 py-2 text-sm"
          >
            {isActionActive("view_business_details") ? "Processing..." : "View business details"}
          </button>
          {selectedBusiness ? (
            <p className="mt-3 text-xs text-slate-300">
              Current status: <span className="font-semibold">{selectedBusiness.status}</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <button
          type="button"
          disabled={Boolean(activeAction)}
          onClick={() => void runAction("setup_wallet", initSubaccount)}
          className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-200"
        >
          {isActionActive("setup_wallet") ? "Processing..." : "Set up wallet"}
        </button>
        <div className="flex gap-2">
          <input
            value={topupAmount}
            onChange={(event) => setTopupAmount(event.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Add funds amount"
          />
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("add_funds_link", createTopupLink)}
            className="rounded-md border border-indigo-400/40 bg-indigo-400/10 px-3 py-2 text-sm font-semibold text-indigo-200"
          >
            {isActionActive("add_funds_link") ? "Processing..." : "Add funds link"}
          </button>
        </div>
        <button
          type="button"
          disabled={Boolean(activeAction)}
          onClick={() => void runAction("pause_payouts", freezeBusiness)}
          className="rounded-md border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-200"
        >
          {isActionActive("pause_payouts") ? "Processing..." : "Pause payouts"}
        </button>
        <button
          type="button"
          disabled={Boolean(activeAction)}
          onClick={() => void runAction("resume_payouts", unfreezeBusiness)}
          className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200"
        >
          {isActionActive("resume_payouts") ? "Processing..." : "Resume payouts"}
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-sm font-semibold text-slate-200">Supplier list</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={supplierName}
            onChange={(event) => setSupplierName(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Supplier name"
          />
          <input
            value={supplierBankId}
            onChange={(event) => setSupplierBankId(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Bank"
          />
          <input
            value={supplierAccountNumber}
            onChange={(event) => setSupplierAccountNumber(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Account number"
          />
          <input
            value={supplierAccountName}
            onChange={(event) => setSupplierAccountName(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Account name"
          />
        </div>
        <button
          type="button"
          disabled={Boolean(activeAction)}
          onClick={() => void runAction("add_supplier", addSupplier)}
          className="mt-3 rounded-md bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-900"
        >
          {isActionActive("add_supplier") ? "Processing..." : "Add supplier"}
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-sm font-semibold text-slate-200">Spending rules</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            value={policyMaxPerTx}
            onChange={(event) => setPolicyMaxPerTx(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Max per payment (NGN)"
          />
          <input
            value={policyDailyCap}
            onChange={(event) => setPolicyDailyCap(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Daily limit (NGN)"
          />
          <input
            value={policyApprovalThreshold}
            onChange={(event) => setPolicyApprovalThreshold(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Manual approval above (NGN)"
          />
          <input
            value={policyDays}
            onChange={(event) => setPolicyDays(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm sm:col-span-2"
            placeholder="Active days (UTC, e.g. 1,2,3,4,5,6)"
          />
          <div className="flex gap-2">
            <input
              value={policyStartTime}
              onChange={(event) => setPolicyStartTime(event.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              placeholder="Start time (UTC)"
            />
            <input
              value={policyEndTime}
              onChange={(event) => setPolicyEndTime(event.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              placeholder="End time (UTC)"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={Boolean(activeAction)}
          onClick={() => void runAction("save_rules", activatePolicy)}
          className="mt-3 rounded-md bg-cyan-300 px-3 py-2 text-sm font-semibold text-slate-900"
        >
          {isActionActive("save_rules") ? "Processing..." : "Save rules"}
        </button>
      </div>
        </>
      ) : null}

      {activeTab === "operations" ? (
        <>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <button
          type="button"
          disabled={Boolean(activeAction)}
          onClick={() => void runAction("recheck_status", runReconciliation)}
          className="rounded-md border border-amber-300/50 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-200"
        >
          {isActionActive("recheck_status") ? "Processing..." : "Recheck payment status"}
        </button>
        <button
          type="button"
          disabled={Boolean(activeAction)}
          onClick={() => void runAction("retry_failed", runRetries)}
          className="rounded-md border border-sky-300/50 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-200"
        >
          {isActionActive("retry_failed") ? "Processing..." : "Retry failed payments"}
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-sm font-semibold text-slate-200">System tools</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("check_load", runLoadCheck)}
            className="rounded-md border border-emerald-300/50 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200"
          >
            {isActionActive("check_load") ? "Processing..." : "Check load"}
          </button>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("view_metrics", fetchMetrics)}
            className="rounded-md border border-sky-300/50 bg-sky-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-200"
          >
            {isActionActive("view_metrics") ? "Processing..." : "View metrics"}
          </button>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("view_uptime", fetchSla)}
            className="rounded-md border border-indigo-300/50 bg-indigo-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-200"
          >
            {isActionActive("view_uptime") ? "Processing..." : "View uptime"}
          </button>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("expand_pilot", expandPilot)}
            className="rounded-md border border-amber-300/50 bg-amber-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-200"
          >
            {isActionActive("expand_pilot") ? "Processing..." : "Expand Pilot to 3"}
          </button>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("evaluate_alerts", evaluateAlerts)}
            className="rounded-md border border-rose-300/50 bg-rose-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200"
          >
            {isActionActive("evaluate_alerts") ? "Processing..." : "Evaluate Alerts"}
          </button>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("view_alerts", fetchAlerts)}
            className="rounded-md border border-fuchsia-300/50 bg-fuchsia-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fuchsia-200"
          >
            {isActionActive("view_alerts") ? "Processing..." : "View alerts"}
          </button>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("list_rotations", listRotations)}
            className="rounded-md border border-teal-300/50 bg-teal-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-teal-200"
          >
            {isActionActive("list_rotations") ? "Processing..." : "List Rotations"}
          </button>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("view_runbooks", fetchRunbooks)}
            className="rounded-md border border-slate-300/50 bg-slate-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
          >
            {isActionActive("view_runbooks") ? "Processing..." : "View runbooks"}
          </button>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("pilot_checklist", fetchPilotChecklist)}
            className="rounded-md border border-lime-300/50 bg-lime-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-lime-200"
          >
            {isActionActive("pilot_checklist") ? "Processing..." : "Pilot Checklist"}
          </button>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("business_report", fetchKpiReport)}
            className="rounded-md border border-orange-300/50 bg-orange-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-orange-200"
          >
            {isActionActive("business_report") ? "Processing..." : "Business report"}
          </button>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("go_live_recommendation", fetchLaunchRecommendation)}
            className="rounded-md border border-emerald-300/50 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200"
          >
            {isActionActive("go_live_recommendation") ? "Processing..." : "Go-live recommendation"}
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <select
            value={incidentScenario}
            onChange={(event) =>
              setIncidentScenario(event.target.value as "webhook_outage" | "provider_partial_failure")
            }
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-xs"
          >
            <option value="webhook_outage">webhook_outage</option>
            <option value="provider_partial_failure">provider_partial_failure</option>
          </select>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("simulate_issue", runIncidentSimulation)}
            className="rounded-md bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-900"
          >
            {isActionActive("simulate_issue") ? "Processing..." : "Simulate issue"}
          </button>
          <div className="hidden sm:block" />
          <div className="hidden sm:block" />
          <select
            value={rotationCredentialType}
            onChange={(event) =>
              setRotationCredentialType(
                event.target.value as
                  | "owner_api_token"
                  | "zendfi_api_key"
                  | "zendfi_webhook_secret",
              )
            }
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-xs"
          >
            <option value="owner_api_token">owner_api_token</option>
            <option value="zendfi_api_key">zendfi_api_key</option>
            <option value="zendfi_webhook_secret">zendfi_webhook_secret</option>
          </select>
          <input
            value={rotationRequestedBy}
            onChange={(event) => setRotationRequestedBy(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-xs"
            placeholder="Requested by"
          />
          <input
            value={rotationReason}
            onChange={(event) => setRotationReason(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-xs"
            placeholder="Why rotate"
          />
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("request_rotation", requestRotation)}
            className="rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-900"
          >
            {isActionActive("request_rotation") ? "Processing..." : "Request key rotation"}
          </button>
          <input
            value={rotationIdToComplete}
            onChange={(event) => setRotationIdToComplete(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-xs sm:col-span-2"
            placeholder="Rotation ID"
          />
          <input
            value={rotationCompletionNotes}
            onChange={(event) => setRotationCompletionNotes(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-xs"
            placeholder="Completion notes"
          />
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("complete_rotation", completeRotation)}
            className="rounded-md bg-emerald-300 px-3 py-2 text-xs font-semibold text-slate-900"
          >
            {isActionActive("complete_rotation") ? "Processing..." : "Mark rotation complete"}
          </button>
        </div>
      </div>
        </>
      ) : null}

      {activeTab === "payouts" ? (
        <>
      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-sm font-semibold text-slate-200">Plain-language payment command</p>
        <textarea
          value={ownerCommand}
          onChange={(event) => setOwnerCommand(event.target.value)}
          className="mt-3 min-h-24 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Describe payment in plain language..."
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={submitParsedCommand}
            onChange={(event) => setSubmitParsedCommand(event.target.checked)}
          />
          Send this command to payment flow
        </label>
        <button
          type="button"
          disabled={Boolean(activeAction)}
          onClick={() => void runAction("process_command", runAiParse)}
          className="mt-3 rounded-md bg-violet-300 px-3 py-2 text-sm font-semibold text-slate-900"
        >
          {isActionActive("process_command") ? "Processing..." : "Process command"}
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-sm font-semibold text-slate-200">Pilot automation mode</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <select
            value={pilotMode}
            onChange={(event) => setPilotMode(event.target.value as "assisted" | "autonomous")}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="assisted">assisted</option>
            <option value="autonomous">autonomous</option>
          </select>
          <input
            value={pilotAutoLimit}
            onChange={(event) => setPilotAutoLimit(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Max automatic payments"
          />
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("save_pilot_mode", updatePilotMode)}
            className="rounded-md bg-teal-300 px-3 py-2 text-sm font-semibold text-slate-900"
          >
            {isActionActive("save_pilot_mode") ? "Processing..." : "Save pilot mode"}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-sm font-semibold text-slate-200">Payments waiting approval</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedIntentId}
            onChange={(event) => setSelectedIntentId(event.target.value)}
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">Select payment to approve...</option>
            {approvalIntents.map((intent) => (
              <option key={intent.id} value={intent.id}>
                {intent.id} | NGN {intent.amountNgn}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("approve_payment", approveIntent)}
            className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-900"
          >
            {isActionActive("approve_payment") ? "Processing..." : "Approve and send"}
          </button>
          <button
            type="button"
            disabled={Boolean(activeAction)}
            onClick={() => void runAction("reject_payment", rejectIntent)}
            className="rounded-md bg-rose-400 px-3 py-2 text-sm font-semibold text-slate-900"
          >
            {isActionActive("reject_payment") ? "Processing..." : "Reject"}
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-sm font-semibold text-slate-200">New payment check</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <select
            value={payoutSupplierId}
            onChange={(event) => setPayoutSupplierId(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value="">Select supplier...</option>
            {(selectedBusinessDetail?.suppliers ?? []).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.supplierName} ({supplier.accountNumber})
              </option>
            ))}
          </select>
          <input
            value={payoutAmount}
            onChange={(event) => setPayoutAmount(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Amount (NGN)"
          />
          <input
            value={payoutReason}
            onChange={(event) => setPayoutReason(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
            placeholder="Purpose"
          />
        </div>
        <button
          type="button"
          disabled={Boolean(activeAction)}
          onClick={() => void runAction("check_payment", evaluatePayoutIntent)}
          className="mt-3 rounded-md bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-900"
        >
          {isActionActive("check_payment") ? "Processing..." : "Check payment"}
        </button>
      </div>
        </>
      ) : null}

      {activeTab === "logs" ? (
        <>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-wider text-slate-400">Business snapshot</p>
          <p className="mt-2">Spent Today: NGN {selectedBusinessDetail?.spentTodayNgn ?? 0}</p>
          {selectedBusinessDetail?.activePolicy ? (
            <div className="mt-2 space-y-1">
              <p>Active Policy: {selectedBusinessDetail.activePolicy.id}</p>
              <p>
                Limits: {selectedBusinessDetail.activePolicy.maxPerTxNgn} / {" "}
                {selectedBusinessDetail.activePolicy.dailyCapNgn}
              </p>
              <p>
                Window: {selectedBusinessDetail.activePolicy.activeStartTimeUtc} - {" "}
                {selectedBusinessDetail.activePolicy.activeEndTimeUtc}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-slate-500">No active policy set.</p>
          )}
          <p className="mt-3 text-xs uppercase tracking-wider text-slate-400">Wallet</p>
          {selectedBusinessDetail?.subaccount ? (
            <div className="mt-2 space-y-1">
              <p>ID: {selectedBusinessDetail.subaccount.zendfiSubaccountId}</p>
              <p>Wallet: {selectedBusinessDetail.subaccount.walletAddress}</p>
              <p>
                Balance: {selectedBusinessDetail.subaccountBalance?.availableUsdc ?? 0} USDC
                (pending {selectedBusinessDetail.subaccountBalance?.pendingUsdc ?? 0})
              </p>
              <p>
                Pilot: {selectedBusinessDetail.pilotMode?.mode ?? "assisted"} | auto
                {" "}
                {selectedBusinessDetail.pilotMode?.autoExecutedCount ?? 0}/
                {selectedBusinessDetail.pilotMode?.maxAutoExecutions ?? 3}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-slate-500">Wallet not set up.</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Technical log</p>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-slate-300">
            {responseLog}
          </pre>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Recent Events</p>
          <ul className="mt-2 space-y-2 text-xs text-slate-300">
            {(activity?.events ?? []).slice(0, 8).map((event) => (
              <li key={event.id} className="rounded border border-slate-800 px-2 py-1">
                <p className="font-semibold text-slate-200">{event.type}</p>
                <p>{event.message}</p>
              </li>
            ))}
            {(activity?.events ?? []).length === 0 ? (
              <li className="text-slate-500">No events yet.</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Recent payment requests</p>
          <ul className="mt-2 space-y-2 text-xs text-slate-300">
            {(activity?.intents ?? []).slice(0, 8).map((intent) => (
              <li key={intent.id} className="rounded border border-slate-800 px-2 py-1">
                {intent.id} | {intent.status} | NGN {intent.amountNgn}
              </li>
            ))}
            {(activity?.intents ?? []).length === 0 ? (
              <li className="text-slate-500">No intents yet.</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Recent sent payments</p>
          <ul className="mt-2 space-y-2 text-xs text-slate-300">
            {(activity?.executions ?? []).slice(0, 8).map((execution) => (
              <li key={execution.id} className="rounded border border-slate-800 px-2 py-1">
                {execution.id} | {execution.status} | {execution.providerOrderId ?? "n/a"}
              </li>
            ))}
            {(activity?.executions ?? []).length === 0 ? (
              <li className="text-slate-500">No executions yet.</li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Retry queue</p>
          <ul className="mt-2 space-y-2 text-xs text-slate-300">
            {(activity?.retryJobs ?? []).slice(0, 8).map((job) => (
              <li key={job.id} className="rounded border border-slate-800 px-2 py-1">
                {job.intentId} | {job.attempt}/{job.maxAttempts} | {job.status}
              </li>
            ))}
            {(activity?.retryJobs ?? []).length === 0 ? (
              <li className="text-slate-500">No retry jobs yet.</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Notifications</p>
          <ul className="mt-2 space-y-2 text-xs text-slate-300">
            {(activity?.notifications ?? []).slice(0, 8).map((notification) => (
              <li key={notification.id} className="rounded border border-slate-800 px-2 py-1">
                <p className="font-semibold text-slate-200">{notification.eventType}</p>
                <p>{notification.message}</p>
              </li>
            ))}
            {(activity?.notifications ?? []).length === 0 ? (
              <li className="text-slate-500">No notifications yet.</li>
            ) : null}
          </ul>
        </div>
      </div>
        </>
      ) : null}
    </section>
  );
}
