import { logAudit } from "@/lib/audit/logger";
import { createSupplier, listSuppliers } from "@/lib/services/suppliers";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  const suppliers = await listSuppliers(businessId);
  return NextResponse.json({ suppliers });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const body = (await request.json()) as {
      supplierName?: string;
      bankId?: string;
      accountNumber?: string;
      accountName?: string;
    };

    const supplier = await createSupplier({
      businessId,
      supplierName: body.supplierName ?? "",
      bankId: body.bankId ?? "",
      accountNumber: body.accountNumber ?? "",
      accountName: body.accountName ?? "",
    });

    logAudit({
      actor: "owner",
      action: "supplier_created",
      result: "success",
      businessId,
      metadata: {
        supplierId: supplier.id,
        bankId: supplier.bankId,
      },
    });

    return NextResponse.json({ success: true, supplier }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "supplier_create_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
