import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { getCategories } from "@/services/catalog";
import {
  couponDiscountFor,
  createSell,
  DEFAULT_POS_METHODS,
  getPosLocations,
  getPosPaymentOptions,
  getPosProducts,
  type PosLocation,
} from "@/services/pos";
import { apiErrorMessage } from "@/lib/format";
import { getTaxSettings } from "@/services/settings";
import { getCustomers } from "@/services/customers";
import type { Customer } from "@/services/customers";
import { useCurrency } from "@/context/CurrencyContext";
import { PosProductCard } from "@/components/pos/PosProductCard";
import { PosCartItem } from "@/components/pos/PosCartItem";
import { DiscountModal } from "@/components/pos/DiscountModal";
import { CouponModal } from "@/components/pos/CouponModal";
import { CheckoutModal } from "@/components/pos/CheckoutModal";
import { SuccessModal } from "@/components/pos/SuccessModal";
import { BarcodeScannerModal } from "@/components/pos/BarcodeScannerModal";
import type { Category } from "@/types/catalog";
import type { CartItem, Coupon, CompletedSale, PaymentMethod, PosPaymentOptions, PosProduct, PosVariant } from "@/types/pos";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";


function cartKey(productId: number, variantId?: number) {
  return variantId ? `${productId}-${variantId}` : String(productId);
}

