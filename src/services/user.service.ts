import bcrypt from 'bcryptjs';
import type { UserRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { prisma } from '../config/db.js';
import { AppError } from '../middlewares/error.js';

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

export async function listUsers() {
  return (prisma.user as any).findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      fullName: true,
      alias: true,
      freeShipping: true,
      role: true,
      isVerified: true,
      createdAt: true,
    } as any,
  });
}

export async function createUser(
  email: string,
  password: string,
  fullName: string,
  role: UserRole,
  isVerified = true,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(400, 'El correo ya existe');
  const passwordHash = await bcrypt.hash(password, SALT);
  const userCode = await generateUniqueUserCode();
  return (prisma.user as any).create({
    data: {
      email,
      passwordHash,
      fullName,
      role,
      isVerified,
      verificationToken: null,
      userCode,
      alias: null,
      freeShipping: false,
    } as any,
    select: {
      id: true,
      email: true,
      fullName: true,
      alias: true,
      freeShipping: true,
      role: true,
      isVerified: true,
    } as any,
  });
}

export async function updateUserRole(userId: string, role: UserRole) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) throw new AppError(404, 'Usuario no encontrado');
  return (prisma.user as any).update({
    where: { id: userId },
    data: { role },
    select: { id: true, email: true, fullName: true, role: true, isVerified: true, alias: true, freeShipping: true } as any,
  });
}

export async function updateUserDetails(
  userId: string,
  input: { alias?: string | null; freeShipping?: boolean | null },
) {
  const u = await (prisma.user as any).findUnique({ where: { id: userId } });
  if (!u) throw new AppError(404, 'Usuario no encontrado');

  const data: { alias?: string | null; freeShipping?: boolean } = {};

  if (input.alias !== undefined) {
    const alias = input.alias?.trim() ?? null;
    if (alias && alias.length < 2) throw new AppError(400, 'Alias demasiado corto');

    if (alias) {
      const existing = await (prisma.user as any).findFirst({
        where: {
          id: { not: userId },
          alias: { equals: alias, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existing) throw new AppError(400, 'Alias ya está en uso');
    }

    data.alias = alias;
  }

  if (input.freeShipping !== undefined && input.freeShipping !== null) {
    data.freeShipping = input.freeShipping;
  }

  return (prisma.user as any).update({
    where: { id: userId },
    data: data as any,
    select: { id: true, email: true, fullName: true, role: true, isVerified: true, alias: true, freeShipping: true } as any,
  });
}
