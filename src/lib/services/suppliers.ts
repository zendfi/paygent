import { readStore, writeStore } from "@/lib/storage/store";
import type { Supplier } from "@/lib/storage/types";

type CreateSupplierInput = {
  businessId: string;
  supplierName: string;
  bankId: string;
  accountNumber: string;
  accountName: string;
};

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function listSuppliers(businessId: string): Promise<Supplier[]> {
  const store = await readStore();
  return store.suppliers.filter((supplier) => supplier.businessId === businessId);
}

export async function getSupplierById(
  businessId: string,
  supplierId: string,
): Promise<Supplier | undefined> {
  const store = await readStore();
  return store.suppliers.find(
    (supplier) => supplier.businessId === businessId && supplier.id === supplierId,
  );
}

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  if (
    !input.businessId ||
    !input.supplierName ||
    !input.bankId ||
    !input.accountNumber ||
    !input.accountName
  ) {
    throw new Error("missing_required_supplier_fields");
  }

  const store = await readStore();

  const businessExists = store.businesses.some((business) => business.id === input.businessId);
  if (!businessExists) {
    throw new Error("business_not_found");
  }

  const duplicate = store.suppliers.find(
    (supplier) =>
      supplier.businessId === input.businessId &&
      supplier.bankId.toLowerCase() === input.bankId.toLowerCase() &&
      supplier.accountNumber === input.accountNumber,
  );

  if (duplicate) {
    throw new Error("duplicate_supplier_bank_account");
  }

  const timestamp = nowIso();
  const supplier: Supplier = {
    id: makeId("sup"),
    businessId: input.businessId,
    supplierName: input.supplierName,
    bankId: input.bankId,
    accountNumber: input.accountNumber,
    accountName: input.accountName,
    enabled: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.suppliers.push(supplier);
  await writeStore(store);

  return supplier;
}

export async function deleteSupplier(
  businessId: string,
  supplierId: string,
): Promise<{ success: boolean }> {
  const store = await readStore();
  const index = store.suppliers.findIndex(
    (supplier) => supplier.businessId === businessId && supplier.id === supplierId,
  );

  if (index === -1) {
    throw new Error("supplier_not_found");
  }

  store.suppliers.splice(index, 1);
  await writeStore(store);

  return { success: true };
}
