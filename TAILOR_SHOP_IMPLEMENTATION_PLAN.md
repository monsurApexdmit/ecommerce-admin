# Tailor Shop / Custom Order Management — Implementation Plan

## Overview

New standalone module inside existing ecommerce-admin (Next.js) + inventory-laravel (Laravel 12) stack.
Matches existing design system. Keeps tailor orders fully separate from ecommerce sells.
Multi-tenant: all tables include `company_id`.

---

## Phase 1 — Backend: Database & Models

### 1.1 Migrations (Laravel)

Create in order (foreign key dependencies):

```
database/migrations/
  2025_xx_xx_000001_create_tailor_fabrics_table.php
  2025_xx_xx_000002_create_tailor_customers_table.php
  2025_xx_xx_000003_create_tailor_measurements_table.php
  2025_xx_xx_000004_create_tailor_dorjis_table.php
  2025_xx_xx_000005_create_tailor_orders_table.php
  2025_xx_xx_000006_create_tailor_order_items_table.php
  2025_xx_xx_000007_create_tailor_assignments_table.php
  2025_xx_xx_000008_create_tailor_payments_table.php
  2025_xx_xx_000009_create_tailor_status_logs_table.php
```

### 1.2 Schema Details

#### tailor_fabrics
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| company_id | bigint FK | |
| name | string | |
| fabric_type | string | cotton/silk/linen/synthetic/etc |
| color | string | |
| pattern | string | nullable |
| unit | enum | goj, gaj |
| purchase_price | decimal(10,2) | |
| selling_price | decimal(10,2) | |
| stock_quantity | decimal(10,2) | in goj/gaj |
| supplier_name | string | nullable |
| image_path | string | nullable |
| status | enum | active, inactive |
| timestamps | | |

#### tailor_customers
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| company_id | bigint FK | |
| name | string | |
| phone | string | unique per company |
| address | text | nullable |
| notes | text | nullable |
| timestamps | | |

#### tailor_measurements
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| company_id | bigint FK | |
| customer_id | bigint FK tailor_customers | |
| product_type | string | pajama/jama/panjabi/shirt/pants/blouse/etc |
| chest | decimal(5,1) | nullable |
| waist | decimal(5,1) | nullable |
| hip | decimal(5,1) | nullable |
| shoulder | decimal(5,1) | nullable |
| sleeve | decimal(5,1) | nullable |
| length | decimal(5,1) | nullable |
| neck | decimal(5,1) | nullable |
| bottom_length | decimal(5,1) | nullable |
| inseam | decimal(5,1) | nullable |
| pajama_waist | decimal(5,1) | nullable |
| pajama_length | decimal(5,1) | nullable |
| custom_fields | json | nullable — key/value for extra measurements |
| notes | text | nullable |
| measured_at | date | |
| timestamps | | |

#### tailor_dorjis
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| company_id | bigint FK | |
| name | string | |
| phone | string | |
| address | text | nullable |
| speciality | json | array: ['pajama','shirt',...] |
| commission_type | enum | fixed, percentage |
| commission_value | decimal(10,2) | |
| status | enum | active, inactive |
| notes | text | nullable |
| timestamps | | |

#### tailor_orders
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| company_id | bigint FK | |
| order_number | string | unique, auto-generated e.g. TO-20250512-001 |
| customer_id | bigint FK tailor_customers | |
| order_date | date | |
| delivery_date | date | nullable |
| stitching_charge | decimal(10,2) | default 0 |
| extra_charge | decimal(10,2) | default 0 |
| discount | decimal(10,2) | default 0 |
| total_amount | decimal(10,2) | computed |
| paid_amount | decimal(10,2) | default 0 |
| due_amount | decimal(10,2) | computed: total - paid |
| payment_status | enum | unpaid, partial, paid |
| order_status | enum | pending, measurement_taken, assigned, cutting, stitching, ready, delivered, cancelled |
| notes | text | nullable |
| timestamps | | |

