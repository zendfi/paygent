import { OWNER_SESSION_COOKIE } from "@/lib/auth/session";
import { getEnv } from "@/lib/config/env";
import { errorResponse, unknownErrorToApiPayload } from "@/lib/http/errors";
import { authenticateOwnerUser } from "@/lib/services/auth";
import { NextResponse } from "next/server";

const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export async function POST(request: Request) {
  try {
    const env = getEnv();
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    const result = await authenticateOwnerUser({
      email: body.email ?? "",
      password: body.password ?? "",
    });

    const response = NextResponse.json({
      success: true,
      authenticated: true,
      session: { email: result.email },
    });

    response.cookies.set(OWNER_SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    return errorResponse(401, unknownErrorToApiPayload(error, "login_failed"));
  }
}
