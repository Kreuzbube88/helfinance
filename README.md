# ![HELFINANCE](frontend/public/logo.png)

**HELFINANCE** — Personal Finance Dashboard

A self-hosted, privacy-first finance tracker. Manage income, expenses, loans, and savings from a single clean dashboard. Runs as a single Docker container, stores everything in a local SQLite database, and works offline as a PWA.

> ⚠️ **Hinweis:** HELFINANCE wurde vollständig mit KI (Claude.ai) erstellt. Es wurde nicht für eine öffentliche Bereitstellung im Internet konzipiert und sollte ausschließlich im lokalen Netzwerk / Homelab betrieben werden.

---

## Features

### Navigation

- **Dashboard** — Health score gauge, budget traffic light, free money this month, upcoming bookings
- **Bookings** — Tabs: Income / Expenses
  - **Income** — Recurring income sources; schedule future amount changes
  - **Expenses** — Grouped by category; monthly/quarterly/semi-annual/annual intervals; schedule changes; budget limits per category
- **Loans** — Annuity loan calculator with full amortization table, special payments, avalanche payoff hints
- **Savings** — Savings balance, withdrawals & adjustments, projection chart, reserves for irregular costs
- **Reports** — Tabs: Monthly / Yearly
  - **Monthly** — Breakdown with category donut chart, income/expense comparison, PDF & CSV export
  - **Yearly** — 12-column summary table, PDF & CSV export

### Other Features

| Feature | Description |
|---------|-------------|
| **Notifications** | In-app alerts for negative projections and large upcoming expenses |
| **Email (SMTP)** | Optional email notifications via configurable SMTP |
| **OIDC Login** | Optional SSO via any OIDC provider (Authentik, Keycloak, etc.); native login always available |
| **Admin Panel** | SMTP config, OIDC config, default language/currency, user management, registration control |
| **PWA** | Installable on desktop and mobile; offline shell via service worker |
| **i18n** | German (default) and English; per-user language preference |
| **Dark/Light Mode** | Manual toggle |

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
