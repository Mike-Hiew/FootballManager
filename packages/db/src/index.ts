import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export * from './generated/prisma/client';

const globalForPrisma = globalThis as unknown as { __san7Prisma?: PrismaClient };

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL chưa được cấu hình');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Prisma client dùng chung (giữ một instance trong dev để tránh rò kết nối khi HMR). */
export const prisma: PrismaClient = globalForPrisma.__san7Prisma ?? create();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__san7Prisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
export type Db = PrismaClient | Tx;
