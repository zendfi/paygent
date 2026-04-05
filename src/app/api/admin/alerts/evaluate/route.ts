import { evaluateOperationalAlerts } from "@/lib/services/alerts";
import { NextResponse } from "next/server";

export async function POST() {
  const result = await evaluateOperationalAlerts();
  return NextResponse.json({
    success: true,
    ...result,
  });
}
