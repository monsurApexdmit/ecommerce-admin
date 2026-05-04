# Expo Admin App — Implementation Plan

> Project path: `apps/expo-admin/`
> Based on full analysis of both the **existing expo-admin codebase** and the **web admin** (58 pages · 34 APIs · 17 contexts)

---

## What Is Already Built

### Infrastructure (Complete ✅)
| File | What It Does |
|---|---|
| `src/lib/api.ts` | Axios client + Bearer token + `company_id` interceptors |
| `src/lib/storage.ts` | AsyncStorage session persistence |
| `src/context/AuthContext.tsx` | Login, logout, bootstrap, profile refresh |
| `src/constants/theme.ts` | Color tokens (emerald primary, slate bg/text) |
| `src/components/Screen.tsx` | Safe-area scroll wrapper |
| `src/components/StatCard.tsx` | Dashboard stats tile |
| `src/components/ListCard.tsx` | Info card |

### Services (Complete ✅)
| Service | Endpoints Covered |
|---|---|
| `src/services/auth.ts` | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` |
| `src/services/dashboard.ts` | `GET /sells/stats` |
| `src/services/products.ts` | Full CRUD + stats + reviews + multipart upload |
| `src/services/catalog.ts` | Categories, vendors, warehouses, attributes |
| `src/services/order-service.ts` | Orders, order stats, order detail, shipments, tracking |

### Screens (Complete ✅)
| Route | Status |
|---|---|
| `(auth)/login.tsx` | Login form, redirects if session exists |
| `(tabs)/index.tsx` | Dashboard with 4 stats cards |
| `(tabs)/products.tsx` | Full list — search, filter, sort, bulk, pagination |
| `(tabs)/orders.tsx` | Orders list (check current state) |
| `(tabs)/account.tsx` | Account screen |
| `products/[id].tsx` | Product detail |
| `products/create.tsx` | Create product |
| `products/[id]/edit.tsx` | Edit product |
| `products/[id]/reviews.tsx` | Reviews + admin reply |
| `products/[id]/barcode.tsx` | Single product barcode |
| `products/barcodes.tsx` | Bulk barcode workflow |
| `orders/[id].tsx` | Order detail |
| `orders/shipments.tsx` | Shipments list |

### Tab Navigator
4 tabs: **Dashboard · Products · Orders · Account**

### Current Tech Stack
```
Expo SDK 54 · expo-router 6 · React Native 0.81.5 · React 19
Axios · AsyncStorage · react-native-reanimated 4 · react-native-svg
expo-image-picker · expo-print · expo-sharing
Ionicons
```

---

## Design System (Existing — Keep & Extend)

### Current Colors (`src/constants/theme.ts`)
```typescript
export const colors = {
  background:  "#f8fafc",   // slate-50
  surface:     "#ffffff",
  border:      "#e2e8f0",   // slate-200
  text:        "#0f172a",   // slate-900
  muted:       "#64748b",   // slate-500
  primary:     "#059669",   // emerald-600
  primaryDark: "#047857",   // emerald-700
  danger:      "#dc2626",
  warning:     "#d97706",
  info:        "#2563eb",
}
```

### Design Improvements to Add
Extend theme with missing tokens — **do not change existing values**:
```typescript
// Add to src/constants/theme.ts
export const colors = {
  // ... keep all existing ...

  success:     "#16a34a",   // green-600
  successBg:   "#dcfce7",   // green-100
  dangerBg:    "#fee2e2",   // red-100
  warningBg:   "#fef3c7",   // amber-100
  infoBg:      "#dbeafe",   // blue-100
  primaryBg:   "#ecfdf5",   // emerald-50

  // Gradient endpoints (for LinearGradient)
  gradientStart: "#059669", // emerald-600
  gradientEnd:   "#2563eb", // blue-600
}

