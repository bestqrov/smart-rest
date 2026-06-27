// Centralized config — fail fast if required secrets are missing in production

const REQUIRED_PROD_VARS = [
  'JWT_SECRET',
  'DATABASE_URL',
  'SUPERADMIN_SECRET',
  'SUPERADMIN_EMAIL',
  'FRONTEND_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'RESEND_API_KEY',
  'INTERNAL_API_SECRET',
]

if (process.env.NODE_ENV === 'production') {
  const missing = REQUIRED_PROD_VARS.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

export const JWT_SECRET = process.env.JWT_SECRET ?? (() => {
  throw new Error('Missing required env: JWT_SECRET')
})()

export const DATABASE_URL = process.env.DATABASE_URL ?? null

export default { JWT_SECRET, DATABASE_URL }
