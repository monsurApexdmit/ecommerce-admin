# Parity fix plan — ecommerce-admin vs saas-inventory-ui

Source: page-by-page review of all 63 reference screens (`/home/monsur/Documents/saas-inventory-ui/<group>/<Name>.dc.html`) against the implementation.
Result of the review: **5 same · 29 minor differences · 29 significant differences.**
Reviewers read both sides' code and the backend; nothing was verified in a browser.

How to use this file
- Work phase by phase. Tick `[x]` when done. Phases are ordered by importance, not by app area.
- **FE** = frontend repo `/home/monsur/Documents/ecommerce-admin`. **BE** = backend repo `/home/monsur/Documents/Go/inventory-laravel` (runs in docker container `laravel-app`; migrate with `docker exec laravel-app php artisan migrate --force`).
- **[DECIDE]** = the reference has it but it may not make sense for real data; choose *build* or *skip* before starting. Skipped items stay in the list as "won't do" so they stop counting as gaps.
- Reference "demo only" things (Simulate…, Reset demo data, fake attachments) are intentionally not in this plan.

---

## Phase 0 — Bugs and safety (do first)

- [ ] **Staff email invite sets a default password.** BE `StaffService` creates the linked user with `ChangeMe123` and sends no set-password link, but the UI says "They get a link to set their own password". Create an invitation record + token email (or force password reset) and never ship a known default password.
- [ ] **No invitation accept flow.** Team invites work in the API but there is no `/auth/accept-invitation` page and no invite email. Build the page and email, or hide the invite UI.
- [ ] **Shipment with blank tracking number fails (422).** BE `CreateOrderShipmentRequest` requires `trackingNumber`; reference says "Leave blank to auto-generate (PTH-…)". Auto-generate on the backend.
- [ ] **Delivered shipment does not deliver the order.** BE `OrderShipmentService`: marking Delivered only sets `fulfillment_status`; the reference also sets the order Delivered and records the COD payment. Failed/Returned should send the order back to Packed (today it maps to fulfillment "cancelled").
- [ ] **Deletes that orphan or lose data.**
  - Customers with sales/payments can be deleted (reference blocks).
  - Brands with products can be deleted.
  - Categories with products can be deleted (backend only blocks categories with children).
  - Suppliers with purchase orders/payments can be deleted.
  - Zones used by shipments, fabrics used on orders (UI-only block today).
  - Add guards in BE services + clear 422 messages; show them in FE.
- [ ] **Cancelled orders show as "Unpaid"** in Orders (reference shows "Cancelled").
- [ ] **Dorji assignment pieces ignore quantity.** BE `TailorAssignmentBoardService::options` counts item rows, not summed quantities (Shirt ×3 prefills 1).
- [ ] **Tailor Reports → Dorjis "Speciality"** likely prints raw JSON (`DB::table` skips the array cast). Decode in `TailorReportService`.
- [ ] **Supplier dues second KPI is mislabelled** "Overdue 30+ days" but shows past-due-date data. Rename or recompute.
- [ ] **Dashboard payable card** always shows a due date (even when payable is 0) and `kpis.tsx` has no null guard on `payable.nextDue`.
- [ ] **Broken deep links:** Barcode `?ids=`, Salary `?staff=`, Inventory `?stock=attention`, Pages with notification panel open. Read the params.
- [ ] **Report Speciality / money text in KPI sub lines** from BE have no currency symbol (e.g. "1,000.00 collected"). Return structured values or format in FE.
- [ ] **Settings defaults.** A company with no saved settings gets USD / UTC / international numbers; reference defaults to ৳ / Asia/Dhaka / lakh. Set sensible BE defaults.
- [ ] **Timezone lists differ** between General settings (IANA) and Company settings (UTC/EST/…) for one field. Use one list.
- [ ] **Settings export contains payment gateway secrets in plain text.** Exclude or mask secrets in the export (and ignore them on import).
- [ ] **Aura Shop permission mismatch:** save needs `Settings.write`, image upload needs `Aura Shop.write`. Align.
- [ ] **Partial-save risk:** General/Company settings fan out to several endpoints with `Promise.allSettled`. Report per-section failures, or add one BE endpoint that saves atomically.

