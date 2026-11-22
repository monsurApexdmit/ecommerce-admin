# Courier integration (Pathao + Steadfast) — API contract (backend: inventory-laravel)

Status: IMPLEMENTED + verified with faked courier responses (backend, 2026-11-17). Source of truth; updated in place if anything changes.
Backend code: `app/Services/Courier/*`, `app/Http/Controllers/Api/V1/Shipping/Courier*Controller.php`, `app/Http/Controllers/Api/V1/CourierAccountController.php`, `config/couriers.php`.

All admin routes: prefix `/api`, JWT auth, envelope `{ success, message, data, meta? }`; errors `{ success:false, message, errors? }`.
Form validation → 422 `{ message: "Validation failed.", errors: { field: [msg] } }` (show `errors`, e.g. `credentials.secretKey`, `recipient.phone`).
Business / courier failures → `{ success:false, message }` with **422** (courier rejected the request, e.g. `"Steadfast: Duplicate invoice"`,
`"Pathao: could not sign in — Invalid credentials"`), **409** (already booked / busy), **404**, or **502** (courier unreachable or 5xx:
`"Pathao is not reachable right now. Try again in a minute."`). Show `message` as-is; it is written for staff.
Timestamps are ISO-8601.

---------------------------------------------------------------------------------------------------
## 1. Enums

| name | values |
|---|---|
| `provider` | `pathao` `steadfast` (RedX/Paperfly later; the UI shows RedX as "coming soon") |
| `environment` (pathao only) | `live` `sandbox` (steadfast is always `live`) |
| `courierStatus` (normalized, `courierBooking.status`) | `booked` `pickup_pending` `picked` `in_transit` `out_for_delivery` `delivered` `partial_delivered` `returned` `cancelled` `on_hold` `failed` |
| final courier statuses | `delivered` `partial_delivered` `returned` `cancelled` (no more syncing; cannot cancel) |
| `deliveryType` (pathao) | `48` = normal, `12` = on-demand (integers) |
| `itemType` (pathao) | `1` = document, `2` = parcel (integers) |
| location `type` (pathao) | `city` `zone` `area` |

Suggested labels: booked=Booked, pickup_pending=Pickup pending, picked=Picked up, in_transit=In transit, out_for_delivery=Out for delivery,
delivered=Delivered, partial_delivered=Partially delivered, returned=Returned, cancelled=Cancelled, on_hold=On hold, failed=Delivery failed.

### Shipment `status` (existing field) — how courier states map onto it
The existing shipment `status` vocabulary is kept so all existing screens keep working. A courier shipment's `status` is derived:

| courierStatus | shipment `status` | order effect |
|---|---|---|
| booked, pickup_pending | `pending` | (booking itself: order `fulfillmentStatus` → `shipped`, `Pending` → `Processing`) |
| picked | `picked_up` | fulfillment `shipped` |
| in_transit, on_hold | `in_transit` | fulfillment `shipped` |
| out_for_delivery | `out_for_delivery` | fulfillment `shipped` |
| failed | unchanged (stays live) | none — a failed attempt usually becomes a re-attempt or a return |
| delivered, partial_delivered | `delivered` | order `status` → `Delivered`, fulfillment `delivered`, COD recorded as a payment (amount = courier-reported COD, capped at the order due) + notification |
| returned | `returned` (dead) | fulfillment → `packed`; order status NOT changed, NO auto-restock (same as the manual "returned" flow) + notification |
| cancelled | `cancelled` (dead, NEW value in shipment.status) | fulfillment → `packed`; order can be booked again |

Courier status never moves backwards (a late/out-of-order update only refreshes `rawStatus`).

---------------------------------------------------------------------------------------------------
## 2. Courier accounts (permission `Shipping Methods.read|write|delete`)

