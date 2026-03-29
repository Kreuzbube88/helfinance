import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';

interface UserRow {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  language: string;
  currency: string;
  onboarding_done: number;
  created_at: string;
  password_hash: string;
}

export function createUsersRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/profile', (req: Request, res: Response) => {
    try {
      const user = db
        .prepare('SELECT id, username, email, is_admin, language, currency, onboarding_done, created_at FROM users WHERE id = ?')
        .get(req.user!.id) as UserRow | undefined;
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ ...user, is_admin: user.is_admin === 1, onboarding_done: user.onboarding_done === 1 });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/profile', (req: Request, res: Response) => {
    try {
      const { username, email, language, currency } = req.body as {
        username?: string;
        email?: string;
        language?: string;
        currency?: string;
      };
      if (username) {
        const conflict = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user!.id);
        if (conflict) { res.status(409).json({ error: 'Username already taken' }); return; }
      }
      if (email) {
        const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user!.id);
        if (conflict) { res.status(409).json({ error: 'Email already taken' }); return; }
      }
      db.prepare('UPDATE users SET username = COALESCE(?, username), email = COALESCE(?, email), language = COALESCE(?, language), currency = COALESCE(?, currency) WHERE id = ?')
        .run(username ?? null, email ?? null, language ?? null, currency ?? null, req.user!.id);
      const user = db
        .prepare('SELECT id, username, email, is_admin, language, currency, onboarding_done, created_at FROM users WHERE id = ?')
        .get(req.user!.id) as UserRow;
      res.json({ ...user, is_admin: user.is_admin === 1, onboarding_done: user.onboarding_done === 1 });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/onboarding-done', (req: Request, res: Response) => {
    try {
      db.prepare('UPDATE users SET onboarding_done = 1 WHERE id = ?').run(req.user!.id);
      res.json({ onboarding_done: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/password', (req: Request, res: Response) => {
    try {
      const { old_password, new_password } = req.body as {
        old_password: string;
        new_password: string;
      };

      if (!old_password || !new_password) {
        res.status(400).json({ error: 'old_password and new_password are required' });
        return;
      }

      if (new_password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }

      const user = db
        .prepare('SELECT password_hash FROM users WHERE id = ?')
        .get(req.user!.id) as UserRow | undefined;

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      if (!bcrypt.compareSync(old_password, user.password_hash)) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }

      const newHash = bcrypt.hashSync(new_password, 12);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user!.id);
      res.json({ message: 'Password updated' });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
