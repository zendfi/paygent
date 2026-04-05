import { getPilotChecklist } from "@/lib/services/readiness";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const targetRaw = Number(new URL(request.url).searchParams.get("targetCount") ?? 3);
  const targetCount = Number.isFinite(targetRaw) && targetRaw > 0 ? targetRaw : 3;
  const checklist = await getPilotChecklist(targetCount);

  return NextResponse.json({ checklist });
}
