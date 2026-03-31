import { useState, useEffect, useRef } from 'react'
import { Product } from '../types'
import { extractProductFromImage, fileToBase64 } from '../claude'
import { supabase } from '../supabase'
import BarcodeScanner from './BarcodeScanner'

interface Props {
  product: Product | null
  products: Product[]
  onClose: () => void
  onSave: (name: string, stock: number, threshold: number, barcode: string, imageUrl: string) => Promise<void>
}

export default function ProductModal({ product, products, onClose, onSave }: Props) {
  const [name, setName] = useState('')
  const [stock, setStock] = useState('')
  const [threshold, setThreshold] = useState('')
  const [barcode, setBarcode] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [hint, setHint] = useState('')
  const [hintType, setHintType] = useState<'ok' | 'warn' | 'info'>('info')
  const [showScanner, setShowScanner] = useState(false)
  const ocrRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (product) {
      setName(product.name)
      setStock(String(product.stock))
      setThreshold(String(product.threshold))
      setBarcode(product.barcode ?? '')
      setImageUrl(product.image_url ?? '')
      setImagePreview(product.image_url ?? '')
    }
  }, [product])

  const handleOcr = async (file: File) => {
    setOcrLoading(true); setHint('')
    try {
      const { data, mediaType } = await fileToBase64(file)
      const result = await extractProductFromImage(data, mediaType)
      if (result.name) {
        setName(result.name)
        setHint(result.volume ? `容量: ${result.volume}` : '読み取り完了')
        setHintType('ok')
      } else {
        setHint('読み取れませんでした。手入力してください。')
        setHintType('warn')
      }
    } catch {
      setHint('エラーが発生しました。')
      setHintType('warn')
    }
    setOcrLoading(false)
  }

  const handlePhotoUpload = async (file: File) => {
    setPhotoLoading(true)
    // プレビュー表示
    const reader = new FileReader()
    reader.onload = e => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)

    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `products/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        setImageUrl(data.publicUrl)
      }
    } catch {
      // アップロード失敗は無視（プレビューのみ表示）
    }
    setPhotoLoading(false)
  }

  const handleBarcodeScan = (code: string) => {
    setShowScanner(false)
    setBarcode(code)
    const existing = products.find(p => p.barcode === code)
    if (existing) {
      setHint(`「${existing.name}」として登録済みのバーコードです`)
      setHintType('warn')
    } else {
      setHint(`バーコード読み取り完了: ${code}`)
      setHintType('ok')
    }
  }

  const handleSubmit = async () => {
    if (!name || stock === '' || threshold === '') return
    setLoading(true)
    await onSave(name, Number(stock), Number(threshold), barcode, imageUrl)
    setLoading(false)
  }

  return (
    <>
      <div style={s.overlay} onClick={onClose}>
        <div style={s.sheet} onClick={e => e.stopPropagation()}>
          <div style={s.handle} />
          <h2 style={s.title}>{product ? '薬剤を編集' : '薬剤を登録'}</h2>

          {/* 商品写真 */}
          <div style={s.field}>
            <label style={s.label}>商品写真（任意）</label>
            <div style={s.photoRow}>
              <div style={s.photoPreview}>
                {imagePreview
                  ? <img src={imagePreview} style={s.previewImg} alt="商品写真" />
                  : <span style={s.photoIcon}>💊</span>
                }
              </div>
              <label style={{ ...s.photoUploadBtn, opacity: photoLoading ? 0.6 : 1, position: 'relative', overflow: 'hidden' }}>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, opacity: 0, cursor: 'pointer' }}
                  onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                />
                {photoLoading ? 'アップロード中...' : '写真を選択'}
              </label>
            </div>
          </div>

          {/* 薬剤名 */}
          <div style={s.field}>
            <label style={s.label}>薬剤名</label>
            {!product && (
              <div style={s.btnRow}>
                <label style={{ ...s.subBtn, textAlign: 'center', cursor: 'pointer', opacity: ocrLoading ? 0.6 : 1, position: 'relative', overflow: 'hidden' }}>
                  <input
                    ref={ocrRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, opacity: 0, cursor: 'pointer' }}
                    onChange={e => e.target.files?.[0] && handleOcr(e.target.files[0])}
                  />
                  {ocrLoading ? '読み取り中...' : '📷 AIで読み取り'}
                </label>
                <button style={s.subBtn} onClick={() => setShowScanner(true)}>
                  〒 バーコード
                </button>
              </div>
            )}
            <input value={name} onChange={e => setName(e.target.value)} placeholder="例：カラー剤A" style={{ marginTop: 8 }} />
            {hint && (
              <p style={{ ...s.hint, color: hintType === 'ok' ? '#059669' : hintType === 'warn' ? '#ef3c71' : '#888' }}>
                {hint}
              </p>
            )}
          </div>

          {/* バーコード */}
          <div style={s.field}>
            <label style={s.label}>バーコード（任意）</label>
            <div style={s.inputWithBtn}>
              <input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="スキャンまたは手入力" />
              <button style={s.scanInlineBtn} onClick={() => setShowScanner(true)}>スキャン</button>
            </div>
          </div>

          {/* 在庫・発注ライン */}
          <div style={s.row}>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>{product ? '在庫数' : '初期在庫数'}</label>
              <div style={s.inputUnit}>
                <input type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} placeholder="0" />
                <span style={s.unit}>本</span>
              </div>
            </div>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>この本数を下回ったら発注</label>
              <div style={s.inputUnit}>
                <input type="number" min="0" value={threshold} onChange={e => setThreshold(e.target.value)} placeholder="0" />
                <span style={s.unit}>本</span>
              </div>
            </div>
          </div>

          <button style={s.saveBtn} onClick={handleSubmit} disabled={loading}>
            {loading ? '保存中...' : product ? '変更を保存' : '登録する'}
          </button>
          <button style={s.cancelBtn} onClick={onClose}>キャンセル</button>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />
      )}
    </>
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
    width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto',
  },
  handle: { width: 40, height: 4, background: '#e2e8f0', borderRadius: 99, margin: '0 auto 20px' },
  title: { fontSize: 20, fontWeight: 800, marginBottom: 24, letterSpacing: '-0.3px' },
  field: { marginBottom: 16 },
  row: { display: 'flex', gap: 12 },
  label: { display: 'block', fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' },
  photoRow: { display: 'flex', alignItems: 'center', gap: 12 },
  photoPreview: {
    width: 64, height: 64, borderRadius: 12, background: '#f5f5f7', border: '1.5px solid #ebebeb',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
  },
  previewImg: { width: '100%', height: '100%', objectFit: 'cover' },
  photoIcon: { fontSize: 28 },
  photoUploadBtn: {
    padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    background: '#f5f5f7', color: '#1e1e21', cursor: 'pointer', display: 'inline-block',
  },
  btnRow: { display: 'flex', gap: 8, marginBottom: 0 },
  subBtn: {
    flex: 1, padding: '9px', borderRadius: 12, fontSize: 13, fontWeight: 600,
    background: 'linear-gradient(135deg, #eff6ff, #fff3f6)', color: '#ef3c71',
    border: '1.5px dashed rgba(239,60,113,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  inputWithBtn: { display: 'flex', gap: 8 },
  scanInlineBtn: {
    flexShrink: 0, padding: '0 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
    background: '#f1f0f7', color: '#888',
  },
  hint: { fontSize: 12, marginTop: 6 },
  inputUnit: { position: 'relative' },
  unit: { position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#888', fontWeight: 600 },
  saveBtn: {
    width: '100%', padding: '15px', borderRadius: 12, fontSize: 16, fontWeight: 800,
    background: 'linear-gradient(90deg,#ef3c71,#ff727d)', color: '#fff', marginBottom: 10,
    boxShadow: '0 4px 16px rgba(239,60,113,0.3)',
  },
  cancelBtn: {
    width: '100%', padding: '13px', borderRadius: 12, fontSize: 15, fontWeight: 600,
    background: '#f1f0f7', color: '#888',
  },
}
