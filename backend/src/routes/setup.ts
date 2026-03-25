import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { seedDefaultCategories } from '../db/migrations';

interface UserRow {
  id: number;
  username: string;
  email: string;
  is_admin: number;
  language: string;
  currency: string;
  onboarding_done: number;
}

function makeToken(user: { id: number; username: string; is_admin: number }): string {
  const secret = process.env.SECRET_KEY;
  if (!secret) throw new Error('Missing SECRET_KEY');
  return jwt.sign(
    { id: user.id, username: user.username, is_admin: user.is_admin },
    secret,
    { expiresIn: '7d' }
  );
}

export function createSetupRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/status', (_req: Request, res: Response) => {
    try {
      const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
      res.json({ setupRequired: cnt === 0 });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/init', (req: Request, res: Response) => {
    try {
      const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
      if (cnt > 0) {
        res.status(403).json({ error: 'Setup already completed' });
        return;
      }

      const { username, email, password, language, currency } = req.body as {
        username: string;
        email: string;
        password: string;
        language?: string;
        currency?: string;
      };

      if (!username || !email || !password) {
        res.status(400).json({ error: 'username, email, and password are required' });
        return;
      }
      if (username.length < 3) {
        res.status(400).json({ error: 'Username must be at least 3 characters' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }

      const lang = language || 'de';
      const curr = currency || 'EUR';
      const passwordHash = bcrypt.hashSync(password, 12);

      const result = db
        .prepare('INSERT INTO users (username, email, password_hash, is_admin, language, currency) VALUES (?, ?, ?, 1, ?, ?)')
        .run(username, email, passwordHash, lang, curr);

      const userId = result.lastInsertRowid as number;
      seedDefaultCategories(db, userId);

      const upsert = db.prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      );
      upsert.run('default_language', lang);
      upsert.run('default_currency', curr);

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
      const token = makeToken(user);

      res.status(201).json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_admin: user.is_admin,
          language: user.language,
          currency: user.currency,
          onboarding_done: user.onboarding_done === 1
        }
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
