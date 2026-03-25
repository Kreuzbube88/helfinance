import { Database } from 'better-sqlite3';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        is_admin: number;
      };
      db?: Database;
    }
  }
}

export {};
