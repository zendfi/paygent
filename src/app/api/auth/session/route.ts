import { OWNER_SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const tokenMatch = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((part) => part.startsWith(`${OWNER_SESSION_COOKIE}=`));

  const cookieToken = tokenMatch?.split("=").slice(1).join("=");
  const session = cookieToken ? await verifySessionToken(cookieToken) : null;
  const authenticated = Boolean(session);

  return NextResponse.json({
    authenticated,
    session: session ? { email: session.email, expiresAtUnix: session.exp } : null,
  });
}
