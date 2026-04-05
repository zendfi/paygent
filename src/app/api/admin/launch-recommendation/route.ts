import { getLaunchRecommendation } from "@/lib/services/readiness";
import { NextResponse } from "next/server";

export async function GET() {
  const recommendation = await getLaunchRecommendation();
  return NextResponse.json({ recommendation });
}
