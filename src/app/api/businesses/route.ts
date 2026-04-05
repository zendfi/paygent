import { logAudit } from "@/lib/audit/logger";
import { createBusiness, listBusinesses } from "@/lib/services/businesses";
import { NextResponse } from "next/server";

export async function GET() {
  const businesses = await listBusinesses();
  return NextResponse.json({ businesses });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      businessType?: string;
      ownerPhone?: string;
    };

    const business = await createBusiness({
      name: body.name ?? "",
      businessType: body.businessType ?? "",
      ownerPhone: body.ownerPhone ?? "",
    });

    logAudit({
      actor: "owner",
      action: "business_created",
      result: "success",
      businessId: business.id,
      metadata: {
        name: business.name,
        businessType: business.businessType,
      },
    });

    return NextResponse.json({ success: true, business }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "business_create_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
