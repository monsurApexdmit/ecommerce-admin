# Collections API Contract

Backend: Laravel (`/home/monsur/Documents/Go/inventory-laravel`). All admin routes live under `/api`,
need the JWT bearer token, and are company-scoped by the token. Storefront routes live under `/api/store`
and use the same company resolution as `/api/store/products` (`?company_id=` or subdomain).

Status: **implemented** (see "Changelog" at the bottom for changes).

---

## 1. Concepts

- **manual** collection: the admin picks products and their order. Stored in pivot `collection_product (collection_id, product_id, position)`.
- **automatic** collection: products are computed live from `rules` combined with `match` (`all` = every rule must match, `any` = at least one).
- The storefront only ever shows products that are `published = true` AND `visible_online = true` (and not deleted).
  Admin endpoints show every product of the company and flag the ones that would be hidden online (`visibleOnStorefront: false`).
- Slug is unique per company. It is generated from the name when omitted (`Summer Sale` -> `summer-sale`, then `summer-sale-2` ...).
  A slug you send explicitly is normalised (lower-case, dashes) and must be free, otherwise 422.

## 2. Permissions / plan module

- Permission module name: **`Collections`** (`Collections.read`, `Collections.write`, `Collections.delete`).
  Owner/admin users bypass as usual. Existing staff roles were given the same Collections rights they have on `Categories` (one-time migration).
- Role matrix (`GET /api/staff-roles/matrix-modules`): new module **`Collections`** in the **Catalog** group (right after "Categories & brands"), mapped to permission `Collections`.
- Subscription plans: `"Collections"` was appended to every plan's `modules` list that contains `"Categories"` (all current plans: Trial, Starter, Growth, Professional, Enterprise).
  It arrives in the login / me payload as `company.planModules`. Sidebar / page gating in the admin should use the module name `"Collections"`.

## 3. Objects

### 3.1 Collection (admin)

```json
{
  "id": 12,
  "companyId": 459,
  "name": "Summer Sale",
  "slug": "summer-sale",
  "description": "Hot picks for summer",
  "image": "collections/abc123.jpg",
  "imageUrl": "http://localhost:8005/storage/collections/abc123.jpg",
  "type": "automatic",
  "match": "all",
  "rules": [
    { "field": "category", "operator": "is", "value": 145 },
    { "field": "price", "operator": "less_than", "value": 500 }
  ],
  "sortOrder": 1,
  "productSort": "best_selling",
  "isPublished": true,
  "showOnHomepage": false,
  "seoTitle": null,
  "seoDescription": null,
  "productCount": 7,
  "visibleProductCount": 6,
  "createdAt": "2026-10-28T10:00:00+00:00",
  "updatedAt": "2026-10-28T10:00:00+00:00"
}
```

- `image` is what is stored (relative path on the public disk, or an absolute URL if one was saved). `imageUrl` is always an absolute URL or `null` — use it for `<img>`.
- `productCount` = products in the collection counting every product status (what the admin sees).
  `visibleProductCount` = how many of them the storefront will show (published + visible online).
- `rules` is always an array (`[]` for manual collections). `match` is always `"all"` or `"any"`.

### 3.2 Collection detail (admin, `GET /collections/{id}`)

Everything from 3.1 plus:

```json
{
  "productIds": [8, 4, 6],
  "manualProducts": [
    { "position": 1, "id": 8, "name": "Brand Shirt", "...": "AdminProduct fields (3.3)" }
  ]
}
```

- `productIds`: manual products in their saved order (`[]` for automatic collections).
- `manualProducts`: the same products as AdminProduct objects, ordered, each with `position` (1-based). `[]` for automatic.
- For automatic collections use the preview endpoints to show the matched products.

### 3.3 AdminProduct (preview / manual lists)

```json
{
  "id": 8,
  "name": "Brand Shirt",
  "slug": "brand-shirt",
  "sku": "SKU-8",
  "image": "products/x.jpg",
  "price": 200,
  "salePrice": 20,
  "effectivePrice": 20,
  "offerActive": false,
  "stock": 10,
  "categoryId": 146,
  "categoryName": "Shirt",
  "brandId": null,
  "brandName": null,
  "tag": null,
  "isBestSeller": false,
  "isHotDeal": false,
  "isFeatured": false,
  "published": true,
  "visibleOnline": true,
  "visibleOnStorefront": true,
  "unitsSold": 3,
  "createdAt": "2026-08-30T11:56:15+00:00",
  "position": 1
}
```

