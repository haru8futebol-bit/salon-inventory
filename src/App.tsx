import { useState, useEffect, useCallback } from 'react'
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

type Tab = 'stock' | 'recipe' | 'alert'

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
  } catch { /* サイレント */ }
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [modal, setModal] = useState<Modal | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('stock')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const fetchData = useCallback(async () => {
    const [{ data: p }, { data: l }, { data: r }] = await Promise.all([
      supabase.from('products').select('*').order('created_at'),
      supabase.from('usage_logs').select('*, products(name)').order('used_at', { ascending: false }).limit(100),
      supabase.from('recipes').select('*, recipe_items(*, products(name, stock))').order('created_at'),
    ])
    setProducts(p ?? [])
    setLogs(l ?? [])
    setRecipes(r ?? [])
    setLoading(false)
    return p ?? []
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── 薬剤 CRUD ──────────────────────────────────
  const handleAddOrEdit = async (name: string, stock: number, threshold: number, barcode: string) => {
    if (modal?.type === 'edit') {
      await supabase.from('products').update({ name, stock, threshold, barcode: barcode || null }).eq('id', modal.product.id)
      showToast(`「${name}」を更新しました`)
    } else {
      await supabase.from('products').insert({ name, stock, threshold, barcode: barcode || null })
      showToast(`「${name}」を登録しました`)
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
    await fetchData()
    showToast(`${product.name} ${quantity}本 使用記録しました`)
    if (newStock < product.threshold) {
      sendLineNotification(`⚠️ 在庫アラート\n「${product.name}」残り${newStock}本（閾値${product.threshold}本）`)
    }
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
    showToast(`${product.name} ${quantity}本 入荷しました`)
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`「${product.name}」を削除しますか？`)) return
    await supabase.from('products').delete().eq('id', product.id)
    fetchData()
    showToast(`「${product.name}」を削除しました`)
  }

  // ── レシピ ─────────────────────────────────────
  const handleRecipeSave = async (name: string, memo: string, items: { product_id: string; quantity: string; unit: string; note: string }[]) => {
    if (modal?.type === 'recipeEdit') {
      await supabase.from('recipes').update({ name, memo: memo || null }).eq('id', modal.recipe.id)
      await supabase.from('recipe_items').delete().eq('recipe_id', modal.recipe.id)
      await supabase.from('recipe_items').insert(
        items.map(i => ({ recipe_id: modal.recipe.id, product_id: i.product_id, quantity: Number(i.quantity), unit: i.unit, note: i.note || null }))
      )
      showToast(`レシピ「${name}」を更新しました`)
    } else {
      const { data } = await supabase.from('recipes').insert({ name, memo: memo || null }).select().single()
      if (data) {
        await supabase.from('recipe_items').insert(
          items.map(i => ({ recipe_id: data.id, product_id: i.product_id, quantity: Number(i.quantity), unit: i.unit, note: i.note || null }))
        )
      }
      showToast(`レシピ「${name}」を登録しました`)
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
    showToast(`レシピ「${recipe.name}」を適用しました`)
    const alertProds = prods.filter(p => p.stock < p.threshold)
    if (alertProds.length > 0) {
      sendLineNotification(`⚠️ 在庫アラート\n要発注: ${alertProds.map(p => `${p.name}（残り${p.stock}本）`).join('、')}`)
    }
  }

  const handleRecipeDelete = async (recipe: Recipe) => {
    if (!confirm(`「${recipe.name}」を削除しますか？`)) return
    await supabase.from('recipes').delete().eq('id', recipe.id)
    fetchData()
  }

  const handleVoiceResult = ({ product, quantity }: { product: Product; quantity: number }) => {
    setModal({ type: 'use', product })
    showToast(`🎤 ${product.name} ${quantity}本 — 使用記録画面を開きます`)
  }

  const handleStockCountApply = async (updates: { id: string; stock: number }[]) => {
    await Promise.all(updates.map(u => supabase.from('products').update({ stock: u.stock }).eq('id', u.id)))
    fetchData()
    showToast(`${updates.length}件の在庫を更新しました`)
  }

  const alerts = products.filter(p => p.stock < p.threshold)

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logo}>✂️</div>
          <div>
            <p style={s.headerName}>在庫管理アシスタント</p>
            <p style={s.headerSub}>薬剤在庫管理</p>
          </div>
        </div>
        <div style={s.headerRight}>
          <button style={s.iconBtn} onClick={() => setModal({ type: 'history' })} title="履歴">📋</button>
          <button style={s.iconBtn} onClick={() => setModal({ type: 'stockCount' })} title="写真で在庫確認">📷</button>
        </div>
      </header>

      {/* アラートバナー */}
      {alerts.length > 0 && (
        <div style={s.alertBanner} onClick={() => setTab('alert')}>
          <span style={s.alertBannerIcon}>⚠️</span>
          <span style={s.alertBannerText}>要発注 {alerts.length}件あります</span>
          <span style={s.alertBannerArrow}>›</span>
        </div>
      )}

      {/* タブ */}
      <div style={s.tabBar}>
        <button style={{ ...s.tab, ...(tab === 'stock' ? s.tabActive : {}) }} onClick={() => setTab('stock')}>
          📦 在庫一覧
        </button>
        <button style={{ ...s.tab, ...(tab === 'recipe' ? s.tabActive : {}) }} onClick={() => setTab('recipe')}>
          🧪 レシピ
        </button>
        {alerts.length > 0 && (
          <button style={{ ...s.tab, ...(tab === 'alert' ? s.tabActive : {}), ...s.tabAlert }} onClick={() => setTab('alert')}>
            ⚠️ 要発注
            <span style={s.tabBadge}>{alerts.length}</span>
          </button>
        )}
      </div>

      {/* メインコンテンツ */}
      <main style={s.main}>
        {loading ? (
          <div style={s.center}><div style={s.spinner} /></div>
        ) : (
          <>
            {/* 在庫一覧タブ */}
            {tab === 'stock' && (
              <div>
                {products.length === 0 ? (
                  <div style={s.empty}>
                    <p style={s.emptyIcon}>💊</p>
                    <p style={s.emptyTitle}>薬剤が登録されていません</p>
                    <p style={s.emptySub}>下のボタンから薬剤を登録してください</p>
                  </div>
                ) : (
                  products.map(p => {
                    const isAlert = p.stock < p.threshold
                    const ratio = p.threshold > 0 ? Math.min(p.stock / p.threshold, 1) : 1
                    return (
                      <div key={p.id} style={{ ...s.card, ...(isAlert ? s.cardAlert : {}) }}>
                        <div style={s.cardTop}>
                          <div style={s.cardLeft}>
                            <span style={s.cardName}>{p.name}</span>
                            {p.barcode && <span style={s.cardBarcode}>〒 {p.barcode}</span>}
                          </div>
                          <div style={s.cardRight}>
                            <span style={{ ...s.badge, ...(isAlert ? s.badgeDanger : s.badgeOk) }}>
                              {isAlert ? '要発注' : 'OK'}
                            </span>
                            <button style={s.moreBtn} onClick={() => setModal({ type: 'edit', product: p })}>···</button>
                          </div>
                        </div>
                        <div style={s.stockRow}>
                          <span style={{ ...s.stockNum, color: isAlert ? '#ef3c71' : '#1e1e21' }}>{p.stock}</span>
                          <span style={s.stockUnit}>本</span>
                          <span style={s.thresholdLabel}>/ 閾値 {p.threshold}本</span>
                        </div>
                        <div style={s.barBg}>
                          <div style={{ ...s.barFill, width: `${ratio * 100}%`, background: isAlert ? 'linear-gradient(90deg,#ef3c71,#ff727d)' : 'linear-gradient(90deg,#10b981,#34d399)' }} />
                        </div>
                        <div style={s.cardActions}>
                          <button style={s.useBtn} onClick={() => setModal({ type: 'use', product: p })}>使用する</button>
                          <button style={s.restockBtn} onClick={() => setModal({ type: 'restock', product: p })}>入荷する</button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* レシピタブ */}
            {tab === 'recipe' && (
              <div>
                {recipes.length === 0 ? (
                  <div style={s.empty}>
                    <p style={s.emptyIcon}>🧪</p>
                    <p style={s.emptyTitle}>レシピが登録されていません</p>
                    <p style={s.emptySub}>下のボタンから登録してください</p>
                  </div>
                ) : (
                  recipes.map(recipe => (
                    <div key={recipe.id} style={s.recipeCard}>
                      <div style={s.recipeTop}>
                        <div>
                          <p style={s.recipeName}>{recipe.name}</p>
                          {recipe.memo && <p style={s.recipeMemo}>{recipe.memo}</p>}
                        </div>
                        <button style={s.recipeEditBtn} onClick={() => setModal({ type: 'recipeEdit', recipe })}>編集</button>
                      </div>
                      {recipe.recipe_items && recipe.recipe_items.length > 0 && (
                        <div style={s.recipeIngredients}>
                          {recipe.recipe_items.map(item => (
                            <span key={item.id} style={s.ingredientChip}>
                              {item.products?.name} {item.quantity}{item.unit}
                            </span>
                          ))}
                        </div>
                      )}
                      <button style={s.applyBtn} onClick={() => {
                        if (!confirm(`「${recipe.name}」を施術に使いますか？`)) return
                        handleRecipeApply(recipe)
                      }}>
                        ✓ 施術に使う
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 要発注タブ */}
            {tab === 'alert' && (
              <div>
                {alerts.length === 0 ? (
                  <div style={s.empty}>
                    <p style={s.emptyIcon}>✅</p>
                    <p style={s.emptyTitle}>要発注はありません</p>
                  </div>
                ) : (
                  alerts.map(p => (
                    <div key={p.id} style={{ ...s.card, ...s.cardAlert }}>
                      <div style={s.cardTop}>
                        <span style={s.cardName}>{p.name}</span>
                        <span style={{ ...s.badge, ...s.badgeDanger }}>要発注</span>
                      </div>
                      <div style={s.stockRow}>
                        <span style={{ ...s.stockNum, color: '#ef3c71' }}>{p.stock}</span>
                        <span style={s.stockUnit}>本</span>
                        <span style={s.thresholdLabel}>/ 閾値 {p.threshold}本</span>
                      </div>
                      <button style={s.restockBtn} onClick={() => setModal({ type: 'restock', product: p })}>入荷する</button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ボトムアクション */}
      <div style={s.bottomBar}>
        <div style={s.voiceRow}>
          <VoiceInputButton products={products} onResult={handleVoiceResult} />
        </div>
        <div style={s.actionRow}>
          <button style={s.addBtn} onClick={() => setModal({ type: 'add' })}>＋ 薬剤を追加</button>
          {tab === 'recipe' && (
            <button style={s.addBtnSub} onClick={() => setModal({ type: 'recipeAdd' })}>＋ レシピ追加</button>
          )}
        </div>
      </div>

      {/* トースト */}
      {toast && <div style={s.toast}>{toast}</div>}

      {/* Modals */}
      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <ProductModal product={modal.type === 'edit' ? modal.product : null} products={products} onClose={() => setModal(null)} onSave={handleAddOrEdit} />
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
        <RecipeListModal recipes={recipes} onClose={() => setModal(null)} onAdd={() => setModal({ type: 'recipeAdd' })} onEdit={(recipe) => setModal({ type: 'recipeEdit', recipe })} onApply={handleRecipeApply} onDelete={handleRecipeDelete} />
      )}
      {(modal?.type === 'recipeAdd' || modal?.type === 'recipeEdit') && (
        <RecipeModal recipe={modal.type === 'recipeEdit' ? modal.recipe : null} products={products} onClose={() => setModal(null)} onSave={handleRecipeSave} />
      )}

      {/* 削除は編集モーダル経由 */}
      {modal?.type === 'edit' && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 200 }}>
          <button style={s.deleteFloatBtn} onClick={() => handleDelete(modal.product)}>🗑 削除</button>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#f7f7f9', overflow: 'hidden', fontFamily: "'Hiragino Kaku Gothic ProN', 'Hiragino Sans', sans-serif" },

  // ヘッダー（ピンク系グラデーション）
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(90deg, #ef3c71, #ff727d)', padding: '12px 16px', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  headerName: { fontSize: 15, fontWeight: 700, color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  headerRight: { display: 'flex', gap: 6 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, fontSize: 17, background: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  // アラートバナー
  alertBanner: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff3f6', padding: '10px 16px', borderBottom: '1px solid rgba(239,60,113,0.15)', cursor: 'pointer', flexShrink: 0 },
  alertBannerIcon: { fontSize: 16 },
  alertBannerText: { flex: 1, fontSize: 13, fontWeight: 700, color: '#ef3c71' },
  alertBannerArrow: { fontSize: 18, color: '#ef3c71' },

  // タブ
  tabBar: { display: 'flex', background: '#fff', borderBottom: '1px solid #ebebeb', flexShrink: 0 },
  tab: { flex: 1, padding: '12px 4px', fontSize: 13, fontWeight: 600, color: '#888', background: 'none', borderBottom: '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabActive: { color: '#ef3c71', borderBottom: '2px solid #ef3c71' },
  tabAlert: { color: '#ef3c71' },
  tabBadge: { background: '#ef3c71', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '1px 6px', marginLeft: 2 },

  // メイン
  main: { flex: 1, overflowY: 'auto', padding: '12px' },

  // 薬剤カード
  card: { background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1.5px solid #ebebeb' },
  cardAlert: { border: '1.5px solid rgba(239,60,113,0.25)', background: '#fff' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
  cardRight: { display: 'flex', alignItems: 'center', gap: 6 },
  cardName: { fontSize: 15, fontWeight: 700, color: '#1e1e21' },
  cardBarcode: { fontSize: 11, color: '#aaa' },
  badge: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 },
  badgeOk: { background: 'rgba(16,185,129,0.1)', color: '#059669' },
  badgeDanger: { background: 'rgba(239,60,113,0.1)', color: '#ef3c71' },
  moreBtn: { fontSize: 18, color: '#bbb', padding: '0 4px', background: 'none' },
  stockRow: { display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 },
  stockNum: { fontSize: 38, fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' },
  stockUnit: { fontSize: 14, fontWeight: 600, color: '#aaa' },
  thresholdLabel: { fontSize: 12, color: '#bbb', marginLeft: 4 },
  barBg: { height: 5, background: '#f0f0f5', borderRadius: 99, overflow: 'hidden', marginBottom: 12 },
  barFill: { height: '100%', borderRadius: 99, transition: 'width 0.5s ease' },
  cardActions: { display: 'flex', gap: 8 },
  useBtn: { flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'rgba(239,60,113,0.08)', color: '#ef3c71' },
  restockBtn: { flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'rgba(16,185,129,0.08)', color: '#059669' },

  // レシピカード
  recipeCard: { background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1.5px solid #ebebeb' },
  recipeTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  recipeName: { fontSize: 15, fontWeight: 700, color: '#1e1e21' },
  recipeMemo: { fontSize: 12, color: '#aaa', marginTop: 2 },
  recipeEditBtn: { fontSize: 12, color: '#aaa', background: '#f5f5f7', padding: '4px 10px', borderRadius: 8 },
  recipeIngredients: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  ingredientChip: { fontSize: 12, fontWeight: 600, background: 'rgba(239,60,113,0.08)', color: '#ef3c71', padding: '3px 10px', borderRadius: 99 },
  applyBtn: { width: '100%', padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'linear-gradient(90deg,#ef3c71,#ff727d)', color: '#fff' },

  // ボトム
  bottomBar: { background: '#fff', borderTop: '1px solid #ebebeb', padding: '10px 16px 20px', flexShrink: 0 },
  voiceRow: { marginBottom: 8 },
  actionRow: { display: 'flex', gap: 8 },
  addBtn: { flex: 1, padding: '13px', borderRadius: 12, fontSize: 15, fontWeight: 700, background: 'linear-gradient(90deg,#ef3c71,#ff727d)', color: '#fff', boxShadow: '0 3px 12px rgba(239,60,113,0.3)' },
  addBtnSub: { flex: 1, padding: '13px', borderRadius: 12, fontSize: 15, fontWeight: 700, background: '#f5f5f7', color: '#1e1e21' },

  // 空状態
  empty: { textAlign: 'center', padding: '60px 20px' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: '#1e1e21', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#aaa' },

  // トースト
  toast: { position: 'fixed', bottom: 120, left: '50%', transform: 'translateX(-50%)', background: 'rgba(30,30,33,0.9)', color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 20px', borderRadius: 99, whiteSpace: 'nowrap', zIndex: 999, backdropFilter: 'blur(8px)' },

  // 削除ボタン
  deleteFloatBtn: { background: '#fee2e2', color: '#ef3c71', fontWeight: 700, fontSize: 13, padding: '10px 20px', borderRadius: 99, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },

  // ユーティリティ
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' },
  spinner: { width: 32, height: 32, border: '3px solid #eee', borderTop: '3px solid #ef3c71', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
}
