/**
 * MongoDB Change Stream — Product price sync
 *
 * Requirements:
 *  • MongoDB must run as a replica set (even a single-node `rs0`).
 *    Atlas clusters satisfy this automatically.
 *    Self-hosted: start mongod with --replSet rs0 and run rs.initiate() once.
 *  • The native `mongodb` driver is used alongside Prisma because Prisma does
 *    not expose the underlying MongoClient.
 *
 * Behaviour:
 *  When any Product document's `price` field changes the stream fires and
 *  emits `price_updated` to two Socket.io rooms:
 *    • room_{cafeId}       → POS cashier screens
 *    • menu_room_{cafeId}  → Customer QR menu pages
 */

import { MongoClient, ChangeStreamDocument } from 'mongodb'
import { Server as SocketIOServer } from 'socket.io'
import prisma from '../prisma'
import logger from '../logger'

let nativeClient: MongoClient | null = null

// Only watch updates that touch the `price` field
const PRICE_WATCH_PIPELINE = [
  {
    $match: {
      operationType: 'update',
      'updateDescription.updatedFields.price': { $exists: true },
    },
  },
]

export async function initChangeStreams(io: SocketIOServer): Promise<void> {
  const uri = process.env.DATABASE_URL
  if (!uri) {
    logger.warn({ msg: 'DATABASE_URL not set — Change Streams skipped' })
    return
  }

  try {
    nativeClient = new MongoClient(uri)
    await nativeClient.connect()

    const db = nativeClient.db()

    // Derive the correct Prisma collection name (Prisma maps model "Product" → "Product")
    const col = db.collection('Product')

    const stream = col.watch(PRICE_WATCH_PIPELINE, { fullDocument: 'updateLookup' })

    stream.on('change', async (change: ChangeStreamDocument) => {
      try {
        if (change.operationType !== 'update') return
        const doc = (change as any).fullDocument
        if (!doc) return

        const productId  = doc._id.toString()
        const price      = doc.price as number
        const categoryId = doc.categoryId?.toString()

        if (!categoryId || price === undefined) return

        // Resolve cafeId via the category — one cheap indexed lookup
        const category = await prisma.category.findUnique({
          where:  { id: categoryId },
          select: { cafeId: true },
        })
        if (!category) return

        const { cafeId } = category
        const payload = { productId, price, cafeId }

        io.to(`room_${cafeId}`).emit('price_updated', payload)
        io.to(`menu_room_${cafeId}`).emit('price_updated', payload)

        logger.info({ msg: 'price_updated via change stream', productId, price, cafeId })
      } catch (err) {
        logger.error({ msg: 'change stream handler error', err })
      }
    })

    stream.on('error', (err) => {
      logger.error({ msg: 'Change Stream error', err })
    })

    logger.info({ msg: '✅ MongoDB Change Stream active — watching Product.price' })
  } catch (err: any) {
    // Graceful degradation: if replica set not configured, the route-level
    // price_updated emit (already in menuAdmin.ts) continues to work.
    logger.warn({
      msg: 'Change Streams unavailable — falling back to route-level emit',
      reason: err?.message,
    })
  }
}

export async function closeChangeStreams(): Promise<void> {
  if (nativeClient) {
    await nativeClient.close()
    nativeClient = null
    logger.info({ msg: 'MongoDB native client closed' })
  }
}
