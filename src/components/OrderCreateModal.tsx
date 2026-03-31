import { useState } from 'react'
import { Product } from '../types'

interface Props {
  product: Product
  onClose: () => void
  onSave: (quantity: number) => Promise<void>
}

export default function OrderCreateModal({ product, onClose, onSave }: Props) {
  const [quantity, setQuantity] = useState(String(product.threshold || 1))
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    const qty = Number(quantity)
    if (!qty || qty <= 0) return
    setLoading(true)
    await onSave(qty)
    setLoading(false)
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />
        <h2 style={s.title}>発注を登録</h2>

        <div style={s.productRow}>
          <span style={s.label}>薬剤</span>
          <span style={s.productName}>{product.name}</span>
        </div>
        <div style={s.productRow}>
          <span style={s.label}>現在の在庫</span>
          <span style={s.stockVal}>{product.stock}本</span>
        </div>

        <div style={s.field}>
          <label style={s.fieldLabel}>発注数量</label>
          <div style={s.inputUnit}>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              style={s.input}
            />
            <span style={s.unit}>本</span>
          </div>
        </div>

        <button style={s.saveBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? '登録中...' : '発注する'}
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
    justifyContent: 'center', zIndex: 100,
  },
  sheet: {
    background: '#fff', borderRadius: '24px 24px 0 0', padding: '12px 24px 40px',
    width: '100%', maxWidth: 480,
  },
  handle: { width: 40, height: 4, background: '#e2e8f0', borderRadius: 99, margin: '0 auto 20px' },
  title: { fontSize: 20, fontWeight: 800, marginBottom: 20 },
  productRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f0f0f5' },
  label: { fontSize: 13, color: '#888' },
  productName: { fontSize: 14, fontWeight: 700 },
  stockVal: { fontSize: 14, fontWeight: 700, color: '#ef3c71' },
  field: { marginTop: 20, marginBottom: 20 },
  fieldLabel: { display: 'block', fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' },
  inputUnit: { position: 'relative' },
  input: { width: '100%', padding: '14px', paddingRight: 40, fontSize: 24, fontWeight: 800, textAlign: 'center', borderRadius: 12, border: '2px solid #ebebeb' },
  unit: { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#888', fontWeight: 600 },
  saveBtn: {
    width: '100%', padding: '14px', borderRadius: 12, fontSize: 16, fontWeight: 700,
    background: 'linear-gradient(90deg,#ef3c71,#ff727d)', color: '#fff', marginBottom: 10,
    boxShadow: '0 3px 12px rgba(239,60,113,0.3)',
  },
  cancelBtn: {
    width: '100%', padding: '13px', borderRadius: 12, fontSize: 15, fontWeight: 600,
    background: '#f1f0f7', color: '#888',
  },
}
