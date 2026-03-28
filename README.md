# ![HELFINANCE](frontend/public/logo.png)

**HELFINANCE** — Personal Finance Dashboard

A self-hosted, privacy-first finance tracker. Manage income, expenses, loans, savings goals, and household finances from a single clean dashboard. Runs as a single Docker container, stores everything in a local SQLite database, and works offline as a PWA.

> ⚠️ **Hinweis:** HELFINANCE wurde vollständig mit KI (Claude.ai) erstellt. Es wurde nicht für eine öffentliche Bereitstellung im Internet konzipiert und sollte ausschließlich im lokalen Netzwerk / Homelab betrieben werden.

---

## Features

| Module | Description |
|--------|-------------|
| **Dashboard** | Health score gauge, budget traffic light, free money this month, upcoming bookings, savings progress |
| **Income** | Track salaries and recurring income; schedule future amount changes |
| **Expenses** | Group by category; monthly/quarterly/semi-annual/annual intervals; schedule changes |
| **Loans** | Annuity loan calculator with full amortization table; avalanche payoff hints |
| **Savings Goals** | Fixed, dynamic, or combined contribution modes; emergency reserve tracker |
| **Cashflow Calendar** | Daily booking overview + projected running balance chart |
| **Reports** | Monthly breakdown with category donut chart; yearly 12-column table |
| **Export** | PDF and CSV export for monthly and yearly reports |
| **Household** | Link two users; split shared expenses; see monthly balance ("User B owes User A: X€") |
| **Notifications** | In-app alerts for upcoming large expenses, negative projections, savings goals reached |
| **Email (SMTP)** | Optional email notifications via configurable SMTP; test button in admin |
| **OIDC Login** | Optional single sign-on via any OIDC provider (Authentik, Keycloak, etc.); native login always available |
| **Admin Panel** | SMTP config, OIDC config, default language/currency, user management, registration control |
| **PWA** | Installable on desktop and mobile; offline shell via service worker |
| **i18n** | German (default) and English; per-user language preference stored in DB |
| **Dark/Light Mode** | System preference + manual toggle |

---

## Quick Start

### Docker Run
```bash
docker run -d \
  --name helfinance \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /your/appdata/helfinance:/data \
  -e SECRET_KEY=$(openssl rand -hex 32) \
  -e DATABASE_PATH=/data/helfinance.db \
  ghcr.io/kreuzbube88/helfinance:latest
```

Then open `http://localhost:3000`. The first registered user is automatically assigned admin.

### Docker Compose
```bash
cp .env.example .env
# edit .env and set a strong SECRET_KEY
docker compose up -d
```

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3000` | No | HTTP port the app listens on |
| `DATABASE_PATH` | `/data/helfinance.db` | No | Absolute path to the SQLite database file |
| `SECRET_KEY` | `changeme` | **Yes** | Secret used for JWT signing — use `openssl rand -hex 32` |

All other configuration (SMTP, OIDC, default currency/language) lives in the Admin UI and is stored in the database.

---

## Unraid

Import the template via **Apps → Settings → Use custom template URL**:
```
https://raw.githubusercontent.com/Kreuzbube88/helfinance/main/helfinance.xml
```

---

## Development

Requirements: Node.js 20+

```bash
# Backend (starts on :3000)
cd backend && npm install && npm run dev

# Frontend (starts on :5173, proxies /api → :3000)
cd frontend && npm install && npm run dev
```

---

## About

HELFINANCE is a self-hosted personal finance tool built for homelab enthusiasts who want full control over their financial data without any cloud dependency.

*Coded with Claude.ai — because good prompts build great software.*
