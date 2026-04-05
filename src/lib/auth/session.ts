const SESSION_TTL_SECONDS = 12 * 60 * 60;

export const OWNER_SESSION_COOKIE = "paygent_owner_session";

type SessionPayload = {
  email: string;
  exp: number;
};

function getSessionSecret(): string {
  return process.env.PAYGENT_AUTH_SESSION_SECRET || process.env.PAYGENT_OWNER_API_TOKEN || "";
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toHex(signature);
}

export async function createSessionToken(email: string): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("session_secret_not_configured");
  }

  const normalizedEmail = encodeURIComponent(email.trim().toLowerCase());
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${normalizedEmail}.${exp}`;
  const signature = await sign(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const secret = getSessionSecret();
  if (!secret || !token) {
    return null;
  }

  const [normalizedEmail, expRaw, signature] = token.split(".");
  if (!normalizedEmail || !expRaw || !signature) {
    return null;
  }

  const payload = `${normalizedEmail}.${expRaw}`;
  const expectedSignature = await sign(payload, secret);
  if (expectedSignature !== signature) {
    return null;
  }

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return {
    email: decodeURIComponent(normalizedEmail),
    exp,
  };
}
