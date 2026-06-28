import fs from 'fs/promises'
import path from 'path'

// ─── Provider interface ───────────────────────────────────────────────────────

export interface FileProvider {
  store(key: string, buffer: Buffer, mimeType: string): Promise<string>
  delete(key: string): Promise<void>
  move(fromKey: string, toKey: string): Promise<string>
  generatePublicUrl(key: string): Promise<string>
}

// ─── Local disk provider ──────────────────────────────────────────────────────

export class LocalFileProvider implements FileProvider {
  constructor(
    private readonly root:    string = process.env.FILE_STORAGE_ROOT ?? './uploads',
    private readonly baseUrl: string = process.env.FILE_STORAGE_BASE_URL ?? '/uploads',
  ) {}

  async store(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const dest = path.join(this.root, key)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, buffer)
    return dest
  }

  async delete(key: string): Promise<void> {
    const target = path.join(this.root, key)
    await fs.unlink(target).catch(() => undefined)
  }

  async move(fromKey: string, toKey: string): Promise<string> {
    const src  = path.join(this.root, fromKey)
    const dest = path.join(this.root, toKey)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.rename(src, dest)
    return dest
  }

  async generatePublicUrl(key: string): Promise<string> {
    return `${this.baseUrl}/${key}`
  }
}

// ─── Provider registry ────────────────────────────────────────────────────────

const registry = new Map<string, FileProvider>()
registry.set('local', new LocalFileProvider())

export function registerProvider(name: string, provider: FileProvider): void {
  registry.set(name, provider)
}

export function getProvider(name: string = 'local'): FileProvider {
  const p = registry.get(name)
  if (!p) throw new Error(`FileProvider "${name}" not registered`)
  return p
}