### 2.1 CourierAccount DTO (never contains secrets)
```json
{
  "id": 3,
  "provider": "pathao",                 // enum
  "label": "Pathao",                    // display name
  "environment": "sandbox",             // pathao: live|sandbox; steadfast: "live"
  "isActive": true,
  "isDefault": true,                    // at most one per company
  "accountId": null,                    // legacy free-text id (still accepted)
  "credentials": {                      // masked; only keys relevant to the provider are present
    "clientId": "abc1••••", "username": "me@shop.com", "storeId": "12345",   // pathao (clientId masked, username + storeId plain)
    "apiKey": "••••••••a1b2"                                                     // steadfast
  },
  "hasClientSecret": true, "hasPassword": true,      // pathao
  "hasApiKey": true, "hasSecretKey": true,           // steadfast
  "hasKey": true,                                    // legacy flag (= has any secret)
  "apiKey": "••••••••a1b2",                          // legacy masked field (kept for the old UI)
  "isConfigured": true,                 // all required credentials present
  "settings": { "deliveryType": 48, "itemType": 2, "weightKg": 0.5, "note": "Handle with care", "itemDescription": null },
  "connectionStatus": "connected",      // connected | error | untested
  "lastCheckedAt": "2026-11-17T10:00:00+06:00",
  "lastError": null,
  "webhookUrl": "https://api.example.com/api/webhooks/courier/steadfast/9f…",  // full callback URL (omitted in /courier/accounts)
  "isIntegrated": true,                 // false for providers without a driver yet (e.g. legacy "RedX" rows)
  "needsStore": false,                  // pathao: true until credentials.storeId is set (booking needs a pickup store)
  "hasClientId": true,                  // pathao
  "createdAt": "…", "updatedAt": "…"
}
```
Exact flag set per provider — pathao: `hasClientId, hasClientSecret, hasPassword`; steadfast: `hasApiKey, hasSecretKey`; all: `hasKey`.
`credentials` for pathao = `{ clientId (masked "abcd••••••"), username (plain), storeId (plain string) }`; steadfast = `{ apiKey (masked) }`.
Settings defaults when unset: deliveryType 48, itemType 2, weightKg 0.5.

### 2.2 Routes
| method | path | body / query | returns |
|---|---|---|---|
| GET | `/courier-accounts` | – | `CourierAccount[]` |
| POST | `/courier-accounts` | see 2.3 | `CourierAccount` (201) |
| PUT | `/courier-accounts/{id}` | see 2.3 (all optional; blank secret = keep stored) | `CourierAccount` |
| DELETE | `/courier-accounts/{id}` | – | null (409 if it has non-final courier shipments) |
| POST | `/courier-accounts/{id}/test` | – | `{ ok, message, balance? (steadfast number), stores? (pathao: Store[]) , account: CourierAccount }` — always 200, `ok:false` + `message` on failure (also saved to `lastError`) |
| POST | `/courier-accounts/{id}/default` | – | `CourierAccount` (sets isDefault, clears others) |
| GET | `/courier-accounts/{id}/stores` | – | pathao: `Store[]`; steadfast: 422 |
| GET | `/courier-accounts/{id}/locations` | `type=city|zone|area`, `parentId` (city id for zones, zone id for areas) | `Location[]` (cached 24h) |
| GET | `/courier-accounts/{id}/webhook` | – | `{ url, provider, hasToken, token, tokenHint: "••••••••ab12", authHeader: "Bearer <token>" \| null (steadfast only), instructions: string }` — `token` is OUR callback secret (not a courier credential); show it in a copy box only on this screen |
| POST | `/courier-accounts/{id}/webhook/rotate` | – | same as GET webhook (new token) |

`Store` = `{ id: number, name: string, address: string|null, cityId: number|null, zoneId: number|null, isActive: bool, isDefault: bool }`
`Location` = `{ id: number, name: string }` (areas also: `homeDeliveryAvailable?: bool, pickupAvailable?: bool`)

### 2.3 Create / update body
```json
{
  "provider": "steadfast",            // required on create; one account per provider per company (422 if exists)
  "isActive": true, "isDefault": false,
  "environment": "live",              // pathao only
  "accountId": null,                  // optional legacy label
  "credentials": {
    // steadfast (create: both required)
    "apiKey": "…", "secretKey": "…",
    // pathao (create: clientId, clientSecret, username, password required; storeId optional — pick after Test connection)
    "clientId": "…", "clientSecret": "…", "username": "merchant@email", "password": "…", "storeId": 12345
  },
  "settings": { "deliveryType": 48, "itemType": 2, "weightKg": 0.5, "note": "…", "itemDescription": "…" }
}
```
On update, a missing or blank secret field (`apiKey`, `secretKey`, `clientSecret`, `password`) keeps the stored value; `clientId`, `username`, `storeId`
replace when present. Legacy body `{ provider, accountId, apiKey, isActive }` still works (steadfast: `apiKey` → `credentials.apiKey`).
Changing pathao credentials/environment clears the cached token.

---------------------------------------------------------------------------------------------------
## 3. Booking (permission `Orders.write`; account pickers `Orders.read`)

### 3.0 Accounts for the booking dialog (no Shipping Methods permission needed)
| method | path | query | returns |
|---|---|---|---|
| GET | `/courier/accounts` | – | `CourierAccount[]` (active + integrated + configured only, default first; same DTO without `webhookUrl`) |
| GET | `/courier/accounts/{id}/locations` | `type`, `parentId` | `Location[]` (same as 2.2) |
| GET | `/courier/accounts/{id}/stores` | – | `Store[]` |

