# Finance API contract

Backend: Laravel (`/home/monsur/Documents/Go/inventory-laravel`). Status: v1 **implemented**; **v2 implemented** (2026-10-28) — see the section "v2 additions" (near the end) and the "Changelog". v2 is additive: v1 fields keep their names and shapes.

All routes are under `/api/finance`, need the JWT (`Authorization: Bearer …`) and the permission module **`Finance`**:

| HTTP | permission |
|---|---|
| GET | `Finance.read` |
| POST | `Finance.write` (role needs *create*; POST on `/{id}/…` also accepts *edit*) |
| PUT | `Finance.write` (role needs *edit*) |
| DELETE | `Finance.delete` |

Owner/admin users bypass permission checks. Every plan includes the `Finance` module. Roles that had Expenses rights got the same Finance rights. In the role matrix it is the module **"Accounts & ledger"** in the **Finance** group (backend permission `Finance`).

## Envelope

```json
{ "success": true, "message": "Success", "data": { … }, "meta": { … } }
```
`meta` is present only on paginated lists:
```json
"meta": { "total": 132, "perPage": 25, "currentPage": 1, "lastPage": 6 }
```
Errors:
```json
{ "success": false, "message": "Choose an account.", "errors": { "accountId": ["Choose an account."] } }
```
- 422 validation: `message` is the first readable error, `errors` has every field (camelCase keys, same names you sent).
- 404: `{ "success": false, "message": "Account not found" }` (also "Entry not found", "Transfer not found").
- 422 business rule: `{ "success": false, "message": "…" }` (messages listed per endpoint).

Money is a JSON number with 2 decimals (BDT). Dates are `YYYY-MM-DD`; timestamps ISO-8601 (server time, UTC offset `+00:00`). Formatting on the client; a few server texts (alerts) are already formatted with the company currency (e.g. `৳1,200.00`). `currency` (`{ "code": "BDT", "symbol": "৳" }`) is returned by `/overview`.

## Common query params

### Period (all endpoints that take a period)
| param | values | default |
|---|---|---|
| `preset` | `today`, `yesterday`, `this_week`, `last_7_days`, `this_month`, `last_month`, `last_30_days`, `this_quarter`, `last_quarter`, `this_year`, `last_year`, `all_time`, `custom` | `this_month` (Transactions/Payments/Payouts lists default to `all_time` when neither `preset` nor `from`/`to` are sent) |
| `from` | `YYYY-MM-DD` | – |
| `to` | `YYYY-MM-DD` | – |

Sending `from` and/or `to` implies `custom` (an open side is unbounded). Response objects carry:
```json
"period": { "preset": "this_month", "label": "This month", "from": "2026-10-01", "to": "2026-10-31", "previousFrom": "2026-09-01", "previousTo": "2026-09-30" }
```
(`from`/`to` are `null` for `all_time`; `previousFrom`/`previousTo` are `null` when there is no previous period: `all_time` or an open custom range.) The previous period is the same length immediately before `from` (for calendar presets: previous calendar month / quarter / year / week).

Errors: `"From date must be a valid date (YYYY-MM-DD)."`, `"To date must be a valid date (YYYY-MM-DD)."`, `"The to date must be on or after the from date."`, `"Unknown period preset."`

### Paging
`page` (≥1, default 1), `perPage` (1–100, default 25; `per_page` also accepted).

### CSV
Endpoints marked **CSV** accept `format=csv` and return `text/csv` (attachment, UTF-8 with BOM, all matching rows up to 10 000, same filters, no paging).

## Enums

**Account type** `type`: `cash` | `bank` | `mobile_wallet` | `card` | `other`
Labels: Cash, Bank, Mobile wallet, Card, Other.

**Payment method keys** (`methodKey`, `methodKeys[]`) – the server normalises every stored payment method text to one of these (unknown texts become their lower-cased text, e.g. `"upay"`):

| key | label | matches stored texts |
|---|---|---|
| `cash` | Cash | cash, empty |
| `bank` | Bank transfer | bank, bank transfer, bank_transfer, bank deposit |
| `card` | Card | card, credit/debit card, stripe |
| `bkash` | bKash | bkash…, mobile banking |
| `nagad` | Nagad | nagad… |
| `rocket` | Rocket | rocket… |
| `online` | Online | online, sslcommerz, portwallet, paypal, gateway |
| `cod` | Cash on delivery | cod, cash on delivery |
| `cheque` | Cheque | cheque, check |

Methods are mapped to accounts by `methodKeys`. A key may belong to only one account. **Unmapped keys post to the default account.**

**Direction**: `in` | `out`.

**Ledger source type** `sourceType`:
| value | label | direction | from |
|---|---|---|---|
| `sale` | Sale payment | in | sale payments (`due_payments` on sells, not COD) + sales marked paid with no payment rows (old/online-gateway sales) |
| `cod` | COD collection | in | sale payments that are a shipment's COD collection |
| `refund` | Customer refund | out | sale payment reversals (returns) + cash refunds of customer returns |
| `supplier_payment` | Supplier payment | out | purchase-order payments + supplier opening-balance payments |
| `supplier_refund` | Supplier refund | in | supplier returns settled as a cash refund |
| `expense` | Expense | out | expenses (manual/recurring) |
| `salary` | Salary | out | salary payouts |
| `dorji_payout` | Dorji payout | out | tailor dorji payouts |
| `tailor_payment` | Tailor payment | in | tailor customer payments |
| `manual` | Manual entry | in/out | `finance_entries` |
| `transfer` | Transfer | in/out | `finance_transfers` (two lines) |

**How each money movement is counted once:** salary payouts and dorji payouts are read from their mirrored Expenses rows (expense `source` = `salary` / `dorji_payout`, shown with sourceType `salary` / `dorji_payout`); the `salary_payments` / `tailor_payments` rows themselves are used only when no live mirror expense exists (old data). Customer-return refunds that reversed a sale payment are the `due_payments` "out" rows; only cash refunds without such a row come from `customer_returns`. COD collections are sale payments whose reference is the shipment tracking number (or method COD). Transfers are excluded from money in/out totals in overview and cash flow.

**Manual entry kind** `kind`: `income` (direction in) | `expense` (direction out) | `adjustment` (direction you choose).

**Alert severity**: `info` | `warning` | `danger`.

---

## 1. Accounts

### `GET /api/finance/accounts`
Creates the default accounts the first time a company has none (idempotent): **Cash** (`cash`, default, keys `["cash"]`), **Bank** (`bank`, keys `["bank","card","online"]`), **bKash** (`mobile_wallet`, `["bkash"]`), **Nagad** (`mobile_wallet`, `["nagad"]`).

Query: `asOf` (date, default today) – balances as of the end of that day; `includeInactive` (`true`/`false`, default `true`).

```json
{
  "data": {
    "accounts": [
      {
        "id": 7, "name": "Cash", "type": "cash", "typeLabel": "Cash",
        "methodKeys": ["cash"], "methodLabels": ["Cash"],
        "receivesUnmapped": true,
        "openingBalance": 5000, "isDefault": true, "isActive": true, "note": null,
        "moneyIn": 125400.5, "moneyOut": 80250, "balance": 50150.5,
        "transactionCount": 412, "lastActivityDate": "2026-10-27",
        "createdAt": "2026-10-28T09:12:00+06:00", "updatedAt": "2026-10-28T09:12:00+06:00"
      }
    ],
    "totals": { "balance": 50150.5, "moneyIn": 125400.5, "moneyOut": 80250, "activeCount": 4 },
    "asOf": "2026-10-28",
    "methodOptions": [ { "key": "cash", "label": "Cash", "accountId": 7 }, { "key": "cod", "label": "Cash on delivery", "accountId": null } ],
    "unmappedMethods": [ { "key": "cod", "label": "Cash on delivery", "amount": 1200, "count": 3 } ],
    "defaultAccountId": 7
  }
}
```
`balance = openingBalance + moneyIn − moneyOut` (all ledger lines posted to the account up to `asOf`). `receivesUnmapped` is true for the default account. `methodOptions[].accountId` is the account a key is mapped to (`null` = falls to default). `unmappedMethods` = method keys seen in the ledger that no account maps explicitly (they post to the default account).

### `GET /api/finance/accounts/{id}`
Same account object (with balances) as `data`.

### `POST /api/finance/accounts` (201)
```json
{ "name": "City Bank", "type": "bank", "methodKeys": ["bank"], "openingBalance": 0, "isDefault": false, "isActive": true, "note": "AC 1234" }
```
| field | rules |
|---|---|
| `name` | required, ≤100, unique per company (case-insensitive) |
| `type` | required, enum |
| `methodKeys` | optional array of strings (≤30 chars each, lower-cased by server) |
| `openingBalance` | optional number (may be negative), default 0 |
| `isDefault` | optional bool – setting true unsets the previous default |
| `isActive` | optional bool, default true |
| `note` | optional ≤500 |

Errors: `"Account name is required."`, `"An account named \"Cash\" already exists."`, `"Choose an account type: cash, bank, mobile_wallet, card or other."`, `"Payment method \"bKash\" is already mapped to account \"bKash\"."` (method label), `"Opening balance must be a number."`, `"The default account cannot be inactive."`
Response: account object, message `"Account created"`.

### `PUT /api/finance/accounts/{id}`
Same fields, all optional (send only what changes). Message `"Account updated"`. Error also: `"The default account cannot be inactive."`, `"Set another account as default first."` (when sending `isDefault:false` on the default account).

### `POST /api/finance/accounts/{id}/default`
Makes it the default account (also activates it). Message `"Default account updated"`. Returns the account.

