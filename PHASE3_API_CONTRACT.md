# Phase 3 Customers API contract (BE: inventory-laravel)

Base: `/api/v1/customers` (existing prefix; all JWT + `Customers.read|write|delete`). Envelope `{success,message,data,meta?}`. All fields camelCase.

## Customer object (list rows, detail, create/update response)
Existing fields kept (id, companyId, userId, name, email, phone, address, city, state, zipCode, country, customerType, status, notes, storeCredit, totalOrders, totalSpent, dueAmount, lastOrderAt, duplicatePhone, createdAt, updatedAt).
New: `type` ("individual"|"business"), `businessName`, `licenceBin`, `customerGroup` ("retail"|"wholesale"|"vip"), `creditLimit` (number), `openingBalance` (number), `creditUsed` (number = outstanding due on sales), `creditUsedPercent` (number 0..n, 0 when no limit), `birthday` ("YYYY-MM-DD"|null), `tags` (string[]), `smsOptIn` (bool), `district`, `area`, `country` (default "Bangladesh"), `status` ("active"|"inactive").
`customerType` is now just an alias of `customerGroup` (kept for old callers). Prefer `customerGroup`.
Detail only (GET /{id}) additionally: `recentOrders`: up to 5 of `{id, invoiceNo, date, amount, status}` (newest first).

## Create (POST /) / Update (PUT /{id}) body
name (req on create), phone (req on create, 7-15 digits after stripping spaces/+/-/parens), email (nullable email), address, city, state, zipCode, district, area, country,
type, businessName (required when type=business), licenceBin, customerGroup, creditLimit>=0, openingBalance>=0, birthday (date, not in future), tags (string[]), smsOptIn (bool, default true), status, notes, storeCredit.
Validation errors: 422 standard Laravel shape.

## List GET /
Query: `search` (name/email/phone/business), `group` (retail|wholesale|vip|all), `type` (individual|business|all), `status` (active|inactive|all; default all), `segment` (existing: loyal|risk|due|never|dup|all), `smsOptIn=true` (only opted-in with a phone), `sort` (recent|name|spent|orders|due), `page`, `limit` (max 2000; use big limit for export).
Response `data`: `{data:[Customer], total, per_page, current_page, last_page, counts}` where
`counts = {total, active, inactive, byGroup:{retail,wholesale,vip}, byType:{individual,business}}` (company-wide, unaffected by filters).
GET /stats now also returns correct individuals/businesses.

## Other endpoints (declared before /{id})
- `GET /duplicates` -> `{groups:[{key, reason:"phone"|"name_email", customers:[Customer...]}]}` (phone normalised to digits; or same lowercase name+email).
- `POST /merge` `{primaryId, duplicateIds:[...]}` -> `{merged:n, customer: Customer}`. Moves sells, customer returns, addresses, tailor orders/measurements, coupon usages, held sales, reviews, tickets, wishlists to primary; unions tags; fills blank primary fields; adds opening balance/store credit; deletes duplicates. One transaction.
- `POST /bulk-tag` `{ids:[], tag}` -> `{updated:n}`.
- `GET /sms-numbers` (same filters as list) -> `{numbers:[string], count}` opted-in customers with phone only.
- `PATCH /{id}/status` `{status:"active"|"inactive"}` -> Customer.
- `POST /import` `{rows:[{name, phone, email?, address?, city?, district?, area?, country?, type?, businessName?, licenceBin?, customerGroup?, creditLimit?, openingBalance?, birthday?, tags? (string[] or comma string), smsOptIn?, notes?}]}` -> `{imported, skipped, skippedRows:[{row(1-based), reason}]}`. Skips missing name/phone, duplicate phones (existing + within file), invalid rows.
- DELETE /{id}: unchanged guard (422 when sales/returns exist).

## VIP discount
Sales: if customer is VIP and the create-sale request has no `discount` (or 0), BE applies 5% of items subtotal as `discount` and reduces `amount` accordingly. FE should show the 5% for VIP but send discount explicitly if it computes it.
