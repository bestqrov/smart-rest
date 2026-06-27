import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { pid: false },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Automatically redact sensitive fields wherever they appear in log objects
  redact: {
    paths: [
      'password', 'passwordHash', 'token', 'refreshToken', 'accessToken',
      'newPassword', 'currentPassword', 'pinCode',
      'err.config.headers.Authorization',
      '*.password', '*.passwordHash', '*.token', '*.refreshToken', '*.pinCode',
    ],
    censor: '[REDACTED]',
  },
})

export default logger
