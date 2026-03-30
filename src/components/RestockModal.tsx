import { useState } from 'react'
import { Product } from '../types'

interface Props {
  product: Product
  onClose: () => void
  onSave: (quantity: number, note: string) => Promise<void>
}

export default function RestockModal({ product, onClose, onSave }: Props) {
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    const q = Number(quantity)
    if (!q || q <= 0) { setError('入荷数を入力してください'); return }
    setLoading(true)
    await onSave(q, note)
    setLoading(false)
  }

  const newStock = product.stock + (Number(quantity) || 0)

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />

        <div style={s.productInfo}>
          <span style={s.productLabel}>入荷する薬剤</span>
          <p style={s.productName}>{product.name}</p>
          <div style={s.stockRow}>
            <span style={s.stockCurrent}>{product.stock}本</span>
            {Number(quantity) > 0 && (
              <>
                <span style={s.arrow}>→</span>
                <span style={s.stockNew}>{newStock}本</span>
              </>
            )}
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>入荷数</label>
          <div style={s.inputUnit}>
            <input type="number" min="1" value={quantity}
              onChange={e => { setQuantity(e.target.value); setError('') }}
              placeholder="0" />
            <span style={s.unit}>本</span>
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>メモ（任意）</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="例：〇〇業者から発注分" />
        </div>

        {error && <p style={s.error}>{error}</p>}

        <button style={s.saveBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? '記録中...' : '入荷を記録'}
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
    width: '100%', maxWidth: 480, animation: 'slideUp 0.25s ease',
  },
  handle: { width: 40, height: 4, background: '#e2e8f0', borderRadius: 99, margin: '0 auto 20px' },
  productInfo: {
    background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', borderRadius: 16,
    padding: '14px 18px', marginBottom: 20,
  },
  productLabel: { fontSize: 11, fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em' },
  productName: { fontSize: 20, fontWeight: 800, marginTop: 2, marginBottom: 6 },
  stockRow: { display: 'flex', alignItems: 'center', gap: 10 },
  stockCurrent: { fontSize: 14, color: 'var(--text-sub)' },
  arrow: { fontSize: 14, color: '#059669' },
  stockNew: { fontSize: 16, fontWeight: 800, color: '#059669' },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
  inputUnit: { position: 'relative' },
  unit: { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-sub)', fontWeight: 600 },
  error: { color: 'var(--danger)', fontSize: 13, marginBottom: 12, fontWeight: 600 },
  saveBtn: {
    width: '100%', padding: '15px', borderRadius: 16, fontSize: 16, fontWeight: 800,
    background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', marginBottom: 10,
    boxShadow: '0 4px 16px rgba(16,185,129,0.30)',
  },
  cancelBtn: {
    width: '100%', padding: '13px', borderRadius: 16, fontSize: 15, fontWeight: 600,
    background: '#f1f0f7', color: 'var(--text-sub)',
  },
}
