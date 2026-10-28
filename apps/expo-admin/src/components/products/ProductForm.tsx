import { useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { buildProductFileAsset, createProduct, getProducts, updateProduct } from "@/services/products";
import { getAttributes, getCategories, getVendors, getWarehouses } from "@/services/catalog";
import { useCurrency } from "@/context/CurrencyContext";
import { generateBarcodeCode, generateProductSku, generateVariantDrafts } from "@/lib/variants";
import { getImageUrl } from "@/lib/images";
import type { Attribute, Category, Vendor, Warehouse } from "@/types/catalog";
import type {
  BundleItem,
  Product,
  ProductAttributeSelection,
  ProductDraft,
  ProductFileAsset,
  ProductVariant,
} from "@/types/product";
import { PickerField } from "./PickerField";
import { ProductStatusPill } from "./ProductStatusPill";

type ProductFormProps = {
  product?: Product | null;
  onSaved: (product: Product) => void;
  onCancel?: () => void;
};

type FormState = {
  name: string;
  description: string;
  category: string;
  categoryId: string;
  vendorId: string;
  locationId: string;
  price: string;
  salePrice: string;
  offerPrice: string;
  offerType: string;
  costPrice: string;
  profitMargin: string;
  marginType: string;
  stock: string;
  reorderPoint: string;
  sku: string;
  barcode: string;
  receiptNumber: string;
  published: boolean;
  availableInPos: boolean;
  visibleOnline: boolean;
  tag: string;
  isHotDeal: boolean;
  isBestSeller: boolean;
  isFeatured: boolean;
  dealLabel: string;
};

function getInitialForm(product?: Product | null): FormState {
  if (!product) {
    return {
      name: "",
      description: "",
      category: "",
      categoryId: "",
      vendorId: "",
      locationId: "",
      price: "",
      salePrice: "",
      offerPrice: "",
      offerType: "percentage",
      costPrice: "",
      profitMargin: "",
      marginType: "percentage",
      stock: "",
      reorderPoint: "",
      sku: generateProductSku(),
      barcode: generateBarcodeCode(),
      receiptNumber: "",
      published: true,
      availableInPos: true,
      visibleOnline: true,
      tag: "",
      isHotDeal: false,
      isBestSeller: false,
      isFeatured: false,
      dealLabel: "",
    };
  }

  // One selling price (price = salePrice, like the web form). Older products may have a price
  // that cost + margin does not reproduce: express it as a flat margin so nothing changes on save.
  const selling = product.salePrice > 0 ? product.salePrice : product.price;
  const cost = product.costPrice ?? 0;
  const marginValue = product.profitMargin ?? 0;
  const marginKind = product.marginType ?? "percentage";
  const derived = marginKind === "flat" ? cost + marginValue : cost * (1 + marginValue / 100);
  const keepMargin = !(selling > 0 && Math.abs(derived - selling) > 0.01);
  const flatMargin = Math.round((selling - cost) * 100) / 100;

  return {
    name: product.name,
    description: product.description,
    category: product.category,
    categoryId: product.categoryId ? String(product.categoryId) : "",
    vendorId: product.vendorId ? String(product.vendorId) : "",
    locationId: product.locationId ? String(product.locationId) : "",
    price: selling ? String(selling) : "",
    salePrice: selling ? String(selling) : "",
    offerPrice: product.offerPrice ? String(product.offerPrice) : "",
    offerType: product.offerType ?? "percentage",
    costPrice: product.costPrice ? String(product.costPrice) : "",
    profitMargin: keepMargin
      ? (marginValue ? String(marginValue) : "")
      : flatMargin > 0 ? String(flatMargin) : "",
    marginType: keepMargin ? marginKind : flatMargin > 0 ? "flat" : marginKind,
    stock: String(product.stock),
    reorderPoint: product.reorderPoint !== undefined ? String(product.reorderPoint) : "",
    sku: product.sku ?? "",
    barcode: product.barcode ?? generateBarcodeCode(),
    receiptNumber: product.receiptNumber ?? "",
    published: product.published,
    availableInPos: product.availableInPos ?? true,
    visibleOnline: product.visibleOnline ?? true,
    tag: product.tag ?? "",
    isHotDeal: Boolean(product.isHotDeal),
    isBestSeller: Boolean(product.isBestSeller),
    isFeatured: Boolean(product.isFeatured),
    dealLabel: product.dealLabel ?? "",
  };
}

export function ProductForm({ product, onSaved, onCancel }: ProductFormProps) {
  const { currency, formatCurrency } = useCurrency();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<FormState>(() => getInitialForm(product));
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>(
    product?.attributes.map((attribute) => attribute.id) ?? [],
  );
  const [productAttributes, setProductAttributes] = useState<ProductAttributeSelection[]>(
    product?.attributes ?? [],
  );
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants ?? []);
  const [existingImages, setExistingImages] = useState(product?.images ?? []);
  const [localImages, setLocalImages] = useState<ProductFileAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(Boolean(product?.sku));
  const [isBundle, setIsBundle] = useState(Boolean(product?.isBundle));
  const [bundlePriceOverride, setBundlePriceOverride] = useState(
    product?.bundlePriceOverride ? String(product.bundlePriceOverride) : "",
  );
  const [bundleItems, setBundleItems] = useState<BundleItem[]>(product?.bundleItems ?? []);
  const [bundleSearch, setBundleSearch] = useState("");
  const [bundleSearchResults, setBundleSearchResults] = useState<Product[]>([]);
  const [bundleSearchLoading, setBundleSearchLoading] = useState(false);

  useEffect(() => {
    setForm(getInitialForm(product));
    setSelectedAttributeIds(product?.attributes.map((attribute) => attribute.id) ?? []);
    setProductAttributes(product?.attributes ?? []);
    setVariants(product?.variants ?? []);
    setExistingImages(product?.images ?? []);
    setLocalImages([]);
    setSkuManuallyEdited(Boolean(product?.sku));
    setIsBundle(Boolean(product?.isBundle));
    setBundlePriceOverride(product?.bundlePriceOverride ? String(product.bundlePriceOverride) : "");
    setBundleItems(product?.bundleItems ?? []);
  }, [product]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        setLoading(true);
        const [nextCategories, nextVendors, nextWarehouses, nextAttributes] =
          await Promise.all([
            getCategories(),
            getVendors(),
            getWarehouses(),
            getAttributes(),
          ]);

        setCategories(nextCategories);
        setVendors(nextVendors);
        setWarehouses(nextWarehouses);
        setAttributes(nextAttributes);

        if (!product && nextWarehouses.length > 0 && !form.locationId) {
          const defaultWarehouse =
            nextWarehouses.find((warehouse) => warehouse.isDefault) ?? nextWarehouses[0];
          setForm((current) => ({
            ...current,
            locationId: String(defaultWarehouse.id),
          }));
        }
      } catch (nextError: any) {
        setError(nextError?.message ?? "Failed to load product form data");
      } finally {
        setLoading(false);
      }
    };

    void loadLookups();
  }, []);

  // Selling price follows cost + margin (as on the web) — recalculated only when the user edits
  // cost/margin, so opening an existing product never rewrites its saved price.
  const updatePricing = (patch: Partial<Pick<FormState, "costPrice" | "profitMargin" | "marginType">>) => {
    setForm((current) => {
      const next = { ...current, ...patch };
      const cost = Number(next.costPrice);
      const margin = Number(next.profitMargin);
      if (next.costPrice.trim() === "" || !Number.isFinite(cost) || !Number.isFinite(margin) || cost < 0 || margin < 0) {
        return next;
      }
      const sale = next.marginType === "flat" ? cost + margin : cost + (cost * margin) / 100;
      if (!Number.isFinite(sale) || sale <= 0) return next;
      const fixed = (Math.round(sale * 100) / 100).toFixed(2);
      return { ...next, salePrice: fixed, price: fixed };
    });
  };

  // Editing the selling price directly keeps the margin in sync with it.
  const updateSellingPrice = (value: string) => {
    setForm((current) => {
      const next = { ...current, salePrice: value, price: value };
      const sale = Number(value);
      const cost = Number(current.costPrice);
      if (!value.trim() || !Number.isFinite(sale) || !Number.isFinite(cost) || cost <= 0) return next;
      const margin = current.marginType === "flat" ? sale - cost : ((sale - cost) / cost) * 100;
      return { ...next, profitMargin: margin >= 0 ? String(Math.round(margin * 100) / 100) : "" };
    });
  };

  useEffect(() => {
    if (variants.length === 0) return;

    const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
    setForm((current) => ({ ...current, stock: String(totalStock) }));
  }, [variants]);

  useEffect(() => {
    if (product || skuManuallyEdited) return;
    setForm((current) => ({
      ...current,
      sku: generateProductSku(),
    }));
  }, [product, skuManuallyEdited]);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: category.parentId ? `└ ${category.categoryName}` : category.categoryName,
      })),
    [categories],
  );
  const vendorOptions = useMemo(
    () => vendors.map((vendor) => ({ value: String(vendor.id), label: vendor.name })),
    [vendors],
  );
  const warehouseOptions = useMemo(
    () =>
      warehouses.map((warehouse) => ({
        value: String(warehouse.id),
        label: warehouse.name,
      })),
    [warehouses],
  );

  const imagePreviews = useMemo(
    () => [
      ...existingImages.map((image) => ({ key: `existing-${image.path}`, uri: getImageUrl(image.path), existing: true, path: image.path })),
      ...localImages.map((image) => ({ key: `local-${image.uri}`, uri: image.uri, existing: false, path: image.uri })),
    ],
    [existingImages, localImages],
  );

  const setField = (field: keyof FormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleAttribute = (attribute: Attribute) => {
    const id = String(attribute.id);
    const isSelected = selectedAttributeIds.includes(id);

    if (isSelected) {
      setSelectedAttributeIds((current) => current.filter((item) => item !== id));
      setProductAttributes((current) => current.filter((item) => item.id !== id));
      setVariants((current) =>
        current.filter((variant) => !Object.prototype.hasOwnProperty.call(variant.attributes, attribute.name)),
      );
      return;
    }

    setSelectedAttributeIds((current) => [...current, id]);
    setProductAttributes((current) => [
      ...current,
      {
        id,
        name: attribute.name,
        value: [],
      },
    ]);
  };

  const updateAttributeValues = (attributeId: string, value: string | string[]) => {
    setProductAttributes((current) =>
      current.map((attribute) =>
        attribute.id === attributeId ? { ...attribute, value } : attribute,
      ),
    );
  };

  const searchBundleProducts = async (query: string) => {
    setBundleSearch(query);
    if (!query.trim()) { setBundleSearchResults([]); return; }
    setBundleSearchLoading(true);
    try {
      const res = await getProducts({ search: query, limit: 10 });
      setBundleSearchResults(res.data.filter((p) => p.id !== product?.id && !p.isBundle));
    } catch {
      setBundleSearchResults([]);
    } finally {
      setBundleSearchLoading(false);
    }
  };

  const addBundleItem = (p: Product) => {
    if (bundleItems.some((bi) => bi.productId === p.id)) return;
    setBundleItems((prev) => [
      ...prev,
      { productId: p.id, productName: p.name, productSku: p.sku ?? "", quantity: 1 },
    ]);
    setBundleSearch("");
    setBundleSearchResults([]);
  };

  const updateBundleItemQty = (index: number, qty: number) => {
    setBundleItems((prev) => prev.map((bi, i) => i === index ? { ...bi, quantity: Math.max(1, qty) } : bi));
  };

  const removeBundleItem = (index: number) => {
    setBundleItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Media library access is required to upload product images.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 6,
    });

    if (result.canceled) return;

    setLocalImages((current) => [
      ...current,
      ...result.assets.map((asset) => buildProductFileAsset(asset)),
    ]);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Camera access is required to take product photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled) return;

    setLocalImages((current) => [
      ...current,
      ...result.assets.map((asset) => buildProductFileAsset(asset)),
    ]);
  };

  const removePreview = (path: string, existing: boolean) => {
    if (existing) {
      setExistingImages((current) => current.filter((image) => image.path !== path));
      return;
    }

    setLocalImages((current) => current.filter((image) => image.uri !== path));
  };

  const handleGenerateVariants = () => {
    const generated = generateVariantDrafts({
      attributes: productAttributes,
      basePrice: Number(form.salePrice) || 0,
      baseSalePrice: Number(form.salePrice) || 0,
      baseOfferPrice: form.offerPrice ? Number(form.offerPrice) : undefined,
      baseOfferType: form.offerPrice ? form.offerType : undefined,
      totalStock: Number(form.stock) || 0,
      baseSku: form.sku,
      locationId: Number(form.locationId) || undefined,
    });

    setVariants(generated);
  };

  const updateVariant = (variantId: string, field: keyof ProductVariant, value: string) => {
    setVariants((current) =>
      current.map((variant) =>
        variant.id === variantId
          ? {
              ...variant,
              [field]:
                field === "name" || field === "sku" || field === "barcode" || field === "offerType"
                  ? value
                  : field === "offerPrice"
                  ? (value === "" ? undefined : Number(value))
                  : Number(value),
              // A variant has one selling price (price = sale price, as on the web).
              ...(field === "salePrice" ? { price: Number(value) } : {}),
            }
          : variant,
      ),
    );
  };

  const removeVariant = (variantId: string) => {
    setVariants((current) => current.filter((variant) => variant.id !== variantId));
  };

  const handleSave = async () => {
    const fail = (message: string) => {
      setError(message);
      return;
    };

    const sellingPrice = Math.round((Number(form.salePrice) || 0) * 100) / 100;
    const positiveVariantPrices = variants.map((v) => v.salePrice || v.price).filter((v) => v > 0);
    const basePrice = sellingPrice > 0
      ? sellingPrice
      : positiveVariantPrices.length ? Math.min(...positiveVariantPrices) : 0;
    const bundleOverride = isBundle && bundlePriceOverride ? Number(bundlePriceOverride) : 0;
    const effectivePrice = bundleOverride > 0 ? bundleOverride : basePrice;
    const costNum = form.costPrice.trim() === "" ? undefined : Number(form.costPrice);
    const offerNum = form.offerPrice.trim() === "" ? 0 : Number(form.offerPrice);
    const reorderNum = form.reorderPoint.trim() === "" ? undefined : Number(form.reorderPoint);

    const missing: string[] = [];
    if (!form.name.trim()) missing.push("product name");
    if (!form.categoryId) missing.push("category");
    if (!form.locationId) missing.push("warehouse");
    if (missing.length) return fail(`Please fill in: ${missing.join(", ")}.`);
    if (!(effectivePrice > 0)) return fail("Selling price must be greater than 0 (set a cost and margin, a price, or a variant price).");
    if (costNum !== undefined && (!Number.isFinite(costNum) || costNum < 0)) return fail("Cost price cannot be negative.");
    if (form.profitMargin.trim() !== "" && Number(form.profitMargin) < 0) return fail("Profit margin cannot be negative.");
    if (!Number.isFinite(offerNum) || offerNum < 0) return fail("Offer cannot be negative.");
    if (form.offerType === "percentage" && offerNum > 100) return fail("A percentage offer cannot be more than 100%.");
    if (reorderNum !== undefined && (!Number.isInteger(reorderNum) || reorderNum < 0)) {
      return fail("Low-stock alert must be a whole number, 0 or more (0 turns the alert off).");
    }
    const badVariantOffer = variants.find(
      (v) => (v.offerType ?? "percentage") === "percentage" && (v.offerPrice ?? 0) > 100,
    );
    if (badVariantOffer) return fail(`Variant "${badVariantOffer.name}": a percentage offer cannot be more than 100%.`);
    const negativeVariant = variants.find((v) => (v.salePrice || 0) < 0 || (v.stock || 0) < 0);
    if (negativeVariant) return fail(`Variant "${negativeVariant.name}": price and stock cannot be negative.`);

    // Duplicate codes inside this product (the server also checks other products and answers 422).
    const seenSkus = new Map<string, string>();
    const productSku = form.sku.trim().toLowerCase();
    for (const v of variants) {
      const key = (v.sku ?? "").trim().toLowerCase();
      if (!key) continue;
      if (key === productSku) return fail(`Variant SKU "${v.sku}" matches the product SKU.`);
      if (seenSkus.has(key)) return fail(`Variant SKU "${v.sku}" is used by more than one variant.`);
      seenSkus.set(key, v.name);
    }
    if (isBundle && bundleItems.length === 0) return fail("Add at least one product to the bundle.");
    if (isBundle && product && bundleItems.some((item) => item.productId === product.id)) {
      return fail("A bundle cannot contain itself.");
    }

    setSaving(true);
    setError(null);

    const draft: ProductDraft = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      categoryId: Number(form.categoryId),
      locationId: Number(form.locationId),
      // The web form sends one selling price as both price and sale_price.
      price: basePrice,
      salePrice: basePrice,
      offerPrice: offerNum > 0 ? offerNum : undefined,
      offerType: offerNum > 0 ? form.offerType : undefined,
      costPrice: costNum,
      profitMargin: form.profitMargin ? Number(form.profitMargin) : undefined,
      marginType: form.marginType || "percentage",
      stock: Number(form.stock) || 0,
      reorderPoint: reorderNum ?? (product ? 0 : undefined),
      published: form.published,
      availableInPos: form.availableInPos,
      visibleOnline: form.visibleOnline,
      tag: product ? form.tag.trim() : form.tag.trim() || undefined,
      isHotDeal: form.isHotDeal,
      isBestSeller: form.isBestSeller,
      isFeatured: form.isFeatured,
      dealLabel: form.dealLabel.trim(),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      receiptNumber: form.receiptNumber.trim(),
      vendorId: form.vendorId ? Number(form.vendorId) : undefined,
      attributes: productAttributes,
      variants: variants.map((variant) => {
        const vPrice = variant.salePrice || variant.price;
        return { ...variant, price: vPrice, salePrice: vPrice };
      }),
      localImages,
      keepImages: existingImages.map((image) => image.path),
      deleteImages: product ? existingImages.length === 0 && localImages.length === 0 : false,
      isBundle,
      bundlePriceOverride: isBundle && bundlePriceOverride ? Number(bundlePriceOverride) : undefined,
      bundleItems: isBundle ? bundleItems : [],
    };

    try {
      const saved = product
        ? await updateProduct(product.id, draft)
        : await createProduct(draft);
      onSaved(saved);
    } catch (nextError: any) {
      setError(nextError?.message ?? "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <View style={s.loadingCard}>
          <ActivityIndicator color={colors.primaryDark} size="large" />
          <Text style={s.loadingText}>Loading product data…</Text>
        </View>
      </View>
    );
  }

  const salePreview = Number(form.salePrice) || 0;
  const costPreview = Number(form.costPrice) || 0;
  const offerNum = Number(form.offerPrice) || 0;
  const currencySymbol = formatCurrency(0).replace(/[\d.,\s]/g, "") || currency;
  const offerFinalPrice = offerNum > 0
    ? (form.offerType === "percentage"
        ? salePreview * (1 - offerNum / 100)
        : salePreview - offerNum)
    : 0;

  return (
    <ScrollView contentContainerStyle={[s.root, { paddingBottom: 16 + insets.bottom }]} showsVerticalScrollIndicator={false}>

      {/* ── SECTION 1: Core Details ───────────────────────────── */}
      <SectionCard step={1} icon="cube-outline" title="Product Info" badge={
        <ProductStatusPill label={product ? "Editing" : "New"} tone={product ? "info" : "success"} />
      }>
        <InputField label="Product name" icon="text-outline" required>
          <TextInput
            value={form.name}
            onChangeText={(v) => setField("name", v)}
            placeholder="e.g. Nike Air Max 90"
            placeholderTextColor={colors.muted}
            style={s.input}
          />
        </InputField>

        <InputField label="Description" icon="document-text-outline">
          <TextInput
            value={form.description}
            onChangeText={(v) => setField("description", v)}
            placeholder="Describe the product…"
            placeholderTextColor={colors.muted}
            style={[s.input, s.textarea]}
            multiline
            textAlignVertical="top"
          />
        </InputField>

        <View style={s.row2}>
          <View style={s.rowItem}>
            <PickerField
              label="Category"
              placeholder="Select category"
              value={form.categoryId}
              options={categoryOptions}
              onChange={(value) => {
                const selected = categories.find((c) => String(c.id) === value);
                setForm((cur) => ({
                  ...cur,
                  categoryId: value,
                  category: selected?.categoryName ?? cur.category,
                }));
              }}
            />
          </View>
          <View style={s.rowItem}>
            <PickerField
              label="Vendor"
              placeholder="Select vendor"
              value={form.vendorId}
              options={vendorOptions}
              onChange={(v) => setField("vendorId", v)}
              allowEmpty
            />
          </View>
        </View>

        <PickerField
          label="Warehouse / Location"
          placeholder="Select location"
          value={form.locationId}
          options={warehouseOptions}
          onChange={(v) => setField("locationId", v)}
        />
      </SectionCard>

      {/* ── SECTION 2: Identifiers ────────────────────────────── */}
      <SectionCard step={2} icon="barcode-outline" title="Identifiers">
        <InputField label="Product SKU" icon="code-slash-outline" hint={!product && !skuManuallyEdited ? "Auto-generated" : undefined}>
          <View style={s.inputRow}>
            <TextInput
              value={form.sku}
              onChangeText={(v) => {
                setSkuManuallyEdited(true);
                setField("sku", v.toUpperCase());
              }}
              placeholder="e.g. PROD-0001"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              style={[s.input, s.flex]}
            />
            <Pressable
              style={s.regenBtn}
              onPress={() => {
                setSkuManuallyEdited(false);
                setField("sku", generateProductSku());
              }}
            >
              <Ionicons name="refresh" size={15} color={colors.primaryDark} />
            </Pressable>
          </View>
        </InputField>

        <InputField label="Barcode" icon="scan-outline">
          <View style={s.inputRow}>
            <TextInput
              value={form.barcode}
              onChangeText={(v) => setField("barcode", v)}
              placeholder="EAN / UPC barcode"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              style={[s.input, s.flex]}
            />
            <Pressable style={s.regenBtn} onPress={() => setField("barcode", generateBarcodeCode())}>
              <Ionicons name="refresh" size={15} color={colors.primaryDark} />
            </Pressable>
          </View>
        </InputField>

        <InputField label="Receipt number" icon="receipt-outline">
          <TextInput
            value={form.receiptNumber}
            onChangeText={(v) => setField("receiptNumber", v)}
            placeholder="Optional"
            placeholderTextColor={colors.muted}
            style={s.input}
          />
        </InputField>
      </SectionCard>

      {/* ── SECTION 3: Pricing & Stock ───────────────────────── */}
      <SectionCard step={3} icon="pricetag-outline" title="Pricing & Stock">
        <InputField label="Cost price" icon="card-outline">
          <CurrencyInput
            value={form.costPrice}
            onChangeText={(v) => updatePricing({ costPrice: v })}
            currency={currency}
            placeholder="0.00"
          />
        </InputField>

        {/* Margin row */}
        <View style={s.marginBlock}>
          <View style={s.marginLabelRow}>
            <Text style={s.fieldLabel}>Profit margin</Text>
            <View style={s.segmentPill}>
              <Pressable
                style={[s.segPillItem, form.marginType === "percentage" && s.segPillActive]}
                onPress={() => updatePricing({ marginType: "percentage" })}
              >
                <Text style={[s.segPillText, form.marginType === "percentage" && s.segPillTextActive]}>%</Text>
              </Pressable>
              <Pressable
                style={[s.segPillItem, form.marginType === "flat" && s.segPillActive]}
                onPress={() => updatePricing({ marginType: "flat" })}
              >
                <Text style={[s.segPillText, form.marginType === "flat" && s.segPillTextActive]}>Flat</Text>
              </Pressable>
            </View>
          </View>
          <TextInput
            value={form.profitMargin}
            onChangeText={(v) => updatePricing({ profitMargin: v })}
            keyboardType="decimal-pad"
            placeholder={form.marginType === "percentage" ? "e.g. 20" : "e.g. 50"}
            placeholderTextColor={colors.muted}
            style={s.input}
          />
        </View>

        <InputField
          label="Selling price"
          icon="cash-outline"
          required={variants.length === 0}
          hint={form.costPrice ? "Cost + margin" : variants.length > 0 ? "Or set per variant" : undefined}
        >
          <CurrencyInput
            value={form.salePrice}
            onChangeText={updateSellingPrice}
            currency={currency}
            placeholder="0.00"
          />
        </InputField>

        {/* Price summary card */}
        <View style={s.priceSummary}>
          <View style={s.priceSummaryRow}>
            <Ionicons name="storefront-outline" size={14} color="#166534" />
            <Text style={s.priceSummaryLabel}>Selling at</Text>
            <Text style={s.priceSummaryValue}>{formatCurrency(salePreview)}</Text>
          </View>
          {costPreview > 0 && salePreview > 0 && salePreview < costPreview ? (
            <Text style={[s.stockNote, { color: colors.danger }]}>
              Below cost — you would lose {formatCurrency(costPreview - salePreview)} per unit.
            </Text>
          ) : null}
        </View>

        {/* Offer / Discount */}
        <View style={s.marginBlock}>
          <View style={s.marginLabelRow}>
            <Text style={s.fieldLabel}>Offer / Discount</Text>
            <View style={s.segmentPill}>
              <Pressable
                style={[s.segPillItem, form.offerType === "percentage" && s.segPillActive]}
                onPress={() => setField("offerType", "percentage")}
              >
                <Text style={[s.segPillText, form.offerType === "percentage" && s.segPillTextActive]}>% Off</Text>
              </Pressable>
              <Pressable
                style={[s.segPillItem, form.offerType === "flat" && s.segPillActive]}
                onPress={() => setField("offerType", "flat")}
              >
                <Text style={[s.segPillText, form.offerType === "flat" && s.segPillTextActive]}>Flat {currencySymbol}</Text>
              </Pressable>
            </View>
          </View>
          <TextInput
            value={form.offerPrice}
            onChangeText={(v) => setField("offerPrice", v)}
            keyboardType="decimal-pad"
            placeholder={form.offerType === "percentage" ? "e.g. 10 (10% off, max 100)" : `e.g. 10 (${currencySymbol}10 off)`}
            placeholderTextColor={colors.muted}
            style={s.input}
          />
          {offerNum > 0 && salePreview > 0 && offerFinalPrice > 0 && (
            <View style={[s.priceSummary, { marginTop: 8, backgroundColor: "#fff7ed" }]}>
              <View style={s.priceSummaryRow}>
                <Ionicons name="flash-outline" size={14} color="#c2410c" />
                <Text style={[s.priceSummaryLabel, { color: "#c2410c" }]}>Offer price</Text>
                <Text style={[s.priceSummaryValue, { color: "#c2410c" }]}>{formatCurrency(offerFinalPrice)}</Text>
                <View style={[s.discountBadge, { backgroundColor: "#fed7aa" }]}>
                  <Text style={[s.discountBadgeText, { color: "#c2410c" }]}>
                    {form.offerType === "percentage" ? `-${offerNum}%` : `-${formatCurrency(offerNum)}`}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <InputField label="Stock quantity" icon="layers-outline">
          <TextInput
            value={form.stock}
            onChangeText={(v) => setField("stock", v)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            style={s.input}
            editable={variants.length === 0}
          />
          {variants.length > 0 && (
            <Text style={s.stockNote}>Stock is managed per variant below</Text>
          )}
        </InputField>

        <InputField label="Low-stock alert at" icon="alert-circle-outline" hint="0 = alert off">
          <TextInput
            value={form.reorderPoint}
            onChangeText={(v) => setField("reorderPoint", v.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder={product ? "0" : "Company default"}
            placeholderTextColor={colors.muted}
            style={s.input}
          />
        </InputField>
      </SectionCard>

      {/* ── SECTION 4: Storefront Flags ──────────────────────── */}
      <SectionCard step={4} icon="star-outline" title="Storefront">
        <ToggleCard
          icon="checkmark-done-outline"
          label="Published"
          description="Off = draft (hidden everywhere)"
          value={form.published}
          onChange={(v) => setField("published", v)}
          accentColor="#2563eb"
          accentBg="#dbeafe"
        />
        <ToggleCard
          icon="globe-outline"
          label="Visible online"
          description="Show on the online storefront"
          value={form.visibleOnline}
          onChange={(v) => setField("visibleOnline", v)}
          accentColor="#0891b2"
          accentBg="#cffafe"
        />
        <ToggleCard
          icon="cart-outline"
          label="Available in POS"
          description="Can be sold at the point of sale"
          value={form.availableInPos}
          onChange={(v) => setField("availableInPos", v)}
          accentColor={colors.primaryDark}
          accentBg="#dcfce7"
        />
        <InputField label="Tag" icon="bookmark-outline" hint="e.g. New, Eid collection">
          <TextInput
            value={form.tag}
            onChangeText={(v) => setField("tag", v.slice(0, 50))}
            placeholder="Optional label"
            placeholderTextColor={colors.muted}
            maxLength={50}
            style={s.input}
          />
        </InputField>
        <ToggleCard
          icon="flame-outline"
          label="Hot deal"
          description="Shows hot deal badge"
          value={form.isHotDeal}
          onChange={(v) => setField("isHotDeal", v)}
          accentColor="#dc2626"
          accentBg="#fee2e2"
        />
        <ToggleCard
          icon="trending-up-outline"
          label="Best seller"
          description="Shows best seller badge"
          value={form.isBestSeller}
          onChange={(v) => setField("isBestSeller", v)}
          accentColor="#d97706"
          accentBg="#fef3c7"
        />
        <ToggleCard
          icon="ribbon-outline"
          label="Featured"
          description="Featured on homepage"
          value={form.isFeatured}
          onChange={(v) => setField("isFeatured", v)}
          accentColor={colors.primaryDark}
          accentBg="#dcfce7"
        />
        <InputField label="Deal label" icon="pricetag-outline" hint="e.g. Flash Sale, 40% Off">
          <TextInput
            value={form.dealLabel}
            onChangeText={(v) => setField("dealLabel", v)}
            placeholder="Flash Sale, Limited Offer…"
            placeholderTextColor={colors.muted}
            style={s.input}
          />
        </InputField>
      </SectionCard>

      {/* ── SECTION 5: Bundle / Kit ─────────────────────────── */}
      <SectionCard step={5} icon="layers-outline" title="Bundle / Kit">
        <ToggleCard
          icon="grid-outline"
          label="Bundle / Kit product"
          description="Group multiple products into one bundle"
          value={isBundle}
          onChange={setIsBundle}
          accentColor="#7c3aed"
          accentBg="#ede9fe"
        />

        {isBundle && (
          <View style={s.bundleSection}>
            <InputField label="Bundle price override" icon="cash-outline" hint="Leave blank to use product price">
              <CurrencyInput
                value={bundlePriceOverride}
                onChangeText={setBundlePriceOverride}
                currency={currency}
                placeholder="Use product price"
              />
            </InputField>

            <View style={s.field}>
              <View style={s.fieldLabelRow}>
                <Ionicons name="search-outline" size={13} color={colors.muted} />
                <Text style={s.fieldLabel}>Add child products</Text>
              </View>
              <TextInput
                value={bundleSearch}
                onChangeText={searchBundleProducts}
                placeholder="Search products to add…"
                placeholderTextColor={colors.muted}
                style={s.input}
              />
              {bundleSearchLoading && (
                <ActivityIndicator size="small" color={colors.primaryDark} style={{ marginTop: 8 }} />
              )}
              {bundleSearchResults.length > 0 && (
                <View style={s.bundleDropdown}>
                  {bundleSearchResults.map((p) => (
                    <Pressable key={p.id} style={s.bundleDropdownItem} onPress={() => addBundleItem(p)}>
                      <Text style={s.bundleDropdownName}>{p.name}</Text>
                      <Text style={s.bundleDropdownSku}>{p.sku ?? ""}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {bundleItems.length === 0 ? (
              <View style={s.bundleEmpty}>
                <Ionicons name="cube-outline" size={24} color={colors.muted} />
                <Text style={s.bundleEmptyText}>No child products added yet</Text>
              </View>
            ) : (
              <View style={s.bundleList}>
                {bundleItems.map((item, index) => (
                  <View key={`${item.productId}-${item.variantId ?? ""}`} style={s.bundleItemRow}>
                    <View style={s.bundleItemInfo}>
                      <Text style={s.bundleItemName}>{item.productName}</Text>
                      <Text style={s.bundleItemSku}>{item.productSku}</Text>
                    </View>
                    <View style={s.bundleQtyRow}>
                      <Pressable
                        style={s.bundleQtyBtn}
                        onPress={() => updateBundleItemQty(index, item.quantity - 1)}
                        hitSlop={8}
                      >
                        <Ionicons name="remove" size={14} color={colors.primaryDark} />
                      </Pressable>
                      <Text style={s.bundleQtyText}>{item.quantity}</Text>
                      <Pressable
                        style={s.bundleQtyBtn}
                        onPress={() => updateBundleItemQty(index, item.quantity + 1)}
                        hitSlop={8}
                      >
                        <Ionicons name="add" size={14} color={colors.primaryDark} />
                      </Pressable>
                    </View>
                    <Pressable onPress={() => removeBundleItem(index)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={17} color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </SectionCard>

      {/* ── SECTION 6: Images ───────────────────────────────── */}
      <SectionCard step={7} icon="images-outline" title="Product Images">
        {imagePreviews.length > 0 ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.imageRow}>
              {imagePreviews.map((image, index) => (
                <View key={image.key} style={[s.imgThumb, index === 0 && s.imgThumbPrimary]}>
                  {image.uri ? (
                    <Image source={{ uri: image.uri }} style={s.imgThumbImg} resizeMode="cover" />
                  ) : (
                    <View style={s.imgThumbPlaceholder}>
                      <Ionicons name="image-outline" size={28} color={colors.muted} />
                    </View>
                  )}
                  <Pressable
                    style={s.imgRemoveBtn}
                    onPress={() => removePreview(image.path, image.existing)}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                  {index === 0 && (
                    <View style={s.primaryBadge}>
                      <Text style={s.primaryBadgeText}>Cover</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={s.imgBtnRow}>
              <Pressable style={[s.addImageBtn, s.flex]} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={15} color={colors.primaryDark} />
                <Text style={s.addImageBtnText}>Take photo</Text>
              </Pressable>
              <Pressable style={[s.addImageBtn, s.flex]} onPress={addImages}>
                <Ionicons name="images-outline" size={15} color={colors.primaryDark} />
                <Text style={s.addImageBtnText}>Choose from gallery</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={s.emptyImages}>
            <View style={s.emptyImagesIcon}>
              <Ionicons name="cloud-upload-outline" size={32} color={colors.primaryDark} />
            </View>
            <Text style={s.emptyImagesTitle}>Add product images</Text>
            <Text style={s.emptyImagesSub}>Take a photo or pick from gallery</Text>
            <View style={s.emptyImagesBtns}>
              <Pressable style={s.emptyImagesBtn} onPress={takePhoto}>
                <Ionicons name="camera" size={18} color={colors.primaryDark} />
                <Text style={s.emptyImagesBtnText}>Take photo</Text>
              </Pressable>
              <Pressable style={s.emptyImagesBtn} onPress={addImages}>
                <Ionicons name="images" size={18} color={colors.primaryDark} />
                <Text style={s.emptyImagesBtnText}>Choose from gallery</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SectionCard>

      {/* ── SECTION 6: Attributes & Variants ────────────────── */}
      <SectionCard step={8} icon="options-outline" title="Attributes & Variants">
        {attributes.length > 0 && (
          <>
            <Text style={s.subLabel}>Select attributes for this product</Text>
            <View style={s.attrGrid}>
              {attributes.map((attribute) => {
                const selected = selectedAttributeIds.includes(String(attribute.id));
                return (
                  <Pressable
                    key={attribute.id}
                    style={[s.attrChip, selected && s.attrChipActive]}
                    onPress={() => toggleAttribute(attribute)}
                  >
                    {selected && <Ionicons name="checkmark" size={12} color={colors.primaryDark} />}
                    <Text style={[s.attrChipText, selected && s.attrChipTextActive]}>
                      {attribute.displayName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {productAttributes.map((attribute) => {
          const def = attributes.find((item) => String(item.id) === attribute.id);
          const selectedValues = Array.isArray(attribute.value) ? attribute.value : [attribute.value];

          return (
            <View key={attribute.id} style={s.attrPanel}>
              <View style={s.attrPanelHeader}>
                <View style={s.attrPanelDot} />
                <Text style={s.attrPanelTitle}>{def?.displayName ?? attribute.name}</Text>
              </View>
              {def?.values?.length ? (
                <View style={s.attrValues}>
                  {def.values.map((value) => {
                    const isSelected = selectedValues.includes(value);
                    return (
                      <Pressable
                        key={value}
                        style={[s.attrValueChip, isSelected && s.attrValueChipActive]}
                        onPress={() => {
                          const next = isSelected
                            ? selectedValues.filter((item) => item !== value)
                            : [...selectedValues.filter(Boolean), value];
                          updateAttributeValues(attribute.id, next);
                        }}
                      >
                        <Text style={[s.attrValueText, isSelected && s.attrValueTextActive]}>
                          {value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <TextInput
                  value={Array.isArray(attribute.value) ? attribute.value.join(", ") : attribute.value}
                  onChangeText={(v) => updateAttributeValues(attribute.id, v)}
                  placeholder={`Enter ${attribute.name} values`}
                  placeholderTextColor={colors.muted}
                  style={s.input}
                />
              )}
            </View>
          );
        })}

        {productAttributes.length > 0 && (
          <Pressable style={s.generateBtn} onPress={handleGenerateVariants}>
            <Ionicons name="git-branch-outline" size={16} color="#fff" />
            <Text style={s.generateBtnText}>Generate variants</Text>
          </Pressable>
        )}

        {variants.length > 0 && (
          <View style={s.variantsList}>
            <Text style={s.variantsHeader}>{variants.length} variant{variants.length !== 1 ? "s" : ""}</Text>
            {variants.map((variant, idx) => (
              <View key={variant.id} style={s.variantCard}>
                <View style={s.variantCardHeader}>
                  <View style={s.variantNumBadge}>
                    <Text style={s.variantNum}>{idx + 1}</Text>
                  </View>
                  <Text style={s.variantName}>{variant.name}</Text>
                  <Pressable onPress={() => removeVariant(variant.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  </Pressable>
                </View>
                <View style={s.row2}>
                  <View style={s.rowItem}>
                    <Text style={s.fieldLabel}>Price</Text>
                    <CurrencyInput
                      value={String(variant.salePrice || variant.price || "")}
                      onChangeText={(v) => updateVariant(variant.id, "salePrice", v)}
                      currency={currency}
                      placeholder="0.00"
                    />
                  </View>
                  <View style={s.rowItem}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={[s.fieldLabel, { color: "#c2410c", marginBottom: 0 }]}>Offer price</Text>
                      <View style={s.segmentPill}>
                        <Pressable
                          style={[s.segPillItem, (variant.offerType ?? "percentage") === "percentage" && s.segPillActive]}
                          onPress={() => updateVariant(variant.id, "offerType", "percentage")}
                        >
                          <Text style={[s.segPillText, (variant.offerType ?? "percentage") === "percentage" && s.segPillTextActive]}>%</Text>
                        </Pressable>
                        <Pressable
                          style={[s.segPillItem, variant.offerType === "flat" && s.segPillActive]}
                          onPress={() => updateVariant(variant.id, "offerType", "flat")}
                        >
                          <Text style={[s.segPillText, variant.offerType === "flat" && s.segPillTextActive]}>{currencySymbol}</Text>
                        </Pressable>
                      </View>
                    </View>
                    <TextInput
                      value={variant.offerPrice ? String(variant.offerPrice) : ""}
                      onChangeText={(v) => updateVariant(variant.id, "offerPrice", v)}
                      keyboardType="decimal-pad"
                      placeholder="0 = none"
                      placeholderTextColor={colors.muted}
                      style={s.input}
                    />
                  </View>
                  <View style={s.rowItem}>
                    <Text style={s.fieldLabel}>Stock</Text>
                    <TextInput
                      value={String(variant.stock)}
                      onChangeText={(v) => updateVariant(variant.id, "stock", v)}
                      keyboardType="number-pad"
                      placeholderTextColor={colors.muted}
                      style={s.input}
                    />
                  </View>
                  <View style={s.rowItem}>
                    <Text style={s.fieldLabel}>SKU</Text>
                    <TextInput
                      value={variant.sku}
                      onChangeText={(v) => updateVariant(variant.id, "sku", v)}
                      autoCapitalize="characters"
                      placeholderTextColor={colors.muted}
                      style={s.input}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      {/* ── Error ───────────────────────────────────────────── */}
      {error ? (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* ── Footer actions ──────────────────────────────────── */}
      <View style={s.footer}>
        {onCancel ? (
          <Pressable style={s.cancelBtn} onPress={onCancel}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name={product ? "checkmark-circle" : "add-circle"} size={18} color="#fff" />
              <Text style={s.saveBtnText}>{product ? "Update product" : "Create product"}</Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({
  step,
  icon,
  title,
  badge,
  action,
  children,
}: {
  step: number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={s.sectionCard}>
      <View style={s.sectionHead}>
        <View style={s.sectionIconWrap}>
          <Ionicons name={icon} size={18} color={colors.primaryDark} />
        </View>
        <View style={s.sectionTitleBlock}>
          <Text style={s.sectionTitle}>{title}</Text>
          <Text style={s.sectionStep}>Step {step} of 8</Text>
        </View>
        {badge ?? action ?? null}
      </View>
      <View style={s.sectionDivider} />
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

function InputField({
  label,
  icon,
  required,
  hint,
  children,
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <View style={s.fieldLabelRow}>
        {icon && <Ionicons name={icon} size={13} color={colors.muted} />}
        <Text style={s.fieldLabel}>{label}</Text>
        {required && <Text style={s.requiredDot}>*</Text>}
        {hint && <Text style={s.fieldHint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

function CurrencyInput({
  value,
  onChangeText,
  currency,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  currency: string;
  placeholder?: string;
}) {
  const SYMBOLS: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥",
    BDT: "৳", INR: "₹", PKR: "₨", NPR: "₨", LKR: "₨",
    AUD: "A$", CAD: "C$", HKD: "HK$", SGD: "S$", NZD: "NZ$",
    AED: "د.إ", SAR: "﷼", KWD: "KD", MYR: "RM", THB: "฿",
    IDR: "Rp", PHP: "₱", VND: "₫", KRW: "₩", TRY: "₺",
    BRL: "R$", MXN: "MX$", ZAR: "R", NGN: "₦", GHS: "₵",
  };
  const symbol = SYMBOLS[currency?.toUpperCase()] ?? currency;
  return (
    <View style={s.currencyRow}>
      <View style={s.currencySymbolWrap}>
        <Text style={s.currencySymbol}>{symbol}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder ?? "0.00"}
        placeholderTextColor={colors.muted}
        style={[s.input, s.currencyInput]}
      />
    </View>
  );
}

function ToggleCard({
  icon,
  label,
  description,
  value,
  onChange,
  accentColor,
  accentBg,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  accentColor: string;
  accentBg: string;
}) {
  return (
    <View style={[s.toggleCard, value && { borderColor: accentColor + "44", backgroundColor: accentBg + "55" }]}>
      <View style={[s.toggleIconWrap, { backgroundColor: value ? accentBg : colors.background }]}>
        <Ionicons name={icon} size={18} color={value ? accentColor : colors.muted} />
      </View>
      <View style={s.toggleInfo}>
        <Text style={[s.toggleLabel, value && { color: accentColor }]}>{label}</Text>
        <Text style={s.toggleDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: accentColor, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },

  // Section card
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    paddingBottom: 14,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitleBlock: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionStep: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  sectionBody: {
    padding: 16,
    gap: 14,
  },

  // Field
  field: {
    gap: 8,
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  requiredDot: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 16,
  },
  fieldHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  subLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },

  // Input
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  textarea: {
    minHeight: 110,
  },

  // Input row (with regen button)
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  flex: { flex: 1 },
  regenBtn: {
    width: 44,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },

  // 2-column row
  row2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  rowItem: {
    flex: 1,
    minWidth: 140,
  },

  // Currency input
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  currencySymbolWrap: {
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  currencySymbol: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "700",
  },
  currencyInput: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    minHeight: 48,
  },

  // Margin block
  marginBlock: {
    gap: 8,
  },
  marginLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  segmentPill: {
    flexDirection: "row",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  segPillItem: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  segPillActive: {
    backgroundColor: colors.primaryDark,
  },
  segPillText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  segPillTextActive: {
    color: "#fff",
  },

  // Price summary
  priceSummary: {
    borderRadius: 14,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  priceSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceSummaryLabel: {
    color: "#166534",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  priceSummaryValue: {
    color: "#166534",
    fontSize: 16,
    fontWeight: "800",
  },
  discountBadge: {
    borderRadius: 999,
    backgroundColor: "#166534",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },

  // Stock note
  stockNote: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },

  // Toggle card
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  toggleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleInfo: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  toggleDesc: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
  },

  // Add image buttons
  imgBtnRow: {
    flexDirection: "row",
    gap: 8,
  },
  addImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  addImageBtnText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },

  // Image thumbnails
  imageRow: {
    gap: 10,
    paddingVertical: 2,
  },
  imgThumb: {
    width: 96,
    height: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    position: "relative",
  },
  imgThumbPrimary: {
    borderColor: colors.primaryDark,
    borderWidth: 2,
  },
  imgThumbImg: {
    width: "100%",
    height: "100%",
  },
  imgThumbPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  imgRemoveBtn: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    borderRadius: 999,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  primaryBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // Empty images state
  emptyImages: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  emptyImagesIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyImagesTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyImagesSub: {
    color: colors.muted,
    fontSize: 12,
  },
  emptyImagesBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  emptyImagesBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  emptyImagesBtnText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },

  // Attribute chips
  attrGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attrChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  attrChipActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  attrChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  attrChipTextActive: {
    color: colors.primaryDark,
  },
  attrPanel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#f0fdf4",
    padding: 14,
    gap: 10,
  },
  attrPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attrPanelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryDark,
  },
  attrPanelTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  attrValues: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attrValueChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  attrValueChipActive: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primaryDark,
  },
  attrValueText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  attrValueTextActive: {
    color: "#fff",
  },

  // Generate button
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.primaryDark,
    paddingVertical: 14,
  },
  generateBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  // Variants
  variantsList: {
    gap: 10,
  },
  variantsHeader: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  variantCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    backgroundColor: colors.background,
  },
  variantCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  variantNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  variantNum: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  variantName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },

  // Bundle / Kit
  bundleSection: {
    gap: 12,
    marginTop: 4,
  },
  bundleDropdown: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  bundleDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bundleDropdownName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  bundleDropdownSku: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
  },
  bundleEmpty: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  bundleEmptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  bundleList: {
    gap: 8,
  },
  bundleItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bundleItemInfo: {
    flex: 1,
    gap: 2,
  },
  bundleItemName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  bundleItemSku: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
  },
  bundleQtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bundleQtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  bundleQtyText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "center",
  },

  // Footer
  footer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 2,
    flexDirection: "row",
    borderRadius: 16,
    backgroundColor: colors.primaryDark,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