### `DELETE /api/finance/accounts/{id}`
Errors: `"The default account cannot be deleted. Set another account as default first."`, `"This account has manual entries or transfers. Delete them first or deactivate the account."`. Its method keys then post to the default account. Message `"Account deleted"`, `data: null`.

---

## 2. Transactions (ledger) — **CSV**

### `GET /api/finance/transactions`
Query: period params (default `all_time`), `accountId`, `direction` (`in`|`out`), `sourceType` (one value or comma list), `method` (method key), `search` (party, reference, note, category, method), `sort` (`date_desc` default | `date_asc`), paging, `format=csv`.

```json
{
  "data": {
    "rows": [
      {
        "id": "sell_payment:812",
        "sourceType": "sale", "sourceLabel": "Sale payment",
        "date": "2026-10-27", "createdAt": "2026-10-27T14:03:11+06:00",
        "direction": "in", "amount": 1500, "signedAmount": 1500,
        "accountId": 9, "accountName": "bKash",
        "method": "bKash", "methodKey": "bkash", "methodLabel": "bKash",
        "party": "Rahim Uddin", "partyId": 31,
        "reference": "INV-000231", "category": null,
        "note": "Payment at sale creation",
        "link": { "type": "sale", "id": 231, "href": "/dashboard/sales?q=INV-000231" },
        "kind": null,
        "editable": false, "entryId": null, "transferId": null,
        "runningBalance": null
      },
      {
        "id": "transfer:4:out", "sourceType": "transfer", "sourceLabel": "Transfer",
        "date": "2026-10-26", "direction": "out", "amount": 2000, "signedAmount": -2000,
        "accountId": 7, "accountName": "Cash", "method": null, "methodKey": null, "methodLabel": null,
        "party": "To Bank", "partyId": null, "reference": "TR-4", "category": null, "note": "Deposit",
        "link": null, "editable": true, "entryId": null, "transferId": 4, "runningBalance": null
      }
    ],
    "totals": { "moneyIn": 98000, "moneyOut": 45500, "net": 52500, "count": 132 },
    "account": null,
    "openingBalance": null,
    "closingBalance": null,
    "period": { "preset": "all_time", "label": "All time", "from": null, "to": null, "previousFrom": null, "previousTo": null }
  },
  "meta": { "total": 132, "perPage": 25, "currentPage": 1, "lastPage": 6 }
}
```
When `accountId` is sent: `account` is the account object, `openingBalance` is the account balance just before the period (`openingBalance` of the account for `all_time`), `closingBalance` the balance at the end of it, and every row has `runningBalance` = account balance right after that line (computed over **all** lines of the account in the period in date order, even when `direction`/`sourceType`/`search` hide some lines).

Ids: `sell_payment:{due_payment id}`, `sell_unrecorded:{sell id}`, `po_payment:{due_payment id}`, `vendor_payment:{id}`, `expense:{id}`, `salary_payment:{id}` (old salaries without an expense row), `tailor_payment:{id}`, `dorji_payout:{tailor_payment id}` (old payouts without an expense row), `customer_return:{id}`, `vendor_return:{id}`, `entry:{id}`, `transfer:{id}:out` / `transfer:{id}:in`.

`kind` is the manual entry kind (`income`/`expense`/`adjustment`) on `manual` rows, else `null`.

`link.type` values and `href`:
| type | href |
|---|---|
| `sale` | `/dashboard/sales?q={invoiceNo}` |
| `purchase_order` / `vendor` | `/dashboard/vendors/{vendorId}` |
| `expense` | `/dashboard/expenses` |
| `salary` | `/dashboard/staff/salary?staff={staffId}` |
| `tailor_order` | `/dashboard/tailor/orders/{orderId}` |
| `tailor_payments` | `/dashboard/tailor/payments` |
| `customer_return` | `/dashboard/returns/customer` |
| `vendor_return` | `/dashboard/returns/vendor` |
`link` is `null` for manual entries and transfers (edit them in place: `editable: true`).

Errors: `"Account not found"` (404 for an unknown `accountId`), `"Direction must be in or out."`, `"Unknown source type: xyz."`.

### Manual entries
`GET /api/finance/entries/{id}` → entry object.

`POST /api/finance/entries` (201, message `"Entry added"`)
```json
{ "accountId": 7, "kind": "income", "direction": "in", "amount": 500, "date": "2026-10-27", "category": "Interest", "party": "City Bank", "reference": "SB-22", "note": "Monthly interest" }
```
| field | rules |
|---|---|
| `accountId` | required, an account of the company → `"Choose an account."` / `"Account not found"` (422) |
| `kind` | required `income`/`expense`/`adjustment` → `"Choose income, expense or adjustment."` |
| `direction` | required only for `adjustment` (`in`/`out`) → `"Choose whether the adjustment adds (in) or removes (out) money."`; ignored for income (in) / expense (out) |
| `amount` | required, > 0, ≤ 999 999 999 → `"Amount must be greater than zero."` |
| `date` | required, not in the future (1 day slack) → `"Date cannot be in the future."` |
| `category`, `party`, `reference` | optional ≤100 |
| `note` | optional ≤1000 |

Entry object:
```json
{ "id": 3, "accountId": 7, "accountName": "Cash", "kind": "income", "direction": "in", "amount": 500, "date": "2026-10-27", "category": "Interest", "party": "City Bank", "reference": "SB-22", "note": "Monthly interest", "createdBy": 12, "createdByName": "Monsur", "createdAt": "…", "updatedAt": "…" }
```
`PUT /api/finance/entries/{id}` – same fields, all optional (message `"Entry updated"`). `DELETE /api/finance/entries/{id}` (message `"Entry deleted"`).

Manual `income` / `expense` entries show in P&L as **Other income / Other expenses**; `adjustment` entries only move balances.

### Transfers
`GET /api/finance/transfers` – period params, `accountId` (either side), paging → `data: { rows: [transfer…], totals: { amount, count } }` + `meta`.
`GET /api/finance/transfers/{id}` → transfer object.
`POST /api/finance/transfers` (201, `"Transfer recorded"`)
```json
{ "fromAccountId": 7, "toAccountId": 8, "amount": 2000, "date": "2026-10-26", "reference": "DEP-1", "note": "Deposit" }
```
Errors: `"Choose the account the money leaves."`, `"Choose the account the money goes to."`, `"Pick two different accounts."` (on `toAccountId`), `"Amount must be greater than zero."`, `"Date cannot be in the future."`, `"Account not found"`.
Transfer object:
```json
{ "id": 4, "fromAccountId": 7, "fromAccountName": "Cash", "toAccountId": 8, "toAccountName": "Bank", "amount": 2000, "date": "2026-10-26", "reference": "DEP-1", "note": "Deposit", "createdBy": 12, "createdByName": "Monsur", "createdAt": "…", "updatedAt": "…" }
```
`PUT /api/finance/transfers/{id}` (`"Transfer updated"`), `DELETE /api/finance/transfers/{id}` (`"Transfer deleted"`).
A transfer appears in the ledger as two lines (`transfer:{id}:out` on the from-account, `transfer:{id}:in` on the to-account); it never changes total cash.

---

## 3. Overview

### `GET /api/finance/overview`
Query: period params (default `this_month`).
```json
{
  "data": {
    "period": { … },
    "currency": { "code": "BDT", "symbol": "৳" },
    "kpis": {
      "revenue":      { "value": 250000, "previous": 210000, "changePct": 19.05 },
      "moneyIn":      { "value": 230000, "previous": 200000, "changePct": 15 },
      "moneyOut":     { "value": 150000, "previous": 140000, "changePct": 7.14 },
      "netCashFlow":  { "value": 80000,  "previous": 60000,  "changePct": 33.33 },
      "cogs":         { "value": 140000, "previous": 120000, "changePct": 16.67 },
      "grossProfit":  { "value": 110000, "previous": 90000,  "changePct": 22.22 },
      "expenses":     { "value": 40000,  "previous": 38000,  "changePct": 5.26 },
      "netProfit":    { "value": 70000,  "previous": 52000,  "changePct": 34.62 },
      "cashOnHand":   { "value": 312000, "previous": null, "changePct": null },
      "receivables":  { "value": 45000,  "previous": null, "changePct": null },
      "payables":     { "value": 61000,  "previous": null, "changePct": null }
    },
    "receivables": { "customerDues": 30000, "codWithCouriers": 9000, "tailorBalances": 6000, "total": 45000 },
    "payables": { "supplierDues": 50000, "unpaidSalaries": 8000, "dorjiOwed": 3000, "total": 61000 },
    "charts": {
      "cashFlow": { "granularity": "day", "points": [ { "key": "2026-10-01", "label": "1 Oct", "moneyIn": 5000, "moneyOut": 1200, "net": 3800 } ] },
      "expensesByCategory": [ { "categoryId": 4, "name": "Salaries", "color": "#5B21B6", "amount": 24000, "pct": 60 } ],
      "accountBalances": [ { "accountId": 7, "name": "Cash", "type": "cash", "isActive": true, "balance": 50150.5 } ]
    },
    "pnl": { "otherIncome": 500, "otherExpenses": 0 },
    "recentTransactions": [ /* 10 ledger rows, newest first (same shape as /transactions rows) */ ],
    "alerts": [
      { "type": "overdue_receivables", "severity": "warning", "title": "Overdue customer dues", "message": "৳12,000.00 owed by 4 customers for more than 30 days.", "amount": 12000, "count": 4, "href": "/dashboard/finance/receivables" }
    ]
  }
}
```
- `receivables.customerDues` here is customer dues **excluding** COD with couriers (so the three parts add up to `total`).
- `revenue`, `cogs`, `grossProfit`, `expenses` use exactly the definitions of the existing P&L report (`/api/reports/pnl?from=…&to=…`): revenue = sum of non-cancelled sales `amount` by order date, COGS = sum of their line `total_cost`, expenses = Expenses module rows by expense date (includes salary and dorji payout expenses, once). `netProfit` = grossProfit − expenses + other income − other expenses (manual entries).
- `moneyIn`/`moneyOut` = ledger lines in the period **excluding transfers**.
- `cashOnHand` = sum of active account balances today (all accounts incl. inactive are in `accountBalances`). `receivables`/`payables` are point-in-time totals (today).
- `charts.cashFlow.granularity` = `day` when the period is ≤ 62 days, else `month`.
- Alert types: `overdue_receivables`, `overdue_payables` (supplier bills past their expected date), `unpaid_salaries` (payslips of past months not paid), `dorji_owed`, `cod_to_record` (delivered COD shipments without a recorded collection), `negative_balance` (an account below zero). `href` targets the finance page to open.

