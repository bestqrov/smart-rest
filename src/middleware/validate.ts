import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

/**
 * Zod request body validation middleware.
 * Usage: router.post('/path', validate(MySchema), handler)
 * On failure returns 400 with structured error list.
 * On success replaces req.body with the parsed (coerced + stripped) value.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const issues = (result.error as ZodError).issues.map((i) => ({
        field:   i.path.join('.'),
        message: i.message,
      }))
      res.status(400).json({ error: 'Validation failed', details: issues })
      return
    }
    req.body = result.data
    next()
  }
}
