import { getKpiPostmortemReport } from "@/lib/services/readiness";
import { NextResponse } from "next/server";

export async function GET() {
  const report = await getKpiPostmortemReport();
  return NextResponse.json({ report });
}