### 3.1 `POST /sells/{id}/courier` — book one order
```json
{
  "courierAccountId": 3,              // optional → default account (422 if none)
  "codAmount": 1250,                  // optional, default = order due (amount - paid; 0 if paid)
  "weightKg": 0.5,                    // optional → account settings → 0.5
  "deliveryType": 48, "itemType": 2,  // pathao, optional → account settings
  "itemDescription": "2x T-shirt",    // optional → account setting → built from order items
  "note": "Call before delivery",     // optional → account setting
  "recipient": { "name": "…", "phone": "017…", "address": "…" },   // optional overrides, else from the order shipping address
  "pathao": { "storeId": 12345, "cityId": 1, "zoneId": 52, "areaId": 1023, "cityName": "Dhaka", "zoneName": "Mirpur", "areaName": "…" } // optional
}
```
→ 201 `OrderShipment` (with `courierBooking`), message `"Booked with Steadfast"`. If the order already has a live shipment that is
NOT booked with a courier and still `pending` (e.g. a manual one), that shipment is filled in instead of creating a second one.
Effects: order `fulfillmentStatus` → `shipped`, `shippedAt` set, `Pending` → `Processing` (booking = confirmed), order `carrier` set if empty.
Allowed order statuses: `Pending`, `Processing` (not `Cancelled` / `Delivered`).
Phone is normalized to `01XXXXXXXXX` (accepts +880 / 880 / spaces / dashes). Recipient defaults: shipping name → customer name,
shipping phone → customer phone, address = shipping line1, line2, city, state, postal. Note default: order delivery note → account note.
Re-booking after a cancel/return sends merchant order id `<invoiceNo>-R2`, `-R3`… (couriers reject duplicate invoices).
Errors: 404 order/account; 409 `This order is already booked with <Courier> (tracking …)` / another active non-pending shipment / booking in
progress; 422 order cancelled/delivered, invalid or missing phone, missing address, account off / not integrated / missing credentials,
pathao without a store, courier validation error; 502 courier unreachable; 500 only if the courier booked but our DB save failed (message
contains the consignment + tracking code so staff can record it manually).

### 3.2 `POST /sells/courier/bulk` — book many
```json
{ "sellIds": [10, 11, 12], "courierAccountId": 3,
  "defaults": { "weightKg": 0.5, "deliveryType": 48, "itemType": 2, "note": "…", "itemDescription": "…" } }
```
max 100 ids (keep Pathao batches ≤ 50: Pathao has no bulk API, orders are sent one by one). COD per order = its due
(amount − paid). Steadfast uses its bulk endpoint (falls back to one-by-one if the bulk request itself is rejected). → 200
```json
{ "total": 3, "succeeded": 2, "failed": 1,
  "results": [ { "sellId": 10, "invoiceNo": "INV-1", "ok": true, "shipmentId": 55, "consignmentId": "131822154", "trackingCode": "7DB724A65D4", "message": null },
               { "sellId": 12, "invoiceNo": "INV-3", "ok": false, "shipmentId": null, "consignmentId": null, "trackingCode": null, "message": "Invalid recipient phone" } ] }
```

### 3.3 `GET /courier/quote` — delivery charge (Orders.write)
query: `courierAccountId` (opt → default), `sellId` (opt), `weightKg`, `deliveryType`, `itemType`, `cityId`, `zoneId`
(`storeId` optional → account store) → `{ available: true, deliveryFee: 60, codFeePercent: 1, currency: "BDT", provider: "pathao", message: null }`
Steadfast → `{ available: false, deliveryFee: null, codFeePercent: null, message: "Steadfast does not provide a price API", … }`;
Pathao without city+zone → `available:false`, message `"Pick the city and zone to see the delivery charge"`. `sellId` is accepted but unused.

### 3.4 `GET /courier/customer-risk?phone=017…&courierAccountId=` (OPTIONAL, Orders.read)
→ `{ available: bool, provider, phone, totalParcels: int|null, delivered: int|null, returned: int|null, successRate: number|null (0-100), rating: string|null, message }`
Pathao only (`user/success`, cached 6h per phone); Steadfast → `available:false` + message. 422 for a non-BD number.

---------------------------------------------------------------------------------------------------
## 4. Shipments (permission `Shipments.read|write`)

