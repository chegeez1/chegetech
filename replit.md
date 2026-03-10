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
- Telegram bot integration
- WhatsApp integration (via @whiskeysockets/baileys)
- Email notifications via Nodemailer
- API key management

## Environment Variables

- `PAYSTACK_SECRET_KEY` — Paystack secret key (required for payments)
- `PAYSTACK_PUBLIC_KEY` — Paystack public key
- `EMAIL_USER` — Email address for sending notifications
- `EMAIL_PASS` — Email password/app password
- `EXTERNAL_DATABASE_URL` — PostgreSQL URL (optional; falls back to SQLite)
- `TELEGRAM_BOT_TOKEN` — Telegram bot token (optional)

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
