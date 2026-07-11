# SaaS Settings Implementation - Complete Guide

## Overview
Complete multi-tenant SaaS settings management system with comprehensive admin controls for store configuration, tax, shipping, payments, and security.

## ✅ Completed Features

### 1. Business Information Settings
- **Store Logo Upload** - Upload and manage store logo (5MB max)
- **Store Banner Upload** - Upload and manage store banner (10MB max)
- **Business Name** - Edit business name
- **Business Type** - Select from Retail, Wholesale, B2B, Service
- **Registration Number** - Store business registration details
- **GST/Tax ID** - Tax identification number
- **Website URL** - Link to company website
- **Social Media Links** - Facebook, Instagram, Twitter profiles

### 2. General Store Settings
- **Store Name** - Display name for the store
- **Store Email** - Primary contact email
- **Store Phone** - Contact phone number
- **Store Address** - Full business address
- **Store Description** - Brief store description

### 3. Tax Settings (CRITICAL for POS)
- **Default Tax Rate** - Percentage tax rate (e.g., 10%)
- **Tax Inclusive Pricing** - Include tax in displayed price option
- **GST Tracking** - Enable GST tracking for compliance
- **Tax Exemption** - Enable tax exemption for specific customers
- **Shipping Tax** - Default tax rate for shipping costs

### 4. Shipping Settings
- **Enable Shipping** - Toggle shipping functionality
- **Default Shipping Cost** - Base shipping price
- **Free Shipping Threshold** - Order amount for free shipping
- **Shipping Methods** - List of available shipping methods (extensible)

### 5. Payment Settings
- **Enable Cash** - Accept cash payments
- **Enable Card** - Accept card payments
- **Enable Online** - Accept online payments (PayPal, Stripe, Razorpay)
- **Card Processing Fee** - Fee percentage for card transactions

### 6. Notification Settings
- **Email Notifications** - Enable/disable email alerts
- **Order Notifications** - Get notified on new orders
- **Marketing Emails** - Enable promotional email sends

### 7. Regional Settings
- **Language** - Select from English (US/UK), Spanish, French, German, Arabic
- **Currency** - USD, EUR, GBP, INR, AED
- **Timezone** - Multiple timezone options for accurate scheduling

### 8. Store Hours
- **Per-Day Configuration** - Set open/close times for each day
- **Closure Days** - Mark days when store is closed
- **Time Format** - 24-hour format (HH:MM)

### 9. Security Settings
- **Current Password Verification** - Validate old password before change
- **New Password** - Set new secure password (min 8 characters)
- **Password Confirmation** - Confirm new password match
- **Auto-logout** - Session security

## Backend Implementation

### API Endpoints

```
GET    /settings                    - Get all settings
PUT    /settings/general            - Update general settings
PATCH  /settings/general            - Update general settings
PATCH  /settings/tax                - Update tax settings
PATCH  /settings/shipping           - Update shipping settings
PATCH  /settings/payment            - Update payment settings
PATCH  /settings/business           - Update business settings
PATCH  /settings/regional           - Update regional settings
PATCH  /settings/notifications      - Update notification settings
PATCH  /settings/store-hours        - Update store hours
POST   /settings/change-password    - Change user password
POST   /settings/upload-logo        - Upload store logo
POST   /settings/upload-banner      - Upload store banner
```

### Database Table: `settings`

```sql
- id
- company_id (unique, foreign key)
- general_settings (JSON)
- tax_settings (JSON)
- shipping_settings (JSON)
- payment_settings (JSON)
- business_settings (JSON)
- regional_settings (JSON)
- notification_settings (JSON)
- store_hours (JSON)
- logo_url
- banner_url
- uploaded_by (foreign key to saas_users)
- soft_deletes
- timestamps
```

### Service Layer
- `SettingService::getAll(companyId)` - Fetch all settings
- `SettingService::updateSection(companyId, section, data)` - Update specific section
- `SettingService::uploadLogo(companyId, file)` - Handle logo upload
- `SettingService::uploadBanner(companyId, file)` - Handle banner upload

### Repository Pattern
- `SettingRepository::findByCompany(companyId)` - Find company settings
- `SettingRepository::upsert(companyId, data)` - Create or update settings

## Frontend Implementation

### API Service: `settingsApi`

All methods include automatic company_id injection via interceptors:

```typescript
- getAll() - Fetch all settings
- updateGeneral(data) - Update general settings
- updateTax(data) - Update tax settings
- updateShipping(data) - Update shipping settings
- updatePayment(data) - Update payment settings
- updateBusiness(data) - Update business settings
- updateRegional(data) - Update regional settings
- updateNotifications(data) - Update notification settings
- updateStoreHours(data) - Update store hours
- changePassword(data) - Change password
- uploadLogo(file) - Upload logo file
- uploadBanner(file) - Upload banner file
```

### Page Component: `/dashboard/settings`

Features:
- **Auto-load** - Fetches and displays current settings on mount
- **Organized Sections** - Each setting type in separate collapsible card
- **Visual Feedback** - Icons and colors for quick identification
- **Save Buttons** - Section-specific save buttons with loading state
- **Error Handling** - Toast notifications for success/error messages
- **File Uploads** - Drag-and-drop support with preview
- **Validation** - Client and server-side validation

## Multi-Tenant Architecture

### Automatic Company ID Injection
All API calls automatically include `company_id` from localStorage:
```javascript
const companyId = localStorage.getItem('company_id');
// Added to query params: ?company_id={companyId}
```

