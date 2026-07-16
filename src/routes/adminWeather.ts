import express, { Request, Response } from 'express'
import { authorizeAdmin } from '../middleware/authorizeAdmin'
import logger from '../logger'
import prisma from '../prisma'

const router = express.Router()

type WeatherResponse = {
  available: boolean
  city?: string
  tempC?: number
  condition?: string
  icon?: string
}

router.get('/api/admin/weather', authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const admin = req.admin!
    const cafe = await prisma.cafe.findUnique({
      where: { id: admin.cafeId },
      select: { city: true, lat: true, lng: true },
    })

    const apiKey = process.env.OPENWEATHER_API_KEY
    if (!apiKey || !cafe || (!cafe.city && (cafe.lat == null || cafe.lng == null))) {
      return res.json({ available: false } as WeatherResponse)
    }

    const query = cafe.city
      ? `q=${encodeURIComponent(cafe.city)}`
      : `lat=${cafe.lat}&lon=${cafe.lng}`

    const url = `https://api.openweathermap.org/data/2.5/weather?${query}&units=metric&appid=${apiKey}`
    const weatherRes = await fetch(url)
    if (!weatherRes.ok) {
      return res.json({ available: false } as WeatherResponse)
    }
    const data: any = await weatherRes.json()

    const response: WeatherResponse = {
      available: true,
      city: data.name ?? cafe.city ?? undefined,
      tempC: typeof data.main?.temp === 'number' ? Math.round(data.main.temp) : undefined,
      condition: data.weather?.[0]?.main ?? undefined,
      icon: data.weather?.[0]?.icon ?? undefined,
    }
    res.json(response)
  } catch (err) {
    logger.error({ msg: 'admin weather fetch error', err })
    res.json({ available: false } as WeatherResponse)
  }
})

export default router
