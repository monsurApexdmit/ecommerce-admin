import type { ProductAttributeSelection, ProductVariant } from "@/types/product";

function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];

  return arrays.reduce<T[][]>(
    (accumulator, current) =>
      accumulator.flatMap((entry) => current.map((item) => [...entry, item])),
    [[]],
  );
}

export function generateBarcodeCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const random = (length: number) =>
    Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  return `PROD-${random(8)}-${random(4)}`;
}

export function generateProductSku() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const random = (length: number) =>
    Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  return `SKU-${random(8)}`;
}

export function generateVariantDrafts(input: {
  attributes: ProductAttributeSelection[];
  basePrice: number;
  baseSalePrice: number;
  baseOfferPrice?: number;
  baseOfferType?: string;
  totalStock: number;
  baseSku?: string;
  locationId?: number;
}) {
  const active = input.attributes.filter((attribute) =>
    Array.isArray(attribute.value) ? attribute.value.length > 0 : Boolean(attribute.value),
  );

  if (active.length === 0) return [] as ProductVariant[];

  const combinations = cartesian(
    active.map((attribute) => (Array.isArray(attribute.value) ? attribute.value : [attribute.value])),
  );
  const baseStock = combinations.length > 0 ? Math.floor(input.totalStock / combinations.length) : 0;

  return combinations.map((combination, index) => {
    const attributes = combination.reduce<Record<string, string>>((record, value, comboIndex) => {
      record[active[comboIndex].name] = value;
      return record;
    }, {});

    const skuSuffix = combination.map((value) => value.slice(0, 2).toUpperCase()).join("-");

    return {
      id: `variant-${Date.now()}-${index}`,
      name: combination.join(" / "),
      attributes,
      price: input.basePrice,
      salePrice: input.baseSalePrice,
      offerPrice: input.baseOfferPrice,
      offerType: input.baseOfferType,
      stock: baseStock,
      sku: input.baseSku ? `${input.baseSku}-${skuSuffix}` : skuSuffix,
      barcode: generateBarcodeCode(),
      inventory: input.locationId
        ? [{ warehouseId: input.locationId, quantity: baseStock }]
        : [],
    };
  });
}
