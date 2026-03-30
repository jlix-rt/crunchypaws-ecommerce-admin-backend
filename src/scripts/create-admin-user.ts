import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { randomBytes } from 'crypto';

const email = process.env.ADMIN_EMAIL ?? 'jlrt804@gmail.com';
const password = process.env.ADMIN_PASSWORD ?? 'Reynoso_16';
const fullName = process.env.ADMIN_FULL_NAME ?? 'Admin';

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
  throw new Error('No se pudo generar un user_code único para el admin');
}

async function main() {
  const passwordHash = await bcrypt.hash(password, SALT);
  const userCode = await generateUniqueUserCode();

  const user = await (prisma.user as any).upsert({
    where: { email },
    update: {
      passwordHash,
      fullName,
      role: 'ADMIN',
      isVerified: true,
      verificationToken: null,
      userCode,
      alias: null,
      freeShipping: false,
    },
    create: {
      email,
      passwordHash,
      fullName,
      role: 'ADMIN',
      isVerified: true,
      verificationToken: null,
      userCode,
      alias: null,
      freeShipping: false,
    },
    select: { id: true, email: true, fullName: true, role: true, isVerified: true },
  });

  console.log('Usuario admin listo:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
