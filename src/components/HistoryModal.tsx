import { UsageLog } from '../types'

interface Props {
  logs: UsageLog[]
  onClose: () => void
}

export default function HistoryModal({ logs, onClose }: Props) {
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />
        <div style={s.header}>
          <h2 style={s.title}>使用・入荷履歴</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {logs.length === 0 ? (
          <p style={s.empty}>まだ履歴がありません</p>
        ) : (
          <div style={s.list}>
            {logs.map(log => (
              <div key={log.id} style={s.row}>
                <div style={{ ...s.dot, background: log.type === 'use' ? 'var(--danger)' : 'var(--success)' }} />
                <div style={s.rowContent}>
                  <div style={s.rowTop}>
                    <span style={s.rowName}>{log.products?.name ?? '—'}</span>
                    <span style={{ ...s.rowQty, color: log.type === 'use' ? 'var(--danger)' : 'var(--success)' }}>
                      {log.type === 'use' ? '−' : '+'}{log.quantity}本
                    </span>
                  </div>
                  <div style={s.rowBottom}>
                    <span style={s.rowType}>{log.type === 'use' ? '使用' : '入荷'}</span>
                    {log.note && <span style={s.rowNote}>{log.note}</span>}
                    <span style={s.rowDate}>
                      {new Date(log.used_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
    background: '#fff', borderRadius: '24px 24px 0 0', padding: '12px 24px 32px',
    width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex',
    flexDirection: 'column', animation: 'slideUp 0.25s ease',
  },
  handle: { width: 40, height: 4, background: '#e2e8f0', borderRadius: 99, margin: '0 auto 16px', flexShrink: 0 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 },
  title: { fontSize: 20, fontWeight: 800 },
  closeBtn: { background: '#f1f0f7', color: 'var(--text-sub)', padding: '6px 12px', borderRadius: 10 },
  empty: { textAlign: 'center', color: 'var(--text-sub)', padding: '32px 0' },
  list: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 },
  row: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f0f7' },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6 },
  rowContent: { flex: 1, minWidth: 0 },
  rowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  rowName: { fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowQty: { fontWeight: 800, fontSize: 15, flexShrink: 0, marginLeft: 8 },
  rowBottom: { display: 'flex', alignItems: 'center', gap: 8 },
  rowType: { fontSize: 11, fontWeight: 700, color: 'var(--text-sub)', background: '#f1f0f7', padding: '2px 8px', borderRadius: 99 },
  rowNote: { fontSize: 12, color: 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowDate: { fontSize: 11, color: '#cbd5e1', marginLeft: 'auto', flexShrink: 0 },
}
