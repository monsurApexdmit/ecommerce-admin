export interface Category {
  id: number;
  categoryName: string;
  parentId: number | null;
  status: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Vendor {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: string;
  status?: string;
  description?: string;
}

export interface Warehouse {
  id: number;
  name: string;
  address: string;
  contactPerson?: string | null;
  isDefault: boolean;
}

export interface Attribute {
  id: number;
  name: string;
  displayName: string;
  optionType: "dropdown" | "radio" | "text";
  values: string[];
  status: boolean;
}
