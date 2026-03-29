import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';

interface ExpenseRow {
  id: number;
  user_id: number;
  name: string;
  amount: number;
  interval_months: number;
  category: string | null;
  category_id: number | null;
  booking_day: number;
  effective_from: string | null;
  effective_to: string | null;
}

interface ExpenseChangeRow {
  id: number;
  expense_id: number;
  new_amount: number;
  effective_from: string;
}

// Bug 12: include category_id in mapRow
function mapRow(row: ExpenseRow) {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    amount: row.amount,
    interval_months: row.interval_months,
    category: row.category ?? '',
    category_id: row.category_id ?? null,
    booking_day: row.booking_day,
    effective_from: row.effective_from ?? '',
    effective_to: row.effective_to ?? null,
  };
}

export function createExpensesRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response) => {
    try {
      const rows = db
        .prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY id ASC')
        .all(req.user!.id) as ExpenseRow[];
      res.json(rows.map(mapRow));
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/', (req: Request, res: Response) => {
    try {
      const { name, amount, interval_months, category, category_id, booking_day, effective_from, effective_to } =
        req.body as {
          name: string;
          amount: number;
          interval_months?: number;
          category?: string;
          category_id?: number | null;
          booking_day?: number;
          effective_from?: string;
          effective_to?: string;
        };
      if (!name || amount == null) {
        res.status(400).json({ error: 'name and amount are required' });
        return;
      }
      const result = db
        .prepare(
          'INSERT INTO expenses (user_id, name, amount, interval_months, category, category_id, booking_day, effective_from, effective_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          req.user!.id,
          name,
          amount,
          interval_months ?? 1,
          category ?? null,
          category_id ?? null,
          booking_day ?? 1,
          effective_from ?? null,
          effective_to ?? null
        );
      const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid) as ExpenseRow;
      res.status(201).json(mapRow(row));
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as ExpenseRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }
      const { name, amount, interval_months, category, category_id, booking_day, effective_from, effective_to } =
        req.body as {
          name?: string;
          amount?: number;
          interval_months?: number;
          category?: string;
          category_id?: number | null;
          booking_day?: number;
          effective_from?: string | null;
          effective_to?: string | null;
        };

      // Bug 28: nullable date fields and category_id use direct assignment; only COALESCE non-nullable fields
      db.prepare(
        `UPDATE expenses SET
          name = COALESCE(?, name),
          amount = COALESCE(?, amount),
          interval_months = COALESCE(?, interval_months),
          category = COALESCE(?, category),
          category_id = ?,
          booking_day = COALESCE(?, booking_day),
          effective_from = ?,
          effective_to = ?
        WHERE id = ?`
      ).run(
        name ?? null,
        amount ?? null,
        interval_months ?? null,
        category ?? null,
        category_id !== undefined ? (category_id ?? null) : existing.category_id,
        booking_day ?? null,
        effective_from !== undefined ? (effective_from ?? null) : existing.effective_from,
        effective_to !== undefined ? (effective_to ?? null) : existing.effective_to,
        id
      );

      // Bug 10: delete future auto-transactions so they get regenerated
      db.prepare('DELETE FROM transactions WHERE expense_id = ? AND date >= ? AND is_auto = 1')
        .run(id, new Date().toISOString().slice(0, 10));

      const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as ExpenseRow;
      res.json(mapRow(updated));
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as ExpenseRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }
      // Bug 11: remove all auto-generated transactions before deleting
      db.prepare('DELETE FROM transactions WHERE expense_id = ? AND is_auto = 1').run(id);
      db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
      res.json({ message: 'Expense deleted' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/:id/changes', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as ExpenseRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }
      const { new_amount, effective_from } = req.body as {
        new_amount: number;
        effective_from: string;
      };
      if (new_amount == null || !effective_from) {
        res.status(400).json({ error: 'new_amount and effective_from are required' });
        return;
      }
      const result = db
        .prepare('INSERT INTO expense_changes (expense_id, new_amount, effective_from) VALUES (?, ?, ?)')
        .run(id, new_amount, effective_from);
      const change = db
        .prepare('SELECT * FROM expense_changes WHERE id = ?')
        .get(result.lastInsertRowid) as ExpenseChangeRow;
      res.status(201).json(change);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/:id/changes/:changeId', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const changeId = parseInt(req.params.changeId, 10);
      const existing = db
        .prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as ExpenseRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }
      const change = db
        .prepare('SELECT * FROM expense_changes WHERE id = ? AND expense_id = ?')
        .get(changeId, id) as ExpenseChangeRow | undefined;
      if (!change) {
        res.status(404).json({ error: 'Change not found' });
        return;
      }
      db.prepare('DELETE FROM expense_changes WHERE id = ?').run(changeId);
      res.json({ message: 'Change deleted' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/:id/changes', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as ExpenseRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Expense not found' });
        return;
      }
      const changes = db
        .prepare('SELECT * FROM expense_changes WHERE expense_id = ? ORDER BY effective_from ASC')
        .all(id) as ExpenseChangeRow[];
      res.json(changes);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
