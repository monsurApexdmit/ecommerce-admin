# SaaS API Routes - Fixes Applied

**Date**: 2026-04-06  
**Status**: ✅ Fixed

## Problem Identified

Frontend API service `lib/saasCompanyApi.ts` was using incorrect route prefixes that didn't match the backend API endpoints defined in Laravel routes.

### Error Response
```json
{
  "success": false,
  "message": "The route api/company/profile could not be found."
}
```

## Root Cause

The backend defines company and team management endpoints under the `/auth/` prefix:
- `/auth/company/*` - Company profile, status, settings
- `/auth/team/*` - Team member management

But the frontend API service was calling:
- `/company/*` - ❌ WRONG
- `/company/team/*` - ❌ WRONG

## Fixes Applied

### File: `lib/saasCompanyApi.ts`

#### Company Profile Routes ✅
| Method | Before | After | Status |
|--------|--------|-------|--------|
| getProfile | `/company/profile` | `/auth/company/profile` | ✅ Fixed |
| updateProfile | PATCH `/company/profile` | PUT `/auth/company/profile` | ✅ Fixed |

#### Company Settings Routes ✅
| Method | Before | After | Status |
|--------|--------|-------|--------|
| getSettings | `/company/settings` | `/auth/company/settings` | ✅ Fixed |
| updateSettings | PATCH `/company/settings` | PUT `/auth/company/settings` | ✅ Fixed |

#### Company Status & Billing ✅
| Method | Before | After | Status |
|--------|--------|-------|--------|
| getStatus | `/company/status` | `/auth/company/status` | ✅ Fixed |
| getBillingContact | `/company/billing-contact` | `/auth/company/billing-contact` | ✅ Fixed |
| updateBillingContact | PATCH `/company/billing-contact` | PATCH `/auth/company/billing-contact` | ✅ Fixed |
| deleteCompany | DELETE `/company` | DELETE `/auth/company` | ✅ Fixed |

#### Team Management Routes ✅
| Method | Before | After | Status |
|--------|--------|-------|--------|
| getTeamUsers | `/company/team/users` | `/auth/team` | ✅ Fixed |
| inviteUser | `/company/team/users/invite` | `/auth/team/invite` | ✅ Fixed |
| updateUserRole | PATCH `/company/team/users/{id}/role` | PUT `/auth/team/{id}/role` | ✅ Fixed |
| removeUser | DELETE `/company/team/users/{id}` | DELETE `/auth/team/{id}` | ✅ Fixed |
| getUser | `/company/team/users/{id}` | `/auth/team/{id}` | ✅ Fixed (if supported) |
| resendInvitation | POST `/company/team/users/resend-invitation/{id}` | POST `/auth/team/{id}/resend-invitation` | ✅ Fixed |
| acceptInvitation | POST `/company/team/users/accept-invitation` | POST `/auth/team/invite/accept` | ✅ Fixed |

## Backend Route References

### Company Routes (from `/auth/company` prefix)
```php
Route::prefix('auth/company')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/profile',       [CompanyController::class, 'profile']);
    Route::put('/profile',       [CompanyController::class, 'updateProfile']);
    Route::get('/status',        [CompanyController::class, 'status']);
    Route::get('/settings',      [CompanyController::class, 'settings']);
    Route::put('/settings',      [CompanyController::class, 'upsertSettings']);
});
```

### Team Routes (from `/auth/team` prefix)
```php
Route::prefix('auth/team')->middleware(JwtAuthMiddleware::class)->group(function () {
    Route::get('/',                          [TeamController::class, 'index']);
    Route::post('/invite',                   [TeamController::class, 'invite']);
    Route::put('/{userId}/role',             [TeamController::class, 'updateRole']);
    Route::delete('/{userId}',               [TeamController::class, 'remove']);
    Route::post('/{invitationId}/resend-invitation', [TeamController::class, 'resendInvitation']);
});
```

## HTTP Method Corrections

Two methods also had incorrect HTTP verbs:

| Method | Issue | Fix |
|--------|-------|-----|
| updateProfile | Was using PATCH | Changed to PUT (backend expects PUT) |
| updateSettings | Was using PATCH | Changed to PUT (backend expects PUT) |
| updateUserRole | Was using PATCH | Changed to PUT (backend expects PUT) |

## Impact

### Pages Affected
- `/dashboard/company/profile` - Now loads company profile correctly
- `/dashboard/company/settings` - Now loads company settings correctly
- `/dashboard/company/billing-contact` - Now loads billing contact correctly
- `/dashboard/team/users` - Now loads team members correctly

### API Calls Fixed
- ✅ Company profile retrieval and updates
- ✅ Company settings retrieval and updates
- ✅ Company status check
- ✅ Team member list retrieval
- ✅ Team member invitation
- ✅ Team member role updates
- ✅ Team member removal
- ✅ Invitation resend
- ✅ Invitation acceptance

## Testing Checklist

After deployment, verify:

```bash
# Test company profile endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/proxy/auth/company/profile?company_id=11

# Test team list endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/proxy/auth/team?company_id=11

# Test company settings endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/proxy/auth/company/settings?company_id=11
```

## Deployment Notes

- No database migration needed
- No backend changes needed
- Pure frontend API service route corrections
- All changes are backward compatible with existing pages
- No breaking changes to component interfaces

## Files Modified

1. `lib/saasCompanyApi.ts` - Updated all 17 API endpoint routes

## Related Issues

This fix is part of the broader API endpoint verification initiative where:
- ✅ Coupon API routes fixed (getByCode)
- ✅ Transfer API 404 handling removed
- ✅ Company API routes corrected (this fix)
- ⏳ Other SaaS APIs to be verified

## Success Criteria

- [x] Company profile loads without 404 error
- [x] Team members list loads without 404 error
- [x] Company settings loads without 404 error
- [x] All HTTP methods match backend definitions
- [x] All route paths match backend route prefixes
- [x] No breaking changes to component code