### 4.1 `courierBooking` block — on every OrderShipment DTO (`/shipments*`) and on each entry of `sell.shipments[]`
(`null` for manual shipments). Named `courierBooking` because `sell.shipments[].courier` is an existing legacy string field.
```json
"courierBooking": {
  "provider": "steadfast", "accountId": 3,
  "consignmentId": "131822154", "trackingCode": "7DB724A65D4",
  "status": "in_transit",            // normalized courierStatus
  "rawStatus": "pending",            // courier's own string
  "statusAt": "…", "bookedAt": "…",
  "trackingUrl": "https://steadfast.com.bd/t/7DB724A65D4",   // may be null
  "deliveryFee": 60,                 // courier charge, null if unknown
  "codAmount": 1250,                 // COD requested from courier
  "codCollected": null,              // COD the courier reports collected (number|null)
  "isFinal": false, "canCancel": true, "canSync": true,
  "lastSyncedAt": "…", "syncError": null,
  "pathao": { "storeId": 1, "cityId": 1, "cityName": "Dhaka", "zoneId": 52, "zoneName": "…", "areaId": null, "areaName": null }   // pathao only, else null
}
```
`trackingNumber` of a courier shipment = Steadfast tracking code / Pathao consignment id. `carrier` = "Pathao" / "Steadfast".

### 4.2 Routes
| method | path | returns |
|---|---|---|
| POST | `/shipments/{id}/courier/sync` | `OrderShipment` (status refreshed now; courier error → 422/502 and `syncError` saved) |
| POST | `/shipments/{id}/courier/cancel` | `OrderShipment` (pathao only; steadfast → 422 "cancel from the Steadfast portal") |
| GET | `/shipments/{id}/courier/tracking` | `{ provider, status, rawStatus, source: "courier"\|"local", message: string\|null (courier error, fell back to local), events: [{ status: string\|null, message: string, time: string\|null }] }` newest first. Steadfast: courier events (`trackings_by_invoice`), Pathao: our own recorded history (status changes + booking). |

`GET /shipments` new filters: `courierProvider=pathao|steadfast|manual`, `courierStatus=<courierStatus>[,…]`, `courierAccountId`.
`sync` works on any courier shipment (also final ones — harmless). `cancel` only while `courierBooking.canCancel` (pathao, before pickup);
afterwards → 422 "already picked up". Manual status changes (`PATCH /shipments/{id}/status`) still work on courier shipments; the courier
sync never moves a shipment backwards, it only moves it forward.

---------------------------------------------------------------------------------------------------
## 5. Webhooks (public, no JWT)
`POST /api/webhooks/courier/{provider}/{webhookToken}` — URL shown by `GET /courier-accounts/{id}/webhook`.
- Steadfast: additionally requires header `Authorization: Bearer <same token>`; 401 `{"status":"error","message":"Unauthorized"}` otherwise.
  Reply 200 `{"status":"success","message":"Webhook received"}`. Payload read: `consignment_id`, `invoice`, `status`, `cod_amount`,
  `updated_at`, optional `notification_type` / `tracking_message` (tracking-only messages are added to the shipment history).
- Pathao: token in URL; optional `X-PATHAO-Signature` header must equal the token if sent. Replies 202. Reads `consignment_id`,
  `merchant_order_id`, `order_status` / `order_status_slug` / `event` ("order.delivered" → "delivered"), `collected_amount`, `delivery_fee`,
  `updated_at`. `event: "webhook_integration"` → 202 (+ integration header if configured).
- Idempotent (duplicate deliveries ignored, log table `courier_webhook_events`), unknown consignment → 200 (logged as ignored),
  missing consignment id → 422, processing error → 500 (courier retries). Token rotation (`/webhook/rotate`) invalidates the old URL.

---------------------------------------------------------------------------------------------------
## 6. Scheduler
`php artisan couriers:sync` every 15 min (withoutOverlapping): non-final courier shipments of active accounts not synced in the last 10 min, 100 per run.

---------------------------------------------------------------------------------------------------
## 7. Status mapping (raw → normalized `courierStatus`)
Matching is case-insensitive on a slug (`"At the Sorting HUB"` → `at_the_sorting_hub`); unknown strings keep the previous status (raw is still
stored and shown as `rawStatus`), then a keyword fallback is tried (partial/fail/return/cancel/hold/deliver/pickup/transit/hub…).