export default function PosTab() {
  const { formatCurrency } = useCurrency();
  // ── Data ──
  const [products, setProducts]       = useState<PosProduct[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [warehouses, setWarehouses]   = useState<PosLocation[]>([]);
  const [locationsReady, setLocationsReady] = useState(false);
  const [loadingProds, setLoadingProds] = useState(false);
  const [payOptions, setPayOptions]   = useState<PosPaymentOptions>({ methods: DEFAULT_POS_METHODS, defaultMethod: "Cash" });

  // ── Tax ──
  const [taxRate, setTaxRate] = useState(0);

  // ── Filters ──
  const [search, setSearch]                   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCat, setSelectedCat]         = useState("all");
  const [selectedWh, setSelectedWh]           = useState("");

  // ── Cart ──
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [discount, setDiscount]       = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [cartOpen, setCartOpen]       = useState(false);

  // ── Modals ──
  const [variantProduct, setVariantProduct]   = useState<PosProduct | null>(null);
  const [discountOpen, setDiscountOpen]       = useState(false);
  const [couponOpen, setCouponOpen]           = useState(false);
  const [checkoutOpen, setCheckoutOpen]       = useState(false);
  const [successOpen, setSuccessOpen]         = useState(false);
  const [completedSale, setCompletedSale]     = useState<CompletedSale | null>(null);
  const [submitting, setSubmitting]           = useState(false);
  const [scannerOpen, setScannerOpen]         = useState(false);

  // ── Debounce search ──
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // ── Load catalogs, locations, tax, payment methods ──
  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
    getTaxSettings().then((tax) => setTaxRate((tax.defaultTaxRate ?? 0) / 100)).catch(() => undefined);
    getPosPaymentOptions().then(setPayOptions).catch(() => undefined);
    getPosLocations()
      .then((whs) => {
        setWarehouses(whs);
        const def = whs.find((w) => w.isDefault) ?? whs[0];
        if (def) setSelectedWh(String(def.id));
      })
      .catch(() => undefined)
      .finally(() => setLocationsReady(true));
  }, []);

  // ── Load products (POS products only, priced and stocked at the selected location) ──
  const loadProducts = useCallback(async () => {
    if (!locationsReady) return;
    setLoadingProds(true);
    try {
      const result = await getPosProducts({
        search: debouncedSearch || undefined,
        categoryId: selectedCat !== "all" ? Number(selectedCat) : undefined,
        locationId: selectedWh ? Number(selectedWh) : undefined,
      });
      setProducts(result.filter((p) => p.published));
    } catch (err) {
      Alert.alert("Could not load products", apiErrorMessage(err));
    } finally {
      setLoadingProds(false);
    }
  }, [debouncedSearch, selectedCat, selectedWh, locationsReady]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  // ── Totals ──
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const subtotal = useMemo(
    () => round2(cart.reduce((sum, item) => sum + item.price * item.quantity, 0)),
    [cart],
  );
  const manualDiscount = Math.min(Math.max(discount, 0), subtotal);
  // the coupon follows the cart, so it stays right as items change
  const couponCalc = appliedCoupon
    ? couponDiscountFor(
        appliedCoupon,
        cart.map((i) => ({ productId: i.productId, categoryId: i.categoryId, subtotal: i.price * i.quantity })),
        subtotal,
        manualDiscount,
      )
    : { amount: 0, problem: "" };
  const couponDiscount = couponCalc.amount;
  const couponProblem = !appliedCoupon || !couponCalc.problem
    ? ""
    : couponCalc.problem === "min"
      ? `Minimum order ${formatCurrency(appliedCoupon.minOrderAmount)} required for ${appliedCoupon.code}.`
      : couponCalc.problem;
  const totalDiscount = round2(manualDiscount + couponDiscount);
  const tax           = round2(Math.max(0, subtotal - totalDiscount) * taxRate);
  const total         = round2(Math.max(0, subtotal - totalDiscount) + tax);

  // ── Cart helpers ──
  const addToCart = useCallback((product: PosProduct, variant?: PosVariant) => {
    const key = cartKey(product.id, variant ? variant.id : undefined);
    const price = variant ? variant.price : product.price;
    const stock = variant ? variant.stock : product.stock;
    if (stock <= 0) {
      Alert.alert("Out of stock", `${product.name}${variant ? ` (${variant.name})` : ""} has no stock at this location.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        if (existing.quantity >= stock) return prev;
        return prev.map((i) => i.key === key ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          variantId: variant ? variant.id : undefined,
          inventoryId: variant?.inventoryId,
          categoryId: product.categoryId,
          name: product.name,
          variantName: variant?.name,
          price,
          regularPrice: variant ? variant.regularPrice : product.regularPrice,
          // a variant without its own wholesale tier uses the product's (same rule as the server)
          wholesalePrice: variant?.wholesalePrice || product.wholesalePrice,
          minWholesaleQty: variant?.wholesalePrice ? (variant.minWholesaleQty || product.minWholesaleQty) : product.minWholesaleQty,
          image: product.image,
          quantity: 1,
          stock,
        },
      ];
    });
    setCartOpen(true);
  }, []);

  const handleProductPress = (product: PosProduct) => {
    if (product.variants.length > 0) {
      setVariantProduct(product);
    } else {
      addToCart(product);
    }
  };

  const updateQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.key === key ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (key: string) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
  };

  const resetCart = () => {
    setCart([]);
    setDiscount(0);
    setAppliedCoupon(null);
    setCustomerName("Walk-in Customer");
    setSelectedCustomer(null);
    setCustomerSuggestions([]);
    setShowSuggestions(false);
    setCartOpen(false);
  };

  const handleCustomerSearch = (text: string) => {
    setCustomerName(text);
    setSelectedCustomer(null); // typing a name is a walk-in until a saved customer is picked
    if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
    if (!text || text === "Walk-in Customer") {
      setCustomerSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    customerSearchTimer.current = setTimeout(async () => {
      setCustomerSearching(true);
      try {
        const result = await getCustomers({ search: text, limit: 6 });
        setCustomerSuggestions(result.data);
        setShowSuggestions(result.data.length > 0);
      } finally {
        setCustomerSearching(false);
      }
    }, 300);
  };

  const selectCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setSelectedCustomer(customer);
    setCustomerSuggestions([]);
    setShowSuggestions(false);
  };

  // ── Barcode scan ──
  const handleBarcodeScanned = useCallback((barcode: string) => {
    const match = products.find(
      (p) =>
        p.barcode === barcode ||
        p.sku === barcode ||
        p.variants.some((v) => v.barcode === barcode || v.sku === barcode),
    );
    if (!match) {
      setSearch(barcode);
      return;
    }
    const matchedVariant = match.variants.find(
      (v) => v.barcode === barcode || v.sku === barcode,
    );
    if (!matchedVariant && match.variants.length > 0) {
      setVariantProduct(match);
      return;
    }
    addToCart(match, matchedVariant);
  }, [products, addToCart]);

  // ── Checkout ──
  const canCheckout = (method: PaymentMethod): string | null => {
    if (cart.length === 0) return "Add at least one item.";
    if (method === "COD" && !selectedCustomer) return "Cash on delivery needs a customer. Pick a saved customer first.";
    if (appliedCoupon?.perCustomer && !selectedCustomer) return "Select a customer to use this coupon";
    if (appliedCoupon && couponProblem) return couponProblem;
    return null;
  };

  const handleConfirm = async (method: PaymentMethod, tendered: number, change: number, transactionId?: string) => {
    const problem = canCheckout(method);
    if (problem) {
      Alert.alert("Cannot complete the sale", problem);
      return;
    }
    setSubmitting(true);
    try {
      const isCod = method === "COD";
      const location = warehouses.find((w) => String(w.id) === selectedWh);
      const result = await createSell({
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name || customerName.trim() || "Walk-in Customer",
        customerPhone: selectedCustomer?.phone || undefined,
        customerEmail: selectedCustomer?.email || undefined,
        shippingFullName: selectedCustomer?.name,
        shippingPhone: selectedCustomer?.phone,
        shippingEmail: selectedCustomer?.email || undefined,
        shippingAddressLine1: selectedCustomer?.address,
        shippingCity: selectedCustomer?.city,
        shippingState: selectedCustomer?.state,
        shippingPostalCode: selectedCustomer?.zipCode,
        shippingCountry: selectedCustomer?.country,
        method,
        source: "pos",
        locationId: location ? location.id : undefined,
        amount: total,
        discount: totalDiscount,
        manualDiscount,
        ...(appliedCoupon && couponDiscount > 0 ? { couponId: appliedCoupon.id, couponCode: appliedCoupon.code } : {}),
        taxRate: tax > 0 ? round2(taxRate * 100) : undefined,
        taxAmount: tax > 0 ? tax : undefined,
        // paid at the counter; cash on delivery is collected later
        paidAmount: isCod ? 0 : total,
        transactionId: transactionId?.trim() || undefined,
        shippingCost: 0,
        status: isCod ? "Pending" : "Delivered",
        items: cart.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          inventoryId: item.inventoryId,
          productName: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      });

      // the server may re-price (wholesale) or re-settle the coupon: show its totals
      const serverDiscount = result.discount;
      setCompletedSale({
        invoiceNo: result.invoiceNo,
        customerName: selectedCustomer?.name || customerName,
        method,
        subtotal,
        discount: appliedCoupon ? manualDiscount : serverDiscount,
        couponDiscount: appliedCoupon ? Math.max(0, round2(serverDiscount - manualDiscount)) : 0,
        tax,
        total: result.amount,
        itemCount: cart.reduce((s, i) => s + i.quantity, 0),
        tendered: method === "Cash" ? tendered : undefined,
        change: method === "Cash" ? Math.max(0, round2(tendered - result.amount)) || change : undefined,
        transactionId: transactionId?.trim() || undefined,
      });

      setCheckoutOpen(false);
      setSuccessOpen(true);
      void loadProducts(); // stock changed
    } catch (err: any) {
      // server rules (out-of-date price, stock at this location, coupon) come back as a 422 message
      const msg = apiErrorMessage(err, "Could not complete the sale.");
      Alert.alert("Sale not completed", msg);
      if (/price is out of date/i.test(msg)) void loadProducts();
    } finally {
      setSubmitting(false);
    }
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const { canRead } = useAuth();
  if (!canRead('POS')) return <AccessDenied />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.muted} />
              </Pressable>
            )}
          </View>
          <Pressable style={styles.scanBtn} onPress={() => setScannerOpen(true)}>
            <Ionicons name="barcode-outline" size={22} color={colors.primaryDark} />
          </Pressable>
        </View>

        {/* Warehouse picker */}
        {warehouses.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.whScroll}>
            {warehouses.map((wh) => (
              <Pressable
                key={wh.id}
                style={[styles.whChip, selectedWh === String(wh.id) && styles.whChipActive]}
                onPress={() => setSelectedWh(String(wh.id))}
              >
                <Text style={[styles.whChipText, selectedWh === String(wh.id) && styles.whChipTextActive]}>
                  {wh.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Category tabs ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
        {[{ id: "all", categoryName: "All" }, ...categories].map((cat) => (
          <Pressable
            key={cat.id}
            style={[styles.catTab, selectedCat === String(cat.id) && styles.catTabActive]}
            onPress={() => setSelectedCat(String(cat.id))}
          >
            <Text style={[styles.catTabText, selectedCat === String(cat.id) && styles.catTabTextActive]}>
              {cat.categoryName}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Products grid ── */}
      <View style={styles.body}>
        {loadingProds ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primaryDark} size="large" />
          </View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.gridContent}
            renderItem={({ item }) => {
              const qty = cart.find((c) => c.productId === item.id)?.quantity ?? 0;
              return (
                <View style={styles.gridCell}>
                  <PosProductCard
                    product={item}
                    cartQty={qty}
                    onAdd={() => handleProductPress(item)}
                  />
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="cube-outline" size={36} color={colors.muted} />
                <Text style={styles.emptyText}>No products found</Text>
              </View>
            }
          />
        )}
      </View>

      {/* ── Cart panel ── */}
      <View style={styles.cartPanel}>
        {/* Cart header / toggle */}
        <Pressable style={styles.cartHeader} onPress={() => setCartOpen((v) => !v)}>
          <View style={styles.cartHeaderLeft}>
            <Ionicons name="cart-outline" size={20} color={colors.text} />
            <Text style={styles.cartTitle}>Cart</Text>
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.cartHeaderRight}>
            <Text style={styles.cartTotal}>{formatCurrency(total)}</Text>
            <Ionicons
              name={cartOpen ? "chevron-down" : "chevron-up"}
              size={18}
              color={colors.muted}
            />
          </View>
        </Pressable>

        {cartOpen && (
          <>
            {/* Customer name */}
            <View>
              <View style={styles.customerRow}>
                <Ionicons name="person-outline" size={15} color={colors.muted} />
                <TextInput
                  style={styles.customerInput}
                  value={customerName}
                  onChangeText={handleCustomerSearch}
                  onFocus={() => {
                    if (customerName && customerName !== "Walk-in Customer") {
                      setShowSuggestions(customerSuggestions.length > 0);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Customer name"
                  placeholderTextColor="#94a3b8"
                />
                {customerSearching && <ActivityIndicator size="small" color={colors.muted} />}
                {customerName !== "Walk-in Customer" && customerName.length > 0 && (
                  <Pressable hitSlop={8} onPress={() => { setCustomerName("Walk-in Customer"); setSelectedCustomer(null); setShowSuggestions(false); }}>
                    <Ionicons name="close-circle" size={15} color={colors.muted} />
                  </Pressable>
                )}
              </View>
              {showSuggestions && (
                <View style={styles.suggestionList}>
                  {customerSuggestions.map((c) => (
                    <Pressable key={c.id} style={styles.suggestionItem} onPress={() => selectCustomer(c)}>
                      <Text style={styles.suggestionName}>{c.name}</Text>
                      {c.phone ? <Text style={styles.suggestionMeta}>{c.phone}</Text> : null}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Items */}
            {cart.length === 0 ? (
              <View style={styles.emptyCart}>
                <Text style={styles.emptyCartText}>No items — tap a product to add</Text>
              </View>
            ) : (
              <ScrollView style={styles.cartItems} nestedScrollEnabled>
                {cart.map((item) => (
                  <PosCartItem
                    key={item.key}
                    item={item}
                    onIncrement={() => updateQty(item.key, 1)}
                    onDecrement={() => updateQty(item.key, -1)}
                    onRemove={() => removeItem(item.key)}
                  />
                ))}
              </ScrollView>
            )}

            {/* Totals */}
            {cart.length > 0 && (
              <View style={styles.totals}>
                <TotalRow label="Subtotal" value={formatCurrency(subtotal)} />
                {discount > 0 && <TotalRow label="Discount" value={`− ${formatCurrency(discount)}`} valueColor="#dc2626" />}
                {couponDiscount > 0 && <TotalRow label={`Coupon (${appliedCoupon?.code})`} value={`− ${formatCurrency(couponDiscount)}`} valueColor="#dc2626" />}
                {couponProblem ? <Text style={styles.couponProblem}>{couponProblem}</Text> : null}
                {appliedCoupon?.perCustomer && !selectedCustomer ? (
                  <Text style={styles.couponProblem}>Select a customer to use this coupon</Text>
                ) : null}
                {taxRate > 0 ? <TotalRow label={`Tax (${round2(taxRate * 100)}%)`} value={formatCurrency(tax)} /> : null}
                <View style={styles.totalDivider} />
                <TotalRow label="Total" value={formatCurrency(total)} bold />
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.cartActions}>
              <Pressable style={styles.actionBtn} onPress={() => setDiscountOpen(true)}>
                <Ionicons name="pricetag-outline" size={15} color={colors.text} />
                <Text style={styles.actionBtnText}>
                  {discount > 0 ? `− ${formatCurrency(discount)}` : "Discount"}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.actionBtn, appliedCoupon && styles.actionBtnActive]}
                onPress={() => setCouponOpen(true)}
              >
                <Ionicons name="ticket-outline" size={15} color={appliedCoupon ? colors.primaryDark : colors.text} />
                <Text style={[styles.actionBtnText, appliedCoupon && styles.actionBtnTextActive]}>
                  {appliedCoupon ? appliedCoupon.code : "Coupon"}
                </Text>
              </Pressable>

              {cart.length > 0 && (
                <Pressable style={styles.resetBtn} onPress={resetCart} hitSlop={4}>
                  <Ionicons name="trash-outline" size={15} color="#dc2626" />
                </Pressable>
              )}
            </View>

            {/* Checkout */}
            <Pressable
              style={[styles.checkoutBtn, cart.length === 0 && styles.checkoutBtnDisabled]}
              onPress={() => cart.length > 0 && setCheckoutOpen(true)}
              disabled={cart.length === 0}
            >
              <Text style={styles.checkoutText}>
                Checkout {cart.length > 0 ? `· ${formatCurrency(total)}` : ""}
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </>
        )}
      </View>

      {/* ── Variant picker modal ── */}
      <Modal
        visible={variantProduct !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setVariantProduct(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setVariantProduct(null)} />
        <View style={styles.variantSheet}>
          <View style={styles.handle} />
          <Text style={styles.variantTitle}>{variantProduct?.name}</Text>
          <Text style={styles.variantSubtitle}>Select a variant</Text>
          {variantProduct?.variants.map((v) => {
            const price = v.price;
            return (
              <Pressable
                key={v.id}
                style={[styles.variantRow, v.stock <= 0 && styles.variantRowDisabled]}
                onPress={() => {
                  if (v.stock > 0) {
                    addToCart(variantProduct, v);
                    setVariantProduct(null);
                  }
                }}
              >
                <View>
                  <Text style={styles.variantName}>{v.name}</Text>
                  {v.stock <= 0 && <Text style={styles.variantOos}>Out of stock</Text>}
                </View>
                <View style={styles.variantRight}>
                  {v.offerActive && v.regularPrice > price ? (
                    <Text style={styles.variantStrike}>{formatCurrency(v.regularPrice)}</Text>
                  ) : null}
                  <Text style={styles.variantPrice}>{formatCurrency(price)}</Text>
                  {v.stock > 0 && (
                    <Text style={styles.variantStock}>Stock: {v.stock}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Modal>

      {/* ── Other modals ── */}
      <DiscountModal
        visible={discountOpen}
        subtotal={subtotal}
        currentDiscount={discount}
        onApply={setDiscount}
        onClose={() => setDiscountOpen(false)}
      />

      <CouponModal
        visible={couponOpen}
        subtotal={subtotal}
        lines={cart.map((i) => ({ productId: i.productId, categoryId: i.categoryId, subtotal: i.price * i.quantity }))}
        manualDiscount={manualDiscount}
        hasCustomer={!!selectedCustomer}
        appliedCoupon={appliedCoupon}
        onApply={(coupon) => setAppliedCoupon(coupon)}
        onRemove={() => setAppliedCoupon(null)}
        onClose={() => setCouponOpen(false)}
      />

      <CheckoutModal
        visible={checkoutOpen}
        total={total}
        validate={canCheckout}
        subtotal={subtotal}
        discount={manualDiscount}
        couponDiscount={couponDiscount}
        tax={tax}
        customerName={selectedCustomer?.name || customerName}
        hasCustomer={!!selectedCustomer}
        methods={payOptions.methods}
        defaultMethod={payOptions.defaultMethod}
        itemCount={cartCount}
        submitting={submitting}
        onConfirm={handleConfirm}
        onClose={() => setCheckoutOpen(false)}
      />

      <SuccessModal
        visible={successOpen}
        sale={completedSale}
        onNewOrder={() => { setSuccessOpen(false); resetCart(); }}
      />

      <BarcodeScannerModal
        visible={scannerOpen}
        onScanned={handleBarcodeScanned}
        onClose={() => setScannerOpen(false)}
      />
    </SafeAreaView>
  );
}

function TotalRow({ label, value, bold, valueColor }: { label: string; value: string; bold?: boolean; valueColor?: string }) {
  return (
    <View style={trStyles.row}>
      <Text style={[trStyles.label, bold && trStyles.bold]}>{label}</Text>
      <Text style={[trStyles.value, bold && trStyles.bold, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const trStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  label: { color: colors.muted, fontSize: 13 },
  value: { color: colors.text, fontSize: 13, fontWeight: "600" },
  bold: { color: colors.text, fontSize: 15, fontWeight: "800" },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Top bar ──
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  scanBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  whScroll: {
    flexGrow: 0,
  },
  whChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  whChipActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  whChipText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  whChipTextActive: {
    color: colors.primaryDark,
  },

  // ── Category tabs ──
  catScroll: {
    flexGrow: 0,
    paddingLeft: 16,
  },
  catContent: {
    gap: 8,
    paddingRight: 16,
    paddingBottom: 4,
  },
  catTab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  catTabActive: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primaryDark,
  },
  catTabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  catTabTextActive: {
    color: "#fff",
  },

  // ── Products ──
  body: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gridContent: {
    padding: 12,
    paddingBottom: 8,
  },
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  gridCell: {
    flex: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },

  // ── Cart panel ──
  cartPanel: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  cartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cartHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  cartBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  cartHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartTotal: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "800",
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: "#f8fafc",
  },
  customerInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  suggestionList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    marginTop: 4,
    overflow: "hidden",
    zIndex: 99,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  suggestionName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  suggestionMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  emptyCart: {
    paddingVertical: 10,
    alignItems: "center",
  },
  emptyCartText: {
    color: colors.muted,
    fontSize: 13,
  },
  cartItems: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    maxHeight: 200,
  },
  totals: {
    gap: 2,
    paddingHorizontal: 4,
  },
  totalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  cartActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  actionBtnActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  actionBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  actionBtnTextActive: {
    color: colors.primaryDark,
  },
  resetBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  checkoutBtnDisabled: {
    opacity: 0.45,
  },
  checkoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },

  // ── Variant modal ──
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  variantSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 12,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  variantTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  variantSubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: -6,
  },
  variantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#f8fafc",
  },
  variantRowDisabled: {
    opacity: 0.45,
  },
  variantName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  variantOos: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: 2,
  },
  variantRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  variantStrike: {
    color: colors.muted,
    fontSize: 12,
    textDecorationLine: "line-through",
  },
  couponProblem: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 2,
  },
  variantPrice: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "800",
  },
  variantStock: {
    color: colors.muted,
    fontSize: 12,
  },
});