export const radius = {
  sm:  10,
  md:  14,
  lg:  18,
  xl:  24,
  pill: 999,
}

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  20,
  xl:  28,
  xxl: 40,
}
```

### Component Patterns (follow existing code style)
- `StyleSheet.create()` — already used, keep it
- `Ionicons` — already installed, use for all icons
- `Pressable` — already preferred over `TouchableOpacity`
- Bottom sheet: `Modal` with `animationType="slide"` + `justifyContent: "flex-end"` (already in products.tsx)
- Cards: `borderRadius: 18, borderWidth: 1, borderColor: colors.border`

---

## Remaining Phases

---

## Phase 1 — Auth Improvements ✅ COMPLETE

**Current state:** Login works. No signup, no forgot password, no password show/hide.

### What to add

**a) Password visibility toggle** in `(auth)/login.tsx`
```
┌─────────────────────────────────────┐
│ Password                            │
│ ┌─────────────────────────────────┐ │
│ │ ••••••••              [👁 Show] │ │  ← Pressable eye icon
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**b) Forgot Password screen** `(auth)/forgot-password.tsx`
- Email input → `POST /auth/forgot-password`
- Success state: "Check your email" message
- Link from login screen

**c) Auth screen polish**
- Keyboard-aware scroll (use `KeyboardAvoidingView`)
- Disable button while loading (already done — keep)
- Remove dev help text from login (`EXPO_PUBLIC_API_BASE_URL` instructions)

**Files:** `app/(auth)/login.tsx`, `app/(auth)/forgot-password.tsx` (new)

---

## Phase 2 — Dashboard Upgrade ✅ COMPLETE

**Current state:** 4 stats cards (Revenue, Orders, Pending, Delivered) + 2 info `ListCard` tiles.

### What to replace/add

**a) Remove placeholder `ListCard` tiles** — replace with real data

**b) Recent Orders list** (already have `getOrders` in order-service)
```
┌─────────────────────────────────────┐
│ Recent Orders                  →   │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ #INV-001  John Doe      $240    │ │
│ │           PENDING  May 3, 2026  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ #INV-002  Sarah M.      $85     │ │
│ │           DELIVERED May 2, 2026 │ │
│ └─────────────────────────────────┘ │
│ [See all orders]                    │
└─────────────────────────────────────┘
```

**c) Quick stats row** — add Products count + Vendors count

**d) Greeting with date**
```
APEXDMIT                           ← company name in primary color
Welcome back, Monsur               ← user first name
Saturday, May 3 2026
```

**Files:** `app/(tabs)/index.tsx`

---

## Phase 3 — POS Terminal (Week 2–3) ⭐ Flagship ✅ COMPLETE

**Current state:** ✅ Fully implemented. All components built and POS tab registered in tab bar.

### New file: `app/(tabs)/pos.tsx` + add POS to tab bar

**Tab bar update** (replace Account with POS, move Account to More):
```
┌──────┬──────┬──────┬──────┬──────┐
│  🏠  │  📦  │  🛒  │  📋  │  ☰  │
│ Home │ Prod │ POS  │Orders│ More │
└──────┴──────┴──────┴──────┴──────┘
```

### POS Main Screen
```
┌─────────────────────────────────────┐
│ POS              [🏪 Warehouse ▾]   │
│ ┌──────────────────────┐ [📷 Scan] │
│ │ 🔍 Search products   │           │
│ └──────────────────────┘           │
├─────────────────────────────────────┤
│ [All] [Shoes] [Bags] [Electronics]→ │  ← Horizontal ScrollView tabs
├─────────────────────────────────────┤
│ ┌──────────┐  ┌──────────┐          │
│ │  [img]   │  │  [img]   │          │  ← 2-col grid, FlashList
│ │ Nike Air │  │ Adidas   │          │
│ │  $129    │  │  $89     │          │
│ │  [+ Add] │  │  [+ Add] │          │
│ └──────────┘  └──────────┘          │
├─────────────────────────────────────┤
│ Cart · 3 items               $358  │  ← Collapsible bottom panel
│ [👤 Walk-in Customer ▾]             │
│ Nike Air ×2 $258    [-] [+] [🗑]   │
│ Adidas   ×1  $89    [-] [+] [🗑]   │
│ Subtotal $347   Tax (15%) $52.05   │
│ [% Discount]  [🎟 Coupon]          │
│ ┌─────────────────────────────────┐ │
│ │       Checkout  $399.05  →      │ │  ← emerald button
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Checkout Modal (Bottom Sheet)
```
┌─────────────────────────────────────┐
│ ─── Secure Payment 🔒               │
│     Total: $399.05                  │  ← emerald/blue gradient header
├─────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌───────┐ │
│ │ 💵 Cash  │ │ 💳 Card  │ │  COD  │ │  ← 3-col selector
│ │ [active] │ │          │ │       │ │
│ └──────────┘ └──────────┘ └───────┘ │
│ Amount Tendered                     │
│ ┌─────────────────────────────────┐ │
│ │ $  400.00                       │ │
│ └─────────────────────────────────┘ │
│ Change: $0.95                       │
│ ┌─────────────────────────────────┐ │
│ │      Confirm Payment  ✓         │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### New components needed
- `src/components/pos/PosProductCard.tsx`
- `src/components/pos/PosCartItem.tsx`
- `src/components/pos/CheckoutModal.tsx`
- `src/components/pos/DiscountModal.tsx`
- `src/components/pos/SuccessModal.tsx`
- `src/components/pos/CouponModal.tsx`

