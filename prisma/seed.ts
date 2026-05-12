import { PrismaClient, Prisma } from '@prisma/client'
import crypto from 'crypto'
import logger from '../src/logger'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')
  // Ensure user sets DATABASE_URL in env
  if (!process.env.DATABASE_URL) {
    logger.error({ msg: 'Seed aborted: DATABASE_URL env var missing' })
    process.exit(1)
  }

  // 1) Upsert Cafe
  const cafeData = {
    name: 'Café de la Plage',
    subdomain: 'plage',
    logoUrl: null,
    lat: 30.4277,
    lng: -9.5981,
    currency: 'MAD',
    socialLinks: {
      instagram: 'https://www.instagram.com/cafedelaplage',
      googleMaps: 'https://maps.google.com/?q=Caf%C3%A9+de+la+Plage+Agadir',
      tripadvisor: 'https://www.tripadvisor.com/Cafe_de_la_Plague'
    },
    subscriptionStatus: 'FREE' as any
  }

  console.log('Upserting cafe...')
  const cafe = await prisma.cafe.upsert({
    where: { subdomain: cafeData.subdomain },
    update: {
      name: cafeData.name,
      logoUrl: cafeData.logoUrl,
      lat: cafeData.lat,
      lng: cafeData.lng,
      currency: cafeData.currency,
      socialLinks: cafeData.socialLinks,
      subscriptionStatus: cafeData.subscriptionStatus
    },
    create: {
      name: cafeData.name,
      subdomain: cafeData.subdomain,
      logoUrl: cafeData.logoUrl,
      lat: cafeData.lat,
      lng: cafeData.lng,
      currency: cafeData.currency,
      socialLinks: cafeData.socialLinks,
      subscriptionStatus: cafeData.subscriptionStatus
    }
  })
  console.log(`Cafe upserted: ${cafe.name} (id=${cafe.id})`)

  // 2) Categories
  const categoryNames = [
    { nameEn: 'Breakfast', nameAr: 'الفطور', order: 1 },
    { nameEn: 'Cold Drinks', nameAr: 'مشروبات باردة', order: 2 },
    { nameEn: 'Traditional Moroccan', nameAr: 'تقليدية مغربية', order: 3 }
  ]

  const categoriesMap: Record<string, any> = {}

  for (const cat of categoryNames) {
    // find or create - schema has no unique on (cafeId,nameEn), so use findFirst
    let category = await prisma.category.findFirst({
      where: { cafeId: cafe.id, nameEn: cat.nameEn }
    })
    if (!category) {
      category = await prisma.category.create({
        data: { cafeId: cafe.id, nameAr: cat.nameAr, nameEn: cat.nameEn, order: cat.order }
      })
      console.log(`Created category: ${cat.nameEn}`)
    } else {
      console.log(`Category exists: ${cat.nameEn}`)
    }
    categoriesMap[cat.nameEn] = category
  }

  // 3) Products
  type ProductSeed = { category: string; nameEn: string; nameAr: string; price: string }
  const products: ProductSeed[] = [
    { category: 'Traditional Moroccan', nameEn: 'Tajine Kefta', nameAr: 'طاجين كفتة', price: '85' },
    { category: 'Traditional Moroccan', nameEn: 'Moroccan Tea', nameAr: 'شاي مغربي', price: '20' },
    { category: 'Cold Drinks', nameEn: 'Fresh Orange Juice', nameAr: 'عصير برتقال طازج', price: '25' },
    { category: 'Cold Drinks', nameEn: 'Iced Latte', nameAr: 'آيس لاتيه', price: '35' }
  ]

  for (const p of products) {
    const cat = categoriesMap[p.category]
    if (!cat) {
      console.warn(`Category not found for product ${p.nameEn}, skipping`)
      continue
    }

    const existing = await prisma.product.findFirst({
      where: { categoryId: cat.id, nameEn: p.nameEn }
    })
    if (existing) {
      console.log(`Product exists: ${p.nameEn}`)
      continue
    }

    await prisma.product.create({
      data: {
        categoryId: cat.id,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        description: '',
        price: new Prisma.Decimal(p.price),
        imageUrl: null,
        isAvailable: true
      }
    })
    console.log(`Created product: ${p.nameEn} (${p.price} MAD)`)
  }

  // 4) Tables (5) with unique qrToken using crypto
  console.log('Creating tables...')
  for (let i = 1; i <= 5; i++) {
    const token = crypto.randomBytes(16).toString('hex')
    await prisma.table.upsert({
      where: { qrToken: token },
      update: { isActive: true, tableNumber: i, cafeId: cafe.id },
      create: { cafeId: cafe.id, tableNumber: i, qrToken: token, isActive: true }
    })
    console.log(`Upserted table ${i} (qrToken: ${token})`)
  }

  console.log('Seeding completed.')
}

main()
  .catch((e) => {
    logger.error({ msg: 'Seed error', err: e })
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
