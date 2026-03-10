# Project Overview

A full-stack subscription management platform built with Express (backend) + React (frontend), served together through Vite middleware in development.

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui, located in `client/`
- **Backend**: Express 5 + TypeScript, located in `server/`
- **Shared**: Types and schema in `shared/`
- **Database**: SQLite (via `better-sqlite3` + Drizzle ORM) by default; PostgreSQL supported via `EXTERNAL_DATABASE_URL` env var
- **Dev server**: Vite runs in middleware mode under Express on port 5000
- **Build**: `tsx script/build.ts` bundles to `dist/`

## Key Features

- Subscription plan management with categories
- Paystack payment integration
- Customer accounts with email verification and TOTP 2FA
- Admin dashboard with transaction/delivery logs
- Admin manual email verification for customers
- AI-powered customer support chatbot (OpenAI gpt-4o-mini) — key configurable via admin Settings panel or env var
- Live admin-customer chat via Support tab in admin panel
- Support ticket system with escalation workflow
- Manual transaction verification in admin Transactions tab (for payment failures)
- Telegram bot integration (including support ticket management: /tickets, /reply, /close)
- WhatsApp integration (via @whiskeysockets/baileys)
- Email notifications via Nodemailer
- API key management
- Sub-admin system with role-based access control (super admin can create sub-admins with limited permissions; sub-admins cannot access Settings, API credentials, or sub-admin management)

## Support System Architecture

- `server/openai-chat.ts` — AI chatbot using OpenAI API with conversation history per session
- `server/storage.ts` — `support_tickets` and `support_messages` tables for ticket persistence
- `client/src/components/ChatWidget.tsx` — AI chat widget with escalation to human support
- Admin Support tab (`client/src/pages/Admin.tsx`) — real-time ticket management and live chat
- Telegram bot commands: `/tickets`, `/reply <id> <msg>`, `/close <id>` for mobile admin support
- Flow: Customer chats with AI → escalates if needed → admin notified via Telegram → admin replies from dashboard or Telegram

## Environment Variables

- `OPENAI_API_KEY` — OpenAI API key (required for AI chatbot)
- `PAYSTACK_SECRET_KEY` — Paystack secret key (required for payments)
- `PAYSTACK_PUBLIC_KEY` — Paystack public key
- `EMAIL_USER` — Email address for sending notifications
- `EMAIL_PASS` — Email password/app password
- `EXTERNAL_DATABASE_URL` — PostgreSQL URL (optional; falls back to SQLite)
- `TELEGRAM_BOT_TOKEN` — Telegram bot token (optional)
- `TELEGRAM_CHAT_ID` — Telegram admin chat ID (optional)

## Setup Notes

- Native module `better-sqlite3` requires `npm rebuild better-sqlite3` after fresh installs with `--ignore-scripts`
- The `@whiskeysockets/baileys` package install script is broken; install with `npm install --ignore-scripts`
- Port: Always runs on 5000 (or `PORT` env var)
- Host: `0.0.0.0` for Replit proxy compatibility

## Workflows

- **Start application**: `npm run dev` — runs the full stack on port 5000

## Deployment

- Target: autoscale
- Build: `npm run build`
- Run: `node dist/index.cjs`
