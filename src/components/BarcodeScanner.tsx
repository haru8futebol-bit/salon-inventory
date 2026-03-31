import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface Props {
  onScan: (code: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const calledRef = useRef(false)

  useEffect(() => {
    calledRef.current = false
    const scanner = new Html5Qrcode('barcode-reader')
    scannerRef.current = scanner

    const handleScan = (decodedText: string) => {
      if (calledRef.current) return
      calledRef.current = true
      scanner.stop().catch(() => {}).finally(() => onScan(decodedText))
    }

    // 背面カメラを強制（選択画面を出さない）
    scanner.start(
      { facingMode: { exact: 'environment' } },
      { fps: 10, qrbox: { width: 280, height: 120 } },
      handleScan,
      () => {}
    ).catch(() => {
      // environment が使えない端末はデフォルトにフォールバック
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 120 } },
        handleScan,
        () => {}
      ).catch(() => {})
    })

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [onScan])

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />
        <p style={s.title}>バーコードをスキャン</p>
        <p style={s.sub}>薬剤パッケージのバーコードにカメラを向けてください</p>
        <div id="barcode-reader" style={s.reader} />
        <button style={s.cancelBtn} onClick={onClose}>キャンセル</button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end',
    justifyContent: 'center', zIndex: 200, animation: 'fadeIn 0.2s ease',
  },
  sheet: {
    background: '#fff', borderRadius: '24px 24px 0 0', padding: '12px 24px 40px',
    width: '100%', maxWidth: 480, animation: 'slideUp 0.25s ease',
  },
  handle: { width: 40, height: 4, background: '#e2e8f0', borderRadius: 99, margin: '0 auto 16px' },
  title: { fontSize: 18, fontWeight: 800, marginBottom: 6, textAlign: 'center' },
  sub: { fontSize: 13, color: '#888', marginBottom: 16, textAlign: 'center' },
  reader: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  cancelBtn: {
    width: '100%', padding: '13px', borderRadius: 16, fontSize: 15, fontWeight: 600,
    background: '#f1f0f7', color: '#888',
  },
}
