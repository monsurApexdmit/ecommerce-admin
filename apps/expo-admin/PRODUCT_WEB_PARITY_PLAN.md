# Expo Admin Product Parity Plan

## Goal

Bring `apps/expo-admin` product management to practical feature parity with the existing web admin product module in `app/dashboard/products`.

This plan is based on the current web implementation, not on assumptions.

## Current Expo State

Today the Expo app only has a basic product list:

- fetches `GET /products`
- shows name, category, stock, price, image, SKU
- shows published/draft badge
- has no product detail screen
- has no create/edit/delete flow
- has no filter/sort/search controls
- has no review management
- has no barcode workflow
- has no variant or attribute handling

## Web Product Functionality To Match

The web admin currently supports these product capabilities:

- product list with search, filters, sorting, pagination, selection, and bulk actions
- add product
- edit product
- delete product
- product detail view
- publish and unpublish products
- category, vendor, and warehouse/location assignment
- cost price, margin, and auto-calculated sale price
- SKU, barcode, and receipt number fields
- image upload, preview, keep/remove existing images
- promotion flags:
  - hot deal
  - best seller
  - featured
  - deal label
- attributes and variant generation
- per-variant price, sale price, stock, and SKU editing
- product review list and admin reply flow
- single-product barcode screen
- bulk barcode print workflow
- product stats used by inventory:
  - total
  - published
  - unpublished

## Expo Implementation Scope

I will implement the product area in Expo in these parts.

### 1. Product List Upgrade

Replace the current simple list with a mobile-ready catalog screen that supports:

- pull-to-refresh
- debounced search by name, SKU, and category
- filters for:
  - category
  - vendor
  - warehouse/location
  - publish status
- sort options for:
  - default
  - price low to high
  - price high to low
  - published
  - unpublished
  - date added
  - date updated
- pagination or infinite loading
- row actions:
  - view
  - edit
  - reviews
  - barcode
  - delete
- multi-select mode for bulk actions
- bulk actions:
  - publish
  - unpublish
  - delete

### 2. Product Detail Screen

Add a dedicated product detail route for Expo that shows:

- image gallery
- product name and description
- publish state and selling status
- category
- vendor
- location
- stock
- price and sale price
- SKU
- barcode
- receipt number
- promotion flags
- attributes
- variants table/list

This screen will also be the entry point for edit, reviews, and barcode actions.

### 3. Create Product Flow

Add a mobile form for creating products with:

- product name
- description
- category selection
- vendor selection
- warehouse/location selection
- price
- cost price
- profit margin
- margin type
- auto-calculated sale price
- stock
- SKU
- auto-generated barcode with regenerate action
- receipt number
- promotion toggles
- deal label
- image selection and upload
- attribute selection
- variant generation

### 4. Edit Product Flow

Add full edit support using product detail data from `GET /products/{id}`:

- preload server values
- update basic product fields
- keep existing images
- remove existing images
- add new images
- update variants
- update stock based on variants
- update publish state

### 5. Review Management

Add a product reviews screen in Expo with:

- product review summary
- average rating
- review count
- star distribution
- review list
- verified purchase badge
- admin reply composer
- reply update/save flow

API coverage already exists on web and will be mirrored in Expo:

- `GET /store/products/{id}/reviews`
- `POST /products/{productId}/reviews/{reviewId}/reply`

### 6. Barcode Features

Add barcode support in Expo in two layers.

Single product barcode:

- barcode preview
- copy barcode value
- share or download barcode image if device support is available
- print fallback via web/share flow if direct printing is not available

Bulk barcode workflow:

- search products
- add items to print queue
- choose quantity
- configure barcode label content
- generate printable/exportable output

Because the web version relies on browser printing and `JsBarcode`, Expo will need a mobile-appropriate adaptation. The likely approach is:

- generate barcode SVG or image in-app
- share/export PDF for printing

### 7. Product Stats For Mobile Inventory

Expose product stats in Expo where needed using:

- `GET /products/stats`

This will support mobile inventory summary cards consistent with web.

