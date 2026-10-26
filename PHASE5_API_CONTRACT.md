# Phase 5 - Products API contract (BE: inventory-laravel)

All under `/api/products`, JWT, envelope `{success, message, data}`. Errors: `{success:false, message}` (422 for business rules, message is user-readable; FormRequest errors add `errors`).

## GET /products  (list)
Params (all optional): `search` (name, SKU, barcode, supplier name, variant SKU/barcode), `categoryId|category_id` (id | `none`), `brandId` (id | `none`), `supplierId|vendor_id` (id | `none`), `tab` (`all|ok|low|out|hidden|draft`), `sort` (`recent|name|price-asc|price-desc|stock-asc|stock-desc`; default id asc), `locationId` (warehouse id: `stock`, `stockState`, tab, sort are evaluated for that warehouse), `pos=1` (only `availableInPos` products), `published` (bool), `page`, `limit` (max 1000).
Legacy `location_id` still = "products whose home location is X" (POS uses it) - NOT the stock-evaluation param; use camelCase `locationId` for that.

Response `data`: `{ data: Product[], total, per_page, current_page, last_page, tabCounts: {all, ok, low, out, hidden, draft} }`
`tabCounts` follow every active filter except `tab`. `hidden` = not published OR `visibleOnline=false`; `draft` = not published.

## Product fields (list + GET /products/{id})
Existing fields unchanged (incl. `brandName`, `unitName`, `vendorName` (= supplier), `reorderPoint`, `offer*`, `wholesale*`, `isBundle`...). Added:
- `stockByLocation: [{locationId, locationName, quantity}]` - one entry per company location (qty 0 included).
- `stock` - total across warehouses, or the `locationId` warehouse's qty when that param is given. For bundles it is ALWAYS live: complete bundles = min over children floor(childStock / qty) (per-warehouse when `locationId` given).
- `stockState: 'ok'|'low'|'out'` - out: stock<=0; low: `reorderPoint>0 && stock<=reorderPoint`; else ok. `reorderPoint` 0 = alert off.
- `availableInPos: bool` (default true), `visibleOnline: bool` (default true; storefront now requires published AND visibleOnline), `tag: string|null` (max 50).

## POST/PUT /products (multipart or JSON)
New accepted fields (camel or snake): `availableInPos`/`available_in_pos`, `visibleOnline`/`visible_online`, `tag`; variants accept `offer_price`, `offer_type`.
`reorderPoint` omitted on create => company default setting (only if the company configured one), otherwise 0. Explicit 0 stays 0.
422 messages: `SKU 'X' is already used by product 'N'` / `... variant 'V' of 'N'`; `Barcode 'X' is already used by ...`; duplicate SKU/barcode inside the payload (product vs variants); `Selling price must be greater than 0.`; `Cost price cannot be negative.`; `A percentage offer cannot be more than 100%.` (also `Variant 'V': ...`); `A product can have at most 6 images.` (new files + `keep_images`); images must be JPG/PNG/WEBP, 5 MB each. Own SKU/barcode on update is excluded from the check. Draft = send `published=false`.

## POST /products/bulk-price
Body: `{ ids:[1,2] | filter:{...same params as list incl. tab}, percent: -50..1000 }`. `percent <= -100` => 422 "Percent must be greater than -100.".
Reprices price, sale price, flat offer price (percentage offers untouched), wholesale price, bundle override, and all variants (price/sale/flat offer). Cost untouched. Rounded to 2 dp.
Response `data`: `{count, variantsUpdated}`.

## POST /products/bulk-adjust-stock  (row "Quick adjust" and bulk "Bulk adjust")
Body: `{ reason?: "Quick adjust"|"Bulk adjust" (default "Quick adjust"), items:[{productId, variantId?, locationId? (default warehouse), delta (signed int, != 0), reason?}] }`.
Uses StockAdjustmentService (movement history recorded, shows on the Adjustments page). Per-item results; one failing item does not stop the others. Bundles rejected; products with variants require `variantId`.
Response `data`: `{adjusted, failed:[{productId,index,reason}], results:[adjustment rows]}`.

## POST /products/import
Body: `{ rows:[{name, sku, price, barcode?, cost|costPrice, stock?, reorder|reorderPoint?, offer|offerPrice?, category?, brand?, supplier?, unit?, published?, description?}] }` (max 2000; column names case-flexible: name/Name, sku/SKU, ...). `published` values no/false/0/draft/hidden = unpublished.
Per-row checks: missing name/SKU/price, price<=0, bad cost/stock/reorder, offer >= price, duplicate SKU/barcode within the file and against the DB (products + variants). Category/brand/unit/supplier matched by name (case-insensitive); unmatched => left blank + a warning. Opening stock booked at the default warehouse (movement type `receive`, reason "Opening stock (import)").
Response `data`: `{imported, skipped:[{row (1-based index in rows), reason}], warnings:[{row, message}]}`.

## Not covered by BE
Export (FE builds CSV from list), print-barcode `?ids=`, barcode check-digit logic, warnings (price<cost, offer end date past, wholesale > price) are FE-only.
