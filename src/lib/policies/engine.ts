import type { PolicyDecision, PolicyEvaluationInput } from "@/lib/domain/types";

function toMinutes(value: string): number {
  const [hour, minute] = value.split(":").map((part) => Number(part));
  return hour * 60 + minute;
}

function isWithinWindow(nowUtc: Date, start: string, end: string): boolean {
  const current = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (startMinutes <= endMinutes) {
    return current >= startMinutes && current <= endMinutes;
  }

  return current >= startMinutes || current <= endMinutes;
}

export function evaluatePolicy(input: PolicyEvaluationInput): PolicyDecision {
  const reasonCodes: string[] = [];

  if (!input.isSupplierWhitelisted) {
    reasonCodes.push("supplier_not_whitelisted");
  }

  if (input.isBusinessFrozen) {
    reasonCodes.push("business_frozen");
  }

  if (!input.hasSufficientBalance) {
    reasonCodes.push("insufficient_balance");
  }

  if (input.amountNgn <= 0) {
    reasonCodes.push("invalid_amount");
  }

  if (input.amountNgn > input.policy.maxPerTxNgn) {
    reasonCodes.push("per_tx_limit_exceeded");
  }

  if (input.spentTodayNgn + input.amountNgn > input.policy.dailyCapNgn) {
    reasonCodes.push("daily_cap_exceeded");
  }

  const day = input.nowUtc.getUTCDay();
  if (!input.policy.activeDaysUtc.includes(day)) {
    reasonCodes.push("outside_active_day");
  }

  if (
    !isWithinWindow(
      input.nowUtc,
      input.policy.activeStartTimeUtc,
      input.policy.activeEndTimeUtc,
    )
  ) {
    reasonCodes.push("outside_active_window");
  }

  return {
    allowed: reasonCodes.length === 0,
    requiresApproval: input.amountNgn >= input.policy.approvalThresholdNgn,
    reasonCodes,
  };
}
