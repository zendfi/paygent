import { getEnv } from "@/lib/config/env";

type RequestOptions = {
  path: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
};

async function zendfiRequest<T>(options: RequestOptions): Promise<T> {
  const env = getEnv();
  if (env.mockZendfi) {
    throw new Error("Mock mode does not call remote ZendFi endpoint.");
  }

  if (!env.zendfiApiKey) {
    throw new Error("ZENDFI_API_KEY is not configured.");
  }

  const response = await fetch(`${env.zendfiApiBaseUrl}${options.path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${env.zendfiApiKey}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ZendFi request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export async function createSubaccount(input: {
  label: string;
  spendLimitUsdc: number;
  accessMode: "delegated" | "merchant_managed";
  yieldEnabled: boolean;
}): Promise<{ id: string; walletAddress: string }> {
  const env = getEnv();
  if (env.mockZendfi) {
    return {
      id: `sa_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
      walletAddress: `mock_wallet_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`,
    };
  }

  const response = await zendfiRequest<{
    id: string;
    wallet_address: string;
  }>({
    path: "/subaccounts",
    method: "POST",
    body: {
      label: input.label,
      spend_limit_usdc: input.spendLimitUsdc,
      access_mode: input.accessMode,
      yield_enabled: input.yieldEnabled,
    },
  });

  return {
    id: response.id,
    walletAddress: response.wallet_address,
  };
}

export async function getSubaccountBalance(subaccountId: string): Promise<{
  availableUsdc: number;
  pendingUsdc: number;
  totalUsdc: number;
}> {
  const env = getEnv();
  if (env.mockZendfi) {
    const seed = subaccountId.charCodeAt(subaccountId.length - 1) % 100;
    const availableUsdc = 100 + seed;
    const pendingUsdc = seed % 3;
    return {
      availableUsdc,
      pendingUsdc,
      totalUsdc: availableUsdc + pendingUsdc,
    };
  }

  const response = await zendfiRequest<{
    available_usdc: number;
    pending_usdc: number;
    total_usdc: number;
  }>({
    path: `/subaccounts/${subaccountId}/balance`,
    method: "GET",
  });

  return {
    availableUsdc: response.available_usdc,
    pendingUsdc: response.pending_usdc,
    totalUsdc: response.total_usdc,
  };
}

export async function createTopupPaymentLink(input: {
  amount: number;
  businessId: string;
  subAccountId: string;
}): Promise<{ id: string; url?: string }> {
  const env = getEnv();
  if (env.mockZendfi) {
    const id = `link_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    return {
      id,
      url: `${env.appUrl}/mock-checkout/${id}`,
    };
  }

  return zendfiRequest<{ id: string; url?: string }>({
    path: "/payment-links",
    method: "POST",
    body: {
      amount: input.amount,
      currency: "USD",
      token: "USDC",
      payer_service_charge: true,
      description: `Paygent top-up for ${input.businessId}`,
      onramp: true,
      split_recipients: [
        {
          recipient_type: "wallet",
          sub_account_id: input.subAccountId,
        },
      ],
    },
  });
}

export async function freezeSubaccount(subaccountId: string, reason: string): Promise<{
  success: boolean;
}> {
  const env = getEnv();
  if (env.mockZendfi) {
    return { success: true };
  }

  return zendfiRequest<{ success: boolean }>({
    path: `/subaccounts/${subaccountId}/freeze`,
    method: "POST",
    body: { reason },
  });
}

export async function unfreezeSubaccount(subaccountId: string, reason: string): Promise<{
  success: boolean;
}> {
  const env = getEnv();
  if (env.mockZendfi) {
    return { success: true };
  }

  return zendfiRequest<{ success: boolean }>({
    path: `/subaccounts/${subaccountId}/unfreeze`,
    method: "POST",
    body: { reason },
  });
}

export async function withdrawSubaccountToBank(input: {
  subaccountId: string;
  amountUsdc: number;
  bankId: string;
  accountNumber: string;
}): Promise<{
  success: boolean;
  orderId: string;
  transactionSignature?: string;
  status: string;
}> {
  const env = getEnv();
  if (env.mockZendfi) {
    return {
      success: true,
      orderId: `ord_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
      transactionSignature: `sig_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
      status: "PAID",
    };
  }

  const response = await zendfiRequest<{
    success: boolean;
    order_id: string;
    transaction_signature?: string;
    status: string;
  }>({
    path: `/subaccounts/${input.subaccountId}/withdraw-bank`,
    method: "POST",
    body: {
      amount_usdc: input.amountUsdc,
      bank_id: input.bankId,
      account_number: input.accountNumber,
      mode: "live",
    },
  });

  return {
    success: response.success,
    orderId: response.order_id,
    transactionSignature: response.transaction_signature,
    status: response.status,
  };
}

export async function getWithdrawalStatus(orderId: string): Promise<{
  status: "pending" | "completed" | "failed";
  transactionSignature?: string;
  failureReason?: string;
}> {
  const env = getEnv();
  if (env.mockZendfi) {
    const bucket = orderId.charCodeAt(orderId.length - 1) % 3;
    if (bucket === 0) {
      return {
        status: "pending",
      };
    }
    if (bucket === 1) {
      return {
        status: "completed",
        transactionSignature: `sig_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
      };
    }
    return {
      status: "failed",
      failureReason: "provider_timeout",
    };
  }

  const response = await zendfiRequest<{
    status: string;
    transaction_signature?: string;
    failure_reason?: string;
  }>({
    path: `/withdrawals/${orderId}`,
    method: "GET",
  });

  if (response.status === "completed" || response.status === "paid") {
    return {
      status: "completed",
      transactionSignature: response.transaction_signature,
    };
  }

  if (response.status === "failed") {
    return {
      status: "failed",
      failureReason: response.failure_reason ?? "provider_failed",
    };
  }

  return {
    status: "pending",
  };
}
