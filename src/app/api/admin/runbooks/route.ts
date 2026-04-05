import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    runbooks: [
      {
        key: "webhook_delivery_incident",
        title: "Webhook Delivery Incident",
        summary: "Handle spike in ignored/invalid webhook events and replay affected executions.",
        steps: [
          "Check /api/webhooks/unmatched for event drift.",
          "Run /api/reconciliation/run and /api/retries/run.",
          "Trigger /api/admin/alerts/evaluate and confirm alert reduction.",
        ],
      },
      {
        key: "credential_rotation",
        title: "Credential Rotation Workflow",
        summary: "Request, rotate, and close owner/API/webhook secret credentials.",
        steps: [
          "Create rotation request via /api/admin/credentials/rotations.",
          "Perform secret rotation in deployment environment.",
          "Complete workflow via /api/admin/credentials/rotations/:id/complete.",
        ],
      },
      {
        key: "sla_degradation",
        title: "SLA Degradation Response",
        summary: "Respond to degraded/critical SLA checks.",
        steps: [
          "Fetch /api/admin/sla and inspect failing checks.",
          "Run /api/admin/load-check to validate local bottlenecks.",
          "Escalate if execution success or webhook rates remain below objective.",
        ],
      },
    ],
  });
}
