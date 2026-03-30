import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${env.adminVerificationFrontendBaseUrl}/verificar?token=${encodeURIComponent(token)}`;
  if (!env.emailHost) {
    console.warn('[Admin] SMTP no configurado. Verificación:', link);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: env.emailHost,
    port: env.emailPort,
    secure: env.emailPort === 465,
    auth:
      env.emailUser && env.emailPass ? { user: env.emailUser, pass: env.emailPass } : undefined,
  });
  await transporter.sendMail({
    from: env.emailFrom,
    to,
    subject: 'Verifica tu cuenta — CrunchyPaws Admin',
    text: `Verifica tu cuenta: ${link}`,
    html: `<p><a href="${link}">Verificar cuenta</a></p>`,
  });
}
