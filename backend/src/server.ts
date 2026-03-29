import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { getDb } from './db/index';
import { createAuthRouter } from './routes/auth';
import { createUsersRouter } from './routes/users';
import { createAdminRouter } from './routes/admin';
import { createCategoriesRouter } from './routes/categories';
import { createIncomeRouter } from './routes/income';
import { createExpensesRouter } from './routes/expenses';
import { createLoansRouter } from './routes/loans';
import { createSavingsRouter } from './routes/savings';
import { createHouseholdRouter } from './routes/household';
import { createDashboardRouter } from './routes/dashboard';
import { createReportsRouter } from './routes/reports';
import { createExportRouter } from './routes/exportRoutes';
import { createNotificationsRouter } from './routes/notifications';
import { createSetupRouter } from './routes/setup';
import { createTransactionsRouter } from './routes/transactions';
import { createWidgetsRouter } from './routes/widgets';
import { createOverridesRouter } from './routes/overrides';
import { generateAutoTransactions } from './routes/transactions';
import { checkAndCreateNotifications } from './services/notificationService';

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// CORS
if (isProd) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
  app.use(cors({ origin: allowedOrigin, credentials: true }));
} else {
  app.use(cors());
}

app.use(express.json());

// Connect DB and run migrations
const db = getDb();

// Bug 15: generate auto-transactions for all users on startup
(function startupAutoTransactions() {
  try {
    const users = db.prepare('SELECT id FROM users').all() as { id: number }[];
    for (const { id } of users) {
      generateAutoTransactions(db, id);
    }
  } catch (e) {
    console.error('Startup auto-transactions failed:', e);
  }
})();

// Bug 21: run daily notification checks
async function runDailyChecks(): Promise<void> {
  try {
    const users = db.prepare('SELECT id FROM users').all() as { id: number }[];
    for (const { id } of users) {
      await checkAndCreateNotifications(db, id);
    }
  } catch (e) {
    console.error('Daily checks failed:', e);
  }
}
void runDailyChecks();
setInterval(() => { void runDailyChecks(); }, 24 * 60 * 60 * 1000);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes
const v1 = '/api/v1';
app.use(`${v1}/setup`, createSetupRouter(db));
app.use(`${v1}/auth`, createAuthRouter(db));
app.use(`${v1}/users`, createUsersRouter(db));
app.use(`${v1}/admin`, createAdminRouter(db));
app.use(`${v1}/categories`, createCategoriesRouter(db));
app.use(`${v1}/income`, createIncomeRouter(db));
app.use(`${v1}/expenses`, createExpensesRouter(db));
app.use(`${v1}/loans`, createLoansRouter(db));
app.use(`${v1}/savings`, createSavingsRouter(db));
app.use(`${v1}/household`, createHouseholdRouter(db));
app.use(`${v1}/dashboard`, createDashboardRouter(db));
app.use(`${v1}/reports`, createReportsRouter(db));
app.use(`${v1}/export`, createExportRouter(db));
app.use(`${v1}/notifications`, createNotificationsRouter(db));
app.use(`${v1}/transactions`, createTransactionsRouter(db));
app.use(`${v1}/widgets`, createWidgetsRouter(db));
app.use(`${v1}/overrides`, createOverridesRouter(db));

// Serve frontend static files
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

// SPA fallback — serve index.html for all non-API routes
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`HELFINANCE backend running on port ${PORT}`);
});

export default app;