| Steadfast raw | courierStatus |  | Pathao raw | courierStatus |
|---|---|---|---|---|
| in_review | booked | | Pending, Order_Created | booked |
| pending | in_transit | | Pickup_Requested, Assigned_for_Pickup | pickup_pending |
| hold | on_hold | | Pickup_Failed | on_hold |
| delivered_approval_pending | out_for_delivery | | Pickup_Cancelled | cancelled |
| partial_delivered_approval_pending | out_for_delivery | | Picked | picked |
| cancelled_approval_pending | on_hold | | At_the_Sorting_HUB, In_Transit, Received_at_Last_Mile_HUB | in_transit |
| unknown_approval_pending | on_hold | | Assigned_for_Delivery | out_for_delivery |
| unknown | (keep previous) | | Delivered | delivered |
| delivered | delivered | | Partial_Delivery | partial_delivered |
| partial_delivered | partial_delivered | | Return, Paid_Return | returned |
| cancelled (before pickup) | cancelled | | Delivery_Failed | failed |
| cancelled (after pickup) | returned | | On_Hold | on_hold |
| | | | Payment_Invoice, Exchange | (keep previous) |

COD on delivery: `delivered` records a COD payment = courier-reported amount (Steadfast webhook `cod_amount`, Pathao `collected_amount`)
or, if not reported, the shipment `codAmount`; capped at the order due. `partial_delivered` with an unknown amount records nothing
(`codState` stays `delivered_record_payment` → staff use the existing "Record COD payment").

---------------------------------------------------------------------------------------------------
## 8. Assumptions / unconfirmed (owner must confirm with Pathao / Steadfast)
All isolated as constants in the drivers or `config/couriers.php` (env-overridable) so they are one-line fixes.
1. **Steadfast webhook**: format `{notification_type?, consignment_id, invoice, status, cod_amount, updated_at, tracking_message?}` with
   `Authorization: Bearer <token>` and how the URL/token is registered (owner pastes both in the Steadfast panel) — unconfirmed.
   `cod_amount` in the webhook is treated as the amount actually collected.
2. **Steadfast bulk** body = bare JSON array (package source). Official docs mention a `data` field → if bulk is rejected the code falls back
   to one-by-one booking automatically; switch `SteadfastDriver::BULK_WRAP_KEY = 'data'` if confirmed.
3. **Steadfast tracking events** `GET /trackings_by_invoice/{invoice}` and response key `tracking[] {text, created_at}` — unconfirmed.
4. **Steadfast public tracking URL** `https://steadfast.com.bd/t/{code}` (`STEADFAST_TRACKING_URL`) — unconfirmed.
5. **Steadfast `pending`** is mapped to `in_transit` (reviewed + accepted, parcel in their network); `*_approval_pending` are NOT final.
   Steadfast "cancelled" after pickup is treated as a return. No cancel / price / fraud-check API is used for Steadfast.
6. **Pathao status strings** (list in §7) — unconfirmed exact spelling; mapping is keyword-tolerant.
7. **Pathao order details path**: tries `orders/{id}/info` then `orders/{id}` (whichever answers is remembered for a day);
   COD collected field name (`collected_amount` / `cash_collected`) — unconfirmed.
8. **Pathao cancel** `POST orders/{id}/cancel` — unconfirmed endpoint; only allowed before pickup.
9. **Pathao city/zone/area**: sent only when chosen; treated as optional (package does). If the live API requires them, the UI must make
   the pickers required for Pathao (backend returns Pathao's validation message as 422 meanwhile).
10. **Pathao webhook**: payload/signature unconfirmed. We accept token-in-URL, optional `X-PATHAO-Signature` (= our token), `event`
    names like `order.delivered`, and reply 202. Pathao's "webhook integration" check may require the response header
    `X-Pathao-Merchant-Webhook-Integration-Secret: <value from Pathao docs>` — set `PATHAO_WEBHOOK_INTEGRATION_SECRET` in `.env`.
11. **Pathao token**: password grant re-issued on expiry / 401 (refresh_token not used); cached encrypted per account.
12. **Pathao `user/success`** response shape (`data.customer.total_delivery / successful_delivery`, `data.customer_rating`) — unconfirmed.
13. **Pathao price plan** `cod_percentage` assumed a fraction (0.01 = 1 %).
14. **Pathao tracking URL** `https://merchant.pathao.com/tracking?consignment_id={code}&phone={phone}` (`PATHAO_TRACKING_URL`) — unconfirmed.
15. Webhook URL base = `COURIER_WEBHOOK_BASE_URL` or `APP_URL` (currently `http://localhost:8005`) — production must set a public HTTPS URL.
16. Booking a `Pending` order auto-confirms it (`Processing`), mirroring "Mark shipped". Returned / cancelled courier parcels do NOT
    change the order status or restock (same as the existing manual "returned" shipment flow) — staff use Customer returns / cancel.
