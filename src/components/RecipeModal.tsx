import { useState } from 'react'
import { Product, Recipe, RecipeItem } from '../types'

interface DraftItem {
  product_id: string
  quantity: string
  unit: string
  note: string
}

interface Props {
  recipe: Recipe | null
  products: Product[]
  onClose: () => void
  onSave: (name: string, memo: string, items: DraftItem[]) => Promise<void>
}

const UNITS = ['g', 'ml', '本', '個', '%']

export default function RecipeModal({ recipe, products, onClose, onSave }: Props) {
  const [name, setName] = useState(recipe?.name ?? '')
  const [memo, setMemo] = useState(recipe?.memo ?? '')
  const [items, setItems] = useState<DraftItem[]>(
    recipe?.recipe_items?.map(i => ({
      product_id: i.product_id,
      quantity: String(i.quantity),
      unit: i.unit,
      note: i.note ?? '',
    })) ?? [{ product_id: '', quantity: '', unit: 'g', note: '' }]
  )
  const [loading, setLoading] = useState(false)

  const addItem = () => setItems(prev => [...prev, { product_id: '', quantity: '', unit: 'g', note: '' }])

  const updateItem = (index: number, key: keyof DraftItem, value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [key]: value } : item))
  }

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!name) return
    const validItems = items.filter(i => i.product_id && i.quantity)
    if (validItems.length === 0) return
    setLoading(true)
    await onSave(name, memo, validItems)
    setLoading(false)
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />
        <h2 style={s.title}>{recipe ? 'レシピを編集' : '新しいレシピ'}</h2>

        <div style={s.field}>
          <label style={s.label}>レシピ名</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="例：Aさん用カラー / 明るめブリーチ" />
        </div>

        <div style={s.field}>
          <label style={s.label}>メモ（任意）</label>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="施術のポイントなど" />
        </div>

        <div style={s.field}>
          <div style={s.labelRow}>
            <label style={s.label}>使用薬剤</label>
            <button style={s.addItemBtn} onClick={addItem}>＋ 追加</button>
          </div>

          {items.map((item, i) => (
            <div key={i} style={s.itemRow}>
              <select
                style={s.productSelect}
                value={item.product_id}
                onChange={e => updateItem(i, 'product_id', e.target.value)}
              >
                <option value="">薬剤を選択</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                type="number" min="0" step="0.1"
                value={item.quantity}
                onChange={e => updateItem(i, 'quantity', e.target.value)}
                placeholder="量"
                style={s.qtyInput}
              />
              <select
                style={s.unitSelect}
                value={item.unit}
                onChange={e => updateItem(i, 'unit', e.target.value)}
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <button style={s.removeBtn} onClick={() => removeItem(i)}>✕</button>
            </div>
          ))}
        </div>

        <button style={s.saveBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? '保存中...' : recipe ? '変更を保存' : 'レシピを登録'}
        </button>
        <button style={s.cancelBtn} onClick={onClose}>キャンセル</button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end',
    justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.2s ease',
  },
  sheet: {
    background: '#fff', borderRadius: '24px 24px 0 0', padding: '12px 24px 40px',
    width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
    animation: 'slideUp 0.25s ease',
  },
  handle: { width: 40, height: 4, background: '#e2e8f0', borderRadius: 99, margin: '0 auto 20px' },
  title: { fontSize: 20, fontWeight: 800, marginBottom: 24 },
  field: { marginBottom: 16 },
  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  addItemBtn: { fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: '#f0f0ff', padding: '4px 12px', borderRadius: 8 },
  itemRow: { display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' },
  productSelect: {
    flex: 1, padding: '10px 10px', border: '2px solid var(--border)', borderRadius: 10,
    fontSize: 13, background: '#fafafa', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
  },
  qtyInput: { width: 60, padding: '10px 8px', textAlign: 'center' },
  unitSelect: {
    width: 52, padding: '10px 4px', border: '2px solid var(--border)', borderRadius: 10,
    fontSize: 13, background: '#fafafa', color: 'var(--text)', outline: 'none', fontFamily: 'inherit',
    textAlign: 'center',
  },
  removeBtn: { padding: '6px 8px', background: '#fee2e2', color: 'var(--danger)', borderRadius: 8, fontSize: 12, flexShrink: 0 },
  saveBtn: {
    width: '100%', padding: '15px', borderRadius: 16, fontSize: 16, fontWeight: 800,
    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', marginBottom: 10,
    boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
  },
  cancelBtn: {
    width: '100%', padding: '13px', borderRadius: 16, fontSize: 15, fontWeight: 600,
    background: '#f1f0f7', color: 'var(--text-sub)',
  },
}
