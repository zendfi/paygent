import { getKpiPostmortemReport } from "@/lib/services/week8-readiness";
import { NextResponse } from "next/server";

export async function GET() {
  const report = await getKpiPostmortemReport();
  return NextResponse.json({ report });
}
