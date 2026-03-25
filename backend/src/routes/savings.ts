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
}

export function createSavingsRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response) => {
    try {
      const rows = db
        .prepare('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY id ASC')
        .all(req.user!.id) as SavingsGoalRow[];
      res.json(rows);
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
      } = req.body as {
        name: string;
        target_amount: number;
        current_amount?: number;
        contribution_mode?: string;
        fixed_amount?: number;
        dynamic_buffer_amount?: number;
        color?: string;
      };
      if (!name || target_amount == null) {
        res.status(400).json({ error: 'name and target_amount are required' });
        return;
      }
      const result = db
        .prepare(
          `INSERT INTO savings_goals
            (user_id, name, target_amount, current_amount, contribution_mode, fixed_amount, dynamic_buffer_amount, color)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.user!.id,
          name,
          target_amount,
          current_amount ?? 0,
          contribution_mode ?? 'fixed',
          fixed_amount ?? 0,
          dynamic_buffer_amount ?? 0,
          color ?? '#10b981'
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
      } = req.body as {
        name?: string;
        target_amount?: number;
        current_amount?: number;
        contribution_mode?: string;
        fixed_amount?: number;
        dynamic_buffer_amount?: number;
        color?: string;
      };
      db.prepare(
        `UPDATE savings_goals SET
          name = COALESCE(?, name),
          target_amount = COALESCE(?, target_amount),
          current_amount = COALESCE(?, current_amount),
          contribution_mode = COALESCE(?, contribution_mode),
          fixed_amount = COALESCE(?, fixed_amount),
          dynamic_buffer_amount = COALESCE(?, dynamic_buffer_amount),
          color = COALESCE(?, color)
        WHERE id = ?`
      ).run(
        name ?? null,
        target_amount ?? null,
        current_amount ?? null,
        contribution_mode ?? null,
        fixed_amount ?? null,
        dynamic_buffer_amount ?? null,
        color ?? null,
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

  return router;
}
