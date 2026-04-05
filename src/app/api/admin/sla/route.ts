import { getSlaSummary } from "@/lib/services/metrics-sla";
import { NextResponse } from "next/server";

export async function GET() {
  const sla = await getSlaSummary();
  return NextResponse.json({ sla });
}
