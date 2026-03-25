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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// API routes
const v1 = '/api/v1';
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