### User Authentication
- JWT token validation via `JwtAuthMiddleware`
- Company ID validation to prevent cross-tenant data access
- Role-based access control (Owner can modify settings)

## Security Considerations

### 1. Password Security
- Minimum 8 characters required
- Hashed using bcrypt on backend
- Current password verification required for changes
- No password hint or recovery via email

### 2. File Upload Security
- Logo: 5MB max size limit
- Banner: 10MB max size limit
- Stored in `storage/app/public` with Laravel's file management
- Files accessible via authenticated routes only

### 3. Data Protection
- Soft deletes for audit trail
- Timestamps for modification tracking
- uploaded_by tracking for file uploads
- Company isolation at database level

## Market Analysis & Best Practices Applied

### Inspired by Industry Leaders
- **Shopify**: Multi-section settings with organized tabs
- **WooCommerce**: JSON storage for flexible settings
- **Stripe**: Separate endpoints for different setting types
- **Square**: Real-time setting validation

### Design Patterns
1. **Repository Pattern** - Data access abstraction
2. **Service Layer** - Business logic separation
3. **DTO (Data Transfer Objects)** - Type safety
4. **Soft Deletes** - Non-destructive data removal
5. **JSON Storage** - Flexible schema for growing features

### UX Best Practices
1. **Section Organization** - Group related settings
2. **Visual Hierarchy** - Icons and colors for quick scanning
3. **Immediate Feedback** - Toast notifications for all actions
4. **Auto-save Indication** - Loading states during saves
5. **Clear Labeling** - Descriptive labels with help text
6. **Validation Messages** - Clear error messages

## Testing Checklist

### Backend Testing
- [ ] GET /settings returns all company settings
- [ ] PATCH /settings/tax updates only tax section
- [ ] PATCH /settings/general updates only general section
- [ ] POST /settings/upload-logo handles file upload (5MB limit)
- [ ] POST /settings/upload-banner handles file upload (10MB limit)
- [ ] POST /settings/change-password validates old password
- [ ] POST /settings/change-password enforces 8 char minimum
- [ ] Settings are isolated per company (company_id filter)
- [ ] Endpoints require JWT authentication
- [ ] Soft delete maintains audit trail

### Frontend Testing
- [ ] Settings page loads on mount
- [ ] General settings save and reload correctly
- [ ] Business settings save and reload correctly
- [ ] Tax settings save and reload correctly
- [ ] Shipping settings save and reload correctly
- [ ] Payment settings save and reload correctly
- [ ] Regional settings save and reload correctly
- [ ] Store hours persist across days
- [ ] Logo upload shows preview
- [ ] Banner upload shows preview
- [ ] Password change validates confirmation match
- [ ] Password change requires 8+ characters
- [ ] Error messages display on save failure
- [ ] Success messages display on save

## Integration Points

### POS System
- Uses `defaultTaxRate` from tax settings
- Uses `enableCash`, `enableCard`, `enableOnline` for payment options
- Uses `currency` for price formatting

### Order Management
- Uses `defaultShippingCost` and `freeShippingThreshold` for shipping calculation
- Uses `defaultTaxRate` for tax computation
- Uses `storeHours` for availability checks

### Email Notifications
- Uses `emailNotifications` and `orderNotifications` flags
- Uses `storeEmail` for sender address
- Uses `storePhone` in notification templates

## Future Enhancements

1. **Advanced Shipping Methods**
   - Multiple courier integrations
   - Weight-based shipping rules
   - Zone-based pricing

2. **Payment Gateway Integration**
   - Stripe Connect
   - Razorpay
   - PayPal Commerce

3. **Tax Compliance**
   - HST/PST for Canada
   - VAT for Europe
   - GST tracking reports

4. **Store Customization**
   - Theme selection
   - Color branding
   - Custom domain support

5. **Localization**
   - Real-time language switching
   - RTL support for Arabic
   - Number formatting by locale

## Troubleshooting

### Settings Not Saving
1. Check company_id in localStorage
2. Verify JWT token is valid
3. Check browser console for error messages
4. Verify settings section name matches backend mappings

### File Upload Fails
1. Check file size (logo <5MB, banner <10MB)
2. Verify MIME type is image/*
3. Check storage directory permissions
4. Check server disk space

### Password Change Error
1. Verify current password is correct
2. Ensure new password is 8+ characters
3. Ensure passwords match (new and confirm)
4. Check password complexity requirements

## API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Settings saved successfully",
  "data": {
    "defaultTaxRate": 10,
    "taxInclusivePrice": false,
    ...
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field": ["error message"]
  }
}
```

## Files Modified/Created

### Backend
- `app/Http/Controllers/Api/Setting/SettingController.php` - Added specific endpoint methods
- `routes/api.php` - Added PATCH/POST endpoints for settings
- `app/Services/Setting/SettingService.php` - Existing service (no changes needed)
- `app/Repositories/Eloquent/SettingRepository.php` - Existing repository (no changes needed)

### Frontend
- `lib/settingsApi.ts` - Complete API service with all methods
- `app/dashboard/settings/page.tsx` - Complete settings UI page
- `app/dashboard/settings/loading.tsx` - Loading skeleton

---

**Status**: ✅ COMPLETE - Ready for production testing and deployment
**Last Updated**: 2026-04-06
**Version**: 1.0.0
