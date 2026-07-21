import {
  Smartphone, Laptop, Shirt, Home, UtensilsCrossed, Sparkles, Dumbbell,
  Car, BookOpen, Ticket, Baby, Palette, LayoutGrid, type LucideIcon,
} from 'lucide-react'

// Design bible section 6 — lucide-react icons only, no emoji. CATEGORY_TREE
// in lib/variants.ts is the taxonomy source of truth and keeps its emoji
// `icon` field (business data, untouched); this map is the display-layer
// substitute wherever a category icon is rendered in the UI.
export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  electronics: Smartphone,
  computing: Laptop,
  fashion: Shirt,
  home_kitchen: Home,
  groceries: UtensilsCrossed,
  beauty: Sparkles,
  sports: Dumbbell,
  vehicles: Car,
  books: BookOpen,
  tickets: Ticket,
  kids: Baby,
  arts_crafts: Palette,
  all: LayoutGrid,
}

export function getCategoryIcon(key: string): LucideIcon {
  return CATEGORY_ICON_MAP[key] || LayoutGrid
}
