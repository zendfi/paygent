type NodeEnv = "development" | "test" | "production";
type StorageBackend = "file" | "postgres";

export type PaygentEnv = {
  nodeEnv: NodeEnv;
  storageBackend: StorageBackend;
  databaseUrl?: string;
  authSessionSecret?: string;
  appUrl: string;
  ownerApiToken?: string;
  zendfiApiBaseUrl: string;
  zendfiApiKey?: string;
  zendfiWebhookSecret?: string;
  zendfiWebhookToleranceSeconds: number;
  geminiApiKey?: string;
  smsWebhookUrl?: string;
  smsWebhookAuthToken?: string;
  trustRampApprovalThresholdNgn: number;
  signingGrantTtlSeconds: number;
  signingGrantMaxUses: number;
  mockZendfi: boolean;
};

function readNumberEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  const normalized = value.toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function readNodeEnv(): NodeEnv {
  const env = process.env.NODE_ENV;
  if (env === "production" || env === "test" || env === "development") {
    return env;
  }
  return "development";
}

function readStorageBackend(): StorageBackend {
  return process.env.PAYGENT_STORAGE_BACKEND === "postgres" ? "postgres" : "file";
}

function validateProductionEnv(env: PaygentEnv): void {
  if (env.nodeEnv !== "production") {
    return;
  }

  if (!env.ownerApiToken) {
    throw new Error("PAYGENT_OWNER_API_TOKEN is required in production");
  }

  if (!env.mockZendfi && !env.zendfiApiKey) {
    throw new Error("ZENDFI_API_KEY is required when MOCK_ZENDFI=false");
  }

  if (!env.mockZendfi && !env.zendfiWebhookSecret) {
    throw new Error("ZENDFI_WEBHOOK_SECRET is required when MOCK_ZENDFI=false");
  }

  if (env.storageBackend === "postgres" && !env.databaseUrl) {
    throw new Error("DATABASE_URL is required when PAYGENT_STORAGE_BACKEND=postgres");
  }

  if (!env.authSessionSecret) {
    throw new Error("PAYGENT_AUTH_SESSION_SECRET is required in production");
  }
}

export function getEnv(): PaygentEnv {
  const nodeEnv = readNodeEnv();
  const env: PaygentEnv = {
    nodeEnv,
    storageBackend: readStorageBackend(),
    databaseUrl: process.env.DATABASE_URL,
    authSessionSecret: process.env.PAYGENT_AUTH_SESSION_SECRET,
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
    ownerApiToken: process.env.PAYGENT_OWNER_API_TOKEN,
    zendfiApiBaseUrl: process.env.ZENDFI_API_BASE_URL ?? "https://api.zendfi.tech/api/v1",
    zendfiApiKey: process.env.ZENDFI_API_KEY,
    zendfiWebhookSecret: process.env.ZENDFI_WEBHOOK_SECRET,
    zendfiWebhookToleranceSeconds: readNumberEnv(process.env.ZENDFI_WEBHOOK_TOLERANCE_SECONDS, 300),
    geminiApiKey: process.env.GEMINI_API_KEY,
    smsWebhookUrl: process.env.PAYGENT_SMS_WEBHOOK_URL,
    smsWebhookAuthToken: process.env.PAYGENT_SMS_WEBHOOK_AUTH_TOKEN,
    trustRampApprovalThresholdNgn: readNumberEnv(
      process.env.PAYGENT_TRUST_RAMP_APPROVAL_THRESHOLD_NGN,
      25000,
    ),
    signingGrantTtlSeconds: readNumberEnv(process.env.PAYGENT_SIGNING_GRANT_TTL_SECONDS, 2_592_000),
    signingGrantMaxUses: readNumberEnv(process.env.PAYGENT_SIGNING_GRANT_MAX_USES, 5_000),
    mockZendfi: readBooleanEnv(process.env.MOCK_ZENDFI, nodeEnv !== "production"),
  };

  validateProductionEnv(env);
  return env;
}
