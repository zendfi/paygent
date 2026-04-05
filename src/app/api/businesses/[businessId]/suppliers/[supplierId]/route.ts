import { deleteSupplier, getSupplierById } from "@/lib/services/suppliers";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; supplierId: string }> },
) {
  const { businessId, supplierId } = await params;
  const supplier = await getSupplierById(businessId, supplierId);

  if (!supplier) {
    return NextResponse.json({ error: "supplier_not_found" }, { status: 404 });
  }

  return NextResponse.json({ supplier });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; supplierId: string }> },
) {
  try {
    const { businessId, supplierId } = await params;
    await deleteSupplier(businessId, supplierId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "supplier_delete_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 400 },
    );
  }
}
