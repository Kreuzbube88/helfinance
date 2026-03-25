import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  id: number;
  username: string;
  is_admin: number;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  // Also accept token as query param for download endpoints
  const queryToken = req.query.token as string | undefined;
  if (!header && !queryToken) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken ?? '';
  const secret = process.env.SECRET_KEY;
  if (!secret) {
    res.status(500).json({ error: 'Server misconfiguration: missing SECRET_KEY' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = { id: payload.id, username: payload.username, is_admin: payload.is_admin };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