#### tailor_order_items
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| order_id | bigint FK tailor_orders | |
| product_type | string | pajama/panjabi/shirt/etc |
| fabric_id | bigint FK tailor_fabrics | nullable (customer brings own) |
| fabric_quantity | decimal(10,2) | in goj/gaj |
| fabric_unit_price | decimal(10,2) | snapshot at time of order |
| measurement_id | bigint FK tailor_measurements | nullable |
| notes | text | nullable |
| timestamps | | |

#### tailor_assignments
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| company_id | bigint FK | |
| order_id | bigint FK tailor_orders | |
| dorji_id | bigint FK tailor_dorjis | |
| assigned_date | date | |
| expected_completion | date | nullable |
| dorji_charge | decimal(10,2) | |
| work_status | enum | assigned, in_progress, completed, returned |
| admin_notes | text | nullable |
| timestamps | | |

#### tailor_payments
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| company_id | bigint FK | |
| order_id | bigint FK tailor_orders | |
| amount | decimal(10,2) | |
| payment_method | string | cash/card/bkash/nagad/etc |
| payment_date | date | |
| reference | string | nullable |
| notes | text | nullable |
| timestamps | | |

#### tailor_status_logs
| Column | Type | Notes |
|--------|------|-------|
| id | bigint PK | |
| order_id | bigint FK tailor_orders | |
| from_status | string | nullable |
| to_status | string | |
| changed_by | bigint FK users | |
| note | text | nullable |
| timestamps | | |

### 1.3 Models & Relationships

```
app/Models/
  TailorFabric.php       — belongsTo Company; hasMany TailorOrderItem
  TailorCustomer.php     — belongsTo Company; hasMany TailorMeasurement; hasMany TailorOrder
  TailorMeasurement.php  — belongsTo TailorCustomer
  TailorDorji.php        — belongsTo Company; hasMany TailorAssignment
  TailorOrder.php        — belongsTo TailorCustomer; hasMany TailorOrderItem, TailorAssignment, TailorPayment, TailorStatusLog
  TailorOrderItem.php    — belongsTo TailorOrder; belongsTo TailorFabric
  TailorAssignment.php   — belongsTo TailorOrder; belongsTo TailorDorji
  TailorPayment.php      — belongsTo TailorOrder
  TailorStatusLog.php    — belongsTo TailorOrder
```

**Auto-stock deduction**: `TailorOrder` observer on `created`/`updated` — recalculate fabric usage from `tailor_order_items`, deduct from `tailor_fabrics.stock_quantity`.

**Auto-compute**: `TailorOrder` model `boot()` — `total_amount` = fabric cost + stitching_charge + extra_charge − discount. `due_amount` = total − paid. `payment_status` auto-set from paid ratio.

---

## Phase 2 — Backend: API Controllers & Routes

### 2.1 Controllers

```
app/Http/Controllers/Api/Tailor/
  TailorFabricController.php     — index, store, show, update, destroy
  TailorCustomerController.php   — index, store, show, update, findByPhone
  TailorMeasurementController.php — index, store, show, update, byCustomer
  TailorDorjiController.php      — index, store, show, update, destroy
  TailorOrderController.php      — index, store, show, update, destroy, updateStatus, invoice
  TailorAssignmentController.php — index, store, show, update
  TailorPaymentController.php    — index, store (adds payment, updates order paid_amount)
  TailorReportController.php     — dashboard stats, orders report, fabric stock, dorji report
```

### 2.2 Routes (api.php)

