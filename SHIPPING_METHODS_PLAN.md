# Shipping Methods — Implementation Plan

## Overview

Replace the 3 hardcoded shipping options in `aura-shop/src/pages/Checkout.tsx` with dynamic
methods managed from the admin panel and served via a storefront API endpoint.

---

## Architecture

```
Admin Panel  ──CRUD──▶  Laravel API  ──storefront──▶  Aura Shop Checkout
(JWT auth)              (DB table)     (public GET)    (dynamic list)
```

---

## Part 1 — Backend (Laravel)

### 1a. Migration
**File:** `database/migrations/2026_04_21_create_shipping_methods_table.php`

```php
Schema::create('shipping_methods', function (Blueprint $table) {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->string('name');                        // "Standard Shipping"
    $table->string('description')->nullable();     // "Reliable delivery..."
    $table->decimal('price', 10, 2)->default(0);
    $table->string('estimated_days')->nullable();  // "5–7 Business Days"
    $table->string('icon')->nullable();            // "package"|"truck"|"zap"
    $table->boolean('is_active')->default(true);
    $table->unsignedInteger('sort_order')->default(0);
    $table->timestamps();
});
```

### 1b. Model
**File:** `app/Models/ShippingMethod.php`

Fields: `company_id`, `name`, `description`, `price`, `estimated_days`, `icon`,
`is_active`, `sort_order`

### 1c. Admin API Routes (JWT auth)
**File:** `routes/api.php` — add inside the `JwtAuthMiddleware` group:

```
GET    /api/shipping-methods          → index  (list all for company)
POST   /api/shipping-methods          → store
PUT    /api/shipping-methods/{id}     → update
DELETE /api/shipping-methods/{id}     → destroy
PATCH  /api/shipping-methods/{id}/toggle → toggle is_active
```

**Controller:** `app/Http/Controllers/Api/V1/ShippingMethodController.php`
- All actions scope by `auth_company_id` from request attributes (same pattern as other controllers)
- `index`: returns all methods ordered by `sort_order`
- `store`: validates `name` required, `price` numeric
- `toggle`: flips `is_active` boolean

### 1d. Storefront API Route (public, no auth)
**File:** `routes/api.php` — add inside the `store` prefix group (no middleware):

```
GET /api/store/shipping-methods   → StorefrontController::shippingMethods
```

**Method in `StorefrontController`:**
```php
public function shippingMethods(Request $request): JsonResponse
{
    $companyId = $request->query('company_id');
    $methods = ShippingMethod::where('company_id', $companyId)
        ->where('is_active', true)
        ->orderBy('sort_order')
        ->get()
        ->map(fn($m) => [
            'id'             => $m->id,
            'name'           => $m->name,
            'description'    => $m->description,
            'price'          => $m->price,
            'estimated_days' => $m->estimated_days,
            'icon'           => $m->icon,
        ]);
    return response()->json(['success' => true, 'data' => $methods]);
}
```

### 1e. Seeder (demo data for company_id=11)
**File:** `database/seeders/ShippingMethodSeeder.php`

Seed 3 methods: Standard ($5.99, package), Express ($12.99, truck), Overnight ($24.99, zap).
Idempotent — check `firstOrCreate` by `company_id + name`.

---

## Part 2 — Admin Panel (ecommerce-admin)

### 2a. API service
**File:** `lib/shippingMethodApi.ts`

```ts
export interface ShippingMethod {
  id: number
  name: string
  description: string | null
  price: number
  estimatedDays: string | null
  icon: string | null
  isActive: boolean
  sortOrder: number
}

// Methods: getAll(), create(), update(), delete(), toggle()
// Uses existing /api/proxy axios instance with JWT
```

### 2b. New page
**File:** `app/dashboard/shipping-methods/page.tsx`

UI pattern — matches other dashboard list pages:
- Header: "Shipping Methods" + Add button
- Table: Name | Description | Price | Est. Days | Status (toggle switch) | Actions (edit/delete)
- Add/Edit dialog: form with Name*, Description, Price*, Estimated Days, Icon select, Sort Order
- Delete confirmation inline
- Toast feedback on all actions
- Skeleton loading state

**Icon select options:** `package` | `truck` | `zap` | `box` | `globe`
(These match Lucide icon names used in Checkout.tsx)

### 2c. Sidebar nav entry
**File:** `components/app-sidebar.tsx`

Add "Shipping Methods" under the Store or Settings section with `Truck` icon,
linking to `/dashboard/shipping-methods`.

---

## Part 3 — Aura Shop (aura-shop)

### 3a. API service
**File:** `src/services/shippingMethodApi.ts`

```ts
export interface ShippingMethod {
  id: number
  name: string
  description: string | null
  price: number
  estimated_days: string | null
  icon: string | null   // "package"|"truck"|"zap" → mapped to Lucide icon
}

// getActive(): GET /store/shipping-methods → ShippingMethod[]
```

### 3b. Hook
**File:** `src/hooks/useShippingMethods.ts`

```ts
export function useShippingMethods() {
  return useQuery({
    queryKey: ['shipping-methods'],
    queryFn: shippingMethodApi.getActive,
    staleTime: 1000 * 60 * 10,
  })
}
```

### 3c. Update Checkout.tsx
**File:** `src/pages/Checkout.tsx`

Changes:
1. Remove static `shippingMethods` array (lines 29-33)
2. Remove static `ShippingMethodId` type (line 35)
3. Add `useShippingMethods()` hook
4. Change `shippingMethod` state from `ShippingMethodId` to `number | null` (method id)
5. Icon mapping: `{ package: Package, truck: Truck, zap: Zap, box: Box, globe: Globe }`
6. While loading: show 3 skeleton cards in the shipping step
7. After load: set default to first active method (`methods[0]?.id`)
8. `selectedShipping = methods.find(m => m.id === shippingMethod)`
9. Order payload: `shipping_cost: selectedShipping.price`, `shipping_method: selectedShipping.name`
10. If no methods returned: show fallback message "No shipping options available"

---

## File Checklist

### Backend
- [ ] `database/migrations/2026_04_21_create_shipping_methods_table.php`
- [ ] `app/Models/ShippingMethod.php`
- [ ] `app/Http/Controllers/Api/V1/ShippingMethodController.php`
- [ ] `routes/api.php` — admin routes + storefront route
- [ ] `app/Http/Controllers/Api/Storefront/StorefrontController.php` — add `shippingMethods()`
- [ ] `database/seeders/ShippingMethodSeeder.php`

### Admin Panel
- [ ] `lib/shippingMethodApi.ts`
- [ ] `app/dashboard/shipping-methods/page.tsx`
- [ ] `components/app-sidebar.tsx` — add nav link

### Aura Shop
- [ ] `src/services/shippingMethodApi.ts`
- [ ] `src/hooks/useShippingMethods.ts`
- [ ] `src/pages/Checkout.tsx` — replace static data with hook

---

## Order of Implementation

1. Migration + Model + Seeder (backend foundation)
2. Admin API controller + routes
3. Storefront API route
4. Admin panel page + sidebar link
5. Aura shop service + hook + Checkout update

---

## Key Decisions

- **Icon field** stores the Lucide icon name as a string (`"truck"`) — the frontend maps it
  to the actual component. Avoids storing SVG in DB.
- **sort_order** controls display order — admin can reorder by editing the number.
- **Storefront endpoint is public** (no customer auth needed) — shipping options must be
  visible before checkout starts (e.g. on product pages or cart).
- **Fallback**: if the API returns 0 methods, Checkout shows a message rather than breaking.
- **Existing order payload** already sends `shipping_cost` — field name unchanged, just value
  becomes dynamic.
