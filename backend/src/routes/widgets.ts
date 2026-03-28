import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';

interface WidgetPrefRow {
  user_id: number;
  widget_key: string;
  visible: number;
}

const DEFAULT_WIDGETS = ['healthScore', 'budget', 'freeMoney', 'upcomingBookings', 'savingsProgress'];

export function createWidgetsRouter(db: Database.Database): Router {
  const router = Router();
  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response) => {
    try {
      const rows = db
        .prepare('SELECT * FROM widget_preferences WHERE user_id = ?')
        .all(req.user!.id) as WidgetPrefRow[];
      const prefs: Record<string, boolean> = {};
      DEFAULT_WIDGETS.forEach(k => { prefs[k] = true; });
      rows.forEach(r => { prefs[r.widget_key] = r.visible === 1; });
      res.json(prefs);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/:key', (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      const { visible } = req.body as { visible: boolean };
      db.prepare(
        'INSERT INTO widget_preferences (user_id, widget_key, visible) VALUES (?,?,?) ON CONFLICT(user_id,widget_key) DO UPDATE SET visible=excluded.visible'
      ).run(req.user!.id, key, visible ? 1 : 0);
      res.json({ widget_key: key, visible });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