- `effectivePrice` = what a buyer pays now: sale price when set (else list price; bundle override for bundles), lowered by a live offer. This is the price the `price` rule compares against.
- `unitsSold` = units sold in non-cancelled sells (all time; or within the best-sellers window when the collection has a `best_sellers` rule).
- `position` is present only for manual collections (1-based).

### 3.4 Storefront collection (summary)

```json
{
  "id": 12,
  "name": "Summer Sale",
  "slug": "summer-sale",
  "description": "Hot picks for summer",
  "image": "collections/abc123.jpg",
  "imageUrl": "http://localhost:8005/storage/collections/abc123.jpg",
  "productCount": 6,
  "showOnHomepage": true,
  "sortOrder": 1,
  "productSort": "best_selling",
  "seoTitle": null,
  "seoDescription": null
}
```

`productCount` here counts only storefront-visible products.

### 3.5 Storefront product

**Identical** to the items of `GET /api/store/products` (snake_case: `id, slug, name, description, price, sale_price, offer_price,
offer_type, offer_ends_at, offer_active, sku, stock, total_sold, image, images, category_id, category_name, rating, reviews_count,
is_featured, is_hot_deal, is_best_seller, deal_label, variants, is_bundle, bundle_price_override, bundle_items`). It is produced by
the same formatter, so the same product card component renders it.

---

## 4. Rules (automatic collections)

`rules` is an array of rule objects `{ "field": string, "operator": string, "value": any }`.
Request bodies may send `rules` as a JSON array or (multipart) as a JSON-encoded string.
An automatic collection needs at least one rule (max 20).

| field | operators | value | meaning |
|---|---|---|---|
| `category` | `is`, `is_not` | category id (int) | product's category is (not) this category **or any of its subcategories** (all levels). `is_not` keeps products with no category. |
| `brand` | `is`, `is_not` | brand id (int) | product's brand is (not) this brand. `is_not` keeps products with no brand. |
| `tag` | `equals`, `not_equals`, `contains` | string (1-100 chars) | compares the product `tag` field, case-insensitive. `not_equals` keeps products with no tag. |
| `flag` | `is`, `is_not` | `"best_seller"` \| `"hot_deal"` \| `"featured"` | the product's manual Best seller / Hot deal / Featured flag is (not) on. |
| `price` | `greater_than`, `less_than` | number >= 0 | effective price (see 3.3) is strictly greater / less than value. |
| `on_offer` | `is` | `true` | product has a live offer (offer price > 0 and offer end date not passed). |
| `new_arrivals` | `within_days` | int 1-3650 | product created within the last N days. |
| `best_sellers` | `top` | `{ "limit": int 1-500, "days": int 1-3650 }` | product is among the top `limit` products by units sold in non-cancelled sells during the last `days` days (ties: lower product id first). Products that sold nothing never qualify. |
| `in_stock` | `is` | `true` | product (or any of its variants) has stock > 0. **Always applied as an extra AND filter, even when `match` is `"any"`.** |

`operator` may be omitted for single-operator fields (`on_offer`, `new_arrivals`, `best_sellers`, `in_stock`); the backend fills it in
and always returns the normalised rule. Unknown fields/operators are rejected with 422.

Example (`any`): products in category 145 OR tagged "summer", only in stock:

```json
{ "type": "automatic", "match": "any", "rules": [
  { "field": "category", "operator": "is", "value": 145 },
  { "field": "tag", "operator": "equals", "value": "summer" },
  { "field": "in_stock", "operator": "is", "value": true }
]}
```

## 5. Sort options

`productSort` (collection default) and storefront `sort` accept:

