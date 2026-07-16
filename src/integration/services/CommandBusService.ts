// ─── SmartSuite OS — Command Bus ──────────────────────────────────────────────
// Platform-wide command dispatcher. Modules register commands via IntegrationRegistry.
// SuperAdmin executes commands from one unified surface.

import { getModulesByCapability, listModules } from '../registry/IntegrationRegistry'
import type { CommandDefinition, CommandResult } from '../registry/IntegrationRegistry'

export type { CommandDefinition, CommandResult }

// ─── Execute a registered command ────────────────────────────────────────────
export async function execute(
  commandId: string,
  params?:   Record<string, unknown>,
): Promise<CommandResult> {
  const cmd = findCommand(commandId)
  if (!cmd) {
    return { ok: false, message: `Command not found: ${commandId}` }
  }
  try {
    const result = await cmd.execute(params)
    return result
  } catch (err: any) {
    return { ok: false, message: err?.message ?? 'Command failed' }
  }
}

// ─── List all registered commands ────────────────────────────────────────────
export function listCommands(): Array<CommandDefinition & { moduleId: string }> {
  return listModules().flatMap(mod =>
    (mod.commands ?? []).map(cmd => ({ ...cmd, moduleId: mod.id }))
  )
}

// ─── Get a specific command ───────────────────────────────────────────────────
export function findCommand(commandId: string): (CommandDefinition & { moduleId: string }) | undefined {
  for (const mod of getModulesByCapability('commands')) {
    const cmd = (mod.commands ?? []).find(c => c.id === commandId)
    if (cmd) return { ...cmd, moduleId: mod.id }
  }
  return undefined
}
