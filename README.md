# Chege Tech — Premium Subscription Store

A full-featured e-commerce platform for selling shared premium subscription accounts. Built with Express + React, featuring instant email delivery, a customer wallet system, affiliate tiers, flash sales, subscription gifting, and a powerful admin panel.

**Live domain:** `streamvault-premium.site`

---

## Features

### Storefront
- Browse 30+ subscription plans across 5 categories (Streaming, Music, Productivity, VPN, Gaming)
- Search and category filters
- Add to Cart with quantity controls, persisted in localStorage
- Flash Sales with real-time countdown timers and percentage-off badges
- Out-of-stock plans show a **Join Waitlist** button — customers get notified by email when stock returns
- Dark / Light mode toggle stored in localStorage
- Dismissable in-app announcement banners (info / warning / success / urgent)
- Customer wallet balance shown in store header

### Checkout
- Paystack payment (card + M-Pesa via popup)
- Wallet payment — pay entirely from wallet balance
- Hybrid payment — wallet covers part, Paystack covers the remainder
- Promo code / discount support at checkout
- Group discounts applied automatically for tagged customer groups
- **Subscription gifting** — toggle "Gift to someone", enter recipient email + message; credentials are emailed directly to the gift recipient

### Customer Dashboard
| Tab | What it does |
|---|---|
| My Products | View active subscriptions with credential download + ratings |
| Wallet | Balance, top-up via Paystack, P2P transfer to any customer by email or ID |
| Referral | Affiliate link, tier badge (Silver / Gold / Platinum), earnings history |
| Receipts | Invoice portal — download PDF receipts for every completed order |
| Payments | Full payment history |
| Support | Open and reply to support tickets |
| Ideas | Submit feature requests and upvote others |
| API Keys | Manage reseller API keys |
| Security | Enable TOTP 2FA |
| Profile | Update name, email, phone |

### Wallet & Transfers
- Top up via Paystack (card / M-Pesa)
- Pay for subscriptions directly from wallet
- **P2P transfers** — send balance to any customer by email or numeric ID; both parties receive branded email notifications
- Admin can credit or deduct wallet balance from the Customers tab with a reason

### Affiliate / Referral System
- Every purchase by a referred customer earns the referrer coins (ongoing, not one-time)
- **Tier progression:**
  | Tier | Referrals needed | Multiplier |
  |---|---|---|
  | Silver | 5+ | 1.25× |
  | Gold | 15+ | 1.50× |
  | Platinum | 30+ | 2.00× |
- Tier badge shown on the dashboard

### Subscription Gifting
- At checkout, toggle "Gift to someone"
- Enter recipient's email and an optional personal message
- Credentials are delivered to the recipient's inbox; buyer gets a confirmation email

### Waitlist
- Customers click "Join Waitlist" on out-of-stock plans
- Admin can notify all waitlisted customers for a plan with one click (sends email via Resend)

### In-App Announcements
- Admin creates banners (info / warning / success / urgent) with optional expiry and link
- Shown at the top of every logged-in customer's dashboard
- Customers can dismiss banners; dismissed state is remembered in localStorage

### PDF Receipts / Invoice Portal
- Every successful order generates a PDF receipt on demand
- Customers access via the Receipts tab; download is authenticated
- Admin can download receipts per order from the Transactions tab

### Renewal Reminders
- Automated emails at **7 days**, **3 days**, and **1 day** before expiry
- Each reminder includes an urgency badge and renew link
- Deduplication prevents the same reminder being sent twice
- Telegram alert fires for subscriptions expiring within 3 days

### Ratings & Reviews
- Customers rate each purchased plan (1–5 stars + comment)
- Ratings visible in Admin Ratings tab

### Feature Requests
- Customers submit ideas and upvote existing ones
- Admin reviews in the Feature Requests tab

---

## Admin Panel

### Tabs
| Tab | Description |
|---|---|
| Dashboard | Revenue summary, recent orders, live stats |
| Plans | Create / edit / delete subscription plans, set stock, mark popular |
| Accounts | Manage shared credentials, view per-subscriber expiry with color coding |
| Promos | Create discount codes (flat or percent) |
| Transactions | All orders with status, CSV export |
| API Keys | Admin API key management + reseller API docs |
| Customers | Full customer list — credit / deduct wallet, view history, lock accounts, CSV export |
| Customer Groups | Tag customers into groups, apply group discounts at checkout |
| Flash Sales | Create time-limited flash sales with % discount per plan |
| Conversion Funnel | Page-view → checkout → payment analytics with drop-off rates |
| Ratings | Customer ratings and comments per plan |
| Feature Requests | Idea submissions with upvote counts |
| Email Blast | One-off email to all / active / recent customers |
| Campaigns | Scheduled or immediate email campaigns by segment |
| Support | View and reply to customer support tickets |
| Logs | System log viewer |
| Settings | Profile, Paystack config, 2FA setup, **Announcements**, **Waitlist**, env var status |
| Sub-Admins | Create sub-admin accounts with limited access |
| Geo Restrict | Block or allow specific countries |
| VPS Manager | SSH into VPS nodes |
| Domains | Domain / DNS record management |

### Admin Automation Bot
Telegram-based bot with commands:

| Command | Action |
|---|---|
| `/status` | Pending orders, low-stock alerts |
| `/orders` | Recent 10 transactions |
| `deliver <ref>` | Manually trigger account delivery |
| `deduct <email/ID> <amount>` | Deduct customer wallet |
| `credit <email/ID> <amount>` | Credit customer wallet |
| `wallet <email/ID>` | Check wallet balance |
| `stock <plan>` | Check plan stock level |

### Security Bot
- Detects multiple failed login attempts and blocks IPs automatically
- Sends Telegram alert on suspicious activity

---

## Reseller / Public API