---

## 4. Inventory and ledger

### `GET /api/finance/inventory/valuation` — **CSV**
Query: `locationId`, `categoryId` (`none` = uncategorised), `search` (product name/SKU), `sort` (`cost_desc` default | `retail_desc` | `qty_desc` | `name_asc`), paging.
Current stock on hand (positive quantities), valued at cost (variant cost, else product cost) and selling price (same storage model as the Stock report; bundles excluded).
```json
{
  "data": {
    "totals": { "productCount": 120, "units": 3400, "costValue": 820000, "retailValue": 1150000, "potentialProfit": 330000, "marginPct": 28.7 },
    "byLocation": [ { "locationId": 3, "name": "Main warehouse", "units": 2000, "costValue": 500000, "retailValue": 700000, "potentialProfit": 200000 } ],
    "byCategory": [ { "categoryId": 5, "name": "Shirts", "units": 900, "costValue": 200000, "retailValue": 300000, "potentialProfit": 100000 } ],
    "rows": [ { "productId": 44, "name": "Oxford shirt", "sku": "OX-1", "categoryId": 5, "categoryName": "Shirts", "units": 40, "unitCost": 450, "unitPrice": 800, "costValue": 18000, "retailValue": 32000, "potentialProfit": 14000 } ]
  },
  "meta": { "total": 120, "perPage": 25, "currentPage": 1, "lastPage": 5 }
}
```
`byLocation`/`byCategory`/`totals` respect `locationId`/`categoryId`/`search`. `unitCost`/`unitPrice` are value ÷ units (weighted over variants). `locationId: null` / `categoryId: null` rows = "No location" / "Uncategorised".

