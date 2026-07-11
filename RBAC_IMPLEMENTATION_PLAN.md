# RBAC Implementation Plan
## Role-Based Access Control — Frontend + Backend
**Last updated:** 2026-05-07 (post full audit)

---

## Current State Summary

### What exists (already built)
- `saas_users.role` column: `owner | admin | manager | staff`
- `staff_roles` table: company-scoped custom roles
- `permissions` table: **37** seeded modules (verified from PermissionSeeder.php)
- `role_permissions` table: per-role read/write/delete flags per permission
- Frontend: Role & Permission UI page at `/dashboard/staff/roles`
- Frontend: `isOwner()`, `isAdmin()` helpers in auth context (unused)
- Backend: JWT middleware injects `auth_user_id`, `auth_company_id`, `auth_is_legacy`

### What's missing
- No route-level permission enforcement on backend (zero middleware checks)
- No UI show/hide based on role/permissions on frontend
- Sidebar shows all 24+ items to every authenticated user
- No `permissions` field loaded at login — not in `/auth/me` response
- `staff` table has no `role_id` FK to `staff_roles`
- `edit-profile`, `checkout`, `sells`, `international` pages have no permission mapping
- `/users/` API route has no permission guard (legacy endpoint)

---

## Role Hierarchy

```
owner   → full access to everything, bypasses all permission checks
admin   → full access except billing ownership (cannot transfer ownership)
manager → access defined by their assigned staff_role permissions
staff   → access defined by their assigned staff_role permissions
```

**Rule:** `owner` and `admin` bypass all permission checks.
Only `manager` and `staff` are filtered by `role_permissions`.

---

## Complete Permission Module List (40 total)

### Current 37 (from PermissionSeeder.php — verified)

