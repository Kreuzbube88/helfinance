# Contributing to HELFINANCE

Thank you for your interest in contributing! Every contribution — bug reports, feature ideas, translations, or code — helps make HELFINANCE better for everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Translations](#translations-i18n)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

---

## Code of Conduct

Be kind, respectful, and constructive.

---

## How to Contribute

### Reporting Bugs

Use the **Bug Report** template when opening an issue. Include:
- Steps to reproduce
- Expected vs. actual behavior
- Screenshots or logs (`docker logs helfinance`)
- Browser and device

### Suggesting Features

Use the **Feature Request** template. Explain:
- The problem it solves
- How it should work
- Alternatives you considered

### Contributing Code

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Test locally
5. Commit with clear messages, push, and create a PR

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+

### Local Development

```bash
git clone https://github.com/YOUR-USERNAME/helfinance.git
cd helfinance

# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Start frontend (http://localhost:5173)
cd frontend && npm run dev

# Start backend (http://localhost:3000)
cd backend && npm run dev
```

### Environment Variables

Create `backend/.env`:

```env
PORT=3000
DATABASE_PATH=./dev.db
SECRET_KEY=your-dev-secret-key-min-32-chars
```

---

## Code Style

### TypeScript

- Strict mode everywhere — no `any` types
- Interfaces required for all request bodies, DB rows, and component props

```typescript
// Good
interface CreateExpenseBody {
  name: string;
  amount: number;
  interval: 'monthly' | 'quarterly' | 'yearly';
  category?: string;
}

// Bad
function createExpense(data: any) { ... }
```

### Frontend Rules

- API calls **only** via `api.ts` — never `fetch()` directly in components
- All UI strings via `useTranslation()` — never hardcode text
- State management: React Context API + `useState`
- Modals: use `<Modal>` / `<ConfirmModal>` — never `window.confirm` / `window.alert`
- Errors: `useToast()` for global notifications, local state for inline errors

### Backend Rules

- Always type DB query results:
  ```typescript
  const expenses = db.prepare('SELECT * FROM expenses').all() as ExpenseRow[];
  ```
- Errors: `res.status(N).json({ error: '...' })`
- Validation: use `express-validator` on all POST/PUT/PATCH routes
- Booleans: SQLite stores as `0 | 1`
  - Write: `value ? 1 : 0`
  - Read: `row.is_active === 1`

### File Structure

```
frontend/src/
  components/    # Reusable UI components
  pages/         # Route-level page components
  contexts/      # React Context providers
  api.ts         # All API calls
  types.ts       # Shared TypeScript interfaces
  i18n/          # Translation files (de.json, en.json, index.ts)

backend/src/
  routes/        # Express route handlers
  middleware/    # Auth and validation middleware
  services/      # Business logic
  db/            # migrations.ts and DB setup
  types.d.ts     # Backend TypeScript interfaces
```

---

## Translations (i18n)

### Adding a New Language

1. Create `frontend/src/i18n/[code].json` (copy `de.json` or `en.json` as a base)
2. Translate all keys
3. Update `frontend/src/i18n/index.ts` — add the import and resource entry
4. Keep technical terms untranslated: `SQLite`, `JWT`, `OIDC`, `SMTP`, `PWA`, `API`, database field names
5. Follow the namespace structure: `common`, `dashboard`, `bookings`, `loans`, `savings`, `reports`
6. Test locally: `cd frontend && npm run dev`, then switch language in Profile
7. Submit a PR using the **Translation** issue template

---

## Commit Messages

- Imperative mood, lowercase, max 72 characters
- Format: `scope: description`
- Scopes: `feat:` `fix:` `refactor:` `chore:` `docs:` `i18n:`

**Good:**
```
feat: add quarterly interval for expenses
fix: loan payment calculation in dashboard
i18n: add French translation
docs: update Docker setup instructions
```

**Bad:**
```
Fixed stuff
Update
Changes to dashboard
```

---

## Pull Request Process

1. Create a feature branch from `main`: `git checkout -b feat/add-bulk-import`
2. Make your changes:
   - Follow the code style above
   - Add i18n keys to both `de.json` and `en.json`
   - Test manually in the browser
3. Commit: `git commit -m "feat: add bulk import for expenses"`
4. Push: `git push origin feat/add-bulk-import`
5. Create a PR with:
   - Clear title describing the change
   - Description: what changed, why, and how to test it
   - Reference to any related issues (e.g. `Closes #42`)
6. Address any code review feedback
7. A maintainer will merge after approval

---

## Database Migrations

When changing the schema:

1. Edit `backend/src/db/migrations.ts`
2. Add an `ALTER TABLE` or new `CREATE TABLE` statement
3. Test by deleting `dev.db` and restarting the backend
4. Document the migration in your PR description

```typescript
// Example
db.exec(`ALTER TABLE expenses ADD COLUMN notes TEXT`);
```

---

## Testing

Manual testing only. Before opening a PR, verify:

- [ ] Frontend builds: `cd frontend && npm run build`
- [ ] Backend builds: `cd backend && npm run build`
- [ ] Tested in browser (desktop + mobile viewport)
- [ ] All affected features work as expected
- [ ] No errors in the browser console
- [ ] i18n works correctly in both DE and EN

---

## Questions

- Check the [Documentation](https://github.com/kreuzbube88/helfinance/tree/main/docs)
- Search [existing issues](https://github.com/kreuzbube88/helfinance/issues)
- Ask in [Discussions](https://github.com/kreuzbube88/helfinance/discussions)
- Open a [Question issue](https://github.com/kreuzbube88/helfinance/issues/new/choose)

Thank you for contributing! 🚀
