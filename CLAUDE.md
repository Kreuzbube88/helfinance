# CLAUDE.md — HELFINANCE

Personal finance tracker. React + Express + SQLite, single Docker container.

## Stack

Frontend: React 18 + TypeScript strict + Vite 5 + react-router-dom + react-i18next  
Backend: Express 4 + TypeScript strict + better-sqlite3 + jsonwebtoken + bcryptjs  
Icons: lucide-react | Styling: Vanilla CSS + CSS variables | State: Context API  
Auth: JWT (localStorage) + optional OIDC | i18n: DE (default) + EN

## Architecture

- Express serves `/api/*` + React SPA
- Navigation: Dashboard · Bookings (tabs: Income/Expenses) · Loans · Savings · Reports (tabs: Monthly/Yearly)
- Auth middleware: `authenticateToken` / `adminOnly`
- Config: ENV (PORT, DATABASE_PATH, SECRET_KEY) + DB settings table (SMTP, OIDC)
- Calculations: shared `financeCalc.ts` — Dashboard and Reports must use identical logic

## Code Rules

**Frontend:**
- API calls ONLY via `api.ts` — never `fetch` in components
- Errors → `useToast()` for global, local state for inline
- i18n: always `useTranslation()` — never hardcode strings
- Modals: `<Modal>` / `<ConfirmModal>` — never `window.confirm` / `window.alert`
- TypeScript: interfaces for all API requests/responses, no `any`

**Backend:**
- Interface for every request body and DB row (`CreateExpenseBody`, `ExpenseRow`)
- DB reads: `db.prepare().all() as ExpenseRow[]` — never untyped `any[]`
- Validation: express-validator on all POST/PUT/PATCH
- Errors: `res.status(N).json({ error: '...' })`

## Database

Schema in `backend/src/db/migrations.ts` — read it, don't assume structure  
Key pattern: `effective_from` / `effective_to` for time-based changes  
**Booleans**: SQLite stores as `0 | 1` — always `value ? 1 : 0` on write, `=== 1` on read

## i18n

Framework: react-i18next, DE (default) + EN
- **NEVER hardcode UI strings** — always `useTranslation()`
- New features: add keys to DE+EN JSON **before** coding
- Pattern: `t('common.buttons.save')` or `t('pageSpecific.key')`
- Keep untranslated: SQLite, JWT, OIDC, SMTP, API, PWA, technical terms, DB field names
- Namespaces: common (shared) + page-specific (auth, dashboard, bookings, loans, savings, reports, profile, admin)
- Date/number formatting: adapt locale based on selected language
- Language persistence: `localStorage.setItem('helfinance_lang', lang)` after `i18n.changeLanguage()`

## Gotchas

- **better-sqlite3 booleans**: write `? 1 : 0`, read `=== 1`
- **Optional fields**: `category?`, `is_active?`, `color?` in interfaces (not required)
- **TypeScript optional chaining**: use `row?.category` when joins may return null
- **React Router redirects**: `<Navigate to="..." replace />` not `<Redirect>`
- **Calculation consistency**: Dashboard/Reports must use same logic from `financeCalc.ts`

## Dev Environment

- **Claude Code on Windows/PowerShell** — NO local Docker builds/tests
- Container builds: GitHub Actions only
- Git: commit after changes, imperative lowercase <72 chars, scope prefix (`feat:` `fix:`)
- Forbidden: unsolicited tests, unsolicited refactoring, god components

## Removed Features (don't recreate)

Household sharing, Cashflow page, Manual transactions, QuickAddModal, Booking overrides