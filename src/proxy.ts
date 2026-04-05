import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/api/health", "/api/webhooks/zendfi", "/api/auth/session"];
const OWNER_SESSION_COOKIE = "paygent_owner_session";

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function readBearerToken(request: NextRequest): string | undefined {
  const auth = request.headers.get("authorization");
  if (!auth) {
    return undefined;
  }

  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}

function readSessionToken(request: NextRequest): string | undefined {
  const value = request.cookies.get(OWNER_SESSION_COOKIE)?.value;
  return value || undefined;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  const expectedToken = process.env.PAYGENT_OWNER_API_TOKEN;
  if (!expectedToken) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error: "owner_auth_not_configured",
          message: "PAYGENT_OWNER_API_TOKEN must be configured in production.",
        },
        { status: 500 },
      );
    }

    return NextResponse.next();
  }

  const bearerToken = readBearerToken(request);
  const sessionToken = readSessionToken(request);
  const authorized = bearerToken === expectedToken || sessionToken === expectedToken;

  if (!authorized) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Missing or invalid owner bearer token.",
      },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Bearer realm="paygent-owner"',
        },
      },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
