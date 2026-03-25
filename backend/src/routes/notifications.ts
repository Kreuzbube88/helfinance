import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';

interface NotificationRow {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  read: number;
  created_at: string;
}

export function createNotificationsRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response) => {
    try {
      const rows = db
        .prepare(
          'SELECT * FROM notifications WHERE user_id = ? ORDER BY read ASC, created_at DESC'
        )
        .all(req.user!.id) as NotificationRow[];
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/:id/read', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as NotificationRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }
      db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
      res.json({ message: 'Marked as read' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/read-all', (req: Request, res: Response) => {
    try {
      db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user!.id);
      res.json({ message: 'All notifications marked as read' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db
        .prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?')
        .get(id, req.user!.id) as NotificationRow | undefined;
      if (!existing) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }
      db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
      res.json({ message: 'Notification deleted' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