### New service: `src/services/pos.ts`
- `createSell(payload)` — wraps `POST /sells`
- `getActiveCoupons()` — wraps `GET /coupons`

**Files:** `app/(tabs)/pos.tsx`, `app/(tabs)/_layout.tsx` (add POS tab)

---

## Phase 4 — Orders Module Completion (Week 3)

**Current state:** `app/(tabs)/orders.tsx` + `orders/[id].tsx` + `orders/shipments.tsx` exist. Verify completeness.

### Orders List — verify/add
```
┌─────────────────────────────────────┐
│ Orders                    Filter ☰  │
├─────────────────────────────────────┤
│ [All] [Pending] [Processing] [Done] │  ← filter chips with counts
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ #INV-2024-001         PENDING   │ │  ← status pill (matches web)
│ │ John Doe · 3 items              │ │
│ │ $240.00         May 3, 2026     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Order Detail — verify/add
```
┌─────────────────────────────────────┐
│ ← #INV-001      [Change Status ▾]   │
├─────────────────────────────────────┤
│ ● Pending → Processing → Delivered  │  ← progress stepper
├─────────────────────────────────────┤
│ John Doe · john@email.com           │
│ +1 555-0123                         │
├─────────────────────────────────────┤
│ Items (3)                           │
│  [img] Nike Air Max  ×2   $258      │
│  [img] Socks         ×1    $12      │
├─────────────────────────────────────┤
│ Subtotal $270  Tax $40.50           │
│ Discount -$20  Total $290.50        │
├─────────────────────────────────────┤
│ [🖨 Print Invoice] [📦 Shipment]    │
└─────────────────────────────────────┘
```

**Additions if missing:**
- Status change bottom sheet with `updateOrderStatus()`
- Print/share invoice via `expo-print` + `expo-sharing` (already installed)
- Link to shipment screen from order detail

**Files:** `app/(tabs)/orders.tsx`, `app/orders/[id].tsx`, `app/orders/shipments.tsx`

---

## Phase 5 — Inventory Module (Week 4)

**Current state:** Not started. Mirrors `app/dashboard/inventory/page.tsx`.

### New files
- `app/inventory/index.tsx` — stock list with warehouse filter
- `app/inventory/transfer.tsx` — transfer stock between locations

### New service: `src/services/inventory.ts`
Wrap existing web `inventoryApi.ts` + `transferApi.ts`:
- `getInventory(params)` — `GET /inventory`
- `getInventoryStats()` — `GET /inventory/stats`
- `createTransfer(draft)` — `POST /transfers`
- `getTransfers()` — `GET /transfers`

### Inventory Screen
```
┌─────────────────────────────────────┐
│ ← Inventory     [Warehouse: All ▾]  │
├─────────────────────────────────────┤
│ ┌──────────┐  ┌──────────┐          │
│ │  1,240   │  │  18 ⚠   │          │  ← total · low stock
│ │  Total   │  │ Low Stock│          │
│ └──────────┘  └──────────┘          │
├─────────────────────────────────────┤
│ 🔍 Search products...               │
├─────────────────────────────────────┤
│ Nike Air Max (Size 10)              │
│ Warehouse A  ████████░░  45 units   │  ← progress bar
│ Warehouse B  ████░░░░░░  18 units   │
├─────────────────────────────────────┤
│ [+ Transfer Stock]                  │
└─────────────────────────────────────┘
```

**Add to "More" menu:** Inventory link

---

## Phase 6 — Customers Module (Week 4–5)

**Current state:** Not started. Mirrors `app/dashboard/customers/page.tsx`.

### New files
- `app/customers/index.tsx` — customer list
- `app/customers/[id].tsx` — customer detail + order history

### New service: `src/services/customers.ts`
- `getCustomers(params)` — `GET /customers`
- `getCustomerStats()` — `GET /customers/stats`
- `getCustomerById(id)` — `GET /customers/{id}`

### Customer List
```
┌─────────────────────────────────────┐
│ Customers                  + Add    │
│ 🔍 Search by name or email...       │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ JD  John Doe                    │ │  ← initials avatar
│ │     john@example.com            │ │
│ │     12 orders  ·  $1,240 total  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## Phase 7 — Vendors Module (Week 5)

