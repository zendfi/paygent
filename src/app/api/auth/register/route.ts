import { errorResponse, unknownErrorToApiPayload } from "@/lib/http/errors";
import { registerOwnerUser } from "@/lib/services/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };

    const user = await registerOwnerUser({
      email: body.email ?? "",
      password: body.password ?? "",
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    return errorResponse(400, unknownErrorToApiPayload(error, "register_failed"));
  }
}
