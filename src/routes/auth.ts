import express, { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { verifyPassword } from '../auth/hash'
import logger from '../logger'
import { JWT_SECRET } from '../config'
import prisma from '../prisma'
const router = express.Router()

const TOKEN_EXPIRY = '8h'

router.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string }
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign({ userId: user.id, cafeId: user.cafeId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY })

    return res.json({ token, userId: user.id, cafeId: user.cafeId })
    } catch (err) {
    logger.error({ msg: 'Login error', err })
    return res.status(500).json({ error: 'Login failed' })
  }
})

export default router
