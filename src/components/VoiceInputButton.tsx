import { useState, useRef } from 'react'
import { Product } from '../types'
import { parseSpeechWithAI } from '../claude'

// Web Speech API型定義（TypeScript標準DOMに含まれないため）
interface ISpeechRecognition extends EventTarget {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: ISpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
interface ISpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } }
}
type SpeechRecognitionConstructor = new () => ISpeechRecognition

interface Props {
  products: Product[]
  onResult: (result: { product: Product; quantity: number }) => void
}

export default function VoiceInputButton({ products, onResult }: Props) {
  const [listening, setListening] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef<ISpeechRecognition | null>(null)

  const SpeechRecognitionAPI: SpeechRecognitionConstructor | undefined =
    (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition

  if (!SpeechRecognitionAPI) return (
    <span style={s.unsupported}>音声入力はChrome / Safariのみ対応しています</span>
  )

  const start = () => {
    setError(''); setTranscript('')
    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'ja-JP'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    recognition.onresult = async (e: ISpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript
      setTranscript(text)
      if (products.length === 0) { setError('先に薬剤を登録してください'); return }
      setAnalyzing(true)
      const parsed = await parseSpeechWithAI(text, products.map(p => p.name))
      setAnalyzing(false)
      if (!parsed) { setError(`「${text}」から判別できませんでした`); return }
      const matched = products.find(p => p.name === parsed.productName)
      if (!matched) { setError(`「${parsed.productName}」は未登録です`); return }
      onResult({ product: matched, quantity: parsed.quantity })
    }

    recognition.onerror = () => { setError('音声認識エラー。もう一度お試しください。'); setListening(false) }
    recognition.onend = () => setListening(false)
    recognition.start()
    setListening(true)
  }

  const stop = () => { recognitionRef.current?.stop(); setListening(false) }

  return (
    <div style={s.wrapper}>
      <button
        style={{ ...s.btn, ...(listening ? s.btnOn : {}), ...(analyzing ? s.btnAnalyzing : {}) }}
        onClick={listening ? stop : start}
        disabled={analyzing}
      >
        <span style={s.icon}>{analyzing ? '⏳' : listening ? '⏹' : '🎤'}</span>
        <span>{analyzing ? 'AI解析中...' : listening ? '話し終わったら停止' : '音声で使用記録'}</span>
      </button>
      {transcript && <span style={s.transcript}>「{transcript}」</span>}
      {error && <span style={s.error}>{error}</span>}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  btn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--gradient)', color: '#fff',
    fontWeight: 700, fontSize: 14, padding: '10px 20px', borderRadius: 99,
    boxShadow: '0 2px 10px rgba(99,102,241,0.25)',
    minHeight: 44,
  },
  btnOn: {
    background: 'linear-gradient(135deg, #ef4444, #f97316)',
    boxShadow: '0 2px 10px rgba(239,68,68,0.3)',
    animation: 'pulse 1.5s infinite',
  },
  btnAnalyzing: {
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    boxShadow: '0 2px 10px rgba(245,158,11,0.25)',
  },
  icon: { fontSize: 16 },
  transcript: { fontSize: 12, color: 'var(--text-sub)' },
  error: { fontSize: 12, color: 'var(--danger)', fontWeight: 600 },
  unsupported: { fontSize: 12, color: 'var(--text-sub)' },
}
