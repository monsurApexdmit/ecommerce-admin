# Phase 2 Orders API contract (BE)

## GET /sells (paginated when no `limit`)
Query: `page`, `per_page`, `search` (customer name / invoice / phone), `customer_id`, `customer` (alias, name/phone/invoice text),
`status` = all | pending | confirmed | packed | shipped | delivered | completed | cancelled
  (legacy Pending/Processing/Delivered/Cancelled still work; `processing` = raw status Processing)
  - pending = status Pending; confirmed = Processing w/o packed/shipped fulfillment; packed = Processing + fulfillment packed;
    shipped = Processing + (fulfillment shipped or shipped_at set); delivered = status Delivered; completed = Delivered AND payment_status paid; cancelled = Cancelled
`payment` = all | paid | partial | unpaid (nothing paid, not cancelled) | due (legacy)
`source` = all | sales (manual/back-office) | pos | online (storefront)
`method`, `start_date`, `end_date` (YYYY-MM-DD, on order_time), `sort_by`, `sort_dir`.

Response `meta`:
```
meta.pagination {page, per_page, total, last_page}
meta.summary    {count, total}                      // existing, respects all filters
meta.tabCounts  {all, pending, confirmed, packed, shipped, delivered, completed, cancelled}
                // respects every filter EXCEPT status
meta.kpis       {totalOrders, last30Days, pending, confirmedOrPacked, shipped, delivered,
                 revenue, dueToCollect, unpaidCount}
                // company-wide (ignores filters); revenue = sum amount of non-cancelled;
                // dueToCollect = sum due_amount of non-cancelled; unpaidCount = non-cancelled with due>0;
                // last30Days = orders with order_time in last 30 days
```
Pending age: use `orderTime`/`createdAt` already in each sell.

## DELETE /sells/{id}
Only if status Cancelled, no payments recorded, no customer returns. Else 422 with message
("Only cancelled orders can be deleted" / "...has recorded payments..." / "...has customer returns...").

## PATCH /sells/{id}/delivery
Body (camelCase): `shippingFullName` (req, 1-255), `shippingPhone` (req, /^[0-9+()\-\s]{6,20}$/), `shippingAddressLine1` (req, <=500), `note` (nullable, <=500; stored in sell.notes).
422 when status Cancelled or Delivered. Returns the updated sell DTO.
