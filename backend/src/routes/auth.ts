import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { seedDefaultCategories } from '../db/migrations';
import { authMiddleware } from '../middleware/auth';

interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  is_admin: number;
  language: string;
  currency: string;
  onboarding_done: number;
}

interface SettingRow {
  value: string;
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

export function createAuthRouter(db: Database.Database): Router {
  const router = Router();

  router.post('/register', (req: Request, res: Response) => {
    try {
      const { username, email, password } = req.body as {
        username: string;
        email: string;
        password: string;
      };

      if (!username || !email || !password) {
        res.status(400).json({ error: 'username, email, and password are required' });
        return;
      }

      const existing = db
        .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
        .get(username, email);
      if (existing) {
        res.status(409).json({ error: 'Username or email already taken' });
        return;
      }

      const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
      const isAdmin = userCount === 0 ? 1 : 0;

      const passwordHash = bcrypt.hashSync(password, 12);
      const result = db
        .prepare(
          'INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)'
        )
        .run(username, email, passwordHash, isAdmin);

      const userId = result.lastInsertRowid as number;
      seedDefaultCategories(db, userId);

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
      const token = makeToken(user);

      res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin, language: user.language, currency: user.currency, onboarding_done: user.onboarding_done === 1 } });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/login', (req: Request, res: Response) => {
    try {
      const { username, password } = req.body as { username: string; password: string };

      if (!username || !password) {
        res.status(400).json({ error: 'username and password are required' });
        return;
      }

      const user = db
        .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
        .get(username, username) as UserRow | undefined;

      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = makeToken(user);
      res.json({ token, user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin, language: user.language, currency: user.currency, onboarding_done: user.onboarding_done === 1 } });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/logout', (_req: Request, res: Response) => {
    res.json({ message: 'Logged out' });
  });

  router.get('/me', authMiddleware, (req: Request, res: Response) => {
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

  router.get('/oidc/config', (req: Request, res: Response) => {
    try {
      const enabled = db
        .prepare("SELECT value FROM settings WHERE key = 'oidc_enabled'")
        .get() as SettingRow | undefined;

      if (!enabled || enabled.value !== 'true') {
        res.json({ enabled: false });
        return;
      }

      const clientId = db
        .prepare("SELECT value FROM settings WHERE key = 'oidc_client_id'")
        .get() as SettingRow | undefined;
      const issuer = db
        .prepare("SELECT value FROM settings WHERE key = 'oidc_issuer'")
        .get() as SettingRow | undefined;
      const redirectUri = db
        .prepare("SELECT value FROM settings WHERE key = 'oidc_redirect_uri'")
        .get() as SettingRow | undefined;

      res.json({
        enabled: true,
        client_id: clientId?.value,
        issuer: issuer?.value,
        redirect_uri: redirectUri?.value,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/oidc/callback', async (req: Request, res: Response) => {
    try {
      const enabledRow = db
        .prepare("SELECT value FROM settings WHERE key = 'oidc_enabled'")
        .get() as SettingRow | undefined;

      if (!enabledRow || enabledRow.value !== 'true') {
        res.status(400).json({ error: 'OIDC not enabled' });
        return;
      }

      const { Issuer } = await import('openid-client');

      const issuerRow = db
        .prepare("SELECT value FROM settings WHERE key = 'oidc_issuer'")
        .get() as SettingRow | undefined;
      const clientIdRow = db
        .prepare("SELECT value FROM settings WHERE key = 'oidc_client_id'")
        .get() as SettingRow | undefined;
      const clientSecretRow = db
        .prepare("SELECT value FROM settings WHERE key = 'oidc_client_secret'")
        .get() as SettingRow | undefined;
      const redirectUriRow = db
        .prepare("SELECT value FROM settings WHERE key = 'oidc_redirect_uri'")
        .get() as SettingRow | undefined;

      if (!issuerRow || !clientIdRow || !clientSecretRow || !redirectUriRow) {
        res.status(500).json({ error: 'OIDC settings incomplete' });
        return;
      }

      const discoveredIssuer = await Issuer.discover(issuerRow.value);
      const client = new discoveredIssuer.Client({
        client_id: clientIdRow.value,
        client_secret: clientSecretRow.value,
        redirect_uris: [redirectUriRow.value],
        response_types: ['code'],
      });

      const params = client.callbackParams(req);
      const tokenSet = await client.callback(redirectUriRow.value, params);
      const userinfo = await client.userinfo(tokenSet);

      const email = userinfo.email as string;
      const username = (userinfo.preferred_username as string | undefined) || email.split('@')[0];

      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;

      if (!user) {
        const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
        const isAdmin = userCount === 0 ? 1 : 0;
        const result = db
          .prepare('INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)')
          .run(username, email, '', isAdmin);
        const userId = result.lastInsertRowid as number;
        seedDefaultCategories(db, userId);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
      }

      const token = makeToken(user);
      res.json({ token, user: { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin, language: user.language, currency: user.currency, onboarding_done: user.onboarding_done === 1 } });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
