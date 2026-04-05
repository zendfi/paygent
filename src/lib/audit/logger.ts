import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export type AuditRecord = {
  at: string;
  actor: string;
  action: string;
  result: "success" | "failure";
  businessId?: string;
  reasonCodes?: string[];
  metadata?: Record<string, unknown>;
};

export type AuditRecordInput = Omit<AuditRecord, "at">;

const AUDIT_DIRECTORY = path.join(process.cwd(), "data");
const AUDIT_LOG_FILE = path.join(AUDIT_DIRECTORY, "audit-log.ndjson");

function ensureAuditDirectory(): void {
  mkdirSync(AUDIT_DIRECTORY, { recursive: true });
}

export function logAudit(record: AuditRecordInput): void {
  const payload = {
    at: new Date().toISOString(),
    ...record,
  } satisfies AuditRecord;

  console.info("[paygent-audit]", JSON.stringify(payload));

  try {
    ensureAuditDirectory();
    appendFileSync(AUDIT_LOG_FILE, `${JSON.stringify(payload)}\n`, "utf8");
  } catch (error) {
    console.error(
      "[paygent-audit-error]",
      error instanceof Error ? error.message : "failed_to_persist_audit_record",
    );
  }
}

export function getAuditLogFilePath(): string {
  return AUDIT_LOG_FILE;
}
