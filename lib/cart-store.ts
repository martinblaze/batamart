// lib/cart-store.ts
// ── UPGRADED: CartItem now carries selectedVariants for display ──────────────
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string
  productId: string
  variantId?: string
  name: string
  price: number
  quantity: number
  maxQuantity: number
  image: string
  sellerId: string
  sellerName: string
  // NEW: selected variant combination e.g. { storage: "128GB", color: "Black" }
  selectedVariants?: Record<string, string>
  // NEW: subcategory key for display
  subcategory?: string
  category?: string
  deliveryEstimate?: string
}

interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id' | 'quantity'> & { quantity?: number }) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateVariants: (productId: string, variants: Record<string, string>) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const { items } = get()
        const existingItem = items.find((i) => i.productId === item.productId && (i.variantId || '') === (item.variantId || ''))

        if (existingItem) {
          const newQuantity = existingItem.quantity + (item.quantity || 1)
          if (newQuantity <= item.maxQuantity) {
            set({
              items: items.map((i) =>
                i.productId === item.productId && (i.variantId || '') === (item.variantId || '')
                  ? { ...i, quantity: newQuantity, selectedVariants: item.selectedVariants ?? i.selectedVariants }
                  : i
              ),
            })
          }
        } else {
          set({
            items: [
              ...items,
              {
                ...item,
                quantity: item.quantity || 1,
                id: `cart-${Date.now()}-${Math.random()}`,
              },
            ],
          })
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) })
      },

      updateQuantity: (productId, quantity) => {
        const { items } = get()
        const item = items.find((i) => i.productId === productId)
        if (item && quantity > 0 && quantity <= item.maxQuantity) {
          set({ items: items.map((i) => i.productId === productId ? { ...i, quantity } : i) })
        } else if (quantity === 0) {
          get().removeItem(productId)
        }
      },

      updateVariants: (productId, variants) => {
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, selectedVariants: variants } : i
          ),
        })
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),

      getTotalPrice: () =>
        get().items.reduce((total, item) => total + item.price * item.quantity, 0),
    }),
    { name: 'BATAMART-cart-storage' }
  )
)
