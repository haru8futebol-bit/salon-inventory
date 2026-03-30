import { useEffect, useRef } from 'react'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'

interface Props {
  onScan: (code: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const scanner = new Html5QrcodeScanner(
      'barcode-reader',
      {
        fps: 10,
        qrbox: { width: 280, height: 120 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        showTorchButtonIfSupported: true,
      },
      false
    )

    scanner.render(
      (decodedText) => {
        if (!mounted.current) return
        scanner.clear().catch(() => {})
        onScan(decodedText)
      },
      () => {} // スキャン失敗は無視
    )

    scannerRef.current = scanner

    return () => {
      mounted.current = false
      scannerRef.current?.clear().catch(() => {})
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
  sub: { fontSize: 13, color: 'var(--text-sub)', marginBottom: 16, textAlign: 'center' },
  reader: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  cancelBtn: {
    width: '100%', padding: '13px', borderRadius: 16, fontSize: 15, fontWeight: 600,
    background: '#f1f0f7', color: 'var(--text-sub)',
  },
}
