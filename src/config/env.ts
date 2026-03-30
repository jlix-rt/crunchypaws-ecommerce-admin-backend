import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing env: ${name}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  /** Peticiones HTTP en consola (morgan). Desactivar: HTTP_LOG=0 */
  httpLog: !['0', 'false', 'no', 'off'].includes((process.env.HTTP_LOG ?? '').toLowerCase()),
  port: parseInt(process.env.PORT ?? '4001', 10),
  databaseUrl: req('DATABASE_URL'),
  jwtSecret: req('JWT_SECRET'),
  emailHost: process.env.EMAIL_HOST ?? '',
  emailPort: parseInt(process.env.EMAIL_PORT ?? '587', 10),
  emailUser: process.env.EMAIL_USER ?? '',
  emailPass: process.env.EMAIL_PASS ?? '',
  emailFrom: process.env.EMAIL_FROM ?? process.env.EMAIL_USER ?? 'noreply@crunchypaws.local',
  adminFrontendUrl: process.env.ADMIN_FRONTEND_URL ?? 'http://localhost:4201',
  /**
   * Raíz absoluta del admin Angular para enlaces del correo de verificación (`/verificar?token=…`).
   * Si no se define, se usa ADMIN_FRONTEND_URL.
   */
  adminVerificationFrontendBaseUrl: (
    process.env.ADMIN_VERIFICATION_FRONTEND_BASE_URL ??
    process.env.ADMIN_FRONTEND_URL ??
    'http://localhost:4201'
  ).replace(/\/$/, ''),
  publicShopApiUrl: process.env.PUBLIC_SHOP_API_URL ?? 'http://localhost:4000',
  storagePath: path.resolve(
    process.env.STORAGE_PATH ??
      path.join(__dirname, '../../../crunchypaws-ecommerce-backend/uploads'),
  ),
};
