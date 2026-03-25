import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import PDFDocument from 'pdfkit';
import { authMiddleware } from '../middleware/auth';
import { normalizeToMonthly } from '../services/financeCalc';

interface IncomeRow {
  id: number;
  name: string;
  amount: number;
  interval: string;
}

interface ExpenseRow {
  id: number;
  name: string;
  amount: number;
  interval_months: number;
  category_id: number | null;
}

interface CategoryRow {
  id: number;
  name: string;
}

export function createExportRouter(db: Database.Database): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/pdf', (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;

      const incomes = db.prepare('SELECT * FROM income WHERE user_id = ?').all(userId) as IncomeRow[];
      const expenses = db.prepare('SELECT * FROM expenses WHERE user_id = ?').all(userId) as ExpenseRow[];
      const categories = db.prepare('SELECT * FROM categories WHERE user_id = ?').all(userId) as CategoryRow[];

      const categoryMap = new Map<number, string>(categories.map((c) => [c.id, c.name]));

      const monthlyIncome = incomes.reduce((sum, i) => {
        if (i.interval === 'monthly') return sum + i.amount;
        if (i.interval === 'yearly') return sum + i.amount / 12;
        return sum;
      }, 0);

      const monthlyExpenses = expenses.reduce((sum, e) => {
        return sum + normalizeToMonthly(e.amount, e.interval_months);
      }, 0);

      const doc = new PDFDocument({ margin: 50 });
      const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="helfinance_${year}_${String(month).padStart(2, '0')}.pdf"`);
      doc.pipe(res);

      doc.fontSize(20).text('HELFINANCE Financial Report', { align: 'center' });
      doc.fontSize(14).text(`${monthName} ${year}`, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(16).text('Summary', { underline: true });
      doc.fontSize(12);
      doc.text(`Total Monthly Income: ${monthlyIncome.toFixed(2)} EUR`);
      doc.text(`Total Monthly Expenses: ${monthlyExpenses.toFixed(2)} EUR`);
      doc.text(`Net Savings: ${(monthlyIncome - monthlyExpenses).toFixed(2)} EUR`);
      doc.moveDown();

      doc.fontSize(16).text('Income', { underline: true });
      doc.fontSize(12);
      for (const inc of incomes) {
        const monthly = inc.interval === 'monthly' ? inc.amount : inc.interval === 'yearly' ? inc.amount / 12 : 0;
        doc.text(`${inc.name}: ${inc.amount.toFixed(2)} EUR (${inc.interval}) — Monthly: ${monthly.toFixed(2)} EUR`);
      }
      doc.moveDown();

      doc.fontSize(16).text('Expenses', { underline: true });
      doc.fontSize(12);
      for (const exp of expenses) {
        const catName = exp.category_id ? categoryMap.get(exp.category_id) ?? 'Unknown' : 'Uncategorized';
        const monthly = normalizeToMonthly(exp.amount, exp.interval_months);
        doc.text(`${exp.name} [${catName}]: ${exp.amount.toFixed(2)} EUR (every ${exp.interval_months} month(s)) — Monthly: ${monthly.toFixed(2)} EUR`);
      }

      doc.end();
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  router.get('/csv', (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
      const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;

      const incomes = db.prepare('SELECT * FROM income WHERE user_id = ?').all(userId) as IncomeRow[];
      const expenses = db.prepare('SELECT * FROM expenses WHERE user_id = ?').all(userId) as ExpenseRow[];
      const categories = db.prepare('SELECT * FROM categories WHERE user_id = ?').all(userId) as CategoryRow[];

      const categoryMap = new Map<number, string>(categories.map((c) => [c.id, c.name]));

      const escape = (val: string | number): string => {
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const lines: string[] = [];
      lines.push('Type,Name,Amount,Interval,MonthlyAmount,Category');

      for (const inc of incomes) {
        const monthly = inc.interval === 'monthly' ? inc.amount : inc.interval === 'yearly' ? inc.amount / 12 : 0;
        lines.push([escape('income'), escape(inc.name), escape(inc.amount), escape(inc.interval), escape(monthly.toFixed(2)), escape('')].join(','));
      }

      for (const exp of expenses) {
        const catName = exp.category_id ? categoryMap.get(exp.category_id) ?? '' : '';
        const monthly = normalizeToMonthly(exp.amount, exp.interval_months);
        lines.push([escape('expense'), escape(exp.name), escape(exp.amount), escape(`every_${exp.interval_months}m`), escape(monthly.toFixed(2)), escape(catName)].join(','));
      }

      const csv = lines.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="helfinance_${year}_${String(month).padStart(2, '0')}.csv"`);
      res.send(csv);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return router;
}
