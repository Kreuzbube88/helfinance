import Database from 'better-sqlite3';
import path from 'path';
import { runMigrations } from './migrations';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || '/data/helfinance.db';
    const resolvedPath = path.resolve(dbPath);
    db = new Database(resolvedPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

export default getDb;