## Data And Service Work Required

### Product Types

The current Expo product type is too small. It needs to grow to include:

- category and `categoryId`
- vendor and `vendorId`
- location and `locationId`
- status
- barcode
- receipt number
- cost price
- profit margin
- margin type
- promotion flags
- attributes
- variants
- inventory
- created/updated timestamps
- image collection support, not only one image

### Product Service Layer

The current Expo product service only reads a list. It needs full service coverage for:

- `getProducts`
- `getProductById`
- `createProduct`
- `updateProduct`
- `deleteProduct`
- `updateProductStatus`
- `getProductStats`
- `getProductReviews`
- `replyToProductReview`

### Multipart Upload Support

Web uses multipart form data for create/update. Expo will need the same behavior for product forms because image upload depends on it.

That means I will add:

- form-data request builder for product create/update
- support for image files selected on device
- support for `keep_images[]`
- support for `delete_images`
- support for serialized `variants`
- support for serialized `attributes`

### Supporting Services Needed In Expo

To match the web form, Expo also needs lookup data sources for:

- categories
- vendors
- warehouses/locations
- attributes

If Expo does not already have these services, I will add them.

## Proposed Expo Routes

These routes fit the current Expo Router structure.

- `app/(tabs)/products.tsx`
  - upgraded list screen
- `app/products/[id].tsx`
  - product detail
- `app/products/create.tsx`
  - create product
- `app/products/[id]/edit.tsx`
  - edit product
- `app/products/[id]/reviews.tsx`
  - reviews and replies
- `app/products/[id]/barcode.tsx`
  - single product barcode
- `app/products/barcodes.tsx`
  - bulk barcode workflow

## UI Components To Add

Reusable mobile components I expect to add:

- product card row
- product filter sheet
- product sort sheet
- product multi-select action bar
- product form section wrapper
- image picker/upload grid
- variant editor list
- attribute selector
- rating summary card
- review reply card
- barcode preview card

## Implementation Phases

### Phase 1

- expand product types
- expand product service layer
- add lookup services for categories/vendors/warehouses/attributes
- upgrade product list with search/filter/sort
- add product detail screen

### Phase 2

- create product screen
- edit product screen
- multipart image upload
- publish/unpublish
- delete flow

### Phase 3

- attributes and variant generation
- promotion flags
- barcode generation screen
- review summary and reply flow

### Phase 4

- bulk barcode flow
- product stats integration
- polish, validation, empty states, and error handling

## Important Mobile-Specific Adjustments

The Expo app cannot copy the web implementation line for line. Some features need mobile adaptation:

- dialog-heavy web flows will become full screens or bottom sheets
- CSV import/export from web is not the first mobile priority
- browser print flows must become share/export/PDF flows on mobile
- drag-and-drop image upload must become image picker and camera roll upload
- wide variant tables must become stacked mobile editors

## Out Of Scope For First Pass

These exist on web-adjacent flows but should not block core mobile parity:

- CSV import/export
- desktop-style print layout tuning
- advanced barcode paper-size designer matching every web option
- non-product inventory transfer flows unless explicitly requested

## Expected Result

After this work, Expo admin product management will no longer be read-only. It will support the same core business workflow as web:

- browse products
- inspect product details
- create products
- edit products
- delete products
- manage publish state
- manage images
- manage variants
- handle reviews
- use barcode tools

## Suggested File Ownership

Main Expo files likely involved:

- `apps/expo-admin/app/(tabs)/products.tsx`
- `apps/expo-admin/app/products/...`
- `apps/expo-admin/src/services/products.ts`
- `apps/expo-admin/src/types/product.ts`
- `apps/expo-admin/src/lib/api.ts`
- new lookup services in `apps/expo-admin/src/services`
- new reusable UI in `apps/expo-admin/src/components`

## Notes

- Expo connects directly to Laravel, so this work must not depend on the web-only Next.js proxy route.
- Product create and update must be implemented against the Laravel API format already used by the web app.
- The web app is the reference for behavior; mobile UI can differ, but business functionality should match.
