import { useState, useRef } from 'react'
import { Product } from '../types'
import { countStockFromImage, fileToBase64 } from '../claude'

interface CountResult {
  name: string
  count: number
  productId: string | null
}

interface Props {
  products: Product[]
  onApply: (updates: { id: string; stock: number }[]) => Promise<void>
  onClose: () => void
}

export default function StockCountModal({ products, onApply, onClose }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<CountResult[]>([])
  const [notes, setNotes] = useState('')
  const [applying, setApplying] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    setLoading(true)
    setResults([])
    setNotes('')
    try {
      const { data, mediaType } = await fileToBase64(file)
      const res = await countStockFromImage(data, mediaType, products.map(p => p.name))
      const mapped: CountResult[] = res.counts.map(c => ({
        name: c.name,
        count: c.count,
        productId: products.find(p => p.name === c.name || c.name.includes(p.name))?.id ?? null,
      }))
      setResults(mapped)
      setNotes(res.notes)
    } catch {
      setNotes('Claude API の呼び出しに失敗しました。APIキーを確認してください。')
    }
    setLoading(false)
  }

  const handleApply = async () => {
    const updates = results
      .filter(r => r.productId !== null)
      .map(r => ({ id: r.productId!, stock: r.count }))
    if (updates.length === 0) return
    setApplying(true)
    await onApply(updates)
    setApplying(false)
    onClose()
  }

  const updateCount = (index: number, value: number) => {
    setResults(prev => prev.map((r, i) => i === index ? { ...r, count: value } : r))
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>📷 写真で在庫カウント</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <p style={styles.desc}>棚の写真を撮影・アップロードすると、AIが薬剤の本数を数えます。</p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <button style={styles.cameraBtn} onClick={() => fileRef.current?.click()}>
          📸 写真を撮影 / 選択
        </button>

        {preview && (
          <img src={preview} alt="撮影画像" style={styles.preview} />
        )}

        {loading && (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            AIが画像を解析中...
          </div>
        )}

        {results.length > 0 && (
          <>
            <p style={styles.sectionLabel}>カウント結果（修正可能）</p>
            {results.map((r, i) => (
              <div key={i} style={styles.resultRow}>
                <span style={{ flex: 1, fontSize: 14, fontWeight: r.productId ? 600 : 400, color: r.productId ? '#111' : '#999' }}>
                  {r.name}
                  {!r.productId && <span style={styles.unmatchedBadge}>未登録</span>}
                </span>
                <input
                  type="number"
                  min="0"
                  value={r.count}
                  onChange={e => updateCount(i, Number(e.target.value))}
                  style={styles.countInput}
                />
                <span style={{ fontSize: 13, color: '#555' }}>本</span>
              </div>
            ))}
            {notes && <p style={styles.notes}>{notes}</p>}

            <button
              style={styles.applyBtn}
              onClick={handleApply}
              disabled={applying || results.filter(r => r.productId).length === 0}
            >
              {applying ? '反映中...' : `在庫に反映（${results.filter(r => r.productId).length}件）`}
            </button>
          </>
        )}

        {notes && results.length === 0 && !loading && (
          <p style={styles.notes}>{notes}</p>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modal: {
    background: '#fff', borderRadius: 12, padding: 28, width: 420, maxHeight: '90vh',
    overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: 700 },
  closeBtn: { background: '#f0f0f0', color: '#555', padding: '4px 10px' },
  desc: { fontSize: 13, color: '#666', marginBottom: 16 },
  cameraBtn: { width: '100%', background: '#1e40af', color: '#fff', fontWeight: 600, padding: '12px', fontSize: 15, borderRadius: 8 },
  preview: { width: '100%', borderRadius: 8, marginTop: 16, maxHeight: 240, objectFit: 'cover' },
  loading: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, fontSize: 14, color: '#555' },
  spinner: { width: 18, height: 18, border: '2px solid #ddd', borderTop: '2px solid #4f46e5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  sectionLabel: { fontSize: 13, fontWeight: 600, color: '#666', marginTop: 20, marginBottom: 10 },
  resultRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  countInput: { width: 64, textAlign: 'center' },
  unmatchedBadge: { marginLeft: 6, fontSize: 11, background: '#f3f4f6', color: '#9ca3af', padding: '1px 6px', borderRadius: 4 },
  notes: { fontSize: 12, color: '#9ca3af', marginTop: 12 },
  applyBtn: { width: '100%', background: '#16a34a', color: '#fff', fontWeight: 600, padding: '12px', fontSize: 14, borderRadius: 8, marginTop: 16 },
}