| # | Module Name | API Routes | Sidebar / Page |
|---|---|---|---|
| 1 | Dashboard | — | /dashboard |
| 2 | Products | /products/* | Catalog > Products |
| 3 | Categories | /categories/* | Catalog > Categories |
| 4 | Attributes | /attributes/* | Catalog > Attributes |
| 5 | Coupons | /coupons/* | Catalog > Coupons |
| 6 | Print Barcode | /products/barcode/* | Catalog > Print Barcode |
| 7 | Customers | /customers/* | Customers |
| 8 | Orders | /sells/* (order mgmt) | Orders > All Orders |
| 9 | Shipments | /shipments/* | Orders > Shipments |
| 10 | Vendors | /vendors/* | Vendors |
| 11 | POS | frontend only | POS |
| 12 | Sells | /sells/* (history) | Sells page |
| 13 | Inventory | /inventory/* | Inventory > Stock Overview |
| 14 | Transfers | /transfers/* | Inventory > Transfers |
| 15 | Customer Returns | /customer-returns/* | Returns > Customer Returns |
| 16 | Vendor Returns | /vendor-returns/* | Returns > Vendor Returns |
| 17 | Staff | /staff/* | Staff > All Staff |
| 18 | Role & Permission | /staff-roles/* | Staff > Role & Permission |
| 19 | Salary Management | /salary-payments/* | Staff > Salary Management |
| 20 | Settings | /settings/* | Settings > Store Settings |
| 21 | Aura Shop | /settings/aura-shop | Settings > Aura Shop |
| 22 | Company Profile | /auth/company/profile | Settings > Company Profile |
| 23 | Company Settings | /auth/company/settings | Settings > Company Settings |
| 24 | Billing Contact | /auth/company/billing | Settings > Billing Contact |
| 25 | Team Members | /auth/team/* | Settings > Team Members |
| 26 | Subscriptions | /billing/subscription | Settings > Subscriptions |
| 27 | Billing Plans | /billing/plans | Settings > Billing Plans |
| 28 | Store | /store/* | Store |
| 29 | Shipping Methods | /shipping-methods/* | Store > Shipping Methods |
| 30 | Payment Methods | /payment-methods/* | Store > Payment Methods |
| 31 | Shipping Addresses | /shipping-addresses/* | Store > Shipping Addresses |
| 32 | Store Locations | /locations/* | Store > Locations |
| 33 | Store Wishlist | /wishlists/* | Store > Wishlist |
| 34 | Pages | /pages/* | Pages |
| 35 | International | /settings/regional | /dashboard/international |
| 36 | Notifications | /notifications/* | Notifications |
| 37 | Support | /support/tickets/* | Support |

**Support system detail** — `Support` permission covers all 3 attachment types handled under the same route group:
- `text` — plain message body (`POST /support/tickets/{id}/reply` with `body`)
- `image` — image attachments (`attachments[]` with `image/*` mime → stored as `attachment_type=image`)
- `voice` — audio recordings (`attachments[]` with `audio/*` mime → stored as `attachment_type=voice`)
- `file` — documents/PDFs (`attachments[]` other mime → stored as `attachment_type=file`)

Permission gate: `Support,read` = view tickets + messages + attachments. `Support,write` = reply + upload image/voice/file. `Support,delete` = delete ticket.

No sub-permissions needed — all attachment types live under the same `POST /{id}/reply` endpoint with `attachments[]` multipart. Granularity at permission level would be excessive.

### NEW 3 Permissions to Add (audit findings)

| # | Module Name | API Routes | Page | Reason |
|---|---|---|---|---|
| 38 | **Product Reviews** | /products/{id}/reviews, /products/{id}/reviews/{id}/reply | /dashboard/products/[id]/reviews | Review management exists as full page + backend route group; not covered |
| 39 | **Checkout** | /sells/* (create order via checkout flow) | /dashboard/checkout | Distinct checkout flow page; needs own permission separate from Orders |
| 40 | **User Management** | /users/* (legacy CRUD) | — | `/users/` route group exists, no permission, accessible to any JWT holder |

### Deliberately NOT adding (analysis decision)

| Candidate | Decision | Reason |
|---|---|---|
| Edit Profile | NO — skip | Every user edits own profile; not a permission gate |
| Barcode Operations | NO — merge into Products | Barcode endpoints are product sub-features |
| International Settings | NO — use existing #35 | Already seeded as "International" |

---

## Phase 1 — Backend: Install Spatie Laravel Permission

### 1.1 Install package
```bash
composer require spatie/laravel-permission
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
```

This publishes:
- `config/permission.php`
- Migration: `create_permission_tables.php` (creates `roles`, `permissions`, `model_has_roles`, `model_has_permissions`, `role_has_permissions`)

### 1.2 Configure for multi-tenant (company isolation)

**File:** `config/permission.php`

Enable teams mode so each company has its own role/permission scope:
```php
'teams' => true,
'team_foreign_key' => 'company_id',
```

### 1.3 Drop custom tables (replaced by Spatie)

**New migration:** `drop_custom_permission_tables.php`
```php
Schema::dropIfExists('role_permissions');   // replaced by Spatie's role_has_permissions
Schema::dropIfExists('permissions');        // replaced by Spatie's permissions
// Keep staff_roles table if you want to keep custom role names per company
// OR drop it too and use Spatie's roles table
Schema::dropIfExists('staff_roles');        // replaced by Spatie's roles (with teams)
```

### 1.4 Add HasRoles trait to models

**`app/Models/User.php`** (legacy staff users — authenticatable):
```php
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasRoles;

    protected string $guard_name = 'legacy'; // matches config/auth.php legacy guard
}
```

**`app/Models/SaasUser.php`** (SaaS owner/admin):
```php
use Spatie\Permission\Traits\HasRoles;

class SaasUser extends Authenticatable
{
    use HasRoles;

    protected string $guard_name = 'api'; // matches JWT guard
}
```

### 1.5 Update config/auth.php guards

```php
'guards' => [
    'api' => [
        'driver'   => 'jwt',
        'provider' => 'saas_users',
    ],
    'legacy' => [
        'driver'   => 'jwt',
        'provider' => 'users',
    ],
],
```

---

## Phase 2 — Backend: Migrate Permissions to Spatie

### 2.1 Update PermissionSeeder to use Spatie

**File:** `database/seeders/PermissionSeeder.php`

Replace custom `Permission::firstOrCreate` with Spatie's `Permission::firstOrCreate` using guard name.

Add 3 new permissions found in audit:

```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

class PermissionSeeder extends Seeder
{
    private const PERMISSIONS = [
        // Module permissions — each has read / write / delete variants
        'Dashboard',
        'Products',
        'Categories',
        'Attributes',
        'Coupons',
        'Print Barcode',
        'Customers',
        'Orders',
        'Shipments',
        'Vendors',
        'POS',
        'Sells',
        'Inventory',
        'Transfers',
        'Customer Returns',
        'Vendor Returns',
        'Staff',
        'Role & Permission',
        'Salary Management',
        'Settings',
        'Aura Shop',
        'Company Profile',
        'Company Settings',
        'Billing Contact',
        'Team Members',
        'Subscriptions',
        'Billing Plans',
        'Store',
        'Shipping Methods',
        'Payment Methods',
        'Shipping Addresses',
        'Store Locations',
        'Store Wishlist',
        'Pages',
        'International',
        'Notifications',
        'Support',
        // NEW — from audit
        'Product Reviews',
        'Checkout',
        'User Management',
    ];

    public function run(): void
    {
        // Spatie needs guard_name
        foreach (self::PERMISSIONS as $module) {
            // Create 3 granular permissions per module: read, write, delete
            foreach (['read', 'write', 'delete'] as $action) {
                Permission::firstOrCreate(
                    ['name' => "{$module}.{$action}", 'guard_name' => 'api'],
                );
                // Also create for legacy guard (staff users)
                Permission::firstOrCreate(
                    ['name' => "{$module}.{$action}", 'guard_name' => 'legacy'],
                );
            }
        }
    }
}
```

**Permission naming convention:** `{Module}.{action}` e.g. `Products.read`, `Products.write`, `Products.delete`

### 2.2 Default Role Seeder

Create default roles per company when company is created:

```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class DefaultRoleSeeder extends Seeder
{
    public function run(): void
    {
        // Owner role — all permissions
        $owner = Role::firstOrCreate(['name' => 'owner', 'guard_name' => 'api']);
        $owner->syncPermissions(Permission::where('guard_name', 'api')->get());

        // Admin role — all except billing ownership
        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'api']);
        $adminPerms = Permission::where('guard_name', 'api')
            ->whereNotIn('name', ['Subscriptions.delete', 'Billing Plans.delete'])
            ->get();
        $admin->syncPermissions($adminPerms);
    }
}
```

---

## Phase 3 — Backend: Staff role_id → Spatie Role Assignment

Remove custom `role_id` FK approach. Instead use Spatie's `model_has_roles` pivot table.

**`app/Models/Staff.php`** — remove `role_id` column plan. Staff assignment now done via:
```php
$user = User::find($staff->user_id);
$user->assignRole('Manager');           // assigns Spatie role
$user->syncPermissions([...]);          // or direct permission sync
```

**When creating staff:**
```php
// In StaffService::create()
$legacyUser = User::create([...]);
if ($data['role_name']) {
    // Set team (company) context for Spatie teams mode
    setPermissionsTeamId($staff->company_id);
    $legacyUser->assignRole($data['role_name']);
}
```

---

## Phase 4 — Backend: Permission Middleware (Spatie-based)

Replace custom `RequirePermission` middleware with Spatie's built-in middleware.

**Register Spatie middleware aliases in `bootstrap/app.php`:**
```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'role'       => \Spatie\Permission\Middleware\RoleMiddleware::class,
        'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
        'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
    ]);
})
```

**Custom wrapper middleware to handle JWT + owner/admin bypass:**

**File:** `app/Http/Middleware/CheckPermission.php`
```php
<?php

namespace App\Http\Middleware;

use App\Models\SaasUser;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permissionName): Response
    {
        $userId   = $request->attributes->get('auth_user_id');
        $companyId = $request->attributes->get('auth_company_id');
        $isLegacy = $request->attributes->get('auth_is_legacy', false);

        // Set Spatie team context (company isolation)
        setPermissionsTeamId($companyId);

        if (!$isLegacy) {
            // SaaS user — owner/admin bypass
            $saasUser = SaasUser::find($userId);
            if ($saasUser && in_array($saasUser->role, ['owner', 'admin'])) {
                return $next($request);
            }
            // SaaS user with custom role — check Spatie permission
            if ($saasUser && $saasUser->hasPermissionTo($permissionName, 'api')) {
                return $next($request);
            }
        } else {
            // Legacy staff user — check Spatie permission on User model
            $user = User::find($userId);
            if ($user && $user->hasPermissionTo($permissionName, 'legacy')) {
                return $next($request);
            }
        }

        return response()->json(['success' => false, 'message' => 'Access denied.'], 403);
    }
}
```

**Register alias:**
```php
'check_permission' => \App\Http\Middleware\CheckPermission::class,
```

---

## Phase 5 — Backend: Apply Middleware to All Routes

**File:** `routes/api.php`

**Permission naming convention (Spatie):** `Module.action` — e.g. `Products.read`, `Products.write`, `Products.delete`

Use `check_permission` middleware (our JWT-aware wrapper around Spatie):

```php
// PRODUCTS
Route::prefix('products')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',     [...])->middleware('check_permission:Products.read');
    Route::post('/',    [...])->middleware('check_permission:Products.write');
    Route::put('/{id}', [...])->middleware('check_permission:Products.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Products.delete');
    // Barcode sub-routes
    Route::post('/barcode/search',          [...])->middleware('check_permission:Products.read');
    Route::post('/barcode/bulk-generate',   [...])->middleware('check_permission:Print Barcode.write');
    Route::get('/{id}/barcode',             [...])->middleware('check_permission:Print Barcode.read');
    Route::post('/{id}/barcode/regenerate', [...])->middleware('check_permission:Print Barcode.write');
    Route::post('/barcode/find-by-code',    [...])->middleware('check_permission:Products.read');
    Route::post('/barcode/generate-missing',[...])->middleware('check_permission:Print Barcode.write');
    Route::get('/barcode/statistics',       [...])->middleware('check_permission:Print Barcode.read');
    // Reviews
    Route::get('/{id}/reviews',                          [...])->middleware('check_permission:Product Reviews.read');
    Route::post('/{productId}/reviews/{reviewId}/reply', [...])->middleware('check_permission:Product Reviews.write');
});

// CATEGORIES
Route::prefix('categories')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Categories.read');
    Route::post('/',       [...])->middleware('check_permission:Categories.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Categories.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Categories.delete');
});

// ATTRIBUTES
Route::prefix('attributes')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Attributes.read');
    Route::post('/',       [...])->middleware('check_permission:Attributes.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Attributes.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Attributes.delete');
});

// COUPONS
Route::prefix('coupons')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Coupons.read');
    Route::post('/',       [...])->middleware('check_permission:Coupons.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Coupons.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Coupons.delete');
});

// CUSTOMERS
Route::prefix('customers')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Customers.read');
    Route::post('/',       [...])->middleware('check_permission:Customers.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Customers.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Customers.delete');
});

// SELLS / ORDERS
Route::prefix('sells')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Orders.read');
    Route::post('/',       [...])->middleware('check_permission:Orders.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Orders.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Orders.delete');
});

// SHIPMENTS
Route::prefix('shipments')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Shipments.read');
    Route::post('/',       [...])->middleware('check_permission:Shipments.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Shipments.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Shipments.delete');
});

// VENDORS
Route::prefix('vendors')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Vendors.read');
    Route::post('/',       [...])->middleware('check_permission:Vendors.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Vendors.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Vendors.delete');
});

// INVENTORY (read-only)
Route::prefix('inventory')->middleware([JwtAuthMiddleware::class, 'check_permission:Inventory.read'])->group(function () {
    Route::get('/', [...]);
});

// TRANSFERS
Route::prefix('transfers')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',             [...])->middleware('check_permission:Transfers.read');
    Route::post('/',            [...])->middleware('check_permission:Transfers.write');
    Route::post('/{id}/cancel', [...])->middleware('check_permission:Transfers.write');
});

// CUSTOMER RETURNS
Route::prefix('customer-returns')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',              [...])->middleware('check_permission:Customer Returns.read');
    Route::post('/',             [...])->middleware('check_permission:Customer Returns.write');
    Route::put('/{id}',          [...])->middleware('check_permission:Customer Returns.write');
    Route::post('/{id}/approve', [...])->middleware('check_permission:Customer Returns.write');
    Route::post('/{id}/reject',  [...])->middleware('check_permission:Customer Returns.write');
});

// VENDOR RETURNS
Route::prefix('vendor-returns')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Vendor Returns.read');
    Route::post('/',       [...])->middleware('check_permission:Vendor Returns.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Vendor Returns.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Vendor Returns.delete');
});

// STAFF
Route::prefix('staff')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Staff.read');
    Route::post('/',       [...])->middleware('check_permission:Staff.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Staff.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Staff.delete');
});

// STAFF ROLES (Spatie role management)
Route::prefix('staff-roles')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Role & Permission.read');
    Route::post('/',       [...])->middleware('check_permission:Role & Permission.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Role & Permission.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Role & Permission.delete');
    Route::get('/permissions', [...]); // open to all authenticated — needed for role form
});

// SALARY PAYMENTS
Route::prefix('salary-payments')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Salary Management.read');
    Route::post('/',       [...])->middleware('check_permission:Salary Management.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Salary Management.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Salary Management.delete');
});

// SETTINGS
Route::prefix('settings')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',            [...])->middleware('check_permission:Settings.read');
    Route::put('/',            [...])->middleware('check_permission:Settings.write');
    Route::get('/regional',    [...])->middleware('check_permission:International.read');
    Route::put('/regional',    [...])->middleware('check_permission:International.write');
    Route::get('/aura-shop',   [...])->middleware('check_permission:Aura Shop.read');
    Route::put('/aura-shop',   [...])->middleware('check_permission:Aura Shop.write');
});

// LOCATIONS
Route::prefix('locations')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Store Locations.read');
    Route::post('/',       [...])->middleware('check_permission:Store Locations.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Store Locations.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Store Locations.delete');
});

// NOTIFICATIONS
Route::prefix('notifications')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',          [...])->middleware('check_permission:Notifications.read');
    Route::put('/{id}/read', [...])->middleware('check_permission:Notifications.write');
    Route::delete('/{id}',   [...])->middleware('check_permission:Notifications.delete');
});

// SUPPORT — text + image + voice + file all via same reply endpoint
Route::prefix('support/tickets')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',                  [...])->middleware('check_permission:Support.read');
    Route::get('/stats',             [...])->middleware('check_permission:Support.read');
    Route::get('/{id}',              [...])->middleware('check_permission:Support.read');
    Route::post('/{id}/reply',       [...])->middleware('check_permission:Support.write');  // text/image/voice/file
    Route::patch('/{id}/status',     [...])->middleware('check_permission:Support.write');
    Route::patch('/{id}/priority',   [...])->middleware('check_permission:Support.write');
    Route::delete('/{id}',           [...])->middleware('check_permission:Support.delete');
});

// PAGES
Route::prefix('pages')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Pages.read');
    Route::post('/',       [...])->middleware('check_permission:Pages.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Pages.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Pages.delete');
});

// PAYMENT METHODS
Route::prefix('payment-methods')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',     [...])->middleware('check_permission:Payment Methods.read');
    Route::post('/',    [...])->middleware('check_permission:Payment Methods.write');
    Route::put('/{id}', [...])->middleware('check_permission:Payment Methods.write');
});

// SHIPPING METHODS
Route::prefix('shipping-methods')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',     [...])->middleware('check_permission:Shipping Methods.read');
    Route::post('/',    [...])->middleware('check_permission:Shipping Methods.write');
    Route::put('/{id}', [...])->middleware('check_permission:Shipping Methods.write');
});

// SHIPPING ADDRESSES
Route::prefix('shipping-addresses')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:Shipping Addresses.read');
    Route::post('/',       [...])->middleware('check_permission:Shipping Addresses.write');
    Route::put('/{id}',    [...])->middleware('check_permission:Shipping Addresses.write');
    Route::delete('/{id}', [...])->middleware('check_permission:Shipping Addresses.delete');
});

// WISHLISTS
Route::prefix('wishlists')->middleware([JwtAuthMiddleware::class, 'check_permission:Store Wishlist.read'])->group(function () {
    Route::get('/', [...]);
});

// USERS (legacy endpoint)
Route::prefix('users')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',        [...])->middleware('check_permission:User Management.read');
    Route::post('/',       [...])->middleware('check_permission:User Management.write');
    Route::put('/{id}',    [...])->middleware('check_permission:User Management.write');
    Route::delete('/{id}', [...])->middleware('check_permission:User Management.delete');
});

// TEAM, BILLING, COMPANY — owner/admin via role middleware (Spatie)
Route::prefix('auth/team')->middleware([JwtAuthMiddleware::class, 'role:owner|admin'])->group(function () { ... });
Route::prefix('billing')->middleware([JwtAuthMiddleware::class, 'role:owner'])->group(function () { ... });
Route::prefix('auth/company')->middleware([JwtAuthMiddleware::class, 'role:owner|admin'])->group(function () { ... });
```

> **Note:** `role` middleware above uses Spatie's built-in `RoleMiddleware` (registered as `role` alias). The `|` means "owner OR admin".

---

## Phase 6 — Backend: Expose Permissions in /auth/me

**File:** `app/Services/Auth/SaasAuthService.php`

In `me()` (SaaS users — owner/admin — use Spatie):
```php
// Load via Spatie
setPermissionsTeamId($user->company_id);
$permissions = null; // null = full access signal for frontend (owner/admin bypass)

return [
    'user' => [
        ...,
        'permissions' => $permissions,
        'roleId'      => null,
        'roleName'    => $user->getRoleNames()->first(),
    ],
    'company' => [...],
];
```

In `meAsStaff()` (legacy staff — use Spatie on User model):
```php
setPermissionsTeamId($staff->company_id);
$legacyUser = User::find($legacyUserId); // has HasRoles trait

// Build permission map from Spatie
$permissions = [];
foreach ($legacyUser->getAllPermissions() as $perm) {
    // Permission name format: "Module.action" e.g. "Products.read"
    [$module, $action] = explode('.', $perm->name, 2);
    if (!isset($permissions[$module])) {
        $permissions[$module] = ['read' => false, 'write' => false, 'delete' => false];
    }
    $permissions[$module][$action] = true;
}

return [
    'user' => [
        'id'          => $legacyUser->id,
        'companyId'   => $staff->company_id,
        'email'       => $legacyUser->email,
        'fullName'    => $staff->name,
        'role'        => $staff->role ?? 'staff',
        'status'      => $staff->status ?? 'active',
        'joinedDate'  => $staff->joining_date ?? null,
        'lastLogin'   => null,
        'permissions' => $permissions,   // structured map for frontend
        'roleId'      => null,
        'roleName'    => $legacyUser->getRoleNames()->first(),
    ],
    'company' => [...],
];
```

### StaffRoleController — now uses Spatie

`/staff-roles` endpoints now manage Spatie `Role` model with `role_has_permissions` pivot:

```php
// GET /staff-roles — list Spatie roles for company
public function index(Request $request): JsonResponse
{
    setPermissionsTeamId($request->attributes->get('auth_company_id'));
    $roles = Role::with('permissions')
        ->where('team_id', $request->attributes->get('auth_company_id'))
        ->get();
    // Map to frontend format...
}

// POST /staff-roles — create Spatie role + assign permissions
public function store(Request $request): JsonResponse
{
    setPermissionsTeamId($companyId);
    $role = Role::create(['name' => $request->name, 'guard_name' => 'legacy', 'team_id' => $companyId]);

    $permissionNames = [];
    foreach ($request->permissions as $perm) {
        // perm = { permissionId, read, write, delete }
        $permission = Permission::find($perm['permissionId']);
        foreach (['read', 'write', 'delete'] as $action) {
            if ($perm[$action]) {
                $permissionNames[] = "{$permission->module}.{$action}";
            }
        }
    }
    $role->syncPermissions($permissionNames);
}

// Assign role to staff user
public function assignToStaff(int $staffId, string $roleName): void
{
    $staff = Staff::findOrFail($staffId);
    setPermissionsTeamId($staff->company_id);
    $user = User::find($staff->user_id);
    $user->syncRoles([$roleName]);
}
```

---
            $permissions[$rp->name] = [
                'read'   => (bool) $rp->read,
                'write'  => (bool) $rp->write,
                'delete' => (bool) $rp->delete,
            ];
        });
}

return [
    'user' => [
        'id'          => $legacyUser->id,
        'companyId'   => $staff->company_id,
        'email'       => $legacyUser->email,
        'fullName'    => $staff->name,
        'role'        => $staff->role ?? 'staff',
        'status'      => $staff->status ?? 'active',
        'joinedDate'  => $staff->joining_date ?? null,
        'lastLogin'   => null,
        'permissions' => $permissions,  // ADD
        'roleId'      => $staff->role_id,  // ADD
    ],
    'company' => [...],
];
```

---

## Phase 6 — Frontend: Permission System in Auth Context

**File:** `contexts/saas-auth-context.tsx`

### Update User interface:
```typescript
interface User {
  id: number
  companyId: number
  email: string
  fullName: string
  role: 'owner' | 'admin' | 'manager' | 'staff'
  status: string
  joinedDate: string
  permissions: Record<string, { read: boolean; write: boolean; delete: boolean }> | null
  roleId: number | null
}
```

### Add helper functions:
```typescript
const hasPermission = (module: string, action: 'read' | 'write' | 'delete' = 'read'): boolean => {
  if (!user) return false
  if (user.role === 'owner' || user.role === 'admin') return true
  if (user.permissions === null) return true  // explicit null = full access
  return user.permissions?.[module]?.[action] ?? false
}

const canRead   = (module: string): boolean => hasPermission(module, 'read')
const canWrite  = (module: string): boolean => hasPermission(module, 'write')
const canDelete = (module: string): boolean => hasPermission(module, 'delete')
```

### Expose in context value:
```typescript
{ ..., hasPermission, canRead, canWrite, canDelete }
```

### Store user_role cookie at login (for Next.js middleware):
```typescript
// In login() after storing token:
document.cookie = `user_role=${response.data.userRole}; path=/; max-age=86400; SameSite=Lax`
```

---

## Phase 7 — Frontend: PermissionGuard Component

**File:** `components/ui/permission-guard.tsx`
```typescript
import { useSaasAuth } from '@/contexts/saas-auth-context'

export function PermissionGuard({
  module,
  action = 'read',
  fallback = null,
  children,
}: {
  module: string
  action?: 'read' | 'write' | 'delete'
  fallback?: React.ReactNode
  children: React.ReactNode
}) {
  const { hasPermission } = useSaasAuth()
  if (!hasPermission(module, action)) return <>{fallback}</>
  return <>{children}</>
}
```

**File:** `components/ui/access-denied.tsx`
```tsx
import { ShieldOff } from 'lucide-react'

export function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <ShieldOff className="w-8 h-8 text-red-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
      <p className="text-gray-500 max-w-sm">
        You don't have permission to access this page. Contact your administrator.
      </p>
    </div>
  )
}
```

---

## Phase 8 — Frontend: Sidebar Permission Filtering

**File:** `components/app-sidebar.tsx`

Replace hardcoded nav with permission-filtered structure:

```typescript
const { canRead } = useSaasAuth()

const NAV_CONFIG = [
  { title: 'Dashboard',         href: '/dashboard',                      module: 'Dashboard',         group: null },
  { title: 'Products',          href: '/dashboard/products',             module: 'Products',          group: 'Catalog' },
  { title: 'Categories',        href: '/dashboard/categories',           module: 'Categories',        group: 'Catalog' },
  { title: 'Attributes',        href: '/dashboard/attributes',           module: 'Attributes',        group: 'Catalog' },
  { title: 'Coupons',           href: '/dashboard/coupons',              module: 'Coupons',           group: 'Catalog' },
  { title: 'Print Barcode',     href: '/dashboard/products/print-barcode', module: 'Print Barcode',   group: 'Catalog' },
  { title: 'Customers',         href: '/dashboard/customers',            module: 'Customers',         group: null },
  { title: 'All Orders',        href: '/dashboard/orders',               module: 'Orders',            group: 'Orders' },
  { title: 'Shipments',         href: '/dashboard/orders/shipments',     module: 'Shipments',         group: 'Orders' },
  { title: 'Vendors',           href: '/dashboard/vendors',              module: 'Vendors',           group: null },
  { title: 'POS',               href: '/dashboard/pos',                  module: 'POS',               group: null },
  { title: 'Stock Overview',    href: '/dashboard/inventory',            module: 'Inventory',         group: 'Inventory' },
  { title: 'Transfers',         href: '/dashboard/inventory/transfer',   module: 'Transfers',         group: 'Inventory' },
  { title: 'Customer Returns',  href: '/dashboard/returns/customer',     module: 'Customer Returns',  group: 'Returns' },
  { title: 'Vendor Returns',    href: '/dashboard/returns/vendor',       module: 'Vendor Returns',    group: 'Returns' },
  { title: 'All Staff',         href: '/dashboard/staff',                module: 'Staff',             group: 'Staff' },
  { title: 'Role & Permission', href: '/dashboard/staff/roles',          module: 'Role & Permission', group: 'Staff' },
  { title: 'Salary Management', href: '/dashboard/staff/salary',         module: 'Salary Management', group: 'Staff' },
  { title: 'Store Settings',    href: '/dashboard/settings',             module: 'Settings',          group: 'Settings' },
  { title: 'Aura Shop',         href: '/dashboard/settings/aura-shop',   module: 'Aura Shop',         group: 'Settings' },
  { title: 'Company Profile',   href: '/dashboard/company/profile',      module: 'Company Profile',   group: 'Settings' },
  { title: 'Company Settings',  href: '/dashboard/company/settings',     module: 'Company Settings',  group: 'Settings' },
  { title: 'Billing Contact',   href: '/dashboard/company/billing-contact', module: 'Billing Contact', group: 'Settings' },
  { title: 'Team Members',      href: '/dashboard/team/users',           module: 'Team Members',      group: 'Settings' },
  { title: 'Subscriptions',     href: '/dashboard/billing/subscriptions', module: 'Subscriptions',    group: 'Settings' },
  { title: 'Billing Plans',     href: '/dashboard/billing/plans',        module: 'Billing Plans',     group: 'Settings' },
  { title: 'Store',             href: '/dashboard/store',                module: 'Store',             group: 'Store' },
  { title: 'Shipping Methods',  href: '/dashboard/shipping-methods',     module: 'Shipping Methods',  group: 'Store' },
  { title: 'Payment Methods',   href: '/dashboard/payment-methods',      module: 'Payment Methods',   group: 'Store' },
  { title: 'Shipping Addresses',href: '/dashboard/store/shipping-addresses', module: 'Shipping Addresses', group: 'Store' },
  { title: 'Support',           href: '/dashboard/support',              module: 'Support',           group: null },
  { title: 'Pages',             href: '/dashboard/pages',                module: 'Pages',             group: null },
  { title: 'Notifications',     href: '/dashboard/notifications',        module: 'Notifications',     group: null },
  { title: 'International',     href: '/dashboard/international',        module: 'International',     group: 'Settings' },
]

const visibleItems = NAV_CONFIG.filter(item => canRead(item.module))
// Then group visibleItems by 'group' for rendering section headers
```

---

## Phase 9 — Frontend: Page-Level Guards

Apply `PermissionGuard` and `canRead` check to every dashboard page:

### Pattern for every page:
```tsx
// Top of page component:
const { canRead, canWrite, canDelete } = useSaasAuth()
if (!canRead('Products')) return <AccessDenied />

// Add/Create button:
<PermissionGuard module="Products" action="write">
  <Button onClick={handleAdd}>Add Product</Button>
</PermissionGuard>

// Edit button in table row:
<PermissionGuard module="Products" action="write">
  <button onClick={() => handleEdit(item)}>Edit</button>
</PermissionGuard>

// Delete button in table row:
<PermissionGuard module="Products" action="delete">
  <button onClick={() => handleDelete(item.id)}>Delete</button>
</PermissionGuard>
```

### Page → Module mapping:

| Page | Module |
|---|---|
| /dashboard | Dashboard |
| /dashboard/products | Products |
| /dashboard/products/print-barcode | Print Barcode |
| /dashboard/products/[id]/reviews | Product Reviews |
| /dashboard/categories | Categories |
| /dashboard/attributes | Attributes |
| /dashboard/coupons | Coupons |
| /dashboard/customers | Customers |
| /dashboard/orders | Orders |
| /dashboard/orders/shipments | Shipments |
| /dashboard/sells | Sells |
| /dashboard/vendors | Vendors |
| /dashboard/pos | POS |
| /dashboard/inventory | Inventory |
| /dashboard/inventory/transfer | Transfers |
| /dashboard/returns/customer | Customer Returns |
| /dashboard/returns/vendor | Vendor Returns |
| /dashboard/staff | Staff |
| /dashboard/staff/roles | Role & Permission |
| /dashboard/staff/salary | Salary Management |
| /dashboard/settings | Settings |
| /dashboard/settings/aura-shop | Aura Shop |
| /dashboard/company/profile | Company Profile |
| /dashboard/company/settings | Company Settings |
| /dashboard/company/billing-contact | Billing Contact |
| /dashboard/team/users | Team Members |
| /dashboard/billing/subscriptions | Subscriptions |
| /dashboard/billing/plans | Billing Plans |
| /dashboard/store | Store |
| /dashboard/shipping-methods | Shipping Methods |
| /dashboard/payment-methods | Payment Methods |
| /dashboard/store/shipping-addresses | Shipping Addresses |
| /dashboard/store/wishlist | Store Wishlist |
| /dashboard/pages | Pages |
| /dashboard/international | International |
| /dashboard/notifications | Notifications |
| /dashboard/support | Support |
| /dashboard/checkout | Checkout |
| /dashboard/edit-profile | *(no guard — all users can edit own profile)* |

---

## Phase 10 — Frontend: Next.js Middleware Route Guards

**File:** `middleware.ts`

```typescript
// Owner/admin-only routes (hard block at middleware level)
const OWNER_ADMIN_ONLY = [
  '/dashboard/billing',
  '/dashboard/team',
  '/dashboard/staff/roles',
  '/dashboard/company',
]

const userRole = request.cookies.get('user_role')?.value ?? ''

if (OWNER_ADMIN_ONLY.some(path => pathname.startsWith(path))) {
  if (!['owner', 'admin'].includes(userRole)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
}
```

---

## Phase 11 — Frontend: Staff Role Assignment UI

**File:** `app/dashboard/staff/page.tsx`

Add `Role Assignment` dropdown to Add/Edit Staff dialogs:
```tsx
<div>
  <Label>Assign Role (for permissions)</Label>
  <select name="roleId" className="w-full px-3 py-2 border rounded-lg">
    <option value="">-- No role assigned --</option>
    {roles.map(role => (
      <option key={role.id} value={role.id}>{role.name}</option>
    ))}
  </select>
</div>
```

**File:** `lib/staffApi.ts` — add to `CreateStaffData` and `UpdateStaffData`:
```typescript
roleId?: number
```

**File:** `contexts/staff-context.tsx` — pass `roleId` in `addStaff`/`updateStaff`.

---

## Implementation Order (Prioritized)

| Step | Task | Files | Est. Time |
|---|---|---|---|
| 1 | Add 3 new permissions to seeder | `PermissionSeeder.php` | 15 min |
| 2 | Migration: `role_id` on staff table | new migration + `Staff.php` | 20 min |
| 3 | Update StaffService for roleId | `StaffService.php` | 20 min |
| 4 | Create RequirePermission middleware | new middleware file | 30 min |
| 5 | Register middleware alias | `bootstrap/app.php` | 5 min |
| 6 | Apply middleware to all routes | `routes/api.php` | 60 min |
| 7 | Add permissions to /me response | `SaasAuthService.php` | 30 min |
| 8 | Update User type + add helpers | `saas-auth-context.tsx` | 30 min |
| 9 | Create PermissionGuard + AccessDenied | 2 new component files | 20 min |
| 10 | Update sidebar filtering | `app-sidebar.tsx` | 45 min |
| 11 | Add user_role cookie at login | `saas-auth-context.tsx` | 10 min |
| 12 | Update middleware.ts route guards | `middleware.ts` | 20 min |
| 13 | Apply guards to all 37 pages | all dashboard page.tsx files | 120 min |
| 14 | Add roleId to staff form | `staff/page.tsx` + staffApi.ts | 30 min |
| **Total** | | | **~6.5 hours** |

---

## Complete File Change List

### Backend (Laravel)
| File | Action |
|---|---|
| `database/seeders/PermissionSeeder.php` | Add 3 permissions |
| `database/migrations/..._add_role_id_to_staff.php` | CREATE |
| `app/Models/Staff.php` | Add `role_id` fillable + relation |
| `app/Services/Staff/StaffService.php` | Accept `roleId` |
| `app/Http/Middleware/RequirePermission.php` | CREATE |
| `bootstrap/app.php` | Register `permission` alias |
| `routes/api.php` | Add `permission:X,Y` to all routes |
| `app/Services/Auth/SaasAuthService.php` | Add `permissions` + `roleId` to me/meAsStaff |

### Frontend (Next.js)
| File | Action |
|---|---|
| `contexts/saas-auth-context.tsx` | User type + helpers + user_role cookie |
| `components/ui/permission-guard.tsx` | CREATE |
| `components/ui/access-denied.tsx` | CREATE |
| `components/app-sidebar.tsx` | Permission-filtered nav |
| `middleware.ts` | Role-based route guards |
| `lib/staffApi.ts` | Add `roleId` to interfaces |
| `contexts/staff-context.tsx` | Pass `roleId` in create/update |
| `app/dashboard/staff/page.tsx` | Role assignment dropdown |
| All 37 dashboard page files | Add `canRead` guard + PermissionGuard on buttons |

---

## Key Design Decisions

1. **owner + admin bypass all checks** — no role_id needed; `permissions: null` in /me = full access
2. **`permissions: {}` = no access** — staff with no role assigned cannot access anything
3. **Frontend hides, backend enforces** — double layer required; backend 403 is the safety net
4. **`user_role` cookie** — enables Next.js middleware (server-side) to check role without decoding JWT
5. **Barcode merged into Products/Print Barcode** — not a separate permission
6. **edit-profile no guard** — every user can edit their own profile regardless of role
7. **Checkout uses Orders permission** — not a separate permission (same data domain)
8. **`/staff-roles/permissions` route stays open** — needed by role creation form for all admin users