---

## Phase 1 — Sales list + New sale form (significant)

Files: FE `app/dashboard/sales/page.tsx`, `components/sales/new-sale-modal.tsx`, `components/sales/sale-detail-dialog.tsx` · BE `SellService`, `SellController`.

List page
- [ ] One-click "advance status" button per row (Confirmed → Packed → Shipped → Delivered); Packed/Shipped settable from this page.
- [ ] Row icons: Record payment, Cancel (direct).
- [ ] Bulk actions: Mark processing, Print invoices, Send to courier (alongside Mark delivered / Record payment).
- [ ] "To deliver" KPI clickable (opens Pending tab).
- [ ] Footer "N sales · Total X" and "Export N" for a selection, also when filtered.
- [ ] Channel filter default = All (reference lists Sales + POS + Online); KPIs follow the channel.
- [ ] Date filter presets: All time, Today, 7 days, 30 days, This month, Custom (check shared `DateRangeFilter`).
- [ ] Export: all filtered rows, 17 columns (Channel, Phone, Items, Subtotal, Discount, Tax, Delivery, Total, Paid, Due, …) — not just the current page.
- [ ] Record-payment dialog: editable amount (>0, ≤ due), methods Cash/bKash/Nagad/Card/Bank/COD, partial payments; bulk payment per-sale due.
- [ ] Invoice view: stock location, receiver, courier/zone/tracking, transaction ID, per-line discount column, Subtotal/Discount (coupon code)/Tax/Delivery/Total/Paid/Due block, delivery note, "Record payment" + "Mark next status" buttons.

New-sale form (also the SalesNew screen)
- [ ] Stock **location** selector; show "N in stock at <location>", footer "Stock will be deducted from <location>"; send `locationId` (API already accepts it).
- [ ] Per-line **discount** column (BE: add `discount` on order items).
- [ ] Discount type **Flat / Percent** with 100% cap and "cannot exceed subtotal".
- [ ] Editable **Delivery charge**.
- [ ] **Courier** select (Own delivery, Pathao, Steadfast, RedX, Paperfly) + auto-create a linked shipment (BE).
- [ ] Payment methods **bKash, Nagad, Bank**; Transaction ID field for those three (BE already accepts them).
- [ ] Order status options **Packed** and **Shipped** (BE currently restricts to Pending/Processing/Delivered).
- [ ] **COD rules:** customer required, forced unpaid, explanatory message.
- [ ] Validations: delivery address required when delivering, receiver phone format, duplicate lines (done in the last fix), unit price required, line-discount range, charge ≥ 0, partial amount > 0.
- [ ] Customer info line: phone, past orders, due, credit limit; "Walk-in sales must be paid in full".
- [ ] Quick-add customer: email format + duplicate-phone check; pick the new customer by id (not by name).
- [ ] Disable out-of-stock products in the dropdown (instead of a toast after picking).
- [ ] [DECIDE] Order-level `transactionId`, zone name, courier/delivery note stored as real fields (today folded into `notes`).

---

## Phase 2 — Orders (significant)

Files: FE `app/dashboard/orders/page.tsx`, `components/sales/sale-detail-dialog.tsx` · BE `SellService`, `SellRepository`.

