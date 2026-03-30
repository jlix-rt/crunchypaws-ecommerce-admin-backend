import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { AppError } from '../middlewares/error.js';
import { sendVerificationEmail } from '../utils/email.js';

const STAFF: UserRole[] = ['ADMIN', 'SELLER', 'COLLABORATOR'];
const SALT = 10;

function generateUserCode(): string {
  const n = parseInt(randomBytes(3).toString('hex'), 16) % 1_000_000;
  return `CP-${String(n).padStart(6, '0')}`;
}

async function generateUniqueUserCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateUserCode();
    const exists = await (prisma.user as any).findUnique({ where: { userCode: code } });
    if (!exists) return code;
  }
  throw new AppError(500, 'No se pudo generar un código de usuario único');
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !STAFF.includes(user.role)) {
    throw new AppError(401, 'Credenciales inválidas');
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError(401, 'Credenciales inválidas');
  if (!user.isVerified) {
    throw new AppError(403, 'Debes verificar tu correo antes de iniciar sesión');
  }
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: '8h' },
  );
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  };
}

export async function register(email: string, password: string, fullName: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(400, 'El correo ya está registrado');
  const userCode = await generateUniqueUserCode();
  const hash = await bcrypt.hash(password, SALT);
  const verificationToken = randomBytes(32).toString('hex');
  await (prisma.user as any).create({
    data: {
      email,
      userCode,
      passwordHash: hash,
      fullName,
      alias: null,
      role: 'COLLABORATOR',
      isVerified: false,
      verificationToken,
    } as any,
  });
  await sendVerificationEmail(email, verificationToken);
  return { message: 'Revisa tu correo para verificar tu cuenta.' };
}

export async function verifyEmail(token: string) {
  if (!token) throw new AppError(400, 'Token requerido');
  const user = await prisma.user.findFirst({ where: { verificationToken: token } });
  if (!user) throw new AppError(400, 'Enlace inválido');
  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, verificationToken: null },
  });
  return { ok: true, message: 'Cuenta verificada.' };
}
