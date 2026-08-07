import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const pin = Buffer.concat(chunks).toString('utf8').trim();

if (pin.length < 4 || pin.length > 64) {
  throw new Error('PIN-ul trebuie să conțină între 4 și 64 de caractere.');
}

const prisma = new PrismaClient();
try {
  const passwordHash = await bcrypt.hash(pin, 12);
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe('SET TRANSACTION READ WRITE');
    await transaction.turnAdminCredential.upsert({
      where: { id: 'turn-command-center' },
      create: { id: 'turn-command-center', passwordHash },
      update: { passwordHash, failedAttempts: 0, lockedUntil: null },
    });
  });
  process.stdout.write('PIN_RESET_OK');
} finally {
  await prisma.$disconnect();
}