- [ ] **Statuses:** add Confirmed (and Completed) to the backend status flow; tabs Pending / Confirmed / Packed / Shipped / Delivered / Completed / Cancelled. [DECIDE] if you keep only Processing.
- [ ] Payment filter: All / Paid / Partial / Unpaid.
- [ ] Row status select with all statuses (disabled when cancelled) + direct Cancel icon.
- [ ] Bulk: Confirm, Print invoices, **Print packing slips** (new), Cancel orders; "Create shipment" uses the first eligible selected order.
- [ ] Payment cell shows "Cancelled" for cancelled orders.
- [ ] Pending-age warning turns red after 7 days (ours: 30).
- [ ] Shipment cell: tracking + status ("PTH-123 · In transit"), "Picked up in store" for POS, "No shipment".
- [ ] "+ Create" shipment allowed when pending/confirmed/packed and no *live* shipment (failed/returned can be re-shipped).
- [ ] KPI sub-texts: "N in last 30 days", "Due to collect X · N unpaid", "Confirmed or packed".
- [ ] Deep links: `status` (all 7), `customer`/`q`/`search`, `source`, `pay`.
- [ ] Export: all filtered rows, 17 columns.
- [ ] **Detail panel:** phone + address, channel · location, coupon, line items with discount, totals block, inline Record payment (amount, method, "exceeds the due" check), "Edit delivery details & note" form (name, phone, address, note ≤ 500), action buttons (Confirm / Packed / Shipped / Delivered, Create shipment, Cancel order, Delete order).
- [ ] "Delete order" only for cancelled orders with no payments/returns (ours allows any).

---

## Phase 3 — Customers + New customer (significant)

Files: FE `app/dashboard/customers/page.tsx`, `components/customers/*` · BE `Customer` model/service/DTO, new migration.

Data fields to add (BE migration + DTO + requests)
- [ ] `type` (Individual / Business) separate from group; `business_name`; `licence_bin` (Trade licence / BIN).
- [ ] `customer_group` (Retail / Wholesale / **VIP** with 5% auto discount applied at sale time).
- [ ] `credit_limit`, **credit used** (derived from dues), `opening_balance`.
- [ ] `birthday`, `tags[]`, `sms_opt_in`, `status` (Active / Inactive — "kept for history"), `district/area`, country default Bangladesh.
Behaviour
- [ ] Inactive tab + "Inactive" badge; "Total customers · N inactive".
- [ ] Group filter (Retail / Wholesale / VIP) and Type filter (Individual / Business) as separate controls.
- [ ] **Merge duplicates:** "Review & merge" + bulk Merge that moves sales/payments to one record (BE).
- [ ] Bulk "Add tag"; header + bulk "Copy SMS numbers" (opted-in only).
- [ ] Detail panel: inline "Get payment" form (amount ≤ due; Cash/bKash/Card/Bank), Mark active/inactive, Delete (with guard), credit limit + "credit used (n%)", business/licence/birthday/SMS/tags rows, country in address, 5 recent orders.
- [ ] Import: skip rows without name/phone and duplicate phones; toast "Imported N, skipped M". Export: all filtered rows, 21 columns.
- [ ] New-customer validation: phone 7–15 digits, email format, credit/opening ≥ 0, business name required for Business, birthday not in the future; defaults District Dhaka / Country Bangladesh.

---

## Phase 4 — Shipments + New shipment (significant)

Files: FE `app/dashboard/orders/shipments/page.tsx`, `components/shipments/*` · BE `OrderShipmentService`, `OrderShipment` model, new migration.

Data to add: `cod_amount`, `cod_collected`, `delivery_paid_by` (customer/us), `speed` (regular/express), `pickup_date`, `rider`, `package`.
- [ ] Create form: editable **Delivery address***, **Delivery speed** (fee + ETA rules, own rider = 0), **Pickup date**, editable delivery charge.
- [ ] **COD panel:** amount to collect, who pays delivery, COD fee (1%), "Customer pays", "You receive", "Paid out by <courier> after delivery".
- [ ] Unique tracking number; auto-generate when blank (see Phase 0).
- [ ] Carrier/rider field for every courier (do not overwrite the courier name).
- [ ] Order picker: pending/confirmed/packed, not POS, no live shipment, shows address + Paid/COD tag; no 100-row cap.
- [ ] "Mark order as Shipped" checkbox (default on) instead of "Already handed to courier".
- [ ] List: banner "N orders are ready to ship", Date filter (Any / 7 / 30 days), **Export COD report**, bulk **Print labels**.
- [ ] One-click next-step button (Mark picked up → In transit → Out for delivery → Delivered); forward-only status list; note required for Failed; confirm for Failed/Returned; from Failed only Returned.
- [ ] COD column states: Prepaid / To collect / Collected / Delivered · record payment / Returning.
- [ ] Detail view: step timeline, phone, address, courier + service + rider, COD + state, delivery charge + payer, package, Pickup → ETA, history with location/date, actions Mark failed / Record COD payment / inline Update status.

