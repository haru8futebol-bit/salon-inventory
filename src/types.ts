export interface Product {
  id: string
  name: string
  stock: number
  threshold: number
  barcode: string | null
  created_at: string
}

export interface UsageLog {
  id: string
  product_id: string
  quantity: number
  note: string | null
  type: 'use' | 'restock'
  used_at: string
  products?: { name: string }
}

export interface Recipe {
  id: string
  name: string
  memo: string | null
  created_at: string
  recipe_items?: RecipeItem[]
}

export interface RecipeItem {
  id: string
  recipe_id: string
  product_id: string
  quantity: number
  unit: string
  note: string | null
  products?: { name: string; stock: number }
}
