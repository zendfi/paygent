import { NextResponse } from "next/server";

export type ApiErrorPayload = {
  error: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
};

export function createRequestId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 16);
}

export function errorResponse(
  status: number,
  payload: ApiErrorPayload,
): NextResponse<ApiErrorPayload> {
  return NextResponse.json(payload, { status });
}

export function unknownErrorToApiPayload(
  error: unknown,
  fallbackErrorCode: string,
  fallbackMessage = "unknown_error",
): ApiErrorPayload {
  if (error instanceof Error) {
    return {
      error: fallbackErrorCode,
      message: error.message || fallbackMessage,
    };
  }

  return {
    error: fallbackErrorCode,
    message: fallbackMessage,
  };
}
