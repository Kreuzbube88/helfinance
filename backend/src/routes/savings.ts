import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';

interface SavingsAccountRow {
  id: number;
  user_id: number;
  initial_balance: number;
  initial_balance_date: string | null;
}

interface SavingsTransactionRow {
  id: number;
  user_id: number;
  amount: number;
  date: string;
  description: string | null;
  created_at: string;
}

interface ExpenseRow {
  id: number;
  name: string;
  amount: number;
  interval_months: number;
}

interface CategoryRow {
  id: number;
  name: string;
}

// Returns months elapsed from startDate (YYYY-MM-DD or YYYY-MM) to today (inclusive)
function monthsElapsed(startDate: string): number {
  const parts = startDate.split('-');
  const startYear = parseInt(parts[0], 10);
  const startMonth = parseInt(parts[1], 10);
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth() + 1;
  const elapsed = (nowYear - startYear) * 12 + (nowMonth - startMonth);
  return Math.max(0, elapsed);
}

export function createSavingsRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  // --- Savings Account Balance ---

  router.get('/balance', (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const account = db
        .prepare('SELECT * FROM savings_accounts WHERE user_id = ?')
        .get(userId) as SavingsAccountRow | undefined;
      const txSum = (
        db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM savings_transactions WHERE user_id = ?')
          .get(userId) as { total: number }
      ).total;
      res.json({
        initial_balance: account?.initial_balance ?? 0,
        initial_balance_date: account?.initial_balance_date ?? null,
        current_balance: Math.round(((account?.initial_balance ?? 0) + txSum) * 100) / 100,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/balance/initial', (req: Request, res: Response) => {
    try {
      const { initial_balance, initial_balance_date } = req.body as {
        initial_balance: number;
        initial_balance_date?: string;
      };
      if (initial_balance == null) {
        res.status(400).json({ error: 'initial_balance is required' });
        return;
      }
      db.prepare(
        `INSERT INTO savings_accounts (user_id, initial_balance, initial_balance_date)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           initial_balance = excluded.initial_balance,
           initial_balance_date = excluded.initial_balance_date`
      ).run(req.user!.id, initial_balance, initial_balance_date ?? null);
      res.json({ initial_balance, initial_balance_date: initial_balance_date ?? null });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // --- Savings Summary (for new SavingsPage) ---

  router.get('/summary', (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      const account = db
        .prepare('SELECT * FROM savings_accounts WHERE user_id = ?')
        .get(userId) as SavingsAccountRow | undefined;

      const initialBalance = account?.initial_balance ?? 0;
      const initialDate = account?.initial_balance_date ?? null;

      // Find "Savings" category for this user
      const savingsCat = db
        .prepare(`SELECT id FROM categories WHERE user_id = ? AND name = 'Savings' LIMIT 1`)
        .get(userId) as CategoryRow | undefined;

      // Sparen-category expenses
      const sparenExpenses = savingsCat
        ? (db
            .prepare(
              `SELECT id, name, amount, interval_months FROM expenses
               WHERE user_id = ? AND category_id = ? AND (is_active IS NULL OR is_active = 1)
                 AND (effective_to IS NULL OR effective_to >= date('now'))`
            )
            .all(userId, savingsCat.id) as ExpenseRow[])
        : [];

      const monthlyContribution = sparenExpenses.reduce(
        (sum, e) => sum + e.amount / e.interval_months,
        0
      );

      const elapsed = initialDate ? monthsElapsed(initialDate) : 0;
      const totalContributions = Math.round(monthlyContribution * elapsed * 100) / 100;

      // All adjustments (savings_transactions)
      const transactions = db
        .prepare('SELECT * FROM savings_transactions WHERE user_id = ? ORDER BY date DESC, id DESC')
        .all(userId) as SavingsTransactionRow[];

      const adjustmentsSum = transactions.reduce((sum, t) => sum + t.amount, 0);

      const currentBalance = Math.round((initialBalance + totalContributions + adjustmentsSum) * 100) / 100;

      // Projection: next 12 months
      const now = new Date();
      const projection: Array<{ year: number; month: number; balance: number }> = [];
      for (let i = 1; i <= 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        projection.push({
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          balance: Math.round((currentBalance + monthlyContribution * i) * 100) / 100,
        });
      }

      res.json({
        initial_balance: initialBalance,
        initial_balance_date: initialDate,
        monthly_contribution: Math.round(monthlyContribution * 100) / 100,
        total_contributions: totalContributions,
        adjustments_sum: Math.round(adjustmentsSum * 100) / 100,
        current_balance: currentBalance,
        sparen_expenses: sparenExpenses,
        transactions,
        projection,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // --- Savings Transactions (Entnahmen & Korrekturen) ---

  router.get('/transactions', (req: Request, res: Response) => {
    try {
      const rows = db
        .prepare('SELECT * FROM savings_transactions WHERE user_id = ? ORDER BY date DESC, id DESC')
        .all(req.user!.id) as SavingsTransactionRow[];
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/transactions', (req: Request, res: Response) => {
    try {
      const { amount, date, description } = req.body as {
        amount: number;
        date: string;
        description?: string;
      };
      if (amount == null || !date) {
        res.status(400).json({ error: 'amount and date are required' });
        return;
      }
      const result = db
        .prepare('INSERT INTO savings_transactions (user_id, amount, date, description) VALUES (?, ?, ?, ?)')
        .run(req.user!.id, amount, date, description ?? null);
      const row = db
        .prepare('SELECT * FROM savings_transactions WHERE id = ?')
        .get(result.lastInsertRowid) as SavingsTransactionRow;
      res.status(201).json(row);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/transactions/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM savings_transactions WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as SavingsTransactionRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }
      db.prepare('DELETE FROM savings_transactions WHERE id = ?').run(id);
      res.json({ message: 'Transaction deleted' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
