import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';

interface CategoryRow {
  id: number;
  user_id: number;
  name: string;
  icon: string;
  color: string;
  is_default: number;
  sort_order: number;
  budget_limit: number | null;
}

export function createCategoriesRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response) => {
    try {
      const categories = db
        .prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order ASC, id ASC')
        .all(req.user!.id) as CategoryRow[];
      res.json(categories);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/', (req: Request, res: Response) => {
    try {
      const { name, icon, color, sort_order } = req.body as {
        name: string;
        icon?: string;
        color?: string;
        sort_order?: number;
      };
      if (!name) {
        res.status(400).json({ error: 'name is required' });
        return;
      }
      const result = db
        .prepare('INSERT INTO categories (user_id, name, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(req.user!.id, name, icon ?? '💰', color ?? '#6366f1', sort_order ?? 0);
      const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid) as CategoryRow;
      res.status(201).json(category);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/:id', (req: Request, res: Response) => {
    try {
      const catId = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?')
        .get(catId, req.user!.id) as CategoryRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }
      const { name, icon, color, sort_order } = req.body as {
        name?: string;
        icon?: string;
        color?: string;
        sort_order?: number;
      };
      const { budget_limit } = req.body as { budget_limit?: number | null };
      db.prepare(
        'UPDATE categories SET name = COALESCE(?, name), icon = COALESCE(?, icon), color = COALESCE(?, color), sort_order = COALESCE(?, sort_order), budget_limit = ? WHERE id = ?'
      ).run(name ?? null, icon ?? null, color ?? null, sort_order ?? null, budget_limit !== undefined ? budget_limit : existing.budget_limit ?? null, catId);
      const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId) as CategoryRow;
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const catId = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?')
        .get(catId, req.user!.id) as CategoryRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }
      db.prepare('DELETE FROM categories WHERE id = ?').run(catId);
      res.json({ message: 'Category deleted' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
