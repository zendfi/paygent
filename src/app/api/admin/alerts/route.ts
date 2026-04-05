import { listAlerts } from "@/lib/services/alerts";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 100;
  const alerts = await listAlerts(limit);
  return NextResponse.json({
    count: alerts.length,
    alerts,
  });
}
