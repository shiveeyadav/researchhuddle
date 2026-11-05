// Server-only mailer: Resend (RESEND_API_KEY) or SMTP (SMTP_HOST); otherwise logs to console.

function mailFrom() {
  return process.env.MAIL_FROM || 'ResearchHuddle <no-reply@localhost>';
}

async function sendViaResend({ to, subject, text, html }) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: mailFrom(), to: [to], subject, text, html }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Resend API error ${resp.status}: ${detail.slice(0, 300)}`);
  }
}

let transporter = null;
async function sendViaSmtp({ to, subject, text, html }) {
  if (!transporter) {
    // Required lazily so the dependency is only loaded when SMTP is configured.
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
    });
  }
  await transporter.sendMail({ from: mailFrom(), to, subject, text, html });
}

async function sendMail(msg) {
  if (process.env.RESEND_API_KEY) return sendViaResend(msg);
  if (process.env.SMTP_HOST) return sendViaSmtp(msg);
  console.log(
    `[mailer] (no RESEND_API_KEY/SMTP_HOST set - logging instead of sending)\n` +
      `  To: ${msg.to}\n  Subject: ${msg.subject}\n${String(msg.text || '').replace(/^/gm, '  | ')}`
  );
}

module.exports = { sendMail };
