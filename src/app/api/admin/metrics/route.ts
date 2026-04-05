import { getMetricsDashboard } from "@/lib/services/metrics-sla";
import { NextResponse } from "next/server";

export async function GET() {
  const metrics = await getMetricsDashboard();
  return NextResponse.json({ metrics });
}
