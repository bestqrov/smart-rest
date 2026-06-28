import crypto from 'crypto'
import type { PlatformEventName, PlatformEvent } from '../types'
import logger from '../../logger'

// ─── Handler registry ─────────────────────────────────────────────────────────

type Handler<T = unknown> = (event: PlatformEvent<T>) => void | Promise<void>

interface Subscription {
  id:      string
  event:   PlatformEventName | '*'
  handler: Handler<any>
}

// ─── EventBus singleton ───────────────────────────────────────────────────────

class EventBus {
  private readonly subs = new Map<string, Subscription>()

  /**
   * Publish a typed platform event.
   * Handlers run concurrently; individual failures are logged but do not block.
   */
  publish<T>(name: PlatformEventName, payload: T, source = 'unknown'): void {
    const event: PlatformEvent<T> = {
      name,
      payload,
      source,
      timestamp: new Date(),
      traceId:   crypto.randomUUID(),
    }

    const handlers: Handler[] = []
    for (const sub of this.subs.values()) {
      if (sub.event === name || sub.event === '*') handlers.push(sub.handler)
    }

    if (handlers.length === 0) return

    // Fire and forget — each handler is isolated
    Promise.all(
      handlers.map(h =>
        Promise.resolve()
          .then(() => h(event))
          .catch(err => logger.error({ msg: '[EventBus] handler error', event: name, err })),
      ),
    ).catch(() => undefined)
  }

  /**
   * Subscribe to a specific event or '*' for all events.
   * Returns an unsubscribe function.
   */
  subscribe<T>(
    event: PlatformEventName | '*',
    handler: Handler<T>,
  ): () => void {
    const id = crypto.randomUUID()
    this.subs.set(id, { id, event, handler })
    return () => this.unsubscribeById(id)
  }

  /**
   * Unsubscribe a specific handler reference from an event.
   */
  unsubscribe(event: PlatformEventName | '*', handler: Handler): void {
    for (const [id, sub] of this.subs) {
      if (sub.event === event && sub.handler === handler) {
        this.subs.delete(id)
        return
      }
    }
  }

  private unsubscribeById(id: string): void {
    this.subs.delete(id)
  }

  /** Flush all subscriptions — useful for testing. */
  reset(): void {
    this.subs.clear()
  }

  get subscriberCount(): number {
    return this.subs.size
  }
}

export const eventBus = new EventBus()
