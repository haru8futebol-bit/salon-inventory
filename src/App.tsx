import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { Product, UsageLog, Recipe } from './types'
import ProductModal from './components/ProductModal'
import UsageModal from './components/UsageModal'
import RestockModal from './components/RestockModal'
import HistoryModal from './components/HistoryModal'
import VoiceInputButton from './components/VoiceInputButton'
import StockCountModal from './components/StockCountModal'
import RecipeModal from './components/RecipeModal'
import RecipeListModal from './components/RecipeListModal'

type Modal =
  | { type: 'add' }
  | { type: 'edit'; product: Product }
  | { type: 'use'; product: Product }
  | { type: 'restock'; product: Product }
  | { type: 'history' }
  | { type: 'stockCount' }
  | { type: 'recipeList' }
  | { type: 'recipeAdd' }
  | { type: 'recipeEdit'; recipe: Recipe }

type MessageType = 'bot' | 'user' | 'card' | 'alert'

interface ChatMessage {
  id: string
  type: MessageType
  text?: string
  cards?: Product[]
  alerts?: Product[]
  timestamp: Date
}

function uid() { return Math.random().toString(36).slice(2) }
function nowDate() { return new Date() }

async function sendLineNotification(message: string) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return
  try {
    await fetch(`${url}/functions/v1/line-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ message }),
    })
  } catch { /* LINE通知の失敗はサイレントに無視 */ }
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [modal, setModal] = useState<Modal | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const addMsg = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, { ...msg, id: uid(), timestamp: nowDate() }])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const fetchData = useCallback(async () => {
    const [{ data: p }, { data: l }, { data: r }] = await Promise.all([
      supabase.from('products').select('*').order('created_at'),
      supabase.from('usage_logs').select('*, products(name)').order('used_at', { ascending: false }).limit(100),
      supabase.from('recipes').select('*, recipe_items(*, products(name, stock))').order('created_at'),
    ])
    const prods = p ?? []
    setProducts(prods)
    setLogs(l ?? [])
    setRecipes(r ?? [])
    setLoading(false)
    return prods
  }, [])

  useEffect(() => {
    fetchData().then(prods => {
      const alerts = prods.filter(p => p.stock < p.threshold)
      setMessages([
        { id: uid(), type: 'bot', text: 'こんにちは！薬剤在庫管理アシスタントです。下のメニューから操作してください。', timestamp: nowDate() },
        ...(alerts.length > 0 ? [{ id: uid(), type: 'alert' as MessageType, alerts, timestamp: nowDate() }] : []),
      ])
    })
  }, [fetchData])

  // ── 薬剤 CRUD ──────────────────────────────────
  const handleAddOrEdit = async (name: string, stock: number, threshold: number, barcode: string) => {
    if (modal?.type === 'edit') {
      await supabase.from('products').update({ name, stock, threshold, barcode: barcode || null }).eq('id', modal.product.id)
      addMsg({ type: 'bot', text: `「${name}」を更新しました。` })
    } else {
      await supabase.from('products').insert({ name, stock, threshold, barcode: barcode || null })
      addMsg({ type: 'bot', text: `「${name}」を登録しました。在庫 ${stock}本、閾値 ${threshold}本で管理します。` })
    }
    setModal(null)
    fetchData()
  }

  const handleUse = async (quantity: number, note: string) => {
    if (modal?.type !== 'use') return
    const product = modal.product
    const newStock = product.stock - quantity
    await Promise.all([
      supabase.from('products').update({ stock: newStock }).eq('id', product.id),
      supabase.from('usage_logs').insert({ product_id: product.id, quantity, note: note || null, type: 'use' }),
    ])
    setModal(null)
    const prods = await fetchData()
    addMsg({ type: 'user', text: `${product.name} を ${quantity}本 使用` })
    setTimeout(() => {
      if (newStock < product.threshold) {
        addMsg({ type: 'bot', text: `記録しました。「${product.name}」の在庫が ${newStock}本になりました。⚠️ 閾値を下回っています！` })
        const alertMsg = `⚠️ 在庫アラート\n「${product.name}」の在庫が${newStock}本になりました。\n閾値: ${product.threshold}本\n発注をご検討ください。`
        sendLineNotification(alertMsg)
      } else {
        addMsg({ type: 'bot', text: `記録しました。「${product.name}」の残り在庫は ${newStock}本です。` })
      }
      const alerts = prods.filter(p => p.stock < p.threshold)
      if (alerts.length > 0) addMsg({ type: 'alert', alerts })
    }, 400)
  }

  const handleRestock = async (quantity: number, note: string) => {
    if (modal?.type !== 'restock') return
    const product = modal.product
    const newStock = product.stock + quantity
    await Promise.all([
      supabase.from('products').update({ stock: newStock }).eq('id', product.id),
      supabase.from('usage_logs').insert({ product_id: product.id, quantity, note: note || null, type: 'restock' }),
    ])
    setModal(null)
    fetchData()
    addMsg({ type: 'user', text: `${product.name} を ${quantity}本 入荷` })
    setTimeout(() => addMsg({ type: 'bot', text: `入荷を記録しました。「${product.name}」の在庫は ${newStock}本になりました。` }), 400)
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`「${product.name}」を削除しますか？`)) return
    await supabase.from('products').delete().eq('id', product.id)
    fetchData()
    addMsg({ type: 'bot', text: `「${product.name}」を削除しました。` })
  }

  // ── レシピ ─────────────────────────────────────
  const handleRecipeSave = async (name: string, memo: string, items: { product_id: string; quantity: string; unit: string; note: string }[]) => {
    if (modal?.type === 'recipeEdit') {
      await supabase.from('recipes').update({ name, memo: memo || null }).eq('id', modal.recipe.id)
      await supabase.from('recipe_items').delete().eq('recipe_id', modal.recipe.id)
      await supabase.from('recipe_items').insert(
        items.map(i => ({ recipe_id: modal.recipe.id, product_id: i.product_id, quantity: Number(i.quantity), unit: i.unit, note: i.note || null }))
      )
      addMsg({ type: 'bot', text: `レシピ「${name}」を更新しました。` })
    } else {
      const { data } = await supabase.from('recipes').insert({ name, memo: memo || null }).select().single()
      if (data) {
        await supabase.from('recipe_items').insert(
          items.map(i => ({ recipe_id: data.id, product_id: i.product_id, quantity: Number(i.quantity), unit: i.unit, note: i.note || null }))
        )
      }
      addMsg({ type: 'bot', text: `レシピ「${name}」を登録しました。` })
    }
    setModal(null)
    fetchData()
  }

  const handleRecipeApply = async (recipe: Recipe) => {
    if (!recipe.recipe_items || recipe.recipe_items.length === 0) return
    const updates = recipe.recipe_items
      .map(item => {
        const product = products.find(p => p.id === item.product_id)
        if (!product) return null
        return { product, item }
      })
      .filter(Boolean) as { product: Product; item: typeof recipe.recipe_items[0] }[]

    await Promise.all(
      updates.map(({ product, item }) => Promise.all([
        supabase.from('products').update({ stock: Math.max(0, product.stock - item.quantity) }).eq('id', product.id),
        supabase.from('usage_logs').insert({ product_id: product.id, quantity: item.quantity, note: `レシピ: ${recipe.name}`, type: 'use' }),
      ]))
    )

    const prods = await fetchData()
    setModal(null)
    addMsg({ type: 'user', text: `🧪 レシピ「${recipe.name}」を施術に使用` })
    setTimeout(() => {
      addMsg({ type: 'bot', text: `${updates.length}種類の薬剤の在庫を更新しました。` })
      const alerts = prods.filter(p => p.stock < p.threshold)
      if (alerts.length > 0) {
        addMsg({ type: 'alert', alerts })
        const lineMsg = `⚠️ 在庫アラート（レシピ施術後）\n要発注: ${alerts.map(p => `${p.name}（残り${p.stock}本）`).join('、')}`
        sendLineNotification(lineMsg)
      }
    }, 400)
  }

  const handleRecipeDelete = async (recipe: Recipe) => {
    if (!confirm(`「${recipe.name}」を削除しますか？`)) return
    await supabase.from('recipes').delete().eq('id', recipe.id)
    fetchData()
    addMsg({ type: 'bot', text: `レシピ「${recipe.name}」を削除しました。` })
  }

  // ── その他 ────────────────────────────────────
  const handleVoiceResult = ({ product, quantity }: { product: Product; quantity: number }) => {
    addMsg({ type: 'user', text: `🎤 ${product.name} を ${quantity}本 使った` })
    setTimeout(() => setModal({ type: 'use', product }), 200)
  }

  const handleStockCountApply = async (updates: { id: string; stock: number }[]) => {
    await Promise.all(updates.map(u => supabase.from('products').update({ stock: u.stock }).eq('id', u.id)))
    fetchData()
    addMsg({ type: 'bot', text: `写真から ${updates.length}件 の在庫数を更新しました。` })
  }

  const showStockList = () => {
    addMsg({ type: 'user', text: '在庫一覧を見る' })
    setTimeout(() => {
      if (products.length === 0) {
        addMsg({ type: 'bot', text: 'まだ薬剤が登録されていません。「薬剤追加」から登録してください。' })
      } else {
        addMsg({ type: 'bot', text: '現在の在庫状況です。' })
        setTimeout(() => addMsg({ type: 'card', cards: products }), 200)
      }
    }, 300)
  }

  const alerts = products.filter(p => p.stock < p.threshold)

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.avatar}>💊</div>
          <div>
            <p style={s.headerName}>在庫管理アシスタント</p>
            <p style={s.headerSub}>薬剤在庫管理</p>
          </div>
        </div>
        <div style={s.headerRight}>
          <button style={s.iconBtn} onClick={() => setModal({ type: 'recipeList' })} title="レシピ">🧪</button>
          <button style={s.iconBtn} onClick={() => setModal({ type: 'history' })} title="履歴">📋</button>
          <button style={s.iconBtn} onClick={() => setModal({ type: 'stockCount' })} title="写真で在庫確認">📷</button>
        </div>
      </header>

      {/* Chat */}
      <main style={s.main}>
        {loading ? (
          <div style={s.center}><div style={s.spinner} /></div>
        ) : (
          <>
            {messages.map(msg => (
              <div key={msg.id}>
                {msg.type === 'bot' && (
                  <div style={s.botRow}>
                    <div style={s.botAvatar}>💊</div>
                    <div style={s.botBubble}>{msg.text}</div>
                  </div>
                )}
                {msg.type === 'user' && (
                  <div style={s.userRow}>
                    <div style={s.userBubble}>{msg.text}</div>
                  </div>
                )}
                {msg.type === 'alert' && msg.alerts && msg.alerts.length > 0 && (
                  <div style={s.botRow}>
                    <div style={s.botAvatar}>⚠️</div>
                    <div style={s.alertCard}>
                      <p style={s.alertTitle}>要発注 {msg.alerts.length}件</p>
                      {msg.alerts.map(p => (
                        <div key={p.id} style={s.alertItem}>
                          <span style={s.alertName}>{p.name}</span>
                          <span style={s.alertStock}>残り {p.stock}本 / 閾値 {p.threshold}本</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {msg.type === 'card' && msg.cards && (
                  <div style={s.cardListWrapper}>
                    {msg.cards.map(p => {
                      const isAlert = p.stock < p.threshold
                      const ratio = p.threshold > 0 ? Math.min(p.stock / p.threshold, 1) : 1
                      return (
                        <div key={p.id} style={{ ...s.stockCard, ...(isAlert ? s.stockCardAlert : {}) }}>
                          <div style={s.stockCardTop}>
                            <span style={s.stockCardName}>{p.name}</span>
                            <span style={{ ...s.badge, ...(isAlert ? s.badgeDanger : s.badgeOk) }}>
                              {isAlert ? '要発注' : 'OK'}
                            </span>
                          </div>
                          {p.barcode && <p style={s.barcodeText}>〒 {p.barcode}</p>}
                          <div style={s.stockNumRow}>
                            <span style={{ ...s.stockNum, color: isAlert ? 'var(--danger)' : 'var(--text)' }}>{p.stock}</span>
                            <span style={s.stockUnit}>本</span>
                          </div>
                          <div style={s.barBg}>
                            <div style={{ ...s.barFill, width: `${ratio * 100}%`, background: isAlert ? 'var(--danger)' : 'var(--gradient)' }} />
                          </div>
                          <p style={s.thresholdText}>閾値 {p.threshold}本</p>
                          <div style={s.stockCardActions}>
                            <button style={s.useBtn} onClick={() => setModal({ type: 'use', product: p })}>使用</button>
                            <button style={s.restockBtn} onClick={() => setModal({ type: 'restock', product: p })}>入荷</button>
                            <button style={s.editBtn} onClick={() => setModal({ type: 'edit', product: p })}>···</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </main>

      {/* Quick actions */}
      <div style={s.quickActions}>
        <div style={s.quickScroll}>
          <button style={s.quickBtn} onClick={showStockList}>📦 在庫一覧</button>
          <button style={s.quickBtn} onClick={() => { addMsg({ type: 'user', text: '薬剤を追加する' }); setTimeout(() => setModal({ type: 'add' }), 200) }}>➕ 薬剤追加</button>
          <button style={s.quickBtn} onClick={() => { addMsg({ type: 'user', text: 'レシピを見る' }); setTimeout(() => setModal({ type: 'recipeList' }), 200) }}>🧪 レシピ</button>
          {alerts.length > 0 && (
            <button style={{ ...s.quickBtn, ...s.quickBtnAlert }} onClick={() => { addMsg({ type: 'user', text: '要発注一覧を確認' }); setTimeout(() => addMsg({ type: 'alert', alerts }), 300) }}>
              ⚠️ 要発注 {alerts.length}件
            </button>
          )}
        </div>
      </div>

      {/* Voice bar */}
      <div style={s.inputBar}>
        <VoiceInputButton products={products} onResult={handleVoiceResult} />
      </div>

      {/* Modals */}
      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <ProductModal
          product={modal.type === 'edit' ? modal.product : null}
          products={products}
          onClose={() => setModal(null)}
          onSave={handleAddOrEdit}
        />
      )}
      {modal?.type === 'use' && (
        <UsageModal product={modal.product} onClose={() => setModal(null)} onSave={handleUse} />
      )}
      {modal?.type === 'restock' && (
        <RestockModal product={modal.product} onClose={() => setModal(null)} onSave={handleRestock} />
      )}
      {modal?.type === 'history' && (
        <HistoryModal logs={logs} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'stockCount' && (
        <StockCountModal products={products} onApply={handleStockCountApply} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'recipeList' && (
        <RecipeListModal
          recipes={recipes}
          onClose={() => setModal(null)}
          onAdd={() => setModal({ type: 'recipeAdd' })}
          onEdit={(recipe) => setModal({ type: 'recipeEdit', recipe })}
          onApply={handleRecipeApply}
          onDelete={handleRecipeDelete}
        />
      )}
      {(modal?.type === 'recipeAdd' || modal?.type === 'recipeEdit') && (
        <RecipeModal
          recipe={modal.type === 'recipeEdit' ? modal.recipe : null}
          products={products}
          onClose={() => setModal(null)}
          onSave={handleRecipeSave}
        />
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#f0f0f5', overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gradient-dark)', padding: '12px 16px', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  headerName: { fontSize: 15, fontWeight: 700, color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  headerRight: { display: 'flex', gap: 4 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, fontSize: 18, background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' },
  main: { flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 12 },
  botRow: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  botAvatar: { width: 32, height: 32, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  botBubble: { background: '#fff', borderRadius: '18px 18px 18px 4px', padding: '10px 14px', fontSize: 14, lineHeight: 1.6, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', maxWidth: '75%' },
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  userBubble: { background: 'var(--gradient)', color: '#fff', borderRadius: '18px 18px 4px 18px', padding: '10px 14px', fontSize: 14, lineHeight: 1.6, boxShadow: '0 2px 8px rgba(99,102,241,0.3)', maxWidth: '75%' },
  alertCard: { background: '#fff', borderRadius: '18px 18px 18px 4px', padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid rgba(239,68,68,0.2)', maxWidth: '80%' },
  alertTitle: { fontSize: 13, fontWeight: 800, color: 'var(--danger)', marginBottom: 8 },
  alertItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f5f5f5' },
  alertName: { fontSize: 13, fontWeight: 600 },
  alertStock: { fontSize: 12, color: 'var(--danger)', marginLeft: 8 },
  cardListWrapper: { display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 40 },
  stockCard: { background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1.5px solid var(--border)' },
  stockCardAlert: { border: '1.5px solid rgba(239,68,68,0.3)', background: '#fff9f9' },
  stockCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  stockCardName: { fontSize: 14, fontWeight: 700 },
  barcodeText: { fontSize: 11, color: 'var(--text-sub)', marginBottom: 6 },
  badge: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 },
  badgeOk: { background: 'rgba(16,185,129,0.1)', color: '#059669' },
  badgeDanger: { background: 'rgba(239,68,68,0.1)', color: 'var(--danger)' },
  stockNumRow: { display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 8 },
  stockNum: { fontSize: 36, fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' },
  stockUnit: { fontSize: 14, fontWeight: 600, color: 'var(--text-sub)' },
  barBg: { height: 4, background: '#f0f0f5', borderRadius: 99, overflow: 'hidden', marginBottom: 4 },
  barFill: { height: '100%', borderRadius: 99, transition: 'width 0.6s ease' },
  thresholdText: { fontSize: 11, color: 'var(--text-sub)', marginBottom: 10 },
  stockCardActions: { display: 'flex', gap: 6 },
  useBtn: { flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'rgba(239,68,68,0.08)', color: 'var(--danger)' },
  restockBtn: { flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: 700, background: 'rgba(16,185,129,0.08)', color: '#059669' },
  editBtn: { padding: '8px 12px', borderRadius: 10, fontSize: 14, background: '#f0f0f5', color: 'var(--text-sub)' },
  quickActions: { background: '#fff', borderTop: '1px solid #ebebeb', padding: '10px 12px 6px', flexShrink: 0 },
  quickScroll: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 },
  quickBtn: { flexShrink: 0, padding: '8px 16px', borderRadius: 99, background: '#f0f0f5', color: 'var(--text)', fontSize: 13, fontWeight: 600, border: '1.5px solid #e5e5ea', whiteSpace: 'nowrap' },
  quickBtnAlert: { background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', border: '1.5px solid rgba(239,68,68,0.2)' },
  inputBar: { background: '#fff', borderTop: '1px solid #ebebeb', padding: '10px 16px 20px', flexShrink: 0 },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' },
  spinner: { width: 32, height: 32, border: '3px solid #eee', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
}
