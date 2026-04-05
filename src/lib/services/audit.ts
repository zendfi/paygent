import { existsSync, readFileSync } from "node:fs";
import { getAuditLogFilePath, type AuditRecord } from "@/lib/audit/logger";

type ListAuditRecordsInput = {
  limit?: number;
  businessId?: string;
  action?: string;
  result?: "success" | "failure";
};

export function listAuditRecords(input?: ListAuditRecordsInput): AuditRecord[] {
  const filePath = getAuditLogFilePath();
  if (!existsSync(filePath)) {
    return [];
  }

  const limit = input?.limit && input.limit > 0 ? input.limit : 100;
  const raw = readFileSync(filePath, "utf8");
  const rows = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const parsed: AuditRecord[] = [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    try {
      const record = JSON.parse(rows[i] as string) as AuditRecord;
      if (input?.businessId && record.businessId !== input.businessId) {
        continue;
      }
      if (input?.action && record.action !== input.action) {
        continue;
      }
      if (input?.result && record.result !== input.result) {
        continue;
      }

      parsed.push(record);
      if (parsed.length >= limit) {
        break;
      }
    } catch {
      // Skip malformed rows to keep audit list endpoint resilient.
    }
  }

  return parsed;
}
