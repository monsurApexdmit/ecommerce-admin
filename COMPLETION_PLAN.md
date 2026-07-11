# Frontend & Backend Completion Plan

## Critical Missing Features to Complete

### Priority 1: Return Management Integration (🔴 CRITICAL)

#### Customer Returns - Inventory & Refund Integration
- **Files Affected**: 
  - `/contexts/customer-return-context.tsx` (Lines 147-148)
  - `/lib/customerReturnsApi.ts`
  - Customer returns backend API
- **Tasks**:
  1. Auto-restock inventory when return approved
  2. Initiate refund to customer payment method
  3. Update order status to reflect return
  4. Track refund status

#### Vendor Returns - Inventory & Credit Integration  
- **Files Affected**:
  - `/contexts/vendor-return-context.tsx` (Lines 120-121, 144)
  - `/lib/vendorReturnsApi.ts`
  - Vendor returns backend API
- **Tasks**:
  1. Auto-deduct items from inventory on vendor return
  2. Calculate and apply vendor credit/debit
  3. Track credit balance per vendor
  4. Reconciliation reports

---

### Priority 2: Coupon Management System (🔴 CRITICAL)

#### Backend Implementation
- **Missing Endpoints**:
  - `GET /coupons` - List all coupons
  - `POST /coupons` - Create coupon
  - `GET /coupons/{id}` - Get specific coupon
  - `PUT /coupons/{id}` - Update coupon
  - `DELETE /coupons/{id}` - Delete coupon
  - `POST /coupons/validate` - Validate coupon code
  - `GET /coupons/code/{code}` - Get by code (public)
  - `GET /coupons/{id}/usage-stats` - Usage statistics

#### Frontend Integration
- **Files Affected**:
  - `/lib/couponApi.ts` - Fix error handling
  - `/app/dashboard/coupons/page.tsx` - Implement CRUD
  - `/app/dashboard/pos/page.tsx` - Already integrated, just needs backend

- **Tasks**:
  1. Create coupon API endpoints
  2. Implement coupon list page with CRUD
  3. Add campaign management
  4. Usage tracking and analytics
  5. Validation and constraints

---

### Priority 3: Stock Transfer System (🔴 CRITICAL)

#### Backend Implementation
- **Missing Endpoints**:
  - `GET /transfers` - List stock transfers
  - `POST /transfers` - Create transfer
  - `GET /transfers/{id}` - Get transfer details
  - `PUT /transfers/{id}/cancel` - Cancel transfer
  - `GET /transfers/products-by-location/{locationId}` - Get products for transfer

#### Frontend Integration
- **Files Affected**:
  - `/lib/transferApi.ts` - Remove 404 handling, implement real API
  - `/contexts/transfer-context.tsx` - Update with real data
  - `/app/dashboard/inventory/transfer/page.tsx` - Already has UI

- **Tasks**:
  1. Create transfer API endpoints
  2. Implement transfer logic (deduct from source, add to destination)
  3. Update inventory records
  4. Transfer history and tracking

---

### Priority 4: Real-time Notifications System (🟡 MEDIUM)

#### Frontend
- **Files Affected**:
  - `/app/dashboard/notifications/page.tsx` - Remove mock data
  - Need notification context/service

#### Backend
- **Missing Endpoints**:
  - `GET /notifications` - List user notifications
  - `GET /notifications/unread` - Unread count
  - `PATCH /notifications/{id}/read` - Mark as read
  - Notification triggers on events

- **Tasks**:
  1. Create notification model and database
  2. Implement notification service
  3. Trigger notifications on:
     - New order
     - Return request
     - Payment received
     - Inventory low
     - Staff actions
  4. Real-time delivery (WebSocket or polling)

---

### Priority 5: Settings Page Backend Sync (🟡 MEDIUM)

- **Current State**: Frontend fully implemented, backend exists
- **Issue**: Need to verify all settings are persisted correctly
- **Tasks**:
  1. Test each settings section save
  2. Verify company isolation
  3. Ensure file uploads work
  4. Test password change validation

---

## Implementation Order

### Week 1: Critical Features
1. **Monday-Tuesday**: Coupon Management (Backend)
   - Create coupon model/migration
   - Implement API endpoints
   - Create database queries

2. **Wednesday-Thursday**: Stock Transfers (Backend)
   - Create transfer model/migration
   - Implement API endpoints
   - Update inventory logic

3. **Friday**: Return Management Integration
   - Implement inventory sync
   - Implement refund processing
   - Implement vendor credit updates

### Week 2: Integration & Polish
1. **Monday-Tuesday**: Frontend Integration
   - Fix coupon API integration
   - Fix transfer API integration
   - Test all return workflows

2. **Wednesday-Thursday**: Notifications
   - Implement notification system
   - Setup event triggers
   - Test real-time delivery

3. **Friday**: Testing & Cleanup
   - Full system testing
   - Performance optimization
   - Documentation

---

## Database Changes Required

### New Tables/Migrations Needed:
1. `coupons` - Coupon codes and settings
2. `coupon_usage` - Track coupon usage per order
3. `stock_transfers` - Track inventory transfers
4. `notifications` - User notifications
5. `refunds` - Track customer refunds
6. `vendor_credits` - Track vendor credit balance

### Model Updates:
- Add relationships between returns ↔ refunds
- Add relationships between transfers ↔ inventory
- Add notification tracking to orders and returns

---

## API Endpoints Summary

### Total New Endpoints Needed: ~25

#### Coupons (8 endpoints)
```
GET    /coupons
POST   /coupons
GET    /coupons/{id}
PUT    /coupons/{id}
DELETE /coupons/{id}
POST   /coupons/validate
GET    /coupons/code/{code}
GET    /coupons/{id}/usage-stats
```

#### Stock Transfers (5 endpoints)
```
GET    /transfers
POST   /transfers
GET    /transfers/{id}
PUT    /transfers/{id}/cancel
GET    /transfers/products-by-location/{locationId}
```

#### Notifications (4 endpoints)
```
GET    /notifications
GET    /notifications/unread
PATCH  /notifications/{id}/read
DELETE /notifications/{id}
```

#### Return Integration (3 endpoints)
```
POST   /returns/{id}/approve-refund
POST   /returns/{id}/deduct-inventory
PATCH  /vendors/{id}/update-credit
```

#### Additional (5 endpoints)
```
GET    /refunds
GET    /refunds/{id}
GET    /vendors/{id}/credit-balance
GET    /notifications/settings
PATCH  /notifications/settings
```

---

## Success Criteria

✅ All coupon CRUD operations working  
✅ Stock transfers create, track, and update inventory  
✅ Customer returns auto-refund and restock  
✅ Vendor returns auto-deduct and credit  
✅ Notifications triggered on key events  
✅ All API endpoints tested and documented  
✅ Frontend pages fully integrated  
✅ No 404 errors from missing endpoints  
✅ Full multi-tenant support maintained  
✅ Security measures in place (company_id filtering)

---

## Timeline
**Start**: Immediately  
**Target Completion**: 2 weeks  
**Status**: Ready to implement
