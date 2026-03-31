import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import type { User } from '@supabase/supabase-js'

interface Profile {
  salon_name: string
  avatar_url: string
}

interface Props {
  user: User
  onClose: () => void
  onSaved: (profile: Profile) => void
}

export default function ProfileModal({ user, onClose, onSaved }: Props) {
  const [salonName, setSalonName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordToast, setPasswordToast] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setSalonName(data.salon_name ?? '')
        setAvatarUrl(data.avatar_url ?? '')
        setAvatarPreview(data.avatar_url ?? '')
      }
    })
  }, [user.id])

  const handlePhotoUpload = async (file: File) => {
    setPhotoLoading(true)
    const reader = new FileReader()
    reader.onload = e => setAvatarPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    const ext = file.name.split('.').pop() ?? 'jpg'
    // タイムスタンプを付けてキャッシュを回避
    const path = `avatars/${user.id}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
    } else {
      setToast('写真のアップロードに失敗しました')
    }
    setPhotoLoading(false)
  }

  const handleSave = async () => {
    setLoading(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      salon_name: salonName,
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    })
    setLoading(false)
    if (error) {
      setToast('保存に失敗しました')
      return
    }
    setToast('保存しました')
    setTimeout(() => {
      onSaved({ salon_name: salonName, avatar_url: avatarUrl })
      onClose()
    }, 800)
  }

  const handlePasswordChange = async () => {
    setPasswordToast('')
    if (newPassword.length < 6) { setPasswordToast('パスワードは6文字以上で設定してください'); return }
    if (newPassword !== confirmPassword) { setPasswordToast('パスワードが一致しません'); return }
    setPasswordLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordLoading(false)
    if (error) { setPasswordToast('変更に失敗しました'); return }
    setNewPassword('')
    setConfirmPassword('')
    setShowPasswordSection(false)
    setToast('パスワードを変更しました')
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />
        <h2 style={s.title}>プロフィール設定</h2>

        {/* アバター */}
        <div style={s.avatarSection}>
          <div style={s.avatarWrap}>
            {avatarPreview
              ? <img src={avatarPreview} style={s.avatarImg} alt="プロフィール写真" />
              : <span style={s.avatarIcon}>✂️</span>
            }
          </div>
          <label style={{ ...s.photoBtn, opacity: photoLoading ? 0.6 : 1, position: 'relative', overflow: 'hidden' }}>
            <input type="file" accept="image/*"
              style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, opacity: 0, cursor: 'pointer' }}
              onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
            {photoLoading ? 'アップロード中...' : '写真を変更'}
          </label>
        </div>

        {/* サロン名 */}
        <div style={s.field}>
          <label style={s.label}>サロン名</label>
          <input value={salonName} onChange={e => setSalonName(e.target.value)}
            placeholder="例：ヘアサロン〇〇" style={s.input} />
        </div>

        {/* メールアドレス（表示のみ） */}
        <div style={s.field}>
          <label style={s.label}>メールアドレス</label>
          <p style={s.emailDisplay}>{user.email}</p>
        </div>

        {/* パスワード変更 */}
        <div style={s.field}>
          <button style={s.passwordToggleBtn} onClick={() => setShowPasswordSection(v => !v)}>
            🔑 パスワードを変更する {showPasswordSection ? '▲' : '▼'}
          </button>
          {showPasswordSection && (
            <div style={s.passwordSection}>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="新しいパスワード（6文字以上）" style={{ ...s.input, marginBottom: 10 }} />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="パスワードを確認" style={s.input} />
              {passwordToast && <p style={s.errorMsg}>{passwordToast}</p>}
              <button style={{ ...s.saveBtn, marginTop: 12, marginBottom: 0 }} onClick={handlePasswordChange} disabled={passwordLoading}>
                {passwordLoading ? '変更中...' : 'パスワードを変更する'}
              </button>
            </div>
          )}
        </div>

        {toast && <p style={s.toastMsg}>{toast}</p>}

        <button style={{ ...s.saveBtn, opacity: loading || photoLoading ? 0.6 : 1 }} onClick={handleSave} disabled={loading || photoLoading}>
          {loading ? '保存中...' : photoLoading ? 'アップロード中...' : '変更を保存'}
        </button>
        <button style={s.cancelBtn} onClick={onClose}>閉じる</button>
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
    width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
  },
  handle: { width: 40, height: 4, background: '#e2e8f0', borderRadius: 99, margin: '0 auto 20px' },
  title: { fontSize: 20, fontWeight: 800, marginBottom: 24 },
  avatarSection: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 },
  avatarWrap: {
    width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(90deg,#ef3c71,#ff727d)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarIcon: { fontSize: 32, color: '#fff' },
  photoBtn: {
    padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    background: '#f5f5f7', color: '#1e1e21', cursor: 'pointer', display: 'inline-block',
  },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6, letterSpacing: '0.04em' },
  input: {
    width: '100%', padding: '13px 14px', borderRadius: 10, border: '1.5px solid #e8e8ed',
    fontSize: 15, background: '#fafafa', outline: 'none', boxSizing: 'border-box' as const,
  },
  emailDisplay: { fontSize: 14, color: '#888', padding: '13px 0' },
  toastMsg: { fontSize: 13, color: '#059669', fontWeight: 700, textAlign: 'center', marginBottom: 12 },
  saveBtn: {
    width: '100%', padding: '14px', borderRadius: 12, fontSize: 16, fontWeight: 700,
    background: 'linear-gradient(90deg,#ef3c71,#ff727d)', color: '#fff', marginBottom: 10,
    boxShadow: '0 3px 12px rgba(239,60,113,0.3)',
  },
  cancelBtn: {
    width: '100%', padding: '13px', borderRadius: 12, fontSize: 15, fontWeight: 600,
    background: '#f1f0f7', color: '#888',
  },
  passwordToggleBtn: {
    width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600,
    background: '#f5f5f7', color: '#555', textAlign: 'left' as const,
  },
  passwordSection: {
    marginTop: 12, padding: '16px', background: '#fafafa',
    borderRadius: 10, border: '1.5px solid #e8e8ed',
  },
  errorMsg: { fontSize: 13, color: '#ef3c71', fontWeight: 600, marginTop: 8 },
}