```php
Route::prefix('tailor')->middleware(['auth:sanctum', 'check_company'])->group(function () {
    Route::apiResource('fabrics',      TailorFabricController::class);
    Route::apiResource('customers',    TailorCustomerController::class);
    Route::get('customers/search/phone', [TailorCustomerController::class, 'findByPhone']);
    Route::apiResource('measurements', TailorMeasurementController::class);
    Route::get('measurements/customer/{customerId}', [TailorMeasurementController::class, 'byCustomer']);
    Route::apiResource('dorjis',       TailorDorjiController::class);
    Route::apiResource('orders',       TailorOrderController::class);
    Route::patch('orders/{id}/status', [TailorOrderController::class, 'updateStatus']);
    Route::get('orders/{id}/invoice',  [TailorOrderController::class, 'invoice']);
    Route::apiResource('assignments',  TailorAssignmentController::class);
    Route::apiResource('payments',     TailorPaymentController::class);
    Route::get('reports/dashboard',    [TailorReportController::class, 'dashboard']);
    Route::get('reports/orders',       [TailorReportController::class, 'orders']);
    Route::get('reports/fabrics',      [TailorReportController::class, 'fabrics']);
    Route::get('reports/dorjis',       [TailorReportController::class, 'dorjis']);
});
```

### 2.3 Permissions (add to permissions seeder)

```
TailorShop.read
TailorShop.write
TailorShop.delete
TailorFabric.read / write / delete
TailorOrders.read / write / delete
TailorMeasurements.read / write / delete
TailorDorji.read / write / delete
TailorPayments.read / write / delete
TailorReports.read
```

---

## Phase 3 — Frontend: API Library

### 3.1 New file: `lib/tailorApi.ts`

Follows exact pattern of `sellsApi.ts`:
- Axios instance with `/api/proxy` base
- Token + company_id interceptors
- Full TypeScript interfaces for all entities
- CRUD methods for each resource

```typescript
// Interfaces
export interface TailorFabric { id: number; name: string; fabricType: string; color: string; ... }
export interface TailorCustomer { id: number; name: string; phone: string; ... }
export interface TailorMeasurement { id: number; customerId: number; productType: string; chest?: number; ... }
export interface TailorDorji { id: number; name: string; phone: string; speciality: string[]; ... }
export interface TailorOrder { id: number; orderNumber: string; customerId: number; orderStatus: TailorOrderStatus; ... }
export interface TailorAssignment { id: number; orderId: number; dorjiId: number; workStatus: string; ... }
export interface TailorPayment { id: number; orderId: number; amount: number; ... }

// API object
export const tailorApi = {
  // Fabrics
  getFabrics: (params?) => client.get('/tailor/fabrics', { params }),
  createFabric: (data) => client.post('/tailor/fabrics', data),
  updateFabric: (id, data) => client.put(`/tailor/fabrics/${id}`, data),
  deleteFabric: (id) => client.delete(`/tailor/fabrics/${id}`),

  // Customers
  getCustomers: (params?) => client.get('/tailor/customers', { params }),
  findCustomerByPhone: (phone) => client.get('/tailor/customers/search/phone', { params: { phone } }),
  createCustomer: (data) => client.post('/tailor/customers', data),

  // Measurements
  getMeasurementsByCustomer: (customerId) => client.get(`/tailor/measurements/customer/${customerId}`),
  createMeasurement: (data) => client.post('/tailor/measurements', data),

  // Dorjis
  getDorjis: (params?) => client.get('/tailor/dorjis', { params }),
  createDorji: (data) => client.post('/tailor/dorjis', data),
  updateDorji: (id, data) => client.put(`/tailor/dorjis/${id}`, data),

  // Orders
  getOrders: (params?) => client.get('/tailor/orders', { params }),
  createOrder: (data) => client.post('/tailor/orders', data),
  updateOrder: (id, data) => client.put(`/tailor/orders/${id}`, data),
  updateOrderStatus: (id, status, note?) => client.patch(`/tailor/orders/${id}/status`, { status, note }),
  getOrderInvoice: (id) => client.get(`/tailor/orders/${id}/invoice`),

  // Assignments
  createAssignment: (data) => client.post('/tailor/assignments', data),
  updateAssignment: (id, data) => client.put(`/tailor/assignments/${id}`, data),

  // Payments
  createPayment: (data) => client.post('/tailor/payments', data),

  // Reports
  getDashboardStats: () => client.get('/tailor/reports/dashboard'),
  getOrdersReport: (params?) => client.get('/tailor/reports/orders', { params }),
  getFabricsReport: () => client.get('/tailor/reports/fabrics'),
  getDorjisReport: (params?) => client.get('/tailor/reports/dorjis', { params }),
}
```