---

## Phase 5 — Products list + Product form (significant)

Files: FE `app/dashboard/products/page.tsx`, `ProductFormDialog.tsx`, `contexts/product-context.tsx` · BE `ProductService`, product model.

List
- [ ] **Per-warehouse stock** everywhere (number, In/Low/Out state, tabs, sort, Hidden); bundle stock = complete bundles from child stock.
- [ ] Brand filter (All / No brand / each) and "Supplier: None"; show **brand** under category and **unit** next to stock/reorder.
- [ ] Default reorder point 0 = alert off (ours substitutes 5).
- [ ] Search also covers supplier and variant SKUs; tab counts follow the active filters.
- [ ] Row + bulk **Adjust stock** (quick ± quantity with reason "Quick adjust"/"Bulk adjust").
- [ ] **Print barcode** passes product ids (`?ids=`), also in the details modal.
- [ ] Details modal: Brand, Unit, Reorder at, Barcode type, offer end date, wholesale price + min qty, tracking, receipt/batch no., bundle price, tag badge, image gallery.
- [ ] Grid cards: margin + Delete; empty state with "Clear filters" / "+ Add product".
- [ ] Import: per-row validation (missing name/SKU/price, duplicate SKU/barcode, bad cost), match category/brand/supplier by name, book opening stock at default warehouse, list skipped rows. Export: Name, SKU, Barcode, Category, Brand, Supplier, Unit, Cost, Price, Offer, Stock, Reorder, Status, Published, Description.
- [ ] Bulk price update: percent ± (reject −100%), also reprice variants and wholesale.
- [ ] Custom `tag` badge (single) in addition to Best seller / Hot deal.

Product form
- [ ] **Save as draft** and **Save & add another**.
- [ ] Status card: **Available in POS** (BE column + POS filter) and **Visible online** toggles.
- [ ] Images: max 6, 5 MB each, JPG/PNG/WEBP errors.
- [ ] Barcode: QR type; regenerate valid EAN-13/8, UPC-A/E check digits on type change; "does not fit EAN-13 — will print as Code 128" warning; duplicate barcode check.
- [ ] Duplicate SKU checks (product + variant SKUs).
- [ ] Validations: % offer ≤ 100 (also per variant), selling price > 0, cost ≥ 0; warnings: price below cost, offer end date in the past, wholesale above selling price.
- [ ] Pricing model: selling price derived from cost + margin (or bundle override); drop the separate required "list price" or explain it.
- [ ] Variants: attribute Select all/Clear; generate adds only *new* combinations and keeps edits; variant defaults from product; "Remove all variants"; top Stock field spreads evenly over variants; variant SKU suffix 3 letters.
- [ ] Bundles: "Available" column + "Bundles available from current stock: N", "Items add up to ৳X", block self-containing / duplicate items.
- [ ] "No category" / "No brand" blank options, hide inactive brands, "+ Category/Brand/Unit" and "Manage attributes →" links, always show Supplier picker (with None), bKash in supplier payment methods, "Quantity only / Serial / Batch" labels.

---

## Phase 6 — Categories, Brands, Units, Attributes, Barcode, Coupons

Categories (FE `categories/page.tsx`, BE category model)
- [ ] Status tabs All / Published / Unpublished with counts.
- [ ] **Manual ordering** (Move up/down) — BE `sort_order`.
- [ ] Icon colour swatches (Blue, Purple, Amber, Red, Teal); description under the name; search over description.
- [ ] Duplicate-name check; block deleting a category with products; bulk delete summary "N deleted, M kept".
- [ ] Parent picker lists inactive parents (indented). Import/export by parent *name*, with description + product count.

Brands
- [ ] Import / Export (Name, Website, Description, Logo, Products, Active).
- [ ] Card: description, clickable website, **Stock value**, **View products**; "No brand" card.
- [ ] Duplicate-name and logo URL (http/https) checks; block delete when products exist.

