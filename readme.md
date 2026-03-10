# Chege Tech - Premium Subscription Store

A full-stack website for selling shared premium subscription accounts with Paystack payment processing, automatic email delivery, customer accounts, cart system, and a comprehensive admin panel.

## Database

Uses **SQLite** (file-based) via `better-sqlite3` + Drizzle ORM locally. For production (Render), supports **external PostgreSQL** via `EXTERNAL_DATABASE_URL` env var. The database file is auto-created at `data/database.sqlite` on first startup. Tables are created automatically via `initializeDatabase()` in `server/storage.ts`.

All config data (accounts, plans, promo codes, credentials, logs) is stored in a `settings` table (key-value store) in the database — no JSON files on disk. On first startup, existing JSON files are automatically migrated into the database.

For PostgreSQL mode, settings are cached in-memory on startup and written back async (fire-and-forget) for sync API compatibility.

## Features

### Public Store
- Browse 30+ subscription plans across 5 categories (Streaming, Music, Productivity, VPN, Gaming)
- **Add to Cart** - Cart drawer with qty controls, persisted in localStorage
- **Buy Now** - Direct checkout for each plan
- Search and category filters
- Popular picks section
- Promo code discounts at checkout

### Customer Accounts (/auth, /dashboard)
- **Sign Up** - Email + password registration with email verification (6-digit code)
- **Sign In** - Session-based login stored in database
- **Forgot Password** - 6-digit email reset code, 15-minute expiry, enter code + new password to reset
- **My Products** - View all past purchases linked to your email
- **Credentials Viewer** - Toggle-reveal credentials (email/password/activation codes) on completed orders with per-field copy buttons
- **API Keys** - Generate/revoke personal API keys (max 5 per customer)
- **2FA** - Customer-side TOTP 2FA via authenticator app
- **Profile Tab** - Edit display name, change password with current-password verification
- Neon portal-style glassmorphism auth page

### Auth Gate
- Users must sign up / log in before accessing the store or any page
- Unauthenticated users are redirected to `/auth`
- `/admin` and payment callback routes are exempt (admin has its own auth)
- After login/signup, users land on the store (`/`) instead of dashboard

### Payment & Delivery
- Paystack payment popup (inline JS) with reference tracking
- Auto email delivery of account credentials after payment
- Paystack webhook (`/api/paystack/webhook`) for reliable server-to-server delivery
- **Auto-cancel**: Pending transactions older than 10 minutes are automatically cancelled (checked every 2 minutes)
- If a cancelled transaction receives a valid Paystack payment, it's automatically reinstated and delivered
- Promo codes (% or fixed KES off) with expiry and usage limits

### Admin Panel (/admin)
- Login: Email + Password + TOTP 2FA (Google Authenticator, Authy)
- **Dashboard** - Revenue/orders/emails stats + SVG bar chart (last 14 days revenue) + Top 5 plans by revenue
- **Plans & Offers** - Edit prices, set offer labels, enable/disable plans, add custom plans
- **Accounts** - Add/edit/delete accounts per plan; **Bulk Upload** (CSV paste or file upload with live preview)
- **Promo Codes** - Create, toggle, delete discount codes
- **Transactions** - Full history with search (email/plan/reference), status filter, CSV export, **Resend Credentials** button per completed order
- **API Keys** - Generate and manage API keys (admin-level)
- **Customers** - View all registered customers, suspend/unsuspend accounts
- **Activity Logs** - Full audit log of all admin actions, filterable by category, clearable
- **Settings** - Editable credentials (Paystack, Email, Admin login, Telegram Bot), App config (WhatsApp, site name), 2FA management

### Telegram Bot
- Admin commands: `/addaccount`, `/stock`, `/stats`
- Customer commands: `/buy` (browse & get payment link), `/myorders` (check orders by email)
- Long polling started automatically on server startup

## Database Tables
- `transactions` - Payment records
- `customers` - Registered customer accounts
- `customer_sessions` - Active session tokens
- `api_keys` - Customer and admin API keys
- `settings` - Key-value store for all config data (accounts, plans, promo codes, credentials, app config, delivery logs, admin logs)

## Environment Variables Required
- `PAYSTACK_PUBLIC_KEY` - Paystack public key
- `PAYSTACK_SECRET_KEY` - Paystack secret key
- `EMAIL_USER` - Gmail address for sending emails
- `EMAIL_PASS` - Gmail app password
- `SESSION_SECRET` - Session encryption key
- `TELEGRAM_BOT_TOKEN` - (optional) Telegram bot token from @BotFather
- `TELEGRAM_CHAT_ID` - (optional) Telegram chat/group/channel ID for notifications
- `EXTERNAL_DATABASE_URL` - (optional) PostgreSQL connection string for production (Render). When set, uses PostgreSQL instead of SQLite.

All of these can also be set directly from the admin panel Settings tab without needing Replit Secrets.

## Key Files
- `client/src/pages/Store.tsx` - Main store with cart
- `client/src/pages/Auth.tsx` - Customer signup/login/forgot password (neon portal style)
- `client/src/pages/Dashboard.tsx` - Customer dashboard (orders + API keys + 2FA)
- `client/src/pages/Checkout.tsx` - Checkout with promo codes
- `client/src/pages/Admin.tsx` - Full admin panel (all tabs)
- `server/routes.ts` - All API endpoints
- `server/auth.ts` - Admin TOTP auth (settings stored in DB)
- `server/email.ts` - Email sending (account delivery + password reset)
- `server/telegram.ts` - Telegram bot notifications
- `server/telegram-bot.ts` - Interactive Telegram bot with long polling
- `server/storage.ts` - Database CRUD layer (SQLite/PostgreSQL, settings key-value store)
- `server/accounts.ts` - Account inventory manager (reads/writes from DB settings)
- `server/credentials-store.ts` - Override credentials storage (DB settings)
- `server/admin-logger.ts` - Admin activity logging (DB settings)
- `server/plan-overrides.ts` - Plan price/offer overrides + custom plans (DB settings)
- `server/promo.ts` - Promo code manager (DB settings)
- `server/delivery-log.ts` - Delivery tracking (DB settings)
- `server/plans.ts` - Predefined plan catalog
- `shared/schema.ts` - Drizzle ORM schema (SQLite dialect)

## GitHub
- Repository: https://github.com/Mwasdaym/chegetech

## Deployment (Render)
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Required env vars: PAYSTACK keys, EMAIL credentials, SESSION_SECRET
- For data persistence: Set `EXTERNAL_DATABASE_URL` to a free PostgreSQL (e.g. Neon, Supabase, or Render PostgreSQL)
- Without EXTERNAL_DATABASE_URL, data is stored in SQLite which gets wiped on Render's ephemeral filesystem

## Branding
- Site name: Chege Tech
- WhatsApp support: +254114291301
- Glassmorphism dark theme with indigo/violet gradients