---

## Phase 4 — Frontend: Pages

### 4.1 Directory structure

```
app/dashboard/tailor/
  page.tsx                          — Dashboard (stats cards + recent orders)
  fabrics/
    page.tsx                        — Fabric inventory table + add/edit modal
  orders/
    page.tsx                        — Orders list with filters
    new/page.tsx                    — Create new order form
    [id]/page.tsx                   — Order detail + status timeline + invoice print
  measurements/
    page.tsx                        — Measurement list, search by phone
    new/page.tsx                    — Add measurement form
  dorjis/
    page.tsx                        — Dorji list + add/edit modal
  assignments/
    page.tsx                        — Assignments table + assign modal
  payments/
    page.tsx                        — Payment history + add payment modal
  reports/
    page.tsx                        — Report tabs: orders / fabric stock / dorji
```

### 4.2 Page Descriptions

#### `/dashboard/tailor` — Dashboard
- Stat cards: Today's Orders, Pending, Ready for Delivery, Delivered, Total Due, Low Stock Fabrics, Active Dorjis
- Recent 5 orders table
- Quick action buttons: New Order, Add Fabric, Manage Dorjis

#### `/dashboard/tailor/fabrics` — Fabric Inventory
- Table: image, name, type, color, stock (goj), selling price, status, actions
- Add/Edit modal with all fields + image upload
- Stock shown in red when below threshold (< 5 goj)
- Search + filter by type/status

#### `/dashboard/tailor/orders` — Orders List
- Filters: status, payment status, dorji, customer phone, delivery date range
- Table: order number, customer, product types, total, due, status, delivery date, actions
- Quick status update dropdown per row
- Pagination

#### `/dashboard/tailor/orders/new` — Create Order
- Step 1: Customer — phone lookup → auto-fill if exists → or create new
- Step 2: Items — product type + fabric selector + quantity → auto-calculate fabric cost
- Step 3: Measurements — load saved or enter new per item
- Step 4: Charges — stitching charge, extra, discount, advance payment
- Summary panel with live total/due calculation

#### `/dashboard/tailor/orders/[id]` — Order Detail
- Customer + item details
- Status timeline (vertical stepper showing each status with timestamp and who changed it)
- Current assignment (if any)
- Payment history table + "Add Payment" button
- "Assign to Dorji" button
- Print Invoice button — opens thermal/A4 invoice in new window
- Edit order button

#### `/dashboard/tailor/measurements` — Measurements
- Search by customer phone → show all measurements for that customer
- Table: customer, phone, product type, date, actions
- Add/Edit measurement modal with full measurement fields

#### `/dashboard/tailor/dorjis` — Dorji Management
- Cards or table: name, phone, speciality badges, commission, status, active orders count
- Add/Edit modal
- Click dorji → see assigned orders

#### `/dashboard/tailor/assignments` — Assignments
- Table: order number, customer, dorji, assigned date, expected date, charge, work status
- "Assign Order" modal — select unassigned order + dorji + dates + charge
- Update work status inline

#### `/dashboard/tailor/payments` — Payments
- Table: order number, customer, amount, method, date
- "Add Payment" modal — select order → shows due amount → enter payment
- Filters: date range, payment method, order

#### `/dashboard/tailor/reports` — Reports
- Tab 1 Orders Report: date range → table of orders, total revenue, pending count, due amount
- Tab 2 Fabric Stock: all fabrics, current stock, low stock highlighted
- Tab 3 Dorji Report: dorji name, assigned orders, completed, total charge/commission

---

## Phase 5 — Sidebar Menu

