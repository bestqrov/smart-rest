// Cart types + helpers shared between /pos (table service) and /comptoir (counter sales).

export interface MenuItem { id: string; nameEn: string; nameAr: string; nameFr: string; price: number; imageUrl: string | null; unitType?: string }
export interface MenuCat  { id: string; nameEn: string; nameAr: string; nameFr: string; order: number; products: MenuItem[] }
export interface CartItem { productId: string; name: string; price: number; qty: number; unitType: string }

// Weight items: price is per KG, qty is grams — total = price/1000 * qty.
export function lineTotal(item: { price: number; qty: number; unitType: string }) {
  return item.unitType === 'WEIGHT' ? (item.price / 1000) * item.qty : item.price * item.qty
}