Units
- [ ] Type filter chips (All / Count / Weight / Volume / Length); bulk "Export selected".
- [ ] Conversion target limited to the same type; duplicate name/symbol checks; import keeps conversions + active flag; fix delete dialog text to match the backend guard; select-all over the whole filtered list.

Attributes
- [ ] Status tabs with counts; "used in N products" + in-use warning on delete; slug **Key**; "Rename value".
- [ ] Validation: at least one value, duplicate attribute name, duplicate value toast.
- [ ] Import: blank published defaults to published, read colours and "button"; export with colours + usage.

Barcode page (FE `products/print-barcode/page.tsx`)
- [ ] `?ids=` preselection, "Add from last purchase", "Clear list", variant rows (label per variant), SKU label field.
- [ ] Paper sizes: A4·24, A4·40, Letter·20/30/50, **Label roll** (thermal, one label per page) + tip.
- [ ] "Sheet N of M" preview paging and "N labels · M sheets"; print page-breaks per sheet; preview honours font sizes.
- [ ] Price mode wording "Including tax (X%) / Excluding tax"; label price should use the product price (not ignore offers inconsistently).
- [ ] Barcode follows each product's type with Code 128 fallback; variants use variant SKU; remember preferences in the browser; business name from store settings; packing date default off.

Coupons
- [ ] **Used up** status/tab ("Limit reached"); map Inactive → Disabled; status precedence Disabled → Used up → Scheduled → Expired.
- [ ] "Where it works" summary on each row; inline enable switch + copy; "No sales yet" / "Not started" text.
- [ ] Checks: duplicate code, total uses ≥ already redeemed, whole numbers, % ≤ 100.
- [ ] End date optional ("No end"); code may contain `-` and `_`; coupon stays active through its last day (compare end of day).
- [ ] Picker filter box + "N selected"; changing "Applies to" clears picked ids; export all filtered with applies-to, max, per-customer, sales.

---

## Phase 7 — Suppliers, Purchase orders, Inventory, Returns

Suppliers
- [ ] Duplicate-name check; negative lead time / opening balance errors; block delete when POs/payments exist.
- [ ] KPI "· N blocked"; Purchased "· N open"; search also over description and TIN/BIN; banner wording for one supplier / no overdue PO.
- [ ] Active switch should flip Blocked → Active; import/export full columns with duplicate skip.

Purchase orders (+ PONew)
- [ ] **Receive at** location in the detail dialog + confirm before receiving; row "Receive rest" for partial POs.
- [ ] Allow payment on draft POs; "Mark ordered" in place.
- [ ] Form checks: delivery date not in the past, payment date not in the future, discount range, tax 0–100, shipping ≥ 0, advance ≤ total, blocked supplier rejected (BE too).
- [ ] Expected delivery prefilled from supplier lead time (7-day default) with hint; "Receive at" defaults to the default location; optional "Any variant".
- [ ] Low-stock rule: `max(1, reorder×3 − stock)` and include reorder point 0.
- [ ] Cancel / delete guards (received stock, payments); `?new=1` not required to open the form (PONew).
- [ ] Footer "still to pay" and export over all filtered POs, 17 columns; richer print sheet (paid/due/status/phone/date).

Inventory / Adjustments / Transfers
- [ ] `?stock=attention` preselects the tab; quick adjust starts empty, integers only, rejects unchanged; parent product adjustable.
- [ ] Import CSV `total_stock`/`on hand` columns; export Barcode, Reorder at, Unit cost.
- [ ] Adjustments: default type Decrease, first product + default warehouse preselected; reason filter lists reasons present; show adjustment number + time; notification for large adjustments.
- [ ] Transfers: default From = default location; show reversal record "Returned via <no>"; export one row per line.