**Current state:** Not started. Mirrors `app/dashboard/vendors/page.tsx` + `vendors/[id]/page.tsx`.

### New files
- `app/vendors/index.tsx`
- `app/vendors/[id].tsx`

### New service: `src/services/vendors.ts`
- `getVendors(params)`, `getVendorById(id)`, `createVendor()`, `updateVendor()`, `deleteVendor()`
- Note: `getVendors` already exists in `catalog.ts` — extract to own service

---

## Phase 8 — Returns Module (Week 5–6)

**Current state:** Not started. Mirrors `returns/customer/page.tsx` + `returns/vendor/page.tsx`.

### New files
- `app/returns/index.tsx` — segmented control: Customer / Vendor
- `app/returns/customer/create.tsx` — create customer return
- `app/returns/vendor/create.tsx` — create vendor return

### New service: `src/services/returns.ts`
- `getCustomerReturns()`, `createCustomerReturn(draft)`
- `getVendorReturns()`, `createVendorReturn(draft)`

### Returns Screen
```
┌─────────────────────────────────────┐
│ Returns                   + New     │
│ ┌──────────────┐ ┌────────────────┐ │
│ │   Customer   │ │     Vendor     │ │  ← segmented control
│ └──────────────┘ └────────────────┘ │
├─────────────────────────────────────┤
│ RET-001  Nike Air Max  ×2   $258    │
│ John Doe · Defective       PENDING  │
└─────────────────────────────────────┘
```

---

## Phase 9 — Staff & Salary Module (Week 6)

**Current state:** Not started. Mirrors `staff/page.tsx` + `staff/roles/page.tsx` + `staff/salary/page.tsx`.

### New files
- `app/staff/index.tsx` — staff list with tab bar (Members · Roles · Salary)
- `app/staff/invite.tsx` — invite new staff member

### New service: `src/services/staff.ts`
- `getStaff()`, `getStaffStats()`, `inviteStaff(draft)`, `updateStaffRole(id, role)`, `deleteStaff(id)`
- `getSalaryPayments()`, `createSalaryPayment(draft)`

