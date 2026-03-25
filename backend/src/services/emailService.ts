import nodemailer from 'nodemailer';
import Database from 'better-sqlite3';

interface SmtpSettings {
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_from?: string;
}

function getSmtpSettings(db: Database.Database): SmtpSettings {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'smtp_%'").all() as Array<{
    key: string;
    value: string;
  }>;
  const settings: SmtpSettings = {};
  for (const row of rows) {
    (settings as Record<string, string>)[row.key] = row.value;
  }
  return settings;
}

export async function sendEmail(
  db: Database.Database,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const smtp = getSmtpSettings(db);

  if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_pass) {
    // SMTP not configured — silently skip
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtp.smtp_host,
    port: parseInt(smtp.smtp_port || '587', 10),
    secure: parseInt(smtp.smtp_port || '587', 10) === 465,
    auth: {
      user: smtp.smtp_user,
      pass: smtp.smtp_pass,
    },
  });

  await transporter.sendMail({
    from: smtp.smtp_from || smtp.smtp_user,
    to,
    subject,
    html,
  });
}