Serial & batch
- [ ] "Sell order" text: Sell first / Next / Expired — do not sell / Depleted; exclude expired batches from FEFO ranking; "OK" for no expiry.
- [ ] Edit batch: allow quantity 0, allow changing product; export batches + serials with Type, Manufactured, Qty, Notes.
- [ ] [DECIDE] Allow any product (reference) vs require batch/serial tracking (current backend).

Returns
- [ ] Customer returns: confirm on Approve; require a reason on Reject; default item reason "Changed my mind"; "Find" picks a unique match; export all with reason/rejection reason; "No refund" reduces the invoice total; "original payment" names the method and reverses the payment; use net-of-discount unit price.
- [ ] Supplier returns: photo attachments; PO chips "Not linked" + received POs; supplier filter lists only suppliers with returns; credit note effect text; "Credit to receive" includes replacements; export with credit type.

---

## Phase 8 — Finance and Staff

Dues (shared `components/dues/dues-view.tsx` — split customer vs supplier)
- [ ] **Supplier layout:** columns Supplier | Purchase orders (numbers, partly paid) | Due | Due date ("Due in Nd / Overdue Nd / Due today") | Status (Draft/Ordered/Received · overdue); KPI "Due in next 7 days"; fix "Overdue" label; include draft POs; default method bKash; first row auto-selected; "Note to supplier" block.
- [ ] **Customer layout:** "Last reminder" column, "Unpaid" text ("2 invoices · partly paid"), per-document "N days old · paid X of Y", reminder message always previewed, sort cycle Most overdue → Highest due → Name, auto-select first row, show customer group, aging counts as "N accounts".
- [ ] Both: no future payment date; walk-in dues collectable (or documented).

Expenses / categories / Reports
- [ ] Expenses: **Export CSV** (14 columns); choosing a supplier fills "Paid to"; Next due prefilled (date + period); date-order validations (BE too); templates also copy recurring settings; search note; show inactive category when editing.
- [ ] Expenses KPI: "Profit after expenses" = revenue − expenses (reference) vs ours revenue − COGS − expenses [DECIDE]; recurring count by latest row per title+category.
- [ ] Categories: export "Expenses (all time)" count; "Over by ৳X" on the budget line; protect the Salaries category; search description/type.
- [ ] Reports: sales tax tracking (BE has no tax column) [DECIDE]; revenue/profit from line values like the reference; pinned Total row per page.

Staff / Roles / Salary
- [ ] Staff: protect the only Owner; duplicate email/phone + phone format validation; seat-limit block in the form.
- [ ] Staff details: Pay / "Generate <Month> salary" / "Pay all due" actions; Status + Published rows; Salary link with `?staff=`.
- [ ] Defaults: Cashier + PIN + first location; role picks sign-in method; new staff created published; hide Owner from role picker; show role description on role buttons.
- [ ] PIN login endpoint (stored today, not usable).
- [ ] Last-active wording ("Online now", "Today, 3:04 pm"); "All locations" text.
- [ ] Roles: save each toggle immediately (or keep Save and accept the difference); footer "Can open N of M areas · S sensitive actions allowed".
- [ ] Salary: payslip autosave (or accept Save button), preselect first row + `?staff=`, confirm before single Pay, list only generated rows or accept "Not generated" rows, history page size 5.

---

## Phase 9 — Settings and billing

- [ ] **Plan & billing (SetBilling) page:** pick a plan from a compare table with sticky Save/Discard, switch Monthly/Yearly for the current plan, invoice list (Invoice, Date, Plan, Period, Amount) — build `billing/overview` or fold into Subscriptions.
- [ ] Subscriptions: free-trial row in payment history; "Billing settings" link target.
- [ ] Billing plans: trial lock only after a *paid* plan existed; edit-plan pencil visibility; billing email prefill from store email.
- [ ] Team members: edit/change role/edit email on **invited** rows; role filter lists all roles; Joined date semantics.
- [ ] Company settings: server-stored accent (`accentName`) instead of localStorage; storefront brand colors saved on the company.
- [ ] General settings: export/import full backup incl. logo/banner URLs; reset (no demo reset); `.env` snippet from the saved API URL.
- [ ] Locations: manager as select from staff; plan hint "unlimited"; district list.
- [ ] Notifications settings: wire the other 4 events (payment received, PO received, tailor ready, daily summary); "Buy more SMS" action; SMS/email senders (no gateway today).

