# Bundle / Kit — Full Flow Analysis

## How It Works (Current Implementation)

### 1. Creating a Bundle Product

In **ProductFormDialog**, user:
- Enables "Bundle / Kit" toggle
- Searches and adds child products (with optional variant)
- Sets qty per bundle for each child
- Optionally sets a bundle price override

Payload sent to backend:
```json
{
  "name": "Starter Kit",
  "price": 500,
  "isBundle": true,
  "bundlePriceOverride": 450,
  "bundleItems": [
    { "productId": 10, "variantId": null, "quantity": 2 },
    { "productId": 15, "variantId": 3,    "quantity": 1 }
  ]
}
```

### 2. Stock Calculation on Save

`ProductService.syncBundleStock()` runs after create/update:

```
bundle_stock = MIN over all children of: floor(child_stock / child_qty_per_bundle)
```

**Example:**
- Product A: stock=10, qty_per_bundle=2 → slots = floor(10/2) = 5
- Product B: stock=9,  qty_per_bundle=1 → slots = floor(9/1)  = 9
- **Bundle stock = MIN(5, 9) = 5**

### 3. Selling a Bundle (POS / Order)

When a sell is created with a bundle product item:

`SellService.deductStock()` detects `is_bundle=true` → calls `deductBundleStock()`:

```
For each child in bundle_items:
    deduct (child_qty_per_bundle × sale_qty) from child product stock

Then re-sync bundle stock = MIN(floor(each_child_remaining / child_qty)) 
```

**Example — sell 2 bundles:**
- Product A: deduct 2×2=4 → stock 10→6, slots=floor(6/2)=3
- Product B: deduct 1×2=2 → stock 9→7,  slots=floor(7/1)=7
- **Bundle stock re-synced = MIN(3,7) = 3**

---

## Problems Found

### Problem 1 — Bundle variant deduction bypasses bundle check
**File:** `SellService.php` line ~325  
**Code:**
```php
if ($item['variantId'] ?? null) {
    $this->deductVariantStock($sell->company_id, $item);  // ← runs even if bundle
} else {
    $product = Product::find($item['productId']);
    if ($product && $product->is_bundle) { ... }
}
```
**Bug:** If user selects a bundle product WITH a variant on the sell item, it skips the bundle check entirely and just deducts the bundle's own variant stock — child products are NOT deducted.

**Fix:** Check `is_bundle` before routing to variant deduction:
```php
private function deductStock(Sell $sell, array $items): void
{
    foreach ($items as $item) {
        if (!isset($item['productId']) || $item['quantity'] <= 0) continue;

        $product = Product::find($item['productId']);

        if ($product && $product->is_bundle) {
            // Always go through bundle path regardless of variantId
            $this->deductBundleStock($sell->company_id, $product, (int) $item['quantity']);
        } elseif ($item['variantId'] ?? null) {
            $this->deductVariantStock($sell->company_id, $item);
        } else {
            $this->deductSimpleProductStock($sell->company_id, $item);
        }
    }
}
```

### Problem 2 — Stock restore on sell delete does NOT restore child products
**File:** `SellService.restoreStock()` — only restores the bundle's own stock column, never touches child product stocks.  
**Impact:** If a sale is cancelled/deleted, child product stocks stay deducted.

**Fix needed:** `restoreStock()` must detect bundle items and reverse child deductions.

### Problem 3 — Bundle price not enforced on POS
POS uses the product's `price` field for sell line total. `bundlePriceOverride` is stored in DB but POS/order creation ignores it — uses base `price` instead.  
**Fix:** Frontend should display `bundlePriceOverride ?? price` for bundle products. Already stored in DB, just needs frontend read.

### Problem 4 — No cost price for bundles
Bundle has no `cost_price` field. Profit margin reports show $0 cost for bundles.  
**Fix (optional):** Auto-compute `cost_price = SUM(child cost_price × child_qty)` in `syncBundleStock()`.

---

## Working Flow Summary

```
Create Bundle
    │
    ├─ Save child products + qty in product_bundle_items table
    └─ syncBundleStock() → bundle.stock = MIN(floor(child_stock / child_qty))

Sell Bundle (qty N)
    │
    ├─ deductBundleStock(bundle, N)
    │     ├─ Product A: stock -= (child_qty × N)
    │     ├─ Product B: stock -= (child_qty × N)
    │     └─ re-sync bundle.stock = MIN(floor(remaining/child_qty))
    └─ sell_items record: product_id=bundle_id, quantity=N, price=bundlePriceOverride??price
```

---

## Action Items (Priority Order)

| # | Fix | File | Effort |
|---|-----|------|--------|
| 1 | **[BUG]** Check `is_bundle` before variant routing in `deductStock()` | `SellService.php:~325` | 5 min |
| 2 | **[BUG]** Restore child stocks on sell delete | `SellService.php:restoreStock()` | 30 min |
| 3 | **[UX]** Use `bundlePriceOverride` in POS display and sell payload | `pos/page.tsx` | 15 min |
| 4 | **[REPORT]** Auto-compute bundle cost_price from children | `ProductService.syncBundleStock()` | 15 min |
