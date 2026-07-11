# Expo Admin App

This folder contains a mobile Expo scaffold for the existing ecommerce admin system.

## Included

- Expo Router app structure
- Shared admin login against `POST /api/auth/login`
- Token and `company_id` persistence with AsyncStorage
- Dashboard stats screen using `GET /api/sells/stats`
- Products screen using `GET /api/products`
- Orders screen using `GET /api/sells`
- Account screen with logout and current API configuration

## Important

The mobile app connects directly to Laravel.

It does **not** use the Next.js `/api/proxy` route because that route is browser-only and not suitable for Expo.

## Setup

1. Copy `.env.example` to `.env`
2. Set your Laravel API URL:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.10:8005/api
```

Use your machine LAN IP for a physical device or emulator access. Do not use `localhost` unless the simulator can resolve the backend from the same host context.

3. Install dependencies:

```bash
cd apps/expo-admin
npm install
```

4. Start Expo:

```bash
npm run start
```

## Suggested next work

- Product detail screen
- Order detail and status update
- Push notifications
- Support inbox
- Staff list and salary overview
- Company settings and currency formatting
