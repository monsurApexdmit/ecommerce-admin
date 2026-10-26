# Phase 4 Shipments API contract (BE: inventory-laravel)

All under `/api/shipments`, ApiResponse envelope `{success,message,data}`. Perms: Shipments.read / Shipments.write.
Errors: 422 with `message` (HttpException) or validation `errors`.

## GET /shipments
Query: `page`, `per_page` (1..2000, default 10; `limit` alias), `status` (one or comma list), `carrier`, `search`
(tracking, carrier, rider, invoice, customer, phone), `start_date`, `end_date` (YYYY-MM-DD, on created date), `days` (e.g. 7/30),
`cod=1` (only COD shipments), `sell_id`. Newest first.
`data` = `{ data: Shipment[], total, per_page, current_page, last_page, readyToShip }`  (readyToShip = count for the banner).

## GET /shipments/stats
`{ readyToShip, codWithCouriers, total, pending, pickedUp, inTransit, outForDelivery, delivered, failed, returned, totalShippingCost }`

## GET /shipments/ready-to-ship
Query: `search` (invoice/customer/phone), `page`, `per_page` (1..2000, default 20). No 100 cap.
Orders: sell status Pending/Processing, not yet shipped (unfulfilled/processing/packed), not POS, no live shipment (failed/returned shipments don't count).
`data` = `{ data: ReadyOrder[], total, per_page, current_page, last_page }`
ReadyOrder: `{ id, sellId, invoiceNo, customerName, customerPhone, address, amount, paidAmount, dueAmount, shippingCost,
paymentMethod, paymentLabel ("Paid"|"COD"|"Unpaid"), isCod, itemCount, shippingMethod, status, fulfillmentStatus, orderTime }`

## POST /shipments  (create)
Body (camelCase; snake_case also accepted): `sellId`* , `carrier`*, `trackingNumber` (optional; blank = auto-generated, unique),
`rider`, `package` (pouch|box-m|box-l|custom, free string <=50), `shippingMethod`, `status` (default pending), `shippingCost`,
`codAmount`, `deliveryPayer` (customer|us), `deliverySpeed` (regular|express), `pickupDate`, `estimatedDelivery`, `shippedAt`,
`weight`, `dimensions`, `notes`, `markShipped` (bool; true -> order marked Shipped even while shipment pending; false -> order untouched; omitted -> default sync).
422: "Tracking number already exists" (per company), "This order already has an active shipment". 404 order not found.
NOTE: delivery address / phone live on the order (sell); there is no per-shipment address override.

## PATCH /shipments/{id}/status
Body: `status`*, `description` (alias `note`), `location`, `rider` (optional update).
Forward-only: pending -> picked_up -> in_transit -> out_for_delivery -> delivered (skipping ahead allowed, going back 422).
`failed` only from picked_up/in_transit/out_for_delivery and REQUIRES note: 422 "Add a note explaining why it failed".
From `failed` only `returned`. `delivered` and `returned` are terminal (422). Same status 422.
Delivered: order -> Delivered, COD payment recorded once, `codCollected` true. Failed/returned: order -> Packed.

## POST /shipments/{id}/cod-payment
For `codState = delivered_record_payment`. Body optional: `paymentMethod` (default "COD"), `notes`. Returns Shipment.
422 if not delivered / not COD / already recorded. Records order payment (if balance due) and sets codCollected.

## Shipment object (new/changed fields)
`id, companyId, sellId, trackingNumber, carrier, rider, package, shippingMethod, status, shippedAt, estimatedDelivery, deliveredAt,
shippingCost, codAmount, codCollected (bool), codCollectedAmount, codCollectedAt, codState, deliveryPayer, deliverySpeed, pickupDate,
weight, dimensions, notes, createdAt, updatedAt, trackingHistory[{status,location,description,eventTime}] , sell`
`codState`: `prepaid | to_collect | collected | delivered_record_payment | returning`
`sell`: `{ id, invoiceNo, customerName, customerEmail, customerPhone, customerAddress, area, source, paymentStatus, dueAmount, method, amount, status, shippedAt }`
COD report: GET /shipments?cod=1&per_page=2000 (+ date filters) — use codAmount, codState, codCollectedAmount/At, shippingCost, deliveryPayer, carrier, sell.invoiceNo/customerName.
No COD fee field is stored (compute 1% on FE if needed).
