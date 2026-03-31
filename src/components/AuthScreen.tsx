import { useState } from 'react'
import { supabase } from '../supabase'

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [salonName, setSalonName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false) // 新規登録後の確認メール案内

  const handleSubmit = async () => {
    setError('')
    if (!email || !password) { setError('メールアドレスとパスワードを入力してください'); return }
    if (mode === 'signup' && password.length < 6) { setError('パスワードは6文字以上で設定してください'); return }
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('メールアドレスまたはパスワードが正しくありません')
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { salon_name: salonName || 'マイサロン' } },
      })
      if (error) {
        setError('登録に失敗しました。もう一度お試しください。')
      } else {
        setDone(true)
      }
    }
    setLoading(false)
  }

  // 将来のLINEログイン用（コメントで残す）
  // const handleLineLogin = async () => {
  //   await supabase.auth.signInWithOAuth({ provider: 'line' })
  // }

  if (done) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.checkIcon}>✉️</div>
          <h2 style={s.doneTitle}>確認メールを送信しました</h2>
          <p style={s.doneSub}>
            <strong>{email}</strong> に確認メールを送りました。<br />
            メール内のリンクをタップしてアカウントを有効化してください。
          </p>
          <button style={s.switchBtn} onClick={() => { setDone(false); setMode('login') }}>
            ログイン画面へ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.logo}>✂️</div>
        <h1 style={s.appName}>在庫管理アシスタント</h1>
        <p style={s.appSub}>薬剤在庫管理</p>
      </div>

      <div style={s.card}>
        <h2 style={s.title}>{mode === 'login' ? 'ログイン' : 'アカウント登録'}</h2>

        {mode === 'signup' && (
          <div style={s.field}>
            <label style={s.label}>サロン名</label>
            <input
              value={salonName}
              onChange={e => setSalonName(e.target.value)}
              placeholder="例：ヘアサロン〇〇"
              style={s.input}
            />
          </div>
        )}

        <div style={s.field}>
          <label style={s.label}>メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="example@email.com"
            style={s.input}
            autoCapitalize="none"
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>パスワード{mode === 'signup' && '（6文字以上）'}</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={s.input}
          />
        </div>

        {error && <p style={s.error}>{error}</p>}

        <button style={s.submitBtn} onClick={handleSubmit} disabled={loading}>
          {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウントを作成'}
        </button>

        <div style={s.divider}>
          <span style={s.dividerText}>
            {mode === 'login' ? 'アカウントをお持ちでない方' : '既にアカウントをお持ちの方'}
          </span>
        </div>

        <button style={s.switchBtn} onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
          {mode === 'login' ? '新規登録はこちら' : 'ログインはこちら'}
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
  appSub: { fontSize: 13, color: '#aaa' },
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
    background: 'linear-gradient(90deg,#ef3c71,#ff727d)', color: '#fff', marginBottom: 16,
    boxShadow: '0 3px 12px rgba(239,60,113,0.3)',
  },
  divider: { textAlign: 'center', marginBottom: 12 },
  dividerText: { fontSize: 12, color: '#bbb' },
  switchBtn: {
    width: '100%', padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600,
    background: '#f5f5f7', color: '#1e1e21',
  },
  checkIcon: { fontSize: 48, textAlign: 'center', marginBottom: 16 },
  doneTitle: { fontSize: 18, fontWeight: 800, textAlign: 'center', marginBottom: 12 },
  doneSub: { fontSize: 14, color: '#555', lineHeight: 1.7, textAlign: 'center', marginBottom: 24 },
}