Authenticated with `X-API-Key` header (customer API key from the dashboard).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/plans` | List all available plans |
| `POST` | `/api/v1/orders` | Place an order (wallet deduct) |

---

## API Endpoints Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/customer/register` | Register new customer |
| `POST` | `/api/customer/login` | Login (returns JWT) |
| `POST` | `/api/customer/request-otp` | Request email OTP |
| `POST` | `/api/customer/verify-otp` | Verify OTP + login |

### Payments
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/payment/initialize` | Init Paystack payment (supports gift) |
| `POST` | `/api/payment/verify` | Verify + deliver account |
| `POST` | `/api/payment/initialize-hybrid` | Hybrid wallet + Paystack |
| `POST` | `/api/payment/verify-hybrid` | Verify hybrid |

### Customer (Bearer token required)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/customer/orders` | Order history |
| `GET` | `/api/customer/orders/:ref/receipt` | Download PDF receipt |
| `GET` | `/api/customer/wallet` | Wallet balance |
| `POST` | `/api/customer/wallet/topup/initiate` | Start wallet top-up |
| `POST` | `/api/customer/wallet/topup/verify` | Confirm top-up |
| `POST` | `/api/customer/wallet/pay` | Pay for order from wallet |
| `POST` | `/api/customer/wallet/transfer` | P2P transfer |

### Waitlist & Announcements (public)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/waitlist` | Join waitlist for a plan |
| `GET` | `/api/announcements` | Get active announcements |

### Admin (admin token required)
| Method | Endpoint | Description |
|---|---|---|
| `GET/POST/DELETE` | `/api/admin/announcements` | Manage announcements |
| `GET/DELETE` | `/api/admin/waitlist` | View / remove waitlist entries |
| `POST` | `/api/admin/waitlist/notify/:planId` | Email all waitlisted for a plan |
| `POST` | `/api/admin/customers/:id/wallet/credit` | Credit wallet |
| `POST` | `/api/admin/customers/:id/wallet/deduct` | Deduct wallet |
| `GET` | `/api/admin/export/customers` | CSV export |
| `GET` | `/api/admin/export/orders` | CSV export |
| `GET` | `/api/admin/export/transactions` | CSV export |
| `GET` | `/api/admin/funnel` | Conversion funnel analytics |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, TypeScript |
| Frontend | React 18, Vite, TailwindCSS, shadcn/ui |
| Database | SQLite (dev) via `better-sqlite3` + Drizzle ORM; PostgreSQL (prod) via `EXTERNAL_DATABASE_URL` |
| Payments | Paystack (card + M-Pesa popup) |
| Email | Resend (transactional + campaigns) |
| PDF | PDFKit (receipt generation) |
| Auth | JWT (customer), bcrypt (admin), TOTP 2FA |
| Scheduled jobs | Node cron (expiry reminders, campaigns, weekly reports) |
| Telegram Bot | `node-telegram-bot-api` (admin bot + security alerts) |
| Geo | MaxMind GeoIP / IP-based blocking |

---

## Environment Variables

Create a `.env` file in `chegetech/` with the following:

```env
# Paystack
PAYSTACK_SK=sk_live_...
PAYSTACK_PK=pk_live_...

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_FROM=Chege Tech <no-reply@streamvault-premium.site>
RESEND_OTP_FROM=Chege Tech OTP <otp@streamvault-premium.site>

# Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_password
ADMIN_TOKEN_SECRET=random_secret_string

# Customer JWT
JWT_SECRET=another_random_secret

# Telegram bot (optional)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Database (production only — leave empty for SQLite)
EXTERNAL_DATABASE_URL=postgresql://...

# AI Chatbot (optional — uses Replit AI Integrations)
AI_INTEGRATIONS_OPENAI_BASE_URL=...
AI_INTEGRATIONS_OPENAI_API_KEY=...
```

---

## Getting Started

```bash
# Install dependencies
cd chegetech
npm install

# Start development server (Express + Vite on port 5000)
npm run dev
```

The app serves both the API and the React frontend from port 5000. On first startup, the SQLite database is created automatically at `data/database.sqlite` and all tables are initialized.

---

## Project Structure

```
chegetech/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── pages/
│       │   ├── Store.tsx        # Public storefront
│       │   ├── Checkout.tsx     # Payment flow + gift toggle
│       │   ├── Dashboard.tsx    # Customer dashboard
│       │   └── Admin.tsx        # Admin panel
│       └── components/          # Shared UI components
├── server/
│   ├── index.ts             # Express entry point
│   ├── routes.ts            # All API routes
│   ├── storage.ts           # Database layer (SQLite / PG)
│   ├── cron.ts              # Scheduled jobs (reminders, campaigns)
│   ├── admin-bot.ts         # Telegram admin bot
│   └── security-bot.ts      # Telegram security alerts
├── data/                    # SQLite database (auto-created)
├── uploads/                 # Uploaded assets
└── package.json
```

---

## Database

Uses **SQLite** in development (file at `data/database.sqlite`) and **PostgreSQL** in production (set `EXTERNAL_DATABASE_URL`). Tables are created automatically on startup — no migrations to run manually.

Key tables: `customers`, `transactions`, `wallets`, `wallet_transactions`, `referrals`, `funnel_events`, `customer_groups`, `settings` (key-value store for plans, accounts, promos, announcements, waitlist, campaigns, etc.)

---

## Cron Jobs

| Schedule | Job |
|---|---|
| Daily 9:00 AM | Subscription expiry alerts (7d / 3d / 1d reminders) |
| Every 5 minutes | Email campaign scheduler |
| Sunday 8:00 AM | Weekly revenue + order report (Telegram + email) |

---

## License

Private — all rights reserved. Built for [Chege Tech](https://streamvault-premium.site).
