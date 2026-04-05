export type Business = {
  id: string;
  name: string;
  businessType: string;
  ownerPhone: string;
  status: "active" | "frozen";
  pilotStage: "safe_launch" | "live";
  createdAt: string;
  updatedAt: string;
};

export type PilotModeRecord = {
  businessId: string;
  mode: "assisted" | "autonomous";
  maxAutoExecutions: number;
  autoExecutedCount: number;
  updatedAt: string;
};

export type AiCommandRecord = {
  id: string;
  businessId: string;
  command: string;
  parsedSupplierId?: string;
  parsedAmountNgn?: number;
  action: "execute" | "needs_approval" | "defer";
  confidence: number;
  explanation: string;
  createdAt: string;
};

export type Subaccount = {
  id: string;
  businessId: string;
  zendfiSubaccountId: string;
  walletAddress: string;
  status: "active" | "frozen";
  createdAt: string;
  updatedAt: string;
};

export type Supplier = {
  id: string;
  businessId: string;
  supplierName: string;
  bankId: string;
  accountNumber: string;
  accountName: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PolicyVersion = {
  id: string;
  businessId: string;
  status: "active" | "archived";
  maxPerTxNgn: number;
  dailyCapNgn: number;
  approvalThresholdNgn: number;
  activeDaysUtc: number[];
  activeStartTimeUtc: string;
  activeEndTimeUtc: string;
  createdAt: string;
  activatedAt?: string;
};

export type DailySpendCounter = {
  businessId: string;
  usageDate: string;
  spentNgn: number;
  updatedAt: string;
};

export type PayoutIntentRecord = {
  id: string;
  businessId: string;
  supplierId: string;
  source: "owner_command" | "dashboard_action" | "inventory_trigger";
  amountNgn: number;
  reason?: string;
  idempotencyKey: string;
  status:
    | "queued"
    | "approval_required"
    | "approved"
    | "executing"
    | "completed"
    | "failed"
    | "rejected";
  decision: {
    allowed: boolean;
    requiresApproval: boolean;
    reasonCodes: string[];
  };
  createdAt: string;
  updatedAt: string;
};

export type PayoutExecutionRecord = {
  id: string;
  intentId: string;
  businessId: string;
  supplierId: string;
  status: "initiated" | "pending_webhook" | "completed" | "failed";
  providerOrderId?: string;
  transactionSignature?: string;
  failureCode?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type WebhookInboxRecord = {
  id: string;
  provider: "zendfi";
  eventId: string;
  eventType: string;
  signature: string;
  status: "processed" | "duplicate" | "invalid_signature" | "ignored";
  businessId?: string;
  intentId?: string;
  executionId?: string;
  receivedAt: string;
  processedAt: string;
  payload: Record<string, unknown>;
};

export type RetryJobRecord = {
  id: string;
  intentId: string;
  businessId: string;
  attempt: number;
  maxAttempts: number;
  status: "scheduled" | "succeeded" | "exhausted";
  lastError?: string;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
};

export type OwnerNotificationRecord = {
  id: string;
  businessId: string;
  intentId: string;
  eventType: "payout_completed" | "payout_failed" | "retry_exhausted";
  channel: "in_app";
  status: "sent" | "failed";
  message: string;
  createdAt: string;
};

export type AlertRecord = {
  id: string;
  severity: "info" | "warning" | "critical";
  source: "sla" | "webhook" | "retry" | "load-check" | "security";
  message: string;
  status: "open" | "acknowledged";
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type CredentialRotationRecord = {
  id: string;
  credentialType: "owner_api_token" | "zendfi_api_key" | "zendfi_webhook_secret";
  status: "pending" | "completed";
  requestedBy: string;
  reason: string;
  requestedAt: string;
  completedAt?: string;
  nextDueAt?: string;
  notes?: string;
};

export type ActivityEvent = {
  id: string;
  businessId: string;
  type:
    | "payout_intent_created"
    | "payout_approval_required"
    | "payout_approved"
    | "payout_rejected"
    | "payout_execution_started"
    | "payout_completed"
    | "payout_failed"
    | "webhook_received"
    | "webhook_duplicate"
    | "webhook_processed"
    | "payout_reconciled"
    | "retry_scheduled"
    | "retry_exhausted"
    | "notification_sent"
    | "notification_failed"
    | "ai_intent_parsed"
    | "pilot_mode_updated"
    | "safe_launch_auto_limited";
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type PaygentStore = {
  businesses: Business[];
  subaccounts: Subaccount[];
  suppliers: Supplier[];
  policyVersions: PolicyVersion[];
  dailySpendCounters: DailySpendCounter[];
  payoutIntents: PayoutIntentRecord[];
  payoutExecutions: PayoutExecutionRecord[];
  activityEvents: ActivityEvent[];
  webhookInbox: WebhookInboxRecord[];
  retryJobs: RetryJobRecord[];
  ownerNotifications: OwnerNotificationRecord[];
  pilotModes: PilotModeRecord[];
  aiCommands: AiCommandRecord[];
  alerts: AlertRecord[];
  credentialRotations: CredentialRotationRecord[];
};