---

## Phase 10 — Store, content, support

- [ ] **Payment methods (first section):** six fixed methods (Cash, bKash, Nagad, Card, Bank transfer, COD) with enable switch, Make default, POS/Online chips, status chip (Live/Test/Off), account fields, Test-mode switch, save rules (default must be on, at least one enabled, enabled needs an account number). BE: store `payments.methods` + `default`. COD default limit 5000 (ours 0).
- [ ] Online store: "Clear wishlist data" (BE endpoint + confirm), "Button goes to" options (`/shop` + categories), "Visit store" link when slug has no dot, always show wishlist block (not only with permission) [DECIDE].
- [ ] **Storefront must read `onlineStore`** (name, slug, policies, social links) — saved but unused today.
- [ ] Shipping: "pickup" zone type; checkout preview from a sample cart with free-delivery applied; delete guard for zones used by shipments; free-minimum default.
- [ ] Shipping addresses: "Set as Default" for all non-default rows; sort by created date.
- [ ] **Notifications centre:** live alerts (out of stock, low stock, order pending > 24h, customer owes > 30 days, PO overdue) with dismiss/re-arm; priority per alert; "Delete all N notifications?"; CTA labels Reorder / Pay vendor / View coupon / View adjustment; attention card sums *all* dues/salaries.
- [ ] **Pages:** header Notifications button + dropdown (latest 6, Mark all read), "View store ↗", pre-opened notification panel; quick-start list (FAQ, Returns & Refunds, Shipping Policy, Privacy Policy + seeded About); keep a Markdown `body` copy for FAQ/Policy; select first page after delete.
- [ ] Storefront renders `type: custom` pages, `body`, `place` (not wired today).
- [ ] Support: unread markers (BE unread state) and search over description.

---

## Phase 11 — Tailor

- [ ] **Orders:** deduct fabric when the order first moves past "Received" (cutting), block with "Not enough <fabric>: need X, only Y"; do not silently floor at 0; restore on cancel [DECIDE].
- [ ] Deliver always collects the balance (remove "Deliver without collecting") [DECIDE].
- [ ] Details dialog: dorji lines `<dorji> · <task> ×qty`; "paid" label; Print invoice icon in the list; separate Cancel button with reason; relative "ago" in timeline; payment type labels Advance / Final / Payment; CSV Notes column.
- [ ] New order: "+ New customer" link; default stitching prices + fabric per piece for the 10 reference garments (Shirt 450 / 1.8 m …) when a shop has no history; "Pant" naming; "m" fabric unit fallback; one assignment per line using the dorji's `ratePerPiece`.
- [ ] Assignments: row Delete (+ "Paid jobs cannot be deleted"); pieces = summed quantities; default rate always the dorji's `ratePerPiece`; "Print all job cards" prints the whole window; set `order.dorjiId`.
- [ ] Payments: create an `expenses` row (category Salaries, source salary) on dorji payout [DECIDE — avoid double counting with Staff salary]; payment type labels; receipt prints created date; "balance changed — review and retry".
- [ ] Dorjis: "+880" phone prefix + placeholder, notes textarea.
- [ ] Fabrics: global tab counts; server-side duplicate name+colour check; outline "Order fabric" button.
- [ ] Measurements: "used by N tailor orders" delete text; full customer form link.
- [ ] Reports: fix Speciality (Phase 0); "Fabric used" counts only consumed orders.
- [ ] Dashboard: icon per KPI tile; board dorji = order's own dorji.

---

## Phase 12 — Dashboard, shell and POS polish

