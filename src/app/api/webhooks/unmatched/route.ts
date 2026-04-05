import { listUnmatchedWebhookEvents } from "@/lib/services/webhooks";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const limitRaw = new URL(request.url).searchParams.get("limit");
  const parsed = limitRaw ? Number(limitRaw) : 50;
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;

  const events = await listUnmatchedWebhookEvents(limit);

  return NextResponse.json({
    count: events.length,
    events,
  });
}