### Staff Screen
```
┌─────────────────────────────────────┐
│ Staff                  [+ Invite]   │
│ [Members]  [Roles]  [Salary]        │  ← tab bar
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ MS  Monsur Shafiq       OWNER   │ │
│ │     monsur@apexdmit.com         │ │
│ │     Since Jan 2024              │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## Phase 10 — Settings & Company (Week 7)

**Current state:** `(tabs)/account.tsx` exists — likely basic. Expand it into a full Settings experience.

### Account/Settings Screen
```
┌─────────────────────────────────────┐
│ Account                             │
├─────────────────────────────────────┤
│ 👤 Monsur Shafiq   OWNER            │
│    monsur@apexdmit.com              │
│    Apexdmit                         │
├─────────────────────────────────────┤
│ ACCOUNT                             │
│  🏢 Company Profile            →   │
│  💳 Billing & Subscription     →   │
│  👥 Team Members               →   │
│  ✏️ Edit Profile               →   │
├─────────────────────────────────────┤
│ STORE                               │
│  ⚙️ General Settings           →   │
│  🌐 International              →   │
│  🚚 Shipping Methods           →   │
│  💰 Payment Methods            →   │
├─────────────────────────────────────┤
│ SUBSCRIPTION                        │
│ Pro Plan         [Upgrade]          │
│ Trial: 7 days  ████████░░           │
├─────────────────────────────────────┤
│ [Sign Out]                          │
└─────────────────────────────────────┘
```

### New sub-screens
- `app/settings/company-profile.tsx`
- `app/settings/billing.tsx`
- `app/settings/team.tsx`
- `app/settings/general.tsx`

### New service: `src/services/settings.ts`
- Wrap `saasCompanyApi.ts` + `settingsApi.ts` from web

---

## Phase 11 — "More" Menu (Week 7)

The 5th tab opens a full-screen grid of all sections not in the main tabs.

### `app/(tabs)/more.tsx`
```
┌─────────────────────────────────────┐
│ More                                │
├─────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐           │
│ │    🔄    │ │    👤    │           │
│ │ Inventory│ │Customers │           │
│ └──────────┘ └──────────┘           │
│ ┌──────────┐ ┌──────────┐           │
│ │    🏢    │ │    ↩️    │           │
│ │  Vendors │ │  Returns │           │
│ └──────────┘ └──────────┘           │
│ ┌──────────┐ ┌──────────┐           │
│ │    👔    │ │    🎟️   │           │
│ │   Staff  │ │  Coupons │           │
│ └──────────┘ └──────────┘           │
│ ┌──────────┐ ┌──────────┐           │
│ │    📢    │ │    ⚙️    │           │
│ │  Support │ │ Settings │           │
│ └──────────┘ └──────────┘           │
└─────────────────────────────────────┘
```

**Update `(tabs)/_layout.tsx`:** Replace 4-tab layout with 5-tab layout:
`Dashboard · Products · POS · Orders · More`

---

## Phase 12 — Notifications (Week 8)

**Current state:** Not started. Mirrors `notifications/page.tsx` + `notification-context.tsx`.

### New files
- `app/notifications/index.tsx` — notification center
- `src/services/notifications.ts` — `getNotifications()`, `markAsRead(id)`

### Push Notifications (stretch goal)
- Install `expo-notifications`
- Register FCM token on login via `POST /devices`
- Handle background notification tap → deep link to order/product

---

## Full Feature Parity Matrix

| Web Feature | Expo File | Status |
|---|---|---|
| Authentication (login) | `(auth)/login.tsx` | ✅ Done |
| Forgot password | `(auth)/forgot-password.tsx` | ✅ Done |
| Dashboard stats | `(tabs)/index.tsx` | ✅ Done |
| Dashboard recent orders | `(tabs)/index.tsx` | ✅ Done |
| Product list (full) | `(tabs)/products.tsx` | ✅ Done |
| Product detail | `products/[id].tsx` | ✅ Done |
| Product create/edit | `products/create.tsx`, `[id]/edit.tsx` | ✅ Done |
| Product reviews | `products/[id]/reviews.tsx` | ✅ Done |
| Barcode single | `products/[id]/barcode.tsx` | ✅ Done |
| Barcode bulk | `products/barcodes.tsx` | ✅ Done |
| POS Terminal | `(tabs)/pos.tsx` | ✅ Phase 3 |
| Orders list | `(tabs)/orders.tsx` | ✅ (verify) |
| Order detail + status | `orders/[id].tsx` | ✅ (verify) |
| Shipments | `orders/shipments.tsx` | ✅ (verify) |
| Inventory | `inventory/index.tsx` | ⬜ Phase 5 |
| Stock transfer | `inventory/transfer.tsx` | ⬜ Phase 5 |
| Customers | `customers/index.tsx` | ⬜ Phase 6 |
| Customer detail | `customers/[id].tsx` | ⬜ Phase 6 |
| Vendors | `vendors/index.tsx` | ⬜ Phase 7 |
| Vendor detail | `vendors/[id].tsx` | ⬜ Phase 7 |
| Customer returns | `returns/index.tsx` | ⬜ Phase 8 |
| Vendor returns | `returns/index.tsx` | ⬜ Phase 8 |
| Staff list | `staff/index.tsx` | ⬜ Phase 9 |
| Salary management | `staff/index.tsx` | ⬜ Phase 9 |
| Company profile | `settings/company-profile.tsx` | ⬜ Phase 10 |
| Billing & plans | `settings/billing.tsx` | ⬜ Phase 10 |
| Team management | `settings/team.tsx` | ⬜ Phase 10 |
| General settings | `settings/general.tsx` | ⬜ Phase 10 |
| More menu | `(tabs)/more.tsx` | ⬜ Phase 11 |
| Notifications | `notifications/index.tsx` | ⬜ Phase 12 |
| Coupons | `coupons/index.tsx` | ⬜ Post-MVP |
| Support tickets | `support/index.tsx` | ⬜ Post-MVP |
| CMS pages | `pages/index.tsx` | ⬜ Post-MVP |
| Categories | `categories/index.tsx` | ⬜ Post-MVP |
| Attributes | `attributes/index.tsx` | ⬜ Post-MVP |

---

## Packages to Install

```bash
# POS barcode scanner
npx expo install expo-barcode-scanner
# OR use expo-camera which is more modern:
npx expo install expo-camera

