import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';

interface OverrideRow {
  id: number;
  user_id: number;
  booking_type: 'income' | 'expense';
  booking_id: number;
  month: string;
  override_amount: number;
}

export function createOverridesRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response) => {
    try {
      const { booking_type, booking_id } = req.query as {
        booking_type?: string;
        booking_id?: string;
      };
      let query = 'SELECT * FROM booking_overrides WHERE user_id = ?';
      const params: (string | number)[] = [req.user!.id];
      if (booking_type) { query += ' AND booking_type = ?'; params.push(booking_type); }
      if (booking_id) { query += ' AND booking_id = ?'; params.push(parseInt(booking_id, 10)); }
      query += ' ORDER BY month ASC';
      const rows = db.prepare(query).all(...params) as OverrideRow[];
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/', (req: Request, res: Response) => {
    try {
      const { booking_type, booking_id, month, override_amount } = req.body as {
        booking_type: 'income' | 'expense';
        booking_id: number;
        month: string;
        override_amount: number;
      };
      if (!booking_type || booking_id == null || !month || override_amount == null) {
        res.status(400).json({ error: 'booking_type, booking_id, month, override_amount are required' });
        return;
      }
      db.prepare(
        `INSERT INTO booking_overrides (user_id, booking_type, booking_id, month, override_amount)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(booking_type, booking_id, month) DO UPDATE SET override_amount = excluded.override_amount`
      ).run(req.user!.id, booking_type, booking_id, month, override_amount);
      const row = db
        .prepare('SELECT * FROM booking_overrides WHERE booking_type = ? AND booking_id = ? AND month = ?')
        .get(booking_type, booking_id, month) as OverrideRow;
      res.status(201).json(row);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM booking_overrides WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as OverrideRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Override not found' });
        return;
      }
      db.prepare('DELETE FROM booking_overrides WHERE id = ?').run(id);
      res.json({ message: 'Override deleted' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
