import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';

interface SavingsAccountRow {
  id: number;
  user_id: number;
  initial_balance: number;
}

interface SavingsTransactionRow {
  id: number;
  user_id: number;
  amount: number;
  date: string;
  description: string | null;
  created_at: string;
}

function getCurrentBalance(db: Database.Database, userId: number): number {
  const account = db
    .prepare('SELECT initial_balance FROM savings_accounts WHERE user_id = ?')
    .get(userId) as SavingsAccountRow | undefined;
  const initial = account?.initial_balance ?? 0;
  const txSum = (
    db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM savings_transactions WHERE user_id = ?')
      .get(userId) as { total: number }
  ).total;
  return initial + txSum;
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
      const currentBalance = getCurrentBalance(db, userId);
      res.json({
        initial_balance: account?.initial_balance ?? 0,
        current_balance: Math.round(currentBalance * 100) / 100,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/balance/initial', (req: Request, res: Response) => {
    try {
      const { initial_balance } = req.body as { initial_balance: number };
      if (initial_balance == null) {
        res.status(400).json({ error: 'initial_balance is required' });
        return;
      }
      db.prepare(
        `INSERT INTO savings_accounts (user_id, initial_balance)
         VALUES (?, ?)
         ON CONFLICT(user_id) DO UPDATE SET initial_balance = excluded.initial_balance`
      ).run(req.user!.id, initial_balance);
      res.json({ initial_balance });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // --- Savings Transactions ---

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
