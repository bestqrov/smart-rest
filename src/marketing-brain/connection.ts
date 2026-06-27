/**
 * Marketing Brain — Mongoose connection
 *
 * Uses the same DATABASE_URL as Prisma but manages its own connection pool.
 * Mongoose and Prisma coexist on the same Atlas cluster without conflict
 * because they operate on different collections under different namespaces.
 *
 * Call connect() once at server startup before any model operations.
 * The connection is a singleton — calling connect() multiple times is safe.
 */

import mongoose from 'mongoose'
import logger from '../logger'

let _connected = false

export async function connect(): Promise<void> {
  if (_connected || mongoose.connection.readyState === 1) return

  const uri = process.env.DATABASE_URL
  if (!uri) throw new Error('DATABASE_URL is not set — cannot connect Marketing Brain')

  await mongoose.connect(uri, {
    dbName:              'marketing_brain',
    serverSelectionTimeoutMS: 5000,
    maxPoolSize:         10,
  })

  _connected = true
  logger.info({ msg: '[MarketingBrain] Mongoose connected', db: 'marketing_brain' })
}

export async function disconnect(): Promise<void> {
  if (!_connected) return
  await mongoose.disconnect()
  _connected = false
  logger.info({ msg: '[MarketingBrain] Mongoose disconnected' })
}

export { mongoose }
