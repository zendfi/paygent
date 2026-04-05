import { listAuditRecords } from "@/lib/services/audit";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId") ?? undefined;
  const action = url.searchParams.get("action") ?? undefined;

  const resultParam = url.searchParams.get("result");
  const result =
    resultParam === "success" || resultParam === "failure"
      ? resultParam
      : undefined;

  const limitParam = Number(url.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 100;

  const records = listAuditRecords({
    businessId,
    action,
    result,
    limit,
  });

  return NextResponse.json({
    count: records.length,
    records,
  });
}
