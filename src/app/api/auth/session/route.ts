import { getEnv } from "@/lib/config/env";
import { NextResponse } from "next/server";

const OWNER_SESSION_COOKIE = "paygent_owner_session";
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export async function GET(request: Request) {
  const env = getEnv();
  const cookieHeader = request.headers.get("cookie") ?? "";
  const tokenMatch = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((part) => part.startsWith(`${OWNER_SESSION_COOKIE}=`));

  const cookieToken = tokenMatch?.split("=").slice(1).join("=");
  const authenticated = Boolean(env.ownerApiToken && cookieToken === env.ownerApiToken);

  return NextResponse.json({ authenticated });
}

export async function POST(request: Request) {
  const env = getEnv();

  if (!env.ownerApiToken) {
    return NextResponse.json(
      {
        error: "owner_auth_not_configured",
        message: "PAYGENT_OWNER_API_TOKEN is not configured.",
      },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { token?: string };
  if (!body.token || body.token !== env.ownerApiToken) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Invalid owner token.",
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ success: true, authenticated: true });
  response.cookies.set(OWNER_SESSION_COOKIE, env.ownerApiToken, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, authenticated: false });
  response.cookies.set(OWNER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
