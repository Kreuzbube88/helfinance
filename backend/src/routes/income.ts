import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';

interface IncomeRow {
  id: number;
  user_id: number;
  name: string;
  amount: number;
  interval: string;
  booking_day: number;
  effective_from: string | null;
  effective_to: string | null;
}

interface IncomeChangeRow {
  id: number;
  income_id: number;
  new_amount: number;
  effective_from: string;
}

export function createIncomeRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response) => {
    try {
      const rows = db
        .prepare('SELECT * FROM income WHERE user_id = ? ORDER BY id ASC')
        .all(req.user!.id) as IncomeRow[];
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/', (req: Request, res: Response) => {
    try {
      const { name, amount, interval, booking_day, effective_from, effective_to } = req.body as {
        name: string;
        amount: number;
        interval?: string;
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
          'INSERT INTO income (user_id, name, amount, interval, booking_day, effective_from, effective_to) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          req.user!.id,
          name,
          amount,
          interval ?? 'monthly',
          booking_day ?? 1,
          effective_from ?? null,
          effective_to ?? null
        );
      const row = db.prepare('SELECT * FROM income WHERE id = ?').get(result.lastInsertRowid) as IncomeRow;
      res.status(201).json(row);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM income WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as IncomeRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Income not found' });
        return;
      }
      const { name, amount, interval, booking_day, effective_from, effective_to } = req.body as {
        name?: string;
        amount?: number;
        interval?: string;
        booking_day?: number;
        effective_from?: string;
        effective_to?: string;
      };
      db.prepare(
        `UPDATE income SET
          name = COALESCE(?, name),
          amount = COALESCE(?, amount),
          interval = COALESCE(?, interval),
          booking_day = COALESCE(?, booking_day),
          effective_from = COALESCE(?, effective_from),
          effective_to = COALESCE(?, effective_to)
        WHERE id = ?`
      ).run(
        name ?? null,
        amount ?? null,
        interval ?? null,
        booking_day ?? null,
        effective_from ?? null,
        effective_to ?? null,
        id
      );
      const updated = db.prepare('SELECT * FROM income WHERE id = ?').get(id) as IncomeRow;
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM income WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as IncomeRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Income not found' });
        return;
      }
      db.prepare('DELETE FROM income WHERE id = ?').run(id);
      res.json({ message: 'Income deleted' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/:id/changes', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM income WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as IncomeRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Income not found' });
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
        .prepare('INSERT INTO income_changes (income_id, new_amount, effective_from) VALUES (?, ?, ?)')
        .run(id, new_amount, effective_from);
      const change = db
        .prepare('SELECT * FROM income_changes WHERE id = ?')
        .get(result.lastInsertRowid) as IncomeChangeRow;
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
        .prepare('SELECT * FROM income WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as IncomeRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Income not found' });
        return;
      }
      const change = db
        .prepare('SELECT * FROM income_changes WHERE id = ? AND income_id = ?')
        .get(changeId, id) as IncomeChangeRow | undefined;
      if (!change) {
        res.status(404).json({ error: 'Change not found' });
        return;
      }
      db.prepare('DELETE FROM income_changes WHERE id = ?').run(changeId);
      res.json({ message: 'Change deleted' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/:id/changes', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM income WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as IncomeRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Income not found' });
        return;
      }
      const changes = db
        .prepare('SELECT * FROM income_changes WHERE income_id = ? ORDER BY effective_from ASC')
        .all(id) as IncomeChangeRow[];
      res.json(changes);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