Add to `components/app-sidebar.tsx` NAV_CONFIG:

```typescript
{
  name: "Tailor Shop",
  icon: Scissors,          // from lucide-react
  module: "TailorShop",
  items: [
    { name: "Dashboard",         href: "/dashboard/tailor",              module: "TailorShop" },
    { name: "Fabric Inventory",  href: "/dashboard/tailor/fabrics",      module: "TailorFabric" },
    { name: "Tailoring Orders",  href: "/dashboard/tailor/orders",       module: "TailorOrders" },
    { name: "Measurements",      href: "/dashboard/tailor/measurements", module: "TailorMeasurements" },
    { name: "Dorji / Tailors",   href: "/dashboard/tailor/dorjis",       module: "TailorDorji" },
    { name: "Assignments",       href: "/dashboard/tailor/assignments",  module: "TailorOrders" },
    { name: "Payments",          href: "/dashboard/tailor/payments",     module: "TailorPayments" },
    { name: "Reports",           href: "/dashboard/tailor/reports",      module: "TailorReports" },
  ],
},
```

---

## Phase 6 — Invoice Print

Order detail page "Print Invoice" button generates printable HTML:

**Invoice sections:**
1. Store header (name, phone, address from company settings)
2. Invoice title + order number + date + delivery date
3. Customer details
4. Items table: product type | fabric | qty (goj) | unit price | amount
5. Charges summary: fabric total, stitching charge, extra charge, discount, **Grand Total**
6. Payment summary: paid amount, **Due amount**
7. Order status badge
8. Footer: thank you + return policy

Two formats:
- **A4** — full invoice with logo area, borders, professional layout
- **Thermal 80mm** — compact for POS printer (same pattern as existing POS receipt)

---

## Phase 7 — Implementation Order (Recommended)

Build in this sequence to always have working vertical slice:

```
Week 1 — Foundation
  [ ] Migrations (all 9 tables)
  [ ] Models + relationships + observers
  [ ] Routes + empty controller stubs
  [ ] tailorApi.ts frontend lib

Week 2 — Core CRUD
  [ ] Fabric Inventory page (full CRUD)
  [ ] Dorji Management page (full CRUD)
  [ ] Customer + Measurement pages
  [ ] Sidebar menu item

Week 3 — Orders
  [ ] Order list page with filters
  [ ] Create order multi-step form
  [ ] Order detail + status timeline
  [ ] Status update API + log

Week 4 — Assignments & Payments
  [ ] Assignment create/update
  [ ] Payment recording
  [ ] Auto payment_status update on order
  [ ] Stock deduction on order create/update

Week 5 — Polish
  [ ] Dashboard stats page
  [ ] Invoice print (A4 + thermal)
  [ ] Reports page
  [ ] Permissions wired to all pages
  [ ] Mobile responsiveness pass
```

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Separate orders table | Yes — `tailor_orders` not `sells` | Different fields, workflow, status set |
| Customer table | Separate `tailor_customers` | Tailor customers may not be ecommerce customers; phone-centric |
| Fabric stock deduction | Observer on order save | Atomic, no missed updates |
| Measurement storage | Per product type per customer | Same customer needs shirt + pajama measurements separately |
| Invoice format | Generate HTML in frontend | No server-side PDF dep needed; matches existing POS receipt pattern |
| Commission tracking | Stored on assignment, not dorji | Commission may vary per job |

---

## Files to Create (Summary)

### Laravel Backend (14 files)
- 9 migration files
- 9 model files
- 8 controller files
- Route additions in `api.php`
- Permission seeder additions

### Next.js Frontend (18 files)
- `lib/tailorApi.ts`
- 8 page files under `app/dashboard/tailor/`
- `components/tailor/` — shared components (FabricModal, MeasurementForm, OrderStatusTimeline, AssignModal, PaymentModal, InvoicePrint)
- Sidebar addition in `components/app-sidebar.tsx`

---

*Plan version: 1.0 | Created: 2026-05-12*
