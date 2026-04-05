import { getPayoutIntentById } from "@/lib/services/payout-intents";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ intentId: string }> },
) {
  const { intentId } = await params;
  const intent = await getPayoutIntentById(intentId);

  if (!intent) {
    return NextResponse.json({ error: "intent_not_found" }, { status: 404 });
  }

  return NextResponse.json({ intent });
}
