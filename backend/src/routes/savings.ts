import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';

interface SavingsGoalRow {
  id: number;
  user_id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  contribution_mode: string;
  fixed_amount: number;
  dynamic_buffer_amount: number;
  color: string;
  target_date: string | null;
  priority: number;
}

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

function monthsUntil(targetDate: string): number {
  const now = new Date();
  const target = new Date(targetDate + '-01');
  return Math.max(
    1,
    (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth()
  );
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

  // --- Savings Goals ---

  router.get('/', (req: Request, res: Response) => {
    try {
      const rows = db
        .prepare('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY priority ASC, id ASC')
        .all(req.user!.id) as SavingsGoalRow[];
      const currentBalance = getCurrentBalance(db, req.user!.id);
      const result = rows.map((g) => {
        const remaining = Math.max(0, g.target_amount - currentBalance);
        const required_monthly_saving =
          g.target_date ? Math.round((remaining / monthsUntil(g.target_date)) * 100) / 100 : null;
        return { ...g, required_monthly_saving };
      });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/', (req: Request, res: Response) => {
    try {
      const {
        name,
        target_amount,
        current_amount,
        contribution_mode,
        fixed_amount,
        dynamic_buffer_amount,
        color,
        target_date,
        priority,
      } = req.body as {
        name: string;
        target_amount: number;
        current_amount?: number;
        contribution_mode?: string;
        fixed_amount?: number;
        dynamic_buffer_amount?: number;
        color?: string;
        target_date?: string;
        priority?: number;
      };
      if (!name || target_amount == null) {
        res.status(400).json({ error: 'name and target_amount are required' });
        return;
      }
      const result = db
        .prepare(
          `INSERT INTO savings_goals
            (user_id, name, target_amount, current_amount, contribution_mode, fixed_amount, dynamic_buffer_amount, color, target_date, priority)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.user!.id,
          name,
          target_amount,
          current_amount ?? 0,
          contribution_mode ?? 'fixed',
          fixed_amount ?? 0,
          dynamic_buffer_amount ?? 0,
          color ?? '#10b981',
          target_date ?? null,
          priority ?? 0
        );
      const row = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(result.lastInsertRowid) as SavingsGoalRow;
      res.status(201).json(row);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as SavingsGoalRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Savings goal not found' });
        return;
      }
      const {
        name,
        target_amount,
        current_amount,
        contribution_mode,
        fixed_amount,
        dynamic_buffer_amount,
        color,
        target_date,
        priority,
      } = req.body as {
        name?: string;
        target_amount?: number;
        current_amount?: number;
        contribution_mode?: string;
        fixed_amount?: number;
        dynamic_buffer_amount?: number;
        color?: string;
        target_date?: string | null;
        priority?: number;
      };
      db.prepare(
        `UPDATE savings_goals SET
          name = COALESCE(?, name),
          target_amount = COALESCE(?, target_amount),
          current_amount = COALESCE(?, current_amount),
          contribution_mode = COALESCE(?, contribution_mode),
          fixed_amount = COALESCE(?, fixed_amount),
          dynamic_buffer_amount = COALESCE(?, dynamic_buffer_amount),
          color = COALESCE(?, color),
          target_date = ?,
          priority = COALESCE(?, priority)
        WHERE id = ?`
      ).run(
        name ?? null,
        target_amount ?? null,
        current_amount ?? null,
        contribution_mode ?? null,
        fixed_amount ?? null,
        dynamic_buffer_amount ?? null,
        color ?? null,
        // pass existing value if not provided, else use provided (allows clearing to null)
        target_date !== undefined ? (target_date ?? null) : existing.target_date,
        priority ?? null,
        id
      );
      const updated = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(id) as SavingsGoalRow;
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM savings_goals WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as SavingsGoalRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Savings goal not found' });
        return;
      }
      db.prepare('DELETE FROM savings_goals WHERE id = ?').run(id);
      res.json({ message: 'Savings goal deleted' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

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
