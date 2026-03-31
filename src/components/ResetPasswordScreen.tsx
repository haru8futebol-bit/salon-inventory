import { useState } from 'react'
import { supabase } from '../supabase'

interface Props {
  onDone: () => void
}

export default function ResetPasswordScreen({ onDone }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    setError('')
    if (password.length < 6) { setError('パスワードは6文字以上で設定してください'); return }
    if (password !== confirm) { setError('パスワードが一致しません'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError('変更に失敗しました。もう一度お試しください。'); return }
    setDone(true)
    setTimeout(onDone, 1500)
  }

  if (done) return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.bigIcon}>✅</div>
        <h2 style={s.doneTitle}>パスワードを変更しました</h2>
        <p style={s.doneSub}>新しいパスワードでログインできます。</p>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>✂️</div>
        <h1 style={s.appName}>在庫管理アシスタント</h1>
      </div>
      <div style={s.card}>
        <h2 style={s.title}>新しいパスワードを設定</h2>

        <div style={s.field}>
          <label style={s.label}>新しいパスワード（6文字以上）</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={s.input}
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>パスワードを確認</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="••••••••"
            style={s.input}
          />
        </div>

        {error && <p style={s.error}>{error}</p>}

        <button style={s.submitBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? '変更中...' : 'パスワードを変更する'}
        </button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex', flexDirection: 'column', minHeight: '100dvh',
    background: 'linear-gradient(160deg, #fff0f4, #f7f7f9)',
    alignItems: 'center', justifyContent: 'center', padding: '24px 20px',
    fontFamily: "'Hiragino Kaku Gothic ProN', 'Hiragino Sans', sans-serif",
  },
  header: { textAlign: 'center', marginBottom: 32 },
  logo: {
    width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(90deg,#ef3c71,#ff727d)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
    margin: '0 auto 14px', boxShadow: '0 4px 16px rgba(239,60,113,0.3)',
  },
  appName: { fontSize: 22, fontWeight: 800, color: '#1e1e21', marginBottom: 4 },
  card: {
    background: '#fff', borderRadius: 20, padding: '28px 24px',
    width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  title: { fontSize: 20, fontWeight: 800, color: '#1e1e21', marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6, letterSpacing: '0.04em' },
  input: {
    width: '100%', padding: '13px 14px', borderRadius: 10, border: '1.5px solid #e8e8ed',
    fontSize: 15, background: '#fafafa', outline: 'none', boxSizing: 'border-box' as const,
  },
  error: { fontSize: 13, color: '#ef3c71', fontWeight: 600, marginBottom: 12 },
  submitBtn: {
    width: '100%', padding: '14px', borderRadius: 12, fontSize: 16, fontWeight: 700,
    background: 'linear-gradient(90deg,#ef3c71,#ff727d)', color: '#fff',
    boxShadow: '0 3px 12px rgba(239,60,113,0.3)',
  },
  bigIcon: { fontSize: 48, textAlign: 'center', marginBottom: 16 },
  doneTitle: { fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 12 },
  doneSub: { fontSize: 14, color: '#555', lineHeight: 1.7, textAlign: 'center' },
}
