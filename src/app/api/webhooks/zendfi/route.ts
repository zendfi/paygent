import { logAudit } from "@/lib/audit/logger";
import { processZendfiWebhook } from "@/lib/services/webhooks";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-zendfi-signature");

    const result = await processZendfiWebhook({
      rawBody,
      signatureHeader,
      headers: request.headers,
    });

    logAudit({
      actor: "system",
      action: "zendfi_webhook_processed",
      result: result.ok ? "success" : "failure",
      metadata: {
        eventId: result.eventId,
        eventType: result.eventType,
        duplicate: result.duplicate,
        matchedExecutionId: result.matchedExecutionId,
        message: result.message,
      },
    });

    return NextResponse.json(
      {
        ok: result.ok,
        duplicate: result.duplicate,
        eventId: result.eventId,
        eventType: result.eventType,
        matchedExecutionId: result.matchedExecutionId,
        message: result.message,
      },
      { status: result.httpStatus },
    );
  } catch (error) {
    logAudit({
      actor: "system",
      action: "zendfi_webhook_processed",
      result: "failure",
      metadata: {
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: "webhook_processing_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
