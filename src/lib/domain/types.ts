export type PayoutSource = "owner_command" | "dashboard_action" | "inventory_trigger";

export type PayoutIntentInput = {
  businessId: string;
  supplierId: string;
  amountNgn: number;
  reason?: string;
  source: PayoutSource;
  idempotencyKey: string;
};

export type PolicySnapshot = {
  maxPerTxNgn: number;
  dailyCapNgn: number;
  approvalThresholdNgn: number;
  activeDaysUtc: number[];
  activeStartTimeUtc: string;
  activeEndTimeUtc: string;
};

export type PolicyEvaluationInput = {
  amountNgn: number;
  spentTodayNgn: number;
  nowUtc: Date;
  policy: PolicySnapshot;
  isSupplierWhitelisted: boolean;
  isBusinessFrozen: boolean;
  hasSufficientBalance: boolean;
};

export type PolicyDecision = {
  allowed: boolean;
  requiresApproval: boolean;
  reasonCodes: string[];
};
