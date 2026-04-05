import { getActivePolicy } from "@/lib/services/policies";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const policy = await getActivePolicy(businessId);

  if (!policy) {
    return NextResponse.json({ error: "active_policy_not_found" }, { status: 404 });
  }

  return NextResponse.json({ policy });
}
