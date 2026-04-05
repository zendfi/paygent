import { getEnv } from "@/lib/config/env";
import { getPostgresHealth } from "@/lib/storage/postgres";
import { NextResponse } from "next/server";

export async function GET() {
  const env = getEnv();
  const storage = {
    backend: env.storageBackend,
    postgres: env.storageBackend === "postgres" ? await getPostgresHealth() : null,
  };

  const status =
    storage.backend === "postgres" && storage.postgres && !storage.postgres.ok
      ? "degraded"
      : "ok";

  return NextResponse.json({
    status,
    service: "paygent",
    environment: env.nodeEnv,
    storage,
    timestamp: new Date().toISOString(),
  });
}
