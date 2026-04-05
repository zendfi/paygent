import { getEnv } from "@/lib/config/env";
import { evaluatePolicy } from "@/lib/policies/engine";
import { addActivityEvent } from "@/lib/services/activity";
import { getBusinessById } from "@/lib/services/businesses";
import { getActivePolicy } from "@/lib/services/policies";
import { getOrCreatePilotMode } from "@/lib/services/pilot";
import { getTodaySpentNgn } from "@/lib/services/spending";
import { listSuppliers } from "@/lib/services/suppliers";
import { readStore, writeStore } from "@/lib/storage/store";
import type { AiCommandRecord } from "@/lib/storage/types";

export type AiParsedIntent = {
  supplierId?: string;
  amountNgn?: number;
  reason: string;
};

export type AiDecisionAction = "execute" | "needs_approval" | "defer";

export type AiDecision = {
  action: AiDecisionAction;
  confidence: number;
  explanation: string;
  reasonCodes: string[];
};

export type AiIntentResult = {
  parsed: AiParsedIntent;
  decision: AiDecision;
};

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function parseAmountNgn(command: string): number | undefined {
  const normalized = command.replace(/,/g, "");
  const amountMatch = normalized.match(/(?:ngn\s*|naira\s*)?(\d{3,9})/i);
  if (!amountMatch) {
    return undefined;
  }

  const parsed = Number(amountMatch[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inferSupplierId(command: string, suppliers: Array<{ id: string; supplierName: string; accountName: string; accountNumber: string }>): string | undefined {
  const lower = command.toLowerCase();
  const match = suppliers.find((supplier) =>
    lower.includes(supplier.supplierName.toLowerCase()) ||
    lower.includes(supplier.accountName.toLowerCase()) ||
    lower.includes(supplier.accountNumber.toLowerCase()),
  );

  return match?.id;
}

async function tryGeminiParse(command: string): Promise<{ reason: string } | undefined> {
  const env = getEnv();
  if (!env.geminiApiKey) {
    return undefined;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Extract payout reason from this owner command. Return JSON with key reason only. Command: ${command}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      return undefined;
    }

    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return undefined;
    }

    const parsed = JSON.parse(text) as { reason?: string };
    if (!parsed.reason || typeof parsed.reason !== "string") {
      return undefined;
    }

    return { reason: parsed.reason };
  } catch {
    return undefined;
  }
}

function decideAction(input: {
  hasSupplier: boolean;
  hasAmount: boolean;
  policyAllowed: boolean;
  requiresApproval: boolean;
  isSafeLaunchAssisted: boolean;
  safeLaunchAutoLimited: boolean;
}): AiDecision {
  if (!input.hasSupplier || !input.hasAmount) {
    return {
      action: "defer",
      confidence: 0.35,
      explanation: "Missing supplier or amount in command.",
      reasonCodes: ["missing_parse_fields"],
    };
  }

  if (!input.policyAllowed) {
    return {
      action: "defer",
      confidence: 0.88,
      explanation: "Guardrail policy blocks this payout right now.",
      reasonCodes: ["policy_blocked"],
    };
  }

  if (input.requiresApproval || input.isSafeLaunchAssisted || input.safeLaunchAutoLimited) {
    return {
      action: "needs_approval",
      confidence: 0.82,
      explanation: "Command is valid but requires approval under policy or safe-launch mode.",
      reasonCodes: ["approval_required"],
    };
  }

  return {
    action: "execute",
    confidence: 0.9,
    explanation: "Command parsed and within guardrails for execution.",
    reasonCodes: ["execution_ready"],
  };
}

export async function parseOwnerCommandToIntent(input: {
  businessId: string;
  command: string;
}): Promise<AiIntentResult> {
  const business = await getBusinessById(input.businessId);
  if (!business) {
    throw new Error("business_not_found");
  }

  const [suppliers, activePolicy, spentTodayNgn, pilot] = await Promise.all([
    listSuppliers(input.businessId),
    getActivePolicy(input.businessId),
    getTodaySpentNgn(input.businessId),
    getOrCreatePilotMode(input.businessId),
  ]);

  const supplierId = inferSupplierId(input.command, suppliers);
  const amountNgn = parseAmountNgn(input.command);

  const gemini = await tryGeminiParse(input.command);
  const reason = gemini?.reason ?? input.command.slice(0, 120);

  let policyAllowed = false;
  let requiresApproval = true;

  if (activePolicy && amountNgn && supplierId) {
    const decision = evaluatePolicy({
      amountNgn,
      spentTodayNgn,
      nowUtc: new Date(),
      policy: {
        maxPerTxNgn: activePolicy.maxPerTxNgn,
        dailyCapNgn: activePolicy.dailyCapNgn,
        approvalThresholdNgn: activePolicy.approvalThresholdNgn,
        activeDaysUtc: activePolicy.activeDaysUtc,
        activeStartTimeUtc: activePolicy.activeStartTimeUtc,
        activeEndTimeUtc: activePolicy.activeEndTimeUtc,
      },
      isSupplierWhitelisted: true,
      isBusinessFrozen: business.status === "frozen",
      hasSufficientBalance: true,
    });

    policyAllowed = decision.allowed;
    requiresApproval = decision.requiresApproval;
  }

  const isSafeLaunchAssisted = business.pilotStage === "safe_launch" && pilot.mode === "assisted";
  const safeLaunchAutoLimited =
    business.pilotStage === "safe_launch" &&
    pilot.mode === "autonomous" &&
    pilot.autoExecutedCount >= pilot.maxAutoExecutions;

  const decision = decideAction({
    hasSupplier: Boolean(supplierId),
    hasAmount: Boolean(amountNgn),
    policyAllowed,
    requiresApproval,
    isSafeLaunchAssisted,
    safeLaunchAutoLimited,
  });

  const record: AiCommandRecord = {
    id: makeId("ai"),
    businessId: input.businessId,
    command: input.command,
    parsedSupplierId: supplierId,
    parsedAmountNgn: amountNgn,
    action: decision.action,
    confidence: decision.confidence,
    explanation: decision.explanation,
    createdAt: new Date().toISOString(),
  };

  const store = await readStore();
  store.aiCommands.push(record);
  await writeStore(store);

  await addActivityEvent({
    businessId: input.businessId,
    type: "ai_intent_parsed",
    message: `AI parsed owner command with action ${decision.action}.`,
    metadata: {
      commandId: record.id,
      action: decision.action,
      supplierId,
      amountNgn,
      confidence: decision.confidence,
    },
  });

  return {
    parsed: {
      supplierId,
      amountNgn,
      reason,
    },
    decision,
  };
}