### `GET /api/finance/inventory/ledger` — **CSV**
Query: period params (default `this_month`), `productId`, `variantId`, `locationId`, `type` (`receive`|`sell`|`return`|`transfer`|`adjustment`|`damage`, or comma list), `search` (product, SKU, reference, reason), `direction` (`in`|`out`), paging.
```json
{
  "data": {
    "rows": [
      {
        "id": 9912, "date": "2026-10-27T11:20:00+06:00",
        "productId": 44, "productName": "Oxford shirt", "sku": "OX-1",
        "variantId": 120, "variantName": "M / Blue",
        "locationId": 3, "locationName": "Main warehouse",
        "type": "sell", "typeLabel": "Sale",
        "quantity": -2, "qtyIn": 0, "qtyOut": 2,
        "quantityBefore": 12, "quantityAfter": 10,
        "unitCost": 450, "value": 900,
        "reference": { "type": "sell", "id": 231, "label": "INV-000231", "href": "/dashboard/sales?q=INV-000231" },
        "reason": "Online order", "notes": null, "createdBy": "Monsur",
        "runningQty": 38
      }
    ],
    "totals": { "count": 310, "qtyIn": 500, "qtyOut": 420, "valueIn": 210000, "valueOut": 180000 },
    "product": null,
    "period": { … }
  },
  "meta": { … }
}
```
- `unitCost` = cost stored on the movement, else the variant/product cost today. `value` = |quantity| × unitCost.
- `reference.label`: sale → invoice no, `purchase_order` → PO number, `customer_return`/`vendor_return` → return number, `tailor_order` → order number, `manual` → `ADJ-{movement id}`, other → `{TYPE}-{id}`.
- `runningQty` is filled only when `productId` is sent (stock of that product — of `variantId` / at `locationId` when those are sent — right after the movement, counted back from today's stock); otherwise `null`. `product` is then `{ "id", "name", "sku", "currentQty" }`.

### `GET /api/finance/inventory/cogs`
Query: period params (default `this_month`), `locationId`.
```json
{
  "data": {
    "period": { … },
    "totals": { "revenue": 250000, "cogs": 140000, "grossProfit": 110000, "marginPct": 44, "units": 610, "orders": 210 },
    "byCategory": [ { "categoryId": 5, "name": "Shirts", "units": 120, "revenue": 96000, "cogs": 54000, "grossProfit": 42000 } ],
    "topProducts": [ { "productId": 44, "name": "Oxford shirt", "units": 60, "revenue": 48000, "cogs": 27000, "grossProfit": 21000 } ]
  }
}
```
`totals.cogs` equals the P&L COGS. `byCategory`/`topProducts` revenue is line revenue (sum of line totals); `totals.revenue` is the sales total (P&L revenue). `locationId` filters by the sale's location.

---

## 5. Payouts

### `GET /api/finance/payouts` — **CSV**
Money paid out: supplier payments, salary payouts, dorji payouts. Query: period params (default `all_time`), `type` (`supplier`|`salary`|`dorji`, comma list ok), `accountId`, `method`, `search`, paging.
```json
{
  "data": {
    "rows": [
      { "id": "expense:88", "type": "salary", "typeLabel": "Salary", "date": "2026-10-05", "payee": "Karim", "payeeId": 14, "amount": 12000,
        "accountId": 7, "accountName": "Cash", "method": "Cash", "methodKey": "cash", "methodLabel": "Cash",
        "reference": "Salary Oct 2026", "note": "Salary Oct 2026", "link": { "type": "salary", "id": 14, "href": "/dashboard/staff/salary?staff=14" } }
    ],
    "totals": { "total": 62000, "count": 18, "byType": { "supplier": 40000, "salary": 18000, "dorji": 4000 } },
    "period": { … }
  },
  "meta": { … }
}
```

### `GET /api/finance/payouts/summary`
What we still owe, with the data needed for "Pay" buttons (point-in-time).
```json
{
  "data": {
    "total": 61000,
    "supplierDues": {
      "total": 50000, "partyCount": 3, "overdueAmount": 12000, "overdueParties": 1, "dueNext7Amount": 5000,
      "rows": [ { "vendorId": 5, "name": "Dhaka Fabrics", "phone": "017…", "due": 30000, "docs": 2, "oldestDate": "2026-09-01", "dueDate": "2026-10-20", "overdue": true } ]
    },
    "unpaidSalaries": {
      "total": 8000, "count": 1, "pastMonthsAmount": 8000, "pastMonthsCount": 1,
      "rows": [ { "salaryPaymentId": 77, "staffId": 14, "name": "Karim", "month": "2026-09", "monthLabel": "Sep 2026", "net": 8000, "method": "Cash" } ]
    },
    "dorjiOwed": {
      "total": 3000, "count": 1,
      "rows": [ { "dorjiId": 2, "name": "Selim", "phone": "018…", "owed": 3000 } ]
    }
  }
}
```
`rows` are capped at 50 per group (totals are complete). Unpaid salaries = payslips of the current or earlier months not paid (net > 0).
**Pay actions reuse existing endpoints** (each also posts to the ledger automatically):
- supplier: `POST /api/dues/vendors/{vendorId}/pay` `{ amount, method, date, reference?, notes?, documentIds? }` (permission `Dues.write`); documents: `GET /api/dues/vendors/{vendorId}/documents`.
- salary: `POST /api/salary-payments/{salaryPaymentId}/pay` `{ method?, date? }` (permission `Salary Management.edit`).
- dorji: `POST /api/tailor/payments/record` `{ kind: "dorji", dorji_id, amount, payment_method, payment_date, reference?, notes?, expected_balance? }` (permission `TailorPayments.write`).

---

## 6. Receivables

### `GET /api/finance/receivables`
Customer dues, one row per customer (walk-in sales grouped as `partyId: 0`). Pass-through of the existing Dues service. Query: `search`, `bucket` (`0`..`3` or `all`), `payment` (`all`|`partial`|`unpaid`), `sort` (`age`|`amount`|`name`), paging (default perPage 25).
```json
{
  "data": {
    "rows": [ { "partyId": 31, "name": "Rahim Uddin", "phone": "017…", "email": null, "walkIn": false, "docs": 2, "due": 4500, "oldestDate": "2026-08-01", "ageDays": 88, "oldestDocNo": "INV-000101", "lastPaymentDate": "2026-09-10", "paidSoFar": 1500, "hasPartial": true, "lastDocNos": ["INV-000101", "INV-000180"], "lastReminder": null, "group": "regular" } ],
    "aging": [ { "key": 0, "label": "0–30 days", "amount": 12000, "count": 5 }, { "key": 1, "label": "31–60 days", "amount": 0, "count": 0 }, { "key": 2, "label": "61–90 days", "amount": 4500, "count": 1 }, { "key": 3, "label": "90+ days", "amount": 0, "count": 0 } ],
    "stats": { "totalDue": 30000, "partyCount": 9, "overdue30Amount": 4500, "overdue30Parties": 1, "collectedThisMonth": 9000, "collectedThisMonthCount": 6, "openInvoices": 14, "avgInvoice": 2142.86, "walkInDue": 500 }
  },
  "meta": { … }
}
```
Collect: existing `POST /api/dues/customers/{partyId}/collect` `{ amount, method, date, reference?, notes?, documentIds? }` (`Dues.write`); documents: `GET /api/dues/customers/{partyId}/documents`.

### `GET /api/finance/receivables/summary`
```json
{
  "data": {
    "total": 45000,
    "customerDues": { "total": 30000, "excludingCod": 21000, "partyCount": 9, "overdue30Amount": 4500, "overdue30Parties": 1, "aging": [ … same 4 buckets … ] },
    "codWithCouriers": {
      "total": 9000, "count": 4, "deliveredAmount": 1500, "deliveredCount": 1,
      "byCourier": [ { "carrier": "Pathao", "amount": 6000, "count": 3 } ],
      "rows": [ { "shipmentId": 61, "sellId": 230, "invoiceNo": "INV-000230", "customerName": "Rahim", "carrier": "Pathao", "trackingNumber": "PAT-…", "status": "delivered", "codState": "delivered_record_payment", "amount": 1500, "shippedAt": "2026-10-20T…", "deliveredAt": "2026-10-22T…", "ageDays": 6 } ]
    },
    "tailorBalances": {
      "total": 6000, "count": 3,
      "rows": [ { "orderId": 12, "orderNumber": "TO-0012", "customerName": "Hasan", "customerPhone": "017…", "orderDate": "2026-10-01", "deliveryDate": "2026-10-15", "status": "ready", "total": 5000, "paid": 2000, "due": 3000 } ]
    }
  }
}
```
- `total = customerDues.total + tailorBalances.total` (COD with couriers is **part of** `customerDues.total`; `excludingCod = customerDues.total − codWithCouriers.total`, so `excludingCod + codWithCouriers + tailorBalances = total`).
- COD with couriers = COD shipments handed to the courier (`picked_up`, `in_transit`, `out_for_delivery`, `delivered`) whose cash is not recorded yet; amount = COD amount capped at the order's due (or the due when no COD amount). `codState`: `to_collect` (on the way) or `delivered_record_payment`.
- Collect actions: COD → existing `POST /api/shipments/{shipmentId}/cod-payment` `{ paymentMethod?, notes? }` (`Shipments.write`); tailor → existing `POST /api/tailor/payments/record` `{ kind: "customer", order_id, amount, payment_method, payment_date, … }` (`TailorPayments.write`).
- `rows` capped at 50.

---

## 7. Payments (money received)

### `GET /api/finance/payments` — **CSV**
Sale payments, COD collections, tailor payments, supplier refunds; customer refunds are included as negative rows. Query: period params (default `all_time`), `type` (`sale`|`cod`|`tailor_payment`|`supplier_refund`|`refund`, comma list ok), `accountId`, `method`, `search`, paging.
Rows = ledger row shape (see /transactions) where `signedAmount` is negative for refunds.
```json
{
  "data": {
    "rows": [ { "id": "sell_payment:812", "sourceType": "sale", "signedAmount": 1500, "…": "…" } ],
    "totals": { "received": 98000, "refunded": 2500, "net": 95500, "count": 140 },
    "period": { … }
  },
  "meta": { … }
}
```

### `GET /api/finance/payments/unpaid-sales`
For the "Record payment" picker. Query: `search` (invoice, customer name/phone), `limit` (1–50, default 20).
```json
{ "data": [ { "sellId": 230, "invoiceNo": "INV-000230", "customerName": "Rahim", "customerPhone": "017…", "orderDate": "2026-10-20", "total": 1500, "paid": 0, "due": 1500, "method": "COD", "status": "Delivered" } ] }
```
Then record with the existing `POST /api/payments/sells/{sellId}` `{ amount, payment_method, payment_date, reference?, notes? }` (permission `Dues.write`). Errors from it: `"Payment amount exceeds the outstanding due amount"`, `"Payment date cannot be in the future."`.

---

## 8. Reports

### `GET /api/finance/reports/pnl`
Query: period params (default `this_month`), `compare` (`previous` default | `none`).
```json
{
  "data": {
    "period": { … },
    "current": {
      "revenue": 250000, "cogs": 140000, "grossProfit": 110000, "grossMarginPct": 44,
      "expenses": 40000,
      "expensesByCategory": [ { "categoryId": 4, "name": "Salaries", "color": "#5B21B6", "amount": 24000 } ],
      "otherIncome": 500, "otherExpenses": 0,
      "netProfit": 70500, "netMarginPct": 28.2,
      "info": { "orders": 210, "tax": 3000, "shipping": 6000, "discounts": 2500, "refunds": 2500, "payoutsWithoutExpense": 0 }
    },
    "previous": { … same shape … } ,
    "changes": { "revenue": 19.05, "cogs": 16.67, "grossProfit": 22.22, "expenses": 5.26, "otherIncome": null, "otherExpenses": null, "netProfit": 35.58 },
    "months": [ { "key": "2026-10", "label": "Oct 2026", "revenue": 250000, "cogs": 140000, "grossProfit": 110000, "expenses": 40000, "otherIncome": 500, "otherExpenses": 0, "netProfit": 70500 } ]
  }
}
```
`previous`/`changes` are `null` when `compare=none` or the period has no previous period. `changes.*` is `null` when the previous value is 0. `info` lines are informational (already inside revenue; refunds = customer refunds paid in the period) and are **not** deducted again. `info.payoutsWithoutExpense` = old salary / dorji payouts that were paid before the Expenses mirror existed: they are in the cash ledger but (like the existing P&L report) not in `expenses`. Revenue/COGS/expenses equal `/api/reports/pnl?from=…&to=…` for the same dates; netProfit differs from it only by manual Other income/expenses.

### `GET /api/finance/reports/cashflow`
Query: period params (default `this_month`).
```json
{
  "data": {
    "period": { … },
    "openingBalance": 250000, "moneyIn": 230000, "moneyOut": 150000, "net": 80000, "closingBalance": 330000,
    "bySource": [ { "sourceType": "sale", "label": "Sale payment", "moneyIn": 200000, "moneyOut": 0, "net": 200000, "count": 180 } ],
    "byAccount": [ { "accountId": 7, "name": "Cash", "type": "cash", "isActive": true, "openingBalance": 40000, "moneyIn": 120000, "moneyOut": 90000, "transfersIn": 0, "transfersOut": 20000, "closingBalance": 50000 } ],
    "series": [ { "key": "2026-10-01", "label": "1 Oct", "moneyIn": 5000, "moneyOut": 1200, "net": 3800 } ],
    "granularity": "day"
  }
}
```
`moneyIn`/`moneyOut`/`bySource` exclude transfers (company-level they net to zero); `byAccount` shows them separately and `closingBalance = openingBalance + moneyIn − moneyOut + transfersIn − transfersOut`. Company `openingBalance`/`closingBalance` = sum over all accounts.

### `GET /api/finance/reports/statement`
Query: `accountId` (**required** → `"Choose an account."`), period params (default `this_month`).
```json
{
  "data": {
    "account": { … account object … },
    "period": { … },
    "openingBalance": 40000, "moneyIn": 120000, "moneyOut": 110000, "closingBalance": 50000,
    "rows": [ /* ledger rows oldest first, each with runningBalance */ ],
    "truncated": false
  }
}
```
At most 5 000 rows (`truncated: true` beyond; totals stay exact).

### `GET /api/finance/reports/tax`
Query: period params (default `this_month`).
```json
{
  "data": {
    "period": { … },
    "taxCollected": 3000, "taxableSales": 60000, "salesTotal": 250000, "orders": 210, "taxedOrders": 40, "effectiveRatePct": 5,
    "byRate": [ { "rate": 5, "orders": 40, "taxableAmount": 60000, "tax": 3000 } ],
    "byMonth": [ { "key": "2026-10", "label": "Oct 2026", "orders": 40, "taxableAmount": 60000, "tax": 3000 } ]
  }
}
```
Non-cancelled sales by order date; `taxableAmount` = sale amount − tax for sales with tax > 0.

### `GET /api/finance/reports/aging`
Point in time.
```json
{
  "data": {
    "asOf": "2026-10-28",
    "receivables": {
      "total": 45000,
      "buckets": [ { "key": 0, "label": "0–30 days", "amount": 12000, "count": 5 }, … ],
      "customers": [ { "partyId": 31, "name": "Rahim Uddin", "due": 4500, "ageDays": 88, "bucket": 2 } ],
      "customerDues": 30000, "codWithCouriers": 9000, "tailorBalances": 6000
    },
    "payables": {
      "total": 61000,
      "buckets": [ … ],
      "suppliers": [ { "partyId": 5, "name": "Dhaka Fabrics", "due": 30000, "ageDays": 57, "bucket": 1, "overdue": true } ],
      "supplierDues": 50000, "unpaidSalaries": 8000, "dorjiOwed": 3000
    }
  }
}
```
Buckets are by age of the oldest open document (customer dues / supplier dues only). `customers`/`suppliers` capped at 100, largest due first.

---

## v2 additions (Finance v2) — status: **implemented** (see "v2 implementation status" at the end of this section)

Everything below is **additive**: no v1 field was removed or renamed. Where a v1 figure changes meaning, it is called out under "Changed definitions".

### v2.0 Shared context, filters and time zone (FND-1, FND-2, FND-3)

**Every finance GET response** (`/api/finance/*`, JSON) now carries a `context` object inside `data` (for the list endpoints that return `data.rows`, `context` sits next to `rows`):
```json
"context": {
  "period": { "preset": "this_month", "label": "This month", "from": "2026-10-01", "to": "2026-10-31", "previousFrom": "2026-09-01", "previousTo": "2026-09-30" },
  "currency": { "code": "BDT", "symbol": "৳" },
  "channel": "all", "channelLabel": "All channels",
  "tz": "Asia/Dhaka",
  "asOf": "2026-10-28",
  "currentState": false
}
```
- `period` is `null` on point-in-time endpoints (summaries, payable lists, health "now" checks); those set `currentState: true` ("As things stand now" — the UI labels them so and ignores the period picker for them).
- `currency`: we are **single-currency per company** (company setting `currency`, default BDT). Amounts are never added across currencies because there is only one. Every money figure is in `context.currency`. No currency picker.
- `tz` = the company time zone: `company_settings.timezone` (IANA), default **`Asia/Dhaka`** when empty/invalid. `asOf` = today's date in that zone.

**Time zone rules (FND-3)**
- Presets (`today`, `this_month`, …) and month boundaries are computed in the company time zone (an order at 00:30 Dhaka on the 1st counts in the new month).
- `from`/`to` are local calendar dates in that zone; datetime columns (order time, movement time, refund/credit time) are compared against the local-day bounds converted to UTC.
- Monthly/daily grouping (`months`, `series`, `byMonth`) uses local time.
- Timestamps in responses are ISO-8601 **with the company offset** (e.g. `2026-10-27T14:03:11+06:00`). Plain dates are `YYYY-MM-DD` local dates. Clients should format with an explicit `timeZone: context.tz` (no UTC labels).

**Channel filter** — query `channel`: `all` (default) | `pos` | `online` | `manual`. Error: `"Unknown channel. Use all, pos, online or manual."`
| channel | label | sells.source |
|---|---|---|
| `pos` | POS | `pos` |
| `online` | Online store | `storefront` |
| `manual` | Manual | `manual`, empty or anything else |
The channel narrows **sales-derived** figures only: order volume, paid volume, revenue, product sales / COGS / gross profit, tax, refunds and fees on sale payments, customer receivables. Company-wide figures (expenses, supplier/salary/dorji payouts, account balances, payables, manual entries, transfers) are **not** split by channel; on `/transactions` and `/payments` a channel other than `all` keeps only rows linked to a sale of that channel. Responses include `channelScope: "sales_only"` where this applies.

Period + channel are accepted by: `/overview`, `/metrics`, `/transactions`, `/payments`, `/payments/summary`, `/reports/pnl`, `/reports/tax`, `/inventory/cogs`, `/products/without-cost`, `/receivables/customers` (channel only), `/health`. `/payouts` and `/reports/cashflow` take the period only (company-wide money; `context.channel` is always `all`).

### v2.1 Shared metrics (FND-1) — `GET /api/finance/metrics`
Query: period (default `this_month`), `channel`. One service computes these for Overview, Payments, Reports, Receivables and the health checks, so the same filters always give the same numbers.
```json
{
  "data": {
    "context": { … },
    "orders":   { "count": 137, "volume": 242808.95 },
    "paid":     { "recorded": 210000, "estimated": 12000, "total": 222000, "unpaid": 20808.95, "estimatedCount": 9 },
    "productSales": { "total": 114814.6, "costed": 400, "uncosted": 114414.6, "excluded": 0, "costedPct": 0.35, "uncostedLines": 210, "productsWithoutCost": 51 },
    "refunds":  { "refunded": 167, "refundedCount": 2, "awaiting": 1000, "awaitingCount": 1, "label": "Refunds in this month" },
    "fees":     { "total": 67.68, "count": 120, "byMethod": [ { "methodKey": "bkash", "label": "bKash", "gross": 3600, "fee": 66.6, "count": 12 } ] },
    "moneyIn": 230000, "moneyOut": 150000,
    "tax": { "collected": 3000 },
    "storeCredit": { "total": 528, "customers": 3 }
  }
}
```
Definitions (written once, in `App\Services\Finance\FinanceMetricsService`):
- **Order volume** = Σ `amount` of sales **placed** in the period (order time, company tz), not cancelled, not deleted.
- **Paid volume** = money actually received on **those same sales** (Σ sale payments in, any date), capped per sale at the sale amount → `paid.recorded`. Sales marked paid with no payment record (old data / gateway) are **not** mixed in: they are `paid.estimated` (amount = their paid amount, capped). `paid.total = recorded + estimated` and **always ≤ orders.volume**; `unpaid = volume − total`.
- **Product sales** = Σ line totals of those sales. `costed` = lines with a unit cost > 0; `uncosted` = lines of a real product without cost; `excluded` = custom lines with no product (can't be costed). **`costed + uncosted + excluded = total`** always. `costedPct` is against `total`. `productsWithoutCost` = products (point in time) with stock or sales and no cost.
- **Refunds** by **refund date**: `refunded` = customer refunds paid in the period (= Σ ledger rows `sourceType=refund` in the period). `awaiting` = customer returns with a refund amount not yet paid (status not completed/rejected), requested in the period. Shown as "Refunded X · Awaiting settlement Y", label "Refunds in <period>".
- **Fees** = Σ estimated payment-method fees on customer money-in rows paid in the period (see v2.6).
- **moneyIn / moneyOut** = ledger lines in the period, excluding transfers (same as v1 overview).
- **Tax collected** = Σ sales `tax_amount` (same sales as order volume).
- **Store credit** = Σ `customers.store_credit` > 0 (point in time) — money owed to customers (liability). Replaces the Storify loyalty card (we have no loyalty points).

### v2.2 Overview additions — `GET /api/finance/overview`
New query: `channel`. New/changed fields (all v1 fields kept):
```json
"context": { … },
"metrics": { … same object as /metrics data minus context … },
"kpis": { …v1…, "orderVolume": { "value": 242808.95, "previous": …, "changePct": … }, "paymentFees": { … }, "refunds": { … } },
"storeCredit": { "total": 528, "customers": 3, "href": "/dashboard/customers" },
"profitCoverage": { "productSales": 114814.6, "costed": 400, "uncosted": 114414.6, "excluded": 0, "costedPct": 0.35, "productsWithoutCost": 51, "setCostsHref": "/dashboard/finance/inventory?tab=costs" },
"payables": { …v1…, "supplierCredits": 66.61 },
"pnl": { "otherIncome": 500, "otherExpenses": 0, "paymentFees": 67.68, "voidedExpenses": 0 },
"closeStatus": { … same as GET /finance/close "status" block … }
```
New alert types: `opening_stock` (products with stock that was never moved in; `href` `/dashboard/finance/inventory?tab=opening`), `stock_gap` (stock value ≠ movement value), `supplier_owes_you` (supplier credits to collect), `month_to_close` (an ended month is still open, `info`).

### v2.3 Products without cost (OV-1) — `GET /api/finance/products/without-cost`
Query: period (for the sales columns, default `all_time`), `channel`, `search`, paging. Point-in-time list of products (not bundles) with no cost (product cost 0/empty and no variant cost) that have stock or sales.
```json
{ "data": { "context": {…}, "rows": [ { "productId": 44, "name": "Oxford shirt", "sku": "OX-1", "stock": 12, "unitsSold": 30, "uncostedSales": 24000, "price": 800, "editHref": "/dashboard/products/44" } ],
  "totals": { "products": 51, "uncostedSales": 114414.6 } }, "meta": { … } }
```

### v2.4 Inventory (INV-1, INV-2, INV-3)

**Opening stock preview** — `GET /api/finance/inventory/opening-stock`
Query: `cutoverDate` (optional `YYYY-MM-DD`), `search`, paging (default perPage 100).
Products whose stock on hand is not explained by stock movements: `quantity = stock on hand − Σ movements + Σ sale lines not yet logged as movements` (so the result is the same whether the INV-2 backfill ran before or after). Only `quantity > 0`. Products that already have an opening-stock movement are not listed (`alreadyMovedIn` count).
```json
{ "data": {
  "context": {…},
  "cutoverDate": "2026-10-01", "cutoverReason": "First day after the last closed month",
  "rows": [ { "productId": 44, "name": "Oxford shirt", "sku": "OX-1", "quantity": 40, "unitCost": 450, "value": 18000, "needsCost": false, "locationId": 3 } ],
  "totals": { "products": 51, "ready": 40, "needsCost": 11, "quantity": 900, "value": 210000 },
  "alreadyMovedIn": 0
}, "meta": { … } }
```
`cutoverDate` default: the day after the last closed month; when nothing is closed, the date of the company's first stock movement or sale (so opening stock sits before all history); else today. It may not be in a closed month or in the future.

**Post opening stock** — `POST /api/finance/inventory/opening-stock` (Finance.write)
```json
{ "cutoverDate": "2026-10-01", "items": [ { "productId": 44, "unitCost": 450 } ], "productIds": [44, 45], "setProductCost": true }
```
- `items` overrides unit costs (≥ 0.01); `productIds` limits which products are posted (default: all listed in the preview). `setProductCost` (default true): when the product has no cost, the given unit cost is saved as its cost price so stock value uses it.
- Creates one movement per product: `type: "receive"`, `reference.type: "opening_stock"`, `typeLabel: "Opening stock"`, quantity = preview quantity, `unit_cost`, dated `cutoverDate` 00:00 local. **Stock on hand is not changed** (the stock already exists; this records where it came from).
- **Idempotent**: products that already have an opening-stock movement are skipped; products without a cost (and no `items` cost) are skipped with `needs_cost` and stay in the preview with "Needs cost".
- Response: 201 + message `"Opening stock moved in"` when something was posted, else 200 + `"Nothing to move in"`:
```json
{ "posted": 40, "quantity": 900, "value": 210000, "cutoverDate": "2026-10-01", "skipped": [ { "productId": 51, "name": "…", "reason": "needs_cost", "label": "Needs cost" } ], "remaining": 11 }
```
`remaining` = products still listed in the preview (normally the ones that need a cost). Unit-cost override error: `"Unit cost must be at least 0.01."`.
`reason`: `needs_cost` | `already_moved_in` | `nothing_to_move`. Errors: `"Cutover date must be a valid date (YYYY-MM-DD)."`, `"The cutover date is in a closed month (September 2026). Pick a date in an open month."`, `"Cutover date cannot be in the future."`.

**Missing sale movements (INV-2)**
- `GET /api/finance/inventory/sale-movements/missing` → `{ context, lines: 11, movements: 20, sales: 10, quantity: 22, value: 1980, sample: [ { sellId, invoiceNo, orderDate, productId, productName, variantId, quantity, unitCost, value } ] }` (dry run; `lines` = sale lines, `movements` = movements that would be created (bundle lines expand to components); `sample` ≤ 50).
- `POST /api/finance/inventory/sale-movements/backfill` `{ "dryRun": false }` (Finance.write) → `{ "dryRun": false, "created": 20, "lines": 11, "sales": 10, "quantity": 22, "value": 1980, "skipped": 0 }`, message `"Missing sale movements created"` (`"Dry run: nothing was written"` with `dryRun: true`). Idempotent: a second run creates 0.
- Artisan: `php artisan finance:backfill-sale-movements {companyId} {--dry-run}` (same service).
- What it creates: for every non-cancelled, stock-deducted sale line with a product and no `sell` movement (same sale + product [+ variant], or same `orderItemId`), a `sell` movement of −quantity at the sale's location, dated the order time, `unit_cost` = the line's unit cost, reason `"Sale (backfilled)"`, `orderItemId` set. Bundle lines create one movement per component (component cost). Stock on hand is **not** changed (the sale already deducted it).

**Inventory ledger rows** (`GET /api/finance/inventory/ledger`) gain:
`"orderItemId": 812|null, "backfilled": false, "isOpening": false, "ledgerHref": "/dashboard/finance/transactions?search=INV-000231"|null, "orderHref": "/dashboard/orders?q=INV-000231"|null`. `type` filter also accepts `opening` (= receive movements of reference type `opening_stock`). `typeLabel` is `"Opening stock"` for those.

**Stock vs movements reconciliation (INV-3)** — `GET /api/finance/inventory/reconciliation`
```json
{ "data": {
  "context": {…},
  "stockValue": 820000, "movementValue": 819740, "difference": 260, "status": "gap",
  "text": "Stock value is ৳260.00 higher than the stock movements explain.",
  "lines": [
    { "kind": "no_opening_stock", "label": "Stock never moved in", "productId": 44, "name": "Oxford shirt", "quantity": 40, "value": 18000,
      "explanation": "40 on hand with no movement that brought them in.", "action": { "type": "move_in_opening_stock", "label": "Move in opening stock", "href": "/dashboard/finance/inventory?tab=opening" } }
  ],
  "byKind": [ { "kind": "no_opening_stock", "label": "Stock never moved in", "count": 51, "value": 210000 } ],
  "missingSaleMovements": { "lines": 14, "value": 3205 },
  "explained": 260, "unexplained": 0
}}
```
`difference = stockValue − movementValue` (stock value = v1 valuation cost value; movement value = Σ movement quantity × movement unit cost, falling back to today's cost). Every non-zero difference is split into lines that add up to it exactly (`explained = difference`, `unexplained` is 0 by construction). `kind`:
| kind | meaning | action.type |
|---|---|---|
| `no_opening_stock` | stock on hand that no movement brought in | `move_in_opening_stock` |
| `movements_exceed_stock` | movements add up to more units than on hand (missing sale/damage movements, or stock edited directly) | `backfill_sale_movements` when sale lines are missing, else `adjust` (`/dashboard/inventory/adjustment?productId=…`) |
| `cost_changed` | units match, but movements were valued at an older cost | `set_cost` (`/dashboard/products/{id}`) |
Lines are capped at 200 (largest value first); `byKind` totals are complete.

### v2.5 Expenses: void, closed months, activity (EXP-1)
- `POST /api/finance/expenses/{id}/void` (Finance.write) `{ "reason": "Duplicate bill", "date": "2026-10-28" }` → the expense object (same shape as `/api/expenses/{id}`), message `"Expense voided"`.
  - `reason` required ≤500 → `"Give a reason for voiding."`; `date` optional (default today, company tz), not before the expense date, not future, **not in a closed month**.
  - The expense row is kept (shown struck through with the reason). A reversing ledger line `expense_void:{id}` (sourceType `expense_void`, label "Expense voided", direction `in`, same account/method/category) is posted on the void date. P&L: the expense still counts in its own month; the void subtracts it in the month of the void date. A closed month's figures therefore never change.
  - Errors: `"This expense is already voided."`, `"Salary expenses are generated from salary payments and cannot be voided here"`, `"Dorji payout expenses are generated from Tailor payments and cannot be voided here"`, `"The void date is in a closed month (September 2026). Pick a date in an open month."`, `"The void date cannot be before the expense date."`.
- `GET /api/finance/expenses/{id}/activity` → `{ "expenseId": 9, "rows": [ { "id": 3, "action": "voided", "label": "Voided", "at": "2026-10-28T10:00:00+06:00", "byId": 12, "byName": "Monsur", "changes": null, "note": "Duplicate bill" } ] }`. `action`: `created` | `edited` | `voided` | `deleted`. `changes` (edits): `{ "amount": { "from": 500, "to": 650 }, "expenseDate": { … } }`. Expenses created before v2 get a synthetic `created` row from their creation time.
- Existing `/api/expenses` objects gain: `voided` (bool), `voidedAt` (`YYYY-MM-DD`|null), `voidReason`, `voidedByName`, `periodClosed` (bool, the expense date is in a closed month), `editable` (bool: not voided, not generated, month open).
- `PUT /api/expenses/{id}` / `DELETE /api/expenses/{id}`: 422 `"September 2026 is closed. Void this expense and add a new one in an open month instead."` when the expense date (or the new date) is in a closed month; `"A voided expense cannot be edited."` / `"A voided expense cannot be deleted."`. Edits in open months are allowed and logged (`edited` with changes). The admin UI should offer **Void** instead of Delete.
- Ledger/P&L: `expensesByCategory` amounts are net of voids in the period (can be negative in a month with only a void). `pnl.voidedExpenses` (overview) / `current.voidedExpenses` (reports) = Σ voids in the period.

### v2.6 Month-end close (RPT-1, RPT-3)
- `GET /api/finance/close` →
```json
{ "data": {
  "context": {…},
  "status": {
    "closedThrough": "2026-08-31", "closedThroughLabel": "31 August 2026",
    "text": "Everything up to 31 August 2026 is closed.",
    "suggestion": { "month": "2026-09", "label": "September 2026", "text": "Close September 2026" },
    "olderOpenMonth": null,
    "lastClosedMonth": "2026-08"
  },
  "months": [ { "month": "2026-09", "label": "September 2026", "from": "2026-09-01", "to": "2026-09-30", "status": "open", "canClose": true,
      "closedAt": null, "closedByName": null, "note": null, "netAtClose": null, "liveNet": 182248.7, "drift": null,
      "reopenedAt": null, "reopenedByName": null, "reopenReason": null } ]
}}
```
  - `text`: `"Everything up to <d MMMM yyyy> is closed."` or `"No months closed yet."`. `closedThrough` = last day of the newest month such that every month from the first month with activity up to it is closed (`null` when none).
  - `suggestion` = the most recent **ended** month that is still open (`null` when every ended month is closed). `olderOpenMonth` = the oldest open ended month **older than the suggestion** (`{ month, label, text: "Close an older month instead" }`), else `null` — show the "Close an older month instead" link only when it is not null.
  - `months`: every month from the first month with activity to the current month, newest first. `liveNet` = net profit computed now; `netAtClose` = snapshot at close; `drift = liveNet − netAtClose` (non-zero only if source data such as a sale was changed outside finance after the close).
- `GET /api/finance/close/{month}` (`YYYY-MM`) → one month object plus `snapshot` (the P&L figures stored at close: revenue, cogs, grossProfit, expenses, paymentFees, otherIncome, otherExpenses, netProfit, moneyIn, moneyOut, tax, orders) and `live` (same keys now).
- `POST /api/finance/close` `{ "month": "2026-09", "note": "Checked by accountant" }` (Finance.write) → 201 month object, message `"September 2026 closed"`. Errors: `"Choose a month (YYYY-MM)."`, `"You can only close a month after it ends."`, `"September 2026 is already closed."`.
- `POST /api/finance/close/{month}/reopen` `{ "reason": "Late supplier bill" }` (Finance.write) → month object, message `"September 2026 reopened"`. Errors: `"Give a reason for reopening."`, `"September 2026 is not closed."`.
- **Locks**: while a month is closed, creating, editing or deleting anything **dated** in it is refused with **422** `"September 2026 is closed. Pick a date in an open month, or reopen September 2026 in Finance → Reports."`. Applies to: expenses (`/api/expenses`, recurring generation skips), manual entries and transfers (`/api/finance/entries|transfers`), payments (`/api/payments/sells/*`, dues pay/collect, COD collection, tailor payments, salary pay — any `due_payments`, `vendor_payments`, `tailor_payments` row dated in it) and supplier receipts. Voids are allowed (they post on an open date).
- `GET /api/finance/reports/pnl` gains `closeStatus` (the `status` block above) and, per `months[]` item, `closed` (bool) and `netAtClose` (number|null).

### v2.7 Payment-method fees (TXN-1) — `GET|PUT /api/finance/fees`
Company setting (estimated fees, computed at read time; nothing is stored on payments).
- `GET` → `{ "context": {…}, "fees": [ { "methodKey": "bkash", "label": "bKash", "percent": 1.85, "fixed": 0 } , … one row per method option … ], "appliesTo": ["sale", "cod", "tailor_payment"] }` (unset methods have `percent: 0, fixed: 0`).
- `PUT` (Finance.write) `{ "fees": [ { "methodKey": "bkash", "percent": 1.85, "fixed": 0 }, { "methodKey": "cod", "percent": 1, "fixed": 0 } ] }` → same as GET, message `"Payment fees saved"`. Keys not sent are left as they are; send `percent: 0, fixed: 0` to clear. Errors: `"Fee percent must be between 0 and 100."`, `"Fixed fee cannot be negative."`, `"Unknown payment method: xyz."` (any key from `methodOptions` or a stored custom key is accepted).
- Fee per money-in row of type `sale`, `cod`, `tailor_payment` = `round(amount × percent / 100 + fixed, 2)` using the row's method key. Refunds, supplier refunds, manual entries and transfers have fee 0.
- Account balances stay **gross** (fees are an estimate; post an adjustment entry to match a statement).

### v2.8 Ledger rows / Transactions (TXN-1, TXN-2, TXN-3)
Every ledger row (in `/transactions`, `/payments`, `/reports/statement`, `recentTransactions`) gains:
```json
"gross": -1500, "fee": 0, "net": -1500, "currency": "BDT", "channel": "pos"|"online"|"manual"|null, "sellId": 231|null
```
- `gross` = `signedAmount` (money out — refunds, payouts, expenses — is **negative** in both `gross` and `net`); `net = gross − fee` (fee only on money-in customer rows).
- `totals` gain `"gross": 52500, "fees": 120.5, "netAfterFees": 52379.5` (gross = moneyIn − moneyOut).
- New query params: `channel`; period params now also work from the toolbar (unchanged names).
- New source types: `expense_void` (Expense voided, in) — see v2.5; supplier receipts use the existing `supplier_refund` type (id `entry:{id}`, see v2.10).
- **Credit-note "payments" are no longer cash**: purchase-order payments recorded with method `Credit note` (applied supplier credit notes) are excluded from the money ledger (they never moved money). This removes them from money out, balances and payouts. They are counted in supplier credits instead (v2.9).
- CSV (`format=csv`) respects every filter and has columns: `Date, Type, Direction, Gross, Fee, Net, Currency, Account, Method, Channel, Party, Reference, Category, Note, Running balance, Id`. Refund rows are negative in Gross and Net.

### v2.9 Payables per party (PO-1, PO-2, PO-4) — `GET /api/finance/payouts/payable`
Point in time (`currentState: true`). Query: `type` (`supplier`|`dorji`|`staff`, comma list ok), `search`.
```json
{ "data": {
  "context": {…},
  "rows": [
    { "type": "supplier", "id": 5, "name": "Dhaka Fabrics", "displayName": "Dhaka Fabrics", "deleted": false,
      "owed": 30000, "notYetDue": 5000, "credits": 1000, "creditsHeld": 0, "payableNow": 24000,
      "breakdown": [
        { "key": "owed", "label": "Owed to supplier", "amount": 30000 },
        { "key": "not_yet_due", "label": "Not yet due", "amount": -5000 },
        { "key": "credits", "label": "Credits they owe you", "amount": -1000 },
        { "key": "credits_held", "label": "Credits kept for bills not yet due", "amount": 0 },
        { "key": "payable_now", "label": "Payable now", "amount": 24000 }
      ],
      "nextDue": { "date": "2026-11-05", "amount": 5000 },
      "status": "payable", "payHref": "/dashboard/finance/payouts?type=supplier&id=5&create=1" }
  ],
  "groups": { "payable": [ …rows with payableNow > 0, payableNow desc… ], "nothingPayable": [ …rows with payableNow ≤ 0… ] },
  "totals": { "owed": 61000, "notYetDue": 9000, "credits": 1000, "payableNow": 51000, "theyOweYou": 66.61, "parties": 6 }
}}
```
- Supplier: `owed` = purchase-order dues (draft/sent/partial/received) + opening balance (= v1 `supplierDues` row `due`, so Σ supplier `owed` = overview `payables.supplierDues`). `notYetDue` = dues of POs not received yet (draft/sent) or whose expected date is after today. `credits` = supplier credit balance (credit-note returns credited but not applied to a bill, minus supplier receipts recorded). Credits first cover what is due now; credits beyond that are kept for bills not yet due (`creditsHeld` = min(max(0, credits − (owed − notYetDue)), notYetDue)); only what is left after that makes the supplier owe you. `payableNow = owed − notYetDue − credits + creditsHeld` — so it is ≥ 0 while you still owe overall, and equals `owed − credits` (negative, `status: "they_owe_you"`) when credits exceed everything owed.
- Dorji: `owed` = completed-work balance, `notYetDue` 0, `credits` 0. Staff: `owed` = unpaid payslips up to this month; `notYetDue` = this month's payslips (month not ended); `payableNow` = past months. `id` = dorjiId / staffId.
- `status`: `payable` | `nothing_payable` | `they_owe_you`. The breakdown always adds up: Σ `breakdown[0..3].amount` = `payable_now` (i.e. `owed − notYetDue − credits + creditsHeld = payableNow`). Rows are sorted by `payableNow` desc; `groups.nothingPayable` holds `payableNow ≤ 0`. `totals.theyOweYou` = Σ max(0, credits − owed).
- `GET /api/finance/payouts/payable/{type}/{id}` (`type` = `supplier` | `dorji` | `staff`) → one row plus `documents`, 404 `"Supplier not found"` / `"Dorji not found"` / `"Staff not found"`:
  - supplier — open purchase orders (+ opening balance):
    `{ "documentType": "purchase_order", "documentId": 7, "no": "PO-0007", "status": "received", "date": "2026-10-01", "dueDate": "2026-10-20", "due": 1200, "notYetDue": false }` and `{ "documentType": "opening_balance", "documentId": null, "no": "Opening balance", "status": null, "date": null, "dueDate": null, "due": 500, "notYetDue": false }`. Pay with `POST /api/dues/vendors/{id}/pay` (`documentIds` = the purchase-order `documentId`s).
  - staff — one item per unpaid payslip (current month and earlier):
    `{ "documentType": "payslip", "salaryPaymentId": 77, "documentId": 77, "no": "Salary Sep 2026", "month": "2026-09", "monthLabel": "Sep 2026", "method": "Cash", "status": "unpaid", "date": null, "dueDate": "2026-09-30", "due": 8000, "notYetDue": false }`.
    **`salaryPaymentId` is the id for `POST /api/salary-payments/{salaryPaymentId}/pay`** (`documentId` carries the same value only for backward compatibility — use `salaryPaymentId`). `notYetDue` is true for the current month's payslip.
  - dorji — `documents: []`; pay with `POST /api/tailor/payments/record` `{ kind: "dorji", dorji_id: id, amount, … }`.
- Deep link for the admin (PO-4): `/dashboard/finance/payouts?type=supplier&id=5&create=1` opens Pay pre-filled (frontend). Pay actions still use the v1 endpoints (§5).

### v2.10 Receivables (RCV-1, RCV-2, RCV-4)
**Suppliers** — `GET /api/finance/receivables/suppliers` (point in time). Query: `search`, `direction` (`all`|`we_owe`|`they_owe`).
```json
{ "data": {
  "context": {…},
  "rows": [ { "vendorId": 9, "name": "Nexora", "displayName": "Deleted supplier · …0009", "deleted": true, "fullId": "9",
      "owed": 0, "notYetDue": 0, "credits": 66.61, "payableNow": -66.61, "net": -66.61,
      "direction": "they_owe", "directionLabel": "They owe you",
      "action": "collect", "payDisabledReason": null,
      "payHref": null, "collectHref": "/dashboard/finance/receivables?tab=suppliers&collect=9" } ],
  "totals": { "owed": 50000, "credits": 1066.61, "net": 48933.39, "weOwe": 49000, "theyOweYou": 66.61, "payableNow": 41000 }
}}
```
- Never raw ids: a soft-deleted supplier shows `"<name> (deleted)"`; a supplier row that no longer exists shows `"Deleted supplier · …<last 4 digits of id>"` (`fullId` for the tooltip). Suppliers with a balance (dues, opening balance or unapplied credit) can no longer be deleted: `DELETE /api/vendors/{id}` → 422 `"Cannot delete supplier 'X': it still has a balance of ৳… Settle it or deactivate the supplier instead."`.
- Rows are the same supplier rows as v2.9 (incl. `creditsHeld`, `breakdown`) plus the fields above. `net = owed − credits`. Negative → `direction: "they_owe"`, `action: "collect"`. Positive → `action: "pay"`; when `payableNow ≤ 0` the Pay button is disabled with `payDisabledReason` (e.g. `"৳5,000.00 becomes payable on 5 Nov 2026"` or `"Nothing is payable yet: the purchase orders are not received."`). `payHref` = `/dashboard/finance/payouts?type=supplier&id={id}&create=1`.
- **Record payment received from a supplier** — `POST /api/finance/receivables/suppliers/{vendorId}/receive` (Finance.write) `{ "amount": 66.61, "date": "2026-10-28", "accountId": 7, "method": "cash", "reference": "MR-1", "note": "Credit settled" }` → 201, message `"Payment received from supplier"`, `data` = manual entry object with `kind: "supplier_receipt"` and `vendorId`. Posts money **in** to the account (`accountId`, else the account mapped to `method`, else default) as ledger sourceType `supplier_refund` (id `entry:{id}`) and lowers the supplier's credit balance. Not in P&L. Errors: `"This supplier doesn't owe you anything."`, `"Amount is more than the supplier owes you (৳66.61)."`, `"Amount must be greater than zero."`, month-closed 422. Such entries cannot be changed through `PUT /entries/{id}` (`"Supplier receipts cannot be edited. Delete it and record it again."`); `DELETE` works.
- "Offset against next payout": no separate endpoint — supplier credits are already netted in `payableNow` (v2.9).

**Customers tab** — `GET /api/finance/receivables/customers` (point in time). Query: `search`, `bucket` (`0`|`1`|`2`|`all`), `channel`, `cod` (`true`|`false`), `sort` (`age` default | `amount` | `name`), paging.
One row per unpaid or partly paid sale (incl. COD not collected):
```json
{ "data": {
  "context": {…},
  "rows": [ { "sellId": 230, "invoiceNo": "INV-000230", "customerId": 31, "customerName": "Rahim", "customerPhone": "017…", "orderDate": "2026-10-20",
      "ageDays": 8, "bucket": 0, "total": 1500, "paid": 0, "due": 1500, "method": "COD", "methodKey": "cod", "isCod": true,
      "codState": "to_collect"|"delivered_record_payment"|null, "channel": "online", "status": "Delivered",
      "orderHref": "/dashboard/orders?q=INV-000230" } ],
  "aging": [ { "key": 0, "label": "0–30 days", "amount": 12000, "count": 5 }, { "key": 1, "label": "31–60 days", … }, { "key": 2, "label": "60+ days", … } ],
  "totals": { "due": 30000, "count": 14, "customers": 9, "codDue": 9000 }
}, "meta": { … } }
```
`totals.due` (with `channel=all`, no search/bucket) **equals** overview "owed by customers" = `receivables.customerDues + receivables.codWithCouriers`. Record payment: existing `POST /api/payments/sells/{sellId}` (v1 §7).

`GET /api/finance/receivables/summary` gains `"suppliers": { "owed": 50000, "credits": 1066.61, "theyOweYou": 66.61, "net": 48933.39 }` and `context`.

### v2.11 Payments page (PAY-1…PAY-6) — `GET /api/finance/payments/summary`
Query: period (default `this_month`), `channel`.
```json
{ "data": {
  "context": {…},
  "orderVolume": { "amount": 242808.95, "count": 137 },
  "paidVolume": { "recorded": 210000, "estimated": 12000, "total": 222000, "estimatedCount": 9,
                  "estimatedNote": "Sales marked paid without a payment record (older data or online gateway). Shown separately, not counted as recorded payments." },
  "received": { "amount": 230000, "count": 180, "fees": 67.68, "net": 229932.32 },
  "refunds": { "refunded": 167, "refundedCount": 2, "awaiting": 1000, "awaitingCount": 1, "label": "Refunds in this month" },
  "needsALook": {
    "asOf": "2026-10-28", "label": "As things stand now",
    "onlineUnconfirmed": { "count": 3, "amount": 585, "label": "3 online payments not confirmed", "href": "/dashboard/orders?source=online&pay=unpaid" },
    "codAwaitingCollection": { "count": 4, "amount": 9000, "label": "4 COD orders awaiting collection", "href": "/dashboard/finance/receivables?tab=customers&cod=true" },
    "refundsAwaiting": { "count": 1, "amount": 1000, "label": "1 refund awaiting settlement", "href": "/dashboard/returns/customer" }
  },
  "toSuppliers": { "owed": 50000, "payableNow": 41000, "notYetDue": 9000, "credits": 1066.61, "paidInPeriod": 12000,
                   "payoutsHref": "/dashboard/finance/payouts", "receivablesHref": "/dashboard/finance/receivables?tab=suppliers" }
}}
```
- `paidVolume.total ≤ orderVolume.amount` always (FND-1). `received` = money in by payment date (sale + COD + tailor payments), the cash view.
- `refunds.refunded` equals overview `metrics.refunds.refunded` and Σ `/transactions?sourceType=refund` for the same filters.
- `needsALook` ignores the period (current state). Online unconfirmed = non-cancelled online-store sales, not COD, payment not complete. COD awaiting = non-cancelled sales with method COD and a due.
- `toSuppliers.owed/payableNow` = v2.9 supplier totals; `paidInPeriod` = supplier payments in the period (v1 payouts `byType.supplier`).
- `/payments` list: `channel` filter; `totals` gain `fees`, `netAfterFees`; rows have `gross/fee/net/currency/channel`.

### v2.12 Reports
- **Tax by rate (RPT-2)** — `GET /api/finance/reports/tax` gains `channel`, `context`, and:
  - `byRate[]` items gain `name` (e.g. `"VAT 15%"`; the tax name is company setting `tax_id_type` when it is VAT/GST/Sales tax, else "Tax") and `label`; only sales with a recorded `tax_rate`.
  - `notBrokenDown`: `{ "label": "Not broken down (orders before line tax was recorded)", "orders": 3, "taxableAmount": 900, "tax": 135 }` = taxed sales without a recorded rate (null when 0).
  - `reconciles: true` — Σ `byRate[].tax` + `notBrokenDown.tax` = `taxCollected`. `currency` on the object (`context.currency`).
- **P&L** — `current`/`previous` gain `paymentFees`, `voidedExpenses`, `productSales` (coverage object as in overview `profitCoverage`); `netProfit = grossProfit − expenses − paymentFees + otherIncome − otherExpenses` (see "Changed definitions"). Plus `closeStatus` and `months[].closed/netAtClose` (v2.6).
- **Health checks** — `GET /api/finance/health` (period default `this_month`, `channel`) and artisan `php artisan finance:reconcile {companyId} {--period=this_month} {--from=} {--to=} {--channel=all}` (exit code 1 when a check fails).
```json
{ "data": { "context": {…}, "passed": 9, "failed": 1, "ok": false, "checks": [
  { "id": "R3", "title": "Paid volume is not more than order volume", "status": "pass", "expected": 242808.95, "actual": 222000, "difference": 0,
    "numbers": { "orderVolume": 242808.95, "paidRecorded": 210000, "paidEstimated": 12000 }, "explanation": "Paid volume ৳222,000.00 ≤ order volume ৳242,808.95." } ] } }
```
`status`: `pass` | `fail` | `info`. Checks: **R2** costed + uncosted + excluded = product sales; **R3** paid ≤ order volume; **R4** refunds equal on Overview, Payments and Σ ledger refund rows; **R5** Σ row fees = overview fees, and net = gross − fee on every row; **R6** Σ supplier owed (payables per party) = overview supplier dues; **R7** customers tab total = overview owed by customers; **R8** stock value − movement value = explained lines (status `info` with the gap when non-zero but fully explained; `fail` only if unexplained); **R9** Σ tax by rate + not broken down = tax collected; **R10** Σ monthly net (closed + open months) = net for the whole period; **R11** single currency (always pass: one company currency). Every failing check has an `explanation` naming the numbers.

### v2 Changed definitions (read this)
1. **Net profit** subtracts estimated payment fees (`paymentFees`), and expenses are net of voids dated in the period. With no fee settings and no voids the numbers equal v1.
2. **Money out / balances** no longer include supplier credit-note applications (method `Credit note`), which were never cash.
3. **Periods use the company time zone** (default Asia/Dhaka) instead of server UTC; timestamps carry the company offset.
4. `/payments` and `/transactions` with `channel ≠ all` show only sale-linked rows.

### v2 implementation status
**Implemented** (backend, 2026-10-28). Migration `2026_10_28_300000_finance_v2_tables` (tables `finance_settings`, `finance_period_closes`, `finance_activity_log`; columns `expenses.voided_at/void_reason/voided_by/voided_by_name`, `finance_entries.vendor_id`, `inventory_movements.order_item_id`). Services: `FinanceMetricsService` (definitions), `FinanceContext`, `FinanceFeeService`, `FinanceCloseService`, `FinancePeriodLock` (model-event locks + expense activity log), `FinanceExpenseService`, `FinanceStockService`, `FinancePartyService`, `FinanceHealthService`; controller `FinanceV2Controller`; commands `finance:reconcile`, `finance:backfill-sale-movements`.

Notes for the clients:
- The ledger link for expense rows is now `/dashboard/expenses?expense={id}` (was `/dashboard/expenses`).
- `/api/reports/pnl` (the older Reports module) is unchanged: it does not subtract voids or payment fees. The finance P&L (`/finance/reports/pnl`, overview) is the reference.
- Voiding a recurring template also stops it repeating. Recurring generation skips occurrences dated in a closed month.
- The company 459 data has a 2015 expense/payment, so the month list starts in June 2015 and `olderOpenMonth` is June 2015 until those months are closed.

---

## Expenses page
Existing `/api/expenses*` and `/api/expense-categories*` (permission `Expenses`). Salary and dorji payout expenses are generated and read-only there. v2: void / activity / closed-month locks, see v2.5.

## Changelog
- v1 (2026-10-28): initial contract.
- v1.1 (2026-10-28, implemented): added `kind` on ledger rows; `pnl` block + `isActive` in overview; `overdue30*` / `delivered*` / `pastMonths*` / `overdueParties` fields in summaries; `payoutsWithoutExpense` in P&L info; `customerDues` / `supplierDues` in aging; `period` in inventory ledger; COGS line revenue = line totals; method-mapped error uses the method label. Nothing was removed or renamed.
- v2 (2026-10-28, implemented): shared metrics service + `/metrics`; `context` {period, currency, channel, tz} on every response; `channel` filter; company time zone for periods; profit coverage + `/products/without-cost`; store credit liability; opening-stock move-in; sale-movement backfill; stock reconciliation; expense void + activity; month close/reopen + locks; payables per party; supplier/customer receivables tabs + supplier receipt; payments summary; payment-method fees + gross/fee/net per row; tax by rate names + not broken down; health checks + `finance:reconcile`. See "v2 additions" and "v2 Changed definitions".
