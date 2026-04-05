import { getLaunchRecommendation } from "@/lib/services/week8-readiness";
import { NextResponse } from "next/server";

export async function GET() {
  const recommendation = await getLaunchRecommendation();
  return NextResponse.json({ recommendation });
}
