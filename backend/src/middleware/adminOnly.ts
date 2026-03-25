import { Request, Response, NextFunction } from 'express';

export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.is_admin !== 1) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