- [ ] Dashboard "Today" hourly chart (BE buckets by hour); chart subtitle follows the range ("Daily, last 7 days · Best day …").
- [ ] Header search: inline grouped dropdown (Product / Invoice / Customer / Page), **search customers**, Escape clears.
- [ ] "New sale" button → POS (reference) vs Sales form (ours) [DECIDE]; location control cycles vs dropdown.
- [ ] KPI details: Receivable "N open invoices · M customers" (BE debtor count), Net revenue "{Range} · N orders", Gross profit "–" when no revenue and red when negative, Payable "clear" state with the earliest PO due date.
- [ ] Salary alert: payslip count; "Salaries all paid" from payslip rows; Cash & obligations labels ("Cash in · {range}", "Not generated" 0% bar).
- [ ] Sales by channel: add "Cash on delivery", sort by revenue; payment methods title-cased and capped at 6; recent-orders status pills for all statuses; pipeline counts by sale status (not date range).
- [ ] Reorder suggestions: candidate + quantity rule from the reference (`max(ceil(v·(lead+safety)) − onHand, reorder·(v>0?1:2) − onHand, 1)`), lead time from the latest PO's supplier, round (not floor) days of cover.
- [ ] Sidebar: business name instead of "SAAS Inventory"; Inventory chip counts out-of-stock only ("N out"); Salary due chip; sidebar collapsed state saved in settings; collapsed flyout pinned behaviour.
- [ ] POS: trim cart on location change ("Cart adjusted to stock available at …"); warehouse selector shows address + "N in stock"; only locations with `sells_in_pos`; hide products flagged not for POS; per-product low-stock threshold (reorder point or 5); stock toasts with name + location; receipt shows customer phone + "Txn …"; do not fall back to total stock for a location with no row; best-selling over all sales (not only 90 days); suggested-coupon chips hide expired/exhausted coupons; scope coupons to cart items (send `items`).

---

## Phase 13 — Backend features stored but not wired

- [ ] Receipt paper size + footer message → POS receipt and invoice print.
- [ ] Holiday closures → storefront/store-hours messages.
- [ ] Email / SMS / customer-SMS notification channels (needs a sender or gateway) and the 4 unfiltered notification events.
- [ ] PIN sign-in endpoint for staff.
- [ ] Phone verification (OTP) at COD checkout.
- [ ] Pickup-point locations, district, "ships online" flag consumed by checkout/shipping.
- [ ] Wholesale price + min wholesale qty applied in sell pricing.
- [ ] Coupon scope enforced with cart items; `once_per_customer` needs `customerId` on every channel.
- [ ] Expired offers ignored in *all* pricing paths (only storefront filters today).

---

## Phase 14 — Final QA (browser)

Nothing in this project has been exercised in a browser yet. After each phase, smoke-test:

- [ ] Light and dark theme on every rebuilt page; sidebar expanded and collapsed.
- [ ] Mobile width (no horizontal page scroll).
- [ ] Permissions: owner, admin, and a custom role with limited access (sidebar, pages, buttons, export/cost hidden flags).
- [ ] Core flows end to end: open shift → POS sale (cash, bKash, COD) → receipt → close shift; new sale → invoice → payment; order → shipment → delivered (COD collected); purchase order → receive → pay supplier; customer return → restock → refund; supplier return → credited; expense (recurring) → report; staff invite → accept; payroll generate → pay → expense row; tailor order → assignment → payout.
- [ ] Run `php artisan migrate:status` (no pending) and the scheduler (`expenses:generate-recurring` needs `schedule:run`/`schedule:work`).
- [ ] Remaining TypeScript errors outside this work: `components/ListPage`, `contexts/saas-auth-context`, `contexts/vendor-context`, `app/dashboard/checkout`, `components/PricingCard`, `hooks/use-module-guard`.
- [ ] Pages never restyled (not in the reference): sign-in/sign-up/reset, landing, platform admin, edit profile, international, checkout + billing checkout/success/blocked-access, legacy `/dashboard/sells`, product barcode + reviews, vendor detail, public tailor tracking.

---

### Suggested order of work
1. Phase 0 (bugs/safety) → 2. Phases 1–4 (Sell) → 3. Phase 5–6 (Catalog) → 4. Phase 7 → 5. Phase 8 → 6. Phases 9–11 → 7. Phase 12 → 8. Phase 13 → 9. Phase 14 after every phase.
