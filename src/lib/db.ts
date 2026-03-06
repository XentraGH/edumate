import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Use absolute path for database to work in both dev and production
const dbDir = path.join(process.cwd(), 'db')
const dbPath = path.join(dbDir, 'custom.db')

// Ensure db directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasourceUrl: `file:${dbPath}`,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

