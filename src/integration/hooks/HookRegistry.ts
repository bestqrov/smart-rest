// ─── SmartSuite OS — Hook Registry ───────────────────────────────────────────
// Lifecycle hooks that modules can register on platform events.
// Hooks run in registration order, non-blocking failures are swallowed.

export type HookEvent =
  | 'beforeCreate'
  | 'afterCreate'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'beforeDelete'
  | 'afterDelete'
  | 'beforeEvaluate'
  | 'afterEvaluate'
  | 'beforeApprove'
  | 'afterApprove'
  | 'beforeSuspend'
  | 'afterSuspend'

export interface HookContext {
  event:      HookEvent
  entityType: string
  entityId?:  string
  tenantId?:  string
  actor?:     string
  payload:    Record<string, unknown>
}

export interface RegisteredHook {
  id:       string
  moduleId: string
  event:    HookEvent
  entity:   string  // '*' = all entities
  phase:    'before' | 'after'
  priority: number  // lower = runs first
  handler(ctx: HookContext): Promise<void>
}

// ─── Singleton Hook Store ─────────────────────────────────────────────────────

const hooks: RegisteredHook[] = []

export function registerHook(hook: RegisteredHook): void {
  const existing = hooks.findIndex(h => h.id === hook.id)
  if (existing >= 0) {
    hooks[existing] = hook
  } else {
    hooks.push(hook)
  }
  // Keep sorted by priority
  hooks.sort((a, b) => a.priority - b.priority)
}

export function getHooks(event: HookEvent, entity: string): RegisteredHook[] {
  return hooks.filter(
    h => h.event === event && (h.entity === '*' || h.entity === entity)
  )
}

export function listHooks(): RegisteredHook[] {
  return [...hooks]
}

export function removeHooks(moduleId: string): void {
  for (let i = hooks.length - 1; i >= 0; i--) {
    if (hooks[i].moduleId === moduleId) hooks.splice(i, 1)
  }
}

// ─── Run hooks ────────────────────────────────────────────────────────────────
// Returns true if all before-hooks passed (none threw).
// After-hooks run in background — failures are swallowed.

export async function runHooks(ctx: HookContext): Promise<boolean> {
  const phase    = ctx.event.startsWith('before') ? 'before' : 'after'
  const relevant = getHooks(ctx.event, ctx.entityType)
  const matching = relevant.filter(h => h.phase === phase)

  if (phase === 'before') {
    for (const hook of matching) {
      try {
        await hook.handler(ctx)
      } catch (err) {
        // before-hooks can veto by throwing — propagate
        throw err
      }
    }
    return true
  }

  // after-hooks: run all, swallow errors
  for (const hook of matching) {
    hook.handler(ctx).catch(() => undefined)
  }
  return true
}
