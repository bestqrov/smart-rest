// Centralized config - fail fast if required secrets are missing in production
export const JWT_SECRET = process.env.JWT_SECRET ?? (() => {
  throw new Error('Missing required env: JWT_SECRET')
})()

export const DATABASE_URL = process.env.DATABASE_URL ?? null

export default { JWT_SECRET, DATABASE_URL }