| value | order |
|---|---|
| `manual` | manual collections: saved position. Automatic collections: falls back to `newest` (or best-sellers rank when a `best_sellers` rule exists). |
| `best_selling` | units sold in non-cancelled sells, all time, desc (then newest) |
| `price_asc` | effective price low -> high |
| `price_desc` | effective price high -> low |
| `newest` | created_at desc |
| `name` | name A -> Z |

Storefront `sort` may also be omitted or `default` = the collection's `productSort`. Default `productSort` on create: `manual` for manual collections, `best_selling` for automatic ones.

---

## 6. Admin endpoints (JWT)

Envelope for every response: `{ "success": true, "message": "...", "data": ... }`.
Errors: `{ "success": false, "message": "<readable message>", "errors": { "<field>": ["<message>"] } }` (`errors` only on 422 validation).

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/collections` | Collections.read | paginated list |
| GET | `/api/collections/simple` | Collections.read | `[{id,name,slug,type,isPublished}]` for pickers (homepage sections etc.) |
| POST | `/api/collections` | Collections.write | create (JSON or multipart) |
| POST | `/api/collections/preview` | Collections.read | preview an unsaved definition |
| POST | `/api/collections/reorder` | Collections.write | save list order |
| GET | `/api/collections/{id}` | Collections.read | detail (3.2) |
| PUT | `/api/collections/{id}` | Collections.write | update (JSON or multipart) |
| POST | `/api/collections/{id}` | Collections.write | same as PUT (use for multipart with a file) |
| DELETE | `/api/collections/{id}` | Collections.delete | delete |
| PATCH | `/api/collections/{id}/status` | Collections.write | publish / unpublish |
| PUT | `/api/collections/{id}/products` | Collections.write | set manual products + order |
| GET | `/api/collections/{id}/preview-products` | Collections.read | products of a saved collection (paged) |

### 6.1 `GET /api/collections`

Query: `search` (name/slug contains), `type` (`manual`|`automatic`), `published` (`true`|`false`), `page` (default 1), `limit` (default 20, max 100).
Order: `sortOrder` asc, then id asc.

```json
{ "success": true, "message": "Success", "data": {
  "data": [ { "...": "Collection (3.1)" } ],
  "total": 3, "per_page": 20, "current_page": 1, "last_page": 1
}}
```

### 6.2 `POST /api/collections` / `PUT /api/collections/{id}`

Body (JSON or `multipart/form-data`; booleans may be `true/false/1/0`; in multipart send `rules` and `productIds` as JSON strings):

```json
{
  "name": "Summer Sale",              // required on create, 1-150 chars
  "slug": "summer-sale",              // optional; omitted/empty on create = generated from name; on update omitted = unchanged
  "description": "text",              // optional, max 5000, nullable
  "image": "<file> | url/path string | null",   // file: jpg/jpeg/png/webp/gif <= 5MB; null or "" removes the image
  "type": "manual",                   // required on create: manual | automatic
  "match": "all",                     // all | any (default all)
  "rules": [],                        // required (>=1) when type is automatic; ignored/stored [] for manual
  "productSort": "manual",            // manual | best_selling | price_asc | price_desc | newest | name
  "isPublished": true,                // default false
  "showOnHomepage": false,            // default false
  "seoTitle": "max 255",
  "seoDescription": "max 500",
  "productIds": [8, 4, 6]             // optional, manual only: sets the manual products in this order (same as 6.6)
}
```

Response: `201` (create) / `200` (update), `data` = Collection detail (3.2). Create puts the collection at the end of the list (`sortOrder` = max+1).
Switching a collection from manual to automatic keeps the saved manual products (they are used again if it is switched back).

### 6.3 `PATCH /api/collections/{id}/status`

Body `{ "isPublished": true }` — or empty body to toggle. Response: Collection (3.1). Message `"Collection published"` / `"Collection unpublished"`.

### 6.4 `POST /api/collections/reorder`

Body `{ "ids": [5, 2, 9] }` (all must belong to the company). Sets `sortOrder` 1..n. Response `data: null`, message `"Order saved"`.

### 6.5 `DELETE /api/collections/{id}`

Removes the collection, its manual product links and its uploaded image. Response `data: null`, message `"Collection deleted"`.

### 6.6 `PUT /api/collections/{id}/products`

Body `{ "productIds": [8, 4, 6] }` — the full ordered list (replaces the previous one; `[]` empties it; duplicates are dropped, max 1000).
Only for manual collections. Response: Collection detail (3.2), message `"Products saved"`.

### 6.7 Preview

`POST /api/collections/preview` — body `{ "type": "automatic", "match": "all", "rules": [...], "productIds": [...], "productSort": "newest", "limit": 12 }`
(`type` required; `rules` for automatic, `productIds` for manual; `limit` 1-50, default 12). Nothing is saved.

`GET /api/collections/{id}/preview-products?page=1&limit=20&sort=` — the saved collection's products (`limit` 1-100, default 20; `sort` defaults to the collection's `productSort`).

Both return:

```json
{ "success": true, "message": "Success", "data": {
  "products": [ { "...": "AdminProduct (3.3)" } ],
  "total": 7,
  "visibleTotal": 6,
  "page": 1, "limit": 12, "lastPage": 1,
  "hint": "1 matching product is hidden on the storefront (not published or not visible online)."
}}
```

`total` counts every matching product, `visibleTotal` only storefront-visible ones; `hint` is `null` when nothing is hidden.

---

## 7. Storefront endpoints (public, `resolve_company`)

Envelope matches the other storefront endpoints: `{ "success": true, "data": ..., "meta": ... }`; errors `{ "success": false, "message": "..." }`.

### 7.1 `GET /api/store/collections?company_id=459[&homepage=1]`

Published collections in `sortOrder` order. `homepage=1` returns only `showOnHomepage` ones.

```json
{ "success": true, "data": [ { "...": "Storefront collection (3.4)" } ] }
```

### 7.2 `GET /api/store/collections/{slugOrId}?company_id=459&sort=&page=1&per_page=20`

`per_page` (alias `limit`) default 20, max 100. `sort` see section 5 (unknown values fall back to default).
404 `{ "success": false, "message": "Collection not found" }` if missing or unpublished.

```json
{
  "success": true,
  "data": {
    "collection": { "...": "Storefront collection (3.4)" },
    "products": [ { "...": "Storefront product (3.5), same as /api/store/products items" } ]
  },
  "meta": { "current_page": 1, "last_page": 1, "per_page": 20, "total": 6, "sort": "best_selling" }
}
```

---

## 8. Error messages (422 unless stated)

`message` is the first readable error; `errors` holds all of them by field.

| case | field | message |
|---|---|---|
| name missing | name | `Collection name is required.` |
| name too long | name | `Collection name may not be longer than 150 characters.` |
| slug taken | slug | `The slug "summer-sale" is already used by another collection.` |
| slug invalid (nothing left after normalising) | slug | `The slug must contain letters or numbers.` |
| bad type | type | `Type must be manual or automatic.` |
| bad match | match | `Match must be all or any.` |
| automatic w/o rules | rules | `Add at least one rule for an automatic collection.` |
| too many rules | rules | `A collection can have at most 20 rules.` |
| rule problems | rules.N | e.g. `Rule 2: unknown rule field "colour".`, `Rule 1: operator "contains" is not allowed for category (use is, is_not).`, `Rule 1: choose a category.`, `Rule 1: category not found.`, `Rule 3: enter a price of 0 or more.`, `Rule 4: days must be between 1 and 3650.`, `Rule 5: best sellers limit must be between 1 and 500.`, `Rule 2: enter a tag.` |
| bad productSort | productSort | `Product sort must be one of: manual, best_selling, price_asc, price_desc, newest, name.` |
| bad image | image | `The image must be a jpg, png, webp or gif file up to 5MB.` (non-file non-string: `... or a URL up to 255 characters.`) |
| unknown products | productIds | `Some products were not found: 991, 992.` |
| products on automatic | productIds | `Products can only be picked for a manual collection.` |
| reorder unknown ids | ids | `One or more collections were not found.` |
| not found (404) | — | `Collection not found` |

---

## Changelog

- v1 (2026-10-28): initial contract.
- v1.1 (2026-10-28): implemented and tested; fixed role-matrix route name (`/api/staff-roles/matrix-modules`). No shape changes.
