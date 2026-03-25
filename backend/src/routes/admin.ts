import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';
import { adminOnly } from '../middleware/adminOnly';
import { sendEmail } from '../services/emailService';

interface SettingRow {
  key: string;
  value: string;
}

interface UserRow {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  language: string;
  currency: string;
  created_at: string;
}

export function createAdminRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware, adminOnly);

  router.get('/settings', (req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT key, value FROM settings').all() as SettingRow[];
      const result: Record<string, string> = {};
      for (const row of rows) {
        result[row.key] = row.value;
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/settings', (req: Request, res: Response) => {
    try {
      const settings = req.body as Record<string, string>;
      const upsert = db.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      );
      const upsertMany = db.transaction((entries: Array<[string, string]>) => {
        for (const [key, value] of entries) {
          upsert.run(key, value);
        }
      });
      upsertMany(Object.entries(settings));
      res.json({ message: 'Settings saved' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/settings/test-email', async (req: Request, res: Response) => {
    try {
      const { to } = req.body as { to: string };
      if (!to) {
        res.status(400).json({ error: 'to email is required' });
        return;
      }
      await sendEmail(db, to, 'HELFINANCE Test Email', '<p>SMTP is configured correctly.</p>');
      res.json({ message: 'Test email sent' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/users', (req: Request, res: Response) => {
    try {
      const users = db
        .prepare('SELECT id, username, email, is_admin, language, currency, created_at FROM users')
        .all() as UserRow[];
      res.json(users);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/users/:id', (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { toggle_admin, reset_password } = req.body as {
        toggle_admin?: boolean;
        reset_password?: string;
      };

      if (toggle_admin !== undefined) {
        if (userId === req.user!.id) {
          res.status(400).json({ error: 'Cannot change your own admin flag' });
          return;
        }
        const u = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId) as { is_admin: number } | undefined;
        if (!u) { res.status(404).json({ error: 'User not found' }); return; }
        db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(u.is_admin === 1 ? 0 : 1, userId);
      }

      if (reset_password !== undefined) {
        if (reset_password.length < 8) {
          res.status(400).json({ error: 'Password must be at least 8 characters' });
          return;
        }
        const hash = bcrypt.hashSync(reset_password, 12);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
      }

      res.json({ message: 'User updated' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/users/:id', (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (userId === req.user!.id) {
        res.status(400).json({ error: 'Cannot delete your own account' });
        return;
      }
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      res.json({ message: 'User deleted' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
