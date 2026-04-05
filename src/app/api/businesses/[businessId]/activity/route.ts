import { listActivityEvents } from "@/lib/services/activity";
import { listExecutionsByBusiness, listRetryJobsByBusiness } from "@/lib/services/execution";
import { listOwnerNotificationsByBusiness } from "@/lib/services/notifications";
import { listPayoutIntentsByBusiness } from "@/lib/services/payout-intents";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const limitRaw = new URL(request.url).searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;

  const [events, intents, executions, retryJobs, notifications] = await Promise.all([
    listActivityEvents(businessId, limit),
    listPayoutIntentsByBusiness(businessId),
    listExecutionsByBusiness(businessId),
    listRetryJobsByBusiness(businessId, limit),
    listOwnerNotificationsByBusiness(businessId, limit),
  ]);

  return NextResponse.json({
    events,
    intents: intents.slice(0, limit),
    executions: executions.slice(0, limit),
    retryJobs,
    notifications,
  });
}
