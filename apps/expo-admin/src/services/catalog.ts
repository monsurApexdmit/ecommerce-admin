import { api } from "@/lib/api";
import type { Attribute, Category, Vendor, Warehouse } from "@/types/catalog";

type CategoryResponse = {
  id: number;
  categoryName?: string;
  category_name?: string;
  parentId?: number | null;
  parent_id?: number | null;
  status: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type VendorResponse = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: string;
  status?: string;
  description?: string;
};

type WarehouseResponse = {
  id: number;
  name: string;
  address: string;
  contactPerson?: string | null;
  contact_person?: string | null;
  isDefault?: boolean;
  is_default?: boolean;
};

type AttributeResponse = {
  id: number;
  name: string;
  displayName?: string;
  display_name?: string;
  optionType?: string;
  option_type?: string;
  values?: string;
  status: boolean;
};

function normalizeCategory(category: CategoryResponse): Category {
  return {
    id: category.id,
    categoryName: category.categoryName ?? category.category_name ?? "",
    parentId: category.parentId ?? category.parent_id ?? null,
    status: category.status,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function normalizeVendor(vendor: VendorResponse): Vendor {
  return {
    id: vendor.id,
    name: vendor.name,
    email: vendor.email,
    phone: vendor.phone,
    address: vendor.address,
    logo: vendor.logo,
    status: vendor.status,
    description: vendor.description,
  };
}

function normalizeWarehouse(location: WarehouseResponse): Warehouse {
  return {
    id: location.id,
    name: location.name,
    address: location.address,
    contactPerson: location.contactPerson ?? location.contact_person ?? null,
    isDefault: Boolean(location.isDefault ?? location.is_default),
  };
}

function normalizeAttribute(attribute: AttributeResponse): Attribute {
  const optionType = attribute.optionType ?? attribute.option_type ?? "dropdown";
  return {
    id: attribute.id,
    name: attribute.name,
    displayName: attribute.displayName ?? attribute.display_name ?? attribute.name,
    optionType: optionType as Attribute["optionType"],
    values: attribute.values
      ? attribute.values
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
    status: attribute.status,
  };
}

export async function getCategories() {
  const response = await api.get("/categories/", {
    params: {
      view: "flat",
      include_inactive: true,
      limit: 100,
    },
  });

  const payload = response.data?.data;
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  return items.map(normalizeCategory);
}

export async function getVendors() {
  const response = await api.get("/vendors/", {
    params: { limit: 100 },
  });

  const payload = response.data?.data;
  const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  return items.map(normalizeVendor);
}

export async function getWarehouses() {
  const response = await api.get("/locations");
  const payload = response.data?.data;
  const items = Array.isArray(payload) ? payload : [];
  return items.map(normalizeWarehouse);
}

export async function getAttributes() {
  const response = await api.get("/attributes/", {
    params: { limit: 200 },
  });

  const payload = response.data?.data;
  const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  return items.map(normalizeAttribute);
}
