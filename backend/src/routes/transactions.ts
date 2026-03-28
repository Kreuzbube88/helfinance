import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { authMiddleware } from '../middleware/auth';

interface TransactionRow {
  id: number;
  user_id: number;
  name: string;
  amount: number;
  type: 'income' | 'expense';
  category_id: number | null;
  date: string;
  note: string | null;
}

export function createTransactionsRouter(db: Database.Database): Router {
  const router = Router();
  router.use(authMiddleware);

  router.get('/', (req: Request, res: Response) => {
    try {
      const rows = db
        .prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC')
        .all(req.user!.id) as TransactionRow[];
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.post('/', (req: Request, res: Response) => {
    try {
      const { name, amount, type, category_id, date, note } = req.body as {
        name: string;
        amount: number;
        type: 'income' | 'expense';
        category_id?: number | null;
        date: string;
        note?: string;
      };
      if (!name || amount == null || !type || !date) {
        res.status(400).json({ error: 'name, amount, type and date are required' });
        return;
      }
      const result = db
        .prepare('INSERT INTO transactions (user_id, name, amount, type, category_id, date, note) VALUES (?,?,?,?,?,?,?)')
        .run(req.user!.id, name, amount, type, category_id ?? null, date, note ?? null);
      const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid) as TransactionRow;
      res.status(201).json(row);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.put('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, req.user!.id) as TransactionRow | undefined;
      if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
      const { name, amount, type, category_id, date, note } = req.body as Partial<TransactionRow>;
      db.prepare(
        'UPDATE transactions SET name=COALESCE(?,name), amount=COALESCE(?,amount), type=COALESCE(?,type), category_id=?, date=COALESCE(?,date), note=? WHERE id=?'
      ).run(name ?? null, amount ?? null, type ?? null, category_id ?? null, date ?? null, note ?? null, id);
      res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id));
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, req.user!.id);
      if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
      db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
      res.status(204).end();
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // V4: CSV import
  router.post('/import', (req: Request, res: Response) => {
    try {
      const { csv } = req.body as { csv: string };
      if (!csv) { res.status(400).json({ error: 'csv field required' }); return; }

      const lines = csv.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      const insert = db.prepare('INSERT INTO transactions (user_id, name, amount, type, date) VALUES (?,?,?,?,?)');
      let imported = 0;
      const errors: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p: string) => p.trim());
        if (parts.length < 4) { errors.push(`Line ${i + 1}: expected date,amount,name,type`); continue; }
        const [date, amountStr, name, type] = parts;
        const amount = parseFloat(amountStr);
        if (isNaN(amount)) { errors.push(`Line ${i + 1}: invalid amount`); continue; }
        if (type !== 'income' && type !== 'expense') { errors.push(`Line ${i + 1}: type must be income or expense`); continue; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push(`Line ${i + 1}: date must be YYYY-MM-DD`); continue; }
        insert.run(req.user!.id, name, amount, type, date);
        imported++;
      }

      res.json({ imported, errors });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
