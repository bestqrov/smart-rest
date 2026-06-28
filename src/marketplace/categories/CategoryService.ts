import type {
  MarketplaceCategory, CategoryTree, CreateCategoryInput,
} from '../types'
import { emitCategoryCreated } from '../events/MarketplaceEvents'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function toCategory(row: any): MarketplaceCategory {
  return {
    id:          row.id,
    name:        row.name,
    slug:        row.slug,
    parentId:    row.parentId ?? undefined,
    icon:        row.icon ?? undefined,
    description: row.description ?? undefined,
    active:      row.active,
    sortOrder:   row.sortOrder,
    createdAt:   row.createdAt,
    updatedAt:   row.updatedAt,
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createCategory(input: CreateCategoryInput): Promise<MarketplaceCategory> {
  const { default: prisma } = await import('../../prisma')

  const slug = input.slug ?? toSlug(input.name)
  const row  = await (prisma as any).marketplaceCategory.create({
    data: {
      name:        input.name,
      slug,
      parentId:    input.parentId ?? null,
      icon:        input.icon ?? null,
      description: input.description ?? null,
      sortOrder:   input.sortOrder ?? 0,
    },
  })

  const category = toCategory(row)
  emitCategoryCreated(category.id, category.name, category.parentId)
  return category
}

export async function updateCategory(
  id:    string,
  patch: Partial<Omit<MarketplaceCategory, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<MarketplaceCategory> {
  const { default: prisma } = await import('../../prisma')

  const row = await (prisma as any).marketplaceCategory.update({
    where: { id },
    data: {
      ...(patch.name        !== undefined ? { name: patch.name }               : {}),
      ...(patch.slug        !== undefined ? { slug: patch.slug }               : {}),
      ...(patch.parentId    !== undefined ? { parentId: patch.parentId }       : {}),
      ...(patch.icon        !== undefined ? { icon: patch.icon }               : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.active      !== undefined ? { active: patch.active }           : {}),
      ...(patch.sortOrder   !== undefined ? { sortOrder: patch.sortOrder }     : {}),
    },
  })

  return toCategory(row)
}

export async function getCategory(id: string): Promise<MarketplaceCategory | null> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).marketplaceCategory.findUnique({ where: { id } })
  return row ? toCategory(row) : null
}

export async function getCategoryBySlug(slug: string): Promise<MarketplaceCategory | null> {
  const { default: prisma } = await import('../../prisma')
  const row = await (prisma as any).marketplaceCategory.findUnique({ where: { slug } })
  return row ? toCategory(row) : null
}

export async function getAllCategories(onlyActive = false): Promise<MarketplaceCategory[]> {
  const { default: prisma } = await import('../../prisma')
  const rows = await (prisma as any).marketplaceCategory.findMany({
    where:   onlyActive ? { active: true } : {},
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return rows.map(toCategory)
}

export async function getChildCategories(parentId: string): Promise<MarketplaceCategory[]> {
  const { default: prisma } = await import('../../prisma')
  const rows = await (prisma as any).marketplaceCategory.findMany({
    where:   { parentId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return rows.map(toCategory)
}

// ─── Build in-memory tree (adjacency list → nested) ──────────────────────────

export async function getCategoryTree(onlyActive = true): Promise<CategoryTree[]> {
  const all = await getAllCategories(onlyActive)

  const map = new Map<string, CategoryTree>()
  for (const cat of all) {
    map.set(cat.id, { ...cat, children: [] })
  }

  const roots: CategoryTree[] = []
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export async function archiveCategory(id: string): Promise<void> {
  const { default: prisma } = await import('../../prisma')
  await (prisma as any).marketplaceCategory.update({ where: { id }, data: { active: false } })
}