# Notifications (Phase 12)
npx expo install expo-notifications

# Linear gradient (POS checkout header)
npx expo install expo-linear-gradient
```

> **Note:** `react-native-reanimated`, `expo-print`, `expo-sharing` are already installed.
> `FlashList` from `@shopify/flash-list` is recommended for POS product grid performance but FlatList works fine to start.

---

## Mobile-Only Features (Beyond Web)

| Feature | Phase | Notes |
|---|---|---|
| Camera barcode scanning | 3 (POS) | `expo-camera` — faster than web input |
| Biometric login | 1 | `expo-local-authentication` — add after Phase 1 |
| Pull-to-refresh | All lists | Already in products, replicate pattern |
| Print/share invoice | 4 (Orders) | `expo-print` + `expo-sharing` already installed |
| Haptic feedback on cart actions | 3 (POS) | `expo-haptics` — subtle, improves feel |
| Offline POS queue | Post-MVP | Queue in AsyncStorage, sync on reconnect |

---

## Development Timeline

| Week | Phase | Deliverable |
|---|---|---|
| 1 | Phase 1 + 2 | Auth polish + Dashboard real data |
| 2–3 | Phase 3 | POS Terminal (highest value) |
| 3 | Phase 4 | Orders completion + invoice print |
| 4 | Phase 5 | Inventory + transfers |
| 4–5 | Phase 6 | Customers |
| 5 | Phase 7 | Vendors |
| 5–6 | Phase 8 | Returns |
| 6 | Phase 9 | Staff + salary |
| 7 | Phase 10 + 11 | Settings + More menu |
| 8 | Phase 12 | Notifications |
| 9–10 | — | Polish, dark mode, app store prep |

---

## Architecture Notes

### What's Working Well — Keep It
- `StyleSheet.create()` — performant, type-safe, consistent
- `Pressable` over `TouchableOpacity`
- Bottom-sheet Modals with `animationType="slide"`
- Session stored in AsyncStorage via `src/lib/storage.ts`
- Axios interceptor automatically injects `Bearer` token + `company_id`
- Services are thin, types are clean and separate

### Improvement Opportunities
- **`AsyncStorage` → consider `expo-secure-store`** for the auth token (more secure on both iOS and Android)
- **No loading skeleton** — add skeleton shimmer pattern for initial loads (products page uses `ActivityIndicator`, upgrade to skeleton for lists)
- **No error boundary** — add a top-level error boundary in `app/_layout.tsx`
- **Tabs limited to 4** — upgrade to 5 with More menu in Phase 11
- **No haptics** — add `expo-haptics` for cart actions in POS (improves perceived quality significantly)
