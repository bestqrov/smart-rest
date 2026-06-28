import type { PageOptions, PagedResult } from '../types'

export function normalizePage(opts: PageOptions = {}): { page: number; limit: number; skip: number } {
  const page  = Math.max(1, opts.page  ?? 1)
  const limit = Math.min(500, Math.max(1, opts.limit ?? 50))
  return { page, limit, skip: (page - 1) * limit }
}

export function pagedResult<T>(
  items:  T[],
  total:  number,
  page:   number,
  limit:  number,
): PagedResult<T> {
  return { items, total, page, pages: Math.ceil(total / limit), limit }
}

export function fromQueryString(q: Record<string, string | undefined>): PageOptions {
  return {
    page:  q.page  ? parseInt(q.page,  10) : undefined,
    limit: q.limit ? parseInt(q.limit, 10) : undefined,
  }
}
