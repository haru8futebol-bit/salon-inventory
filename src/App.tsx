import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { Product, UsageLog, Recipe, Order } from './types'
import type { User } from '@supabase/supabase-js'
import ProductModal from './components/ProductModal'
import UsageModal from './components/UsageModal'
import RestockModal from './components/RestockModal'
import HistoryModal from './components/HistoryModal'
import VoiceInputButton from './components/VoiceInputButton'
import StockCountModal from './components/StockCountModal'
import RecipeModal from './components/RecipeModal'
import RecipeListModal from './components/RecipeListModal'
import OrderCreateModal from './components/OrderCreateModal'
import AuthScreen from './components/AuthScreen'
import ProfileModal from './components/ProfileModal'

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
  | { type: 'orderCreate'; product: Product }
  | { type: 'profile' }

type Tab = 'stock' | 'recipe' | 'order' | 'alert'

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
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [profile, setProfile] = useState<{ salon_name: string; avatar_url: string } | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [modal, setModal] = useState<Modal | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('stock')
  const [toast, setToast] = useState('')

  // セッション監視（自動ログイン：localStorageにセッションが残っていれば自動復元）
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // プロフィール読み込み
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('salon_name, avatar_url').eq('id', user.id).single().then(({ data }) => {
      if (data) setProfile({ salon_name: data.salon_name ?? 'マイサロン', avatar_url: data.avatar_url ?? '' })
    })
  }, [user])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    showToast('ログアウトしました')
  }

  const fetchData = useCallback(async () => {
    const [{ data: p }, { data: l }, { data: r }, { data: o }] = await Promise.all([
      supabase.from('products').select('*').order('created_at'),
      supabase.from('usage_logs').select('*, products(name)').order('used_at', { ascending: false }).limit(100),
      supabase.from('recipes').select('*, recipe_items(*, products(name, stock))').order('created_at'),
      supabase.from('orders').select('*, products(name)').order('ordered_at', { ascending: false }),
    ])
    setProducts(p ?? [])
    setLogs(l ?? [])
    setRecipes(r ?? [])
    setOrders(o ?? [])
    setLoading(false)
    return p ?? []
  }, [])

  useEffect(() => { if (user) fetchData() }, [fetchData, user])

  const handleAddOrEdit = async (name: string, stock: number, threshold: number, barcode: string, imageUrl: string) => {
    if (modal?.type === 'edit') {
      await supabase.from('products').update({ name, stock, threshold, barcode: barcode || null, image_url: imageUrl || null }).eq('id', modal.product.id)
      showToast(`「${name}」を更新しました`)
    } else {
      await supabase.from('products').insert({ name, stock, threshold, barcode: barcode || null, image_url: imageUrl || null, user_id: user?.id })
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
      supabase.from('usage_logs').insert({ product_id: product.id, quantity, note: note || null, type: 'use', user_id: user?.id }),
    ])
    setModal(null)
    await fetchData()
    showToast(`${product.name} ${quantity}本 使用しました`)
    if (newStock < product.threshold) {
      sendLineNotification(`⚠️ 在庫アラート\n「${product.name}」残り${newStock}本（発注ライン${product.threshold}本）`)
    }
  }

  const handleRestock = async (quantity: number, note: string) => {
    if (modal?.type !== 'restock') return
    const product = modal.product
    const newStock = product.stock + quantity
    await Promise.all([
      supabase.from('products').update({ stock: newStock }).eq('id', product.id),
      supabase.from('usage_logs').insert({ product_id: product.id, quantity, note: note || null, type: 'restock', user_id: user?.id }),
    ])
    setModal(null)
    fetchData()
    showToast(`${product.name} ${quantity}本 入荷しました`)
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`「${product.name}」を削除しますか？`)) return
    await supabase.from('products').delete().eq('id', product.id)
    setModal(null)
    fetchData()
    showToast(`「${product.name}」を削除しました`)
  }

  const handleCreateOrder = async (quantity: number) => {
    if (modal?.type !== 'orderCreate') return
    const product = modal.product
    await supabase.from('orders').insert({ product_id: product.id, quantity, status: '発注中', user_id: user?.id })
    setModal(null)
    fetchData()
    showToast(`「${product.name}」${quantity}本 発注しました`)
    setTab('order')
  }

  const handleReceiveOrder = async (order: Order) => {
    const productName = order.products?.name ?? '商品'
    if (!confirm(`「${productName}」${order.quantity}本を受け取りましたか？\n在庫に自動で加算されます。`)) return
    const product = products.find(p => p.id === order.product_id)
    const ps = [
      supabase.from('orders').update({ status: '受け取り済み', received_at: new Date().toISOString() }).eq('id', order.id).then(() => {}),
    ]
    if (product) {
      ps.push(
        supabase.from('products').update({ stock: product.stock + order.quantity }).eq('id', product.id).then(() => {}),
        supabase.from('usage_logs').insert({ product_id: product.id, quantity: order.quantity, note: '発注品受け取り', type: 'restock', user_id: user?.id }).then(() => {}),
      )
    }
    await Promise.all(ps)
    fetchData()
    showToast(`${productName} ${order.quantity}本 在庫に加算しました`)
  }

  const handleRecipeSave = async (name: string, memo: string, items: { product_id: string; quantity: string; unit: string; note: string }[]) => {
    if (modal?.type === 'recipeEdit') {
      await supabase.from('recipes').update({ name, memo: memo || null }).eq('id', modal.recipe.id)
      await supabase.from('recipe_items').delete().eq('recipe_id', modal.recipe.id)
      await supabase.from('recipe_items').insert(
        items.map(i => ({ recipe_id: modal.recipe.id, product_id: i.product_id, quantity: Number(i.quantity), unit: i.unit, note: i.note || null }))
      )
      showToast(`レシピ「${name}」を更新しました`)
    } else {
      const { data } = await supabase.from('recipes').insert({ name, memo: memo || null, user_id: user?.id }).select().single()
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
  const activeOrders = orders.filter(o => o.status === '発注中')
  const receivedOrders = orders.filter(o => o.status === '受け取り済み')

  const formatDate = (str: string) => {
    const d = new Date(str)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  // 初期化中
  if (user === undefined) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh', background: '#f7f7f9' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTop: '3px solid #ef3c71', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  // 未ログイン
  if (!user) return <AuthScreen />

  return (
    <div style={s.page}>
      <header style={s.header}>
        <button style={s.headerLeft} onClick={() => setModal({ type: 'profile' })}>
          <div style={s.avatarBtn}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} style={s.avatarImg} alt="" />
              : <span style={s.avatarIcon}>✂️</span>
            }
          </div>
          <div>
            <p style={s.headerName}>{profile?.salon_name ?? '在庫管理アシスタント'}</p>
            <p style={s.headerSub}>タップでプロフィール編集</p>
          </div>
        </button>
        <div style={s.headerRight}>
          <button style={s.iconBtn} onClick={() => setModal({ type: 'history' })}>📋</button>
          <button style={s.iconBtn} onClick={() => setModal({ type: 'stockCount' })}>📷</button>
          <button style={s.iconBtn} onClick={handleLogout} title="ログアウト">🚪</button>
        </div>
      </header>

      {alerts.length > 0 && (
        <div style={s.alertBanner} onClick={() => setTab('alert')}>
          <span>⚠️</span>
          <span style={s.alertBannerText}>要発注 {alerts.length}件あります</span>
          <span style={s.alertBannerArrow}>›</span>
        </div>
      )}

      <div style={s.tabBar}>
        <button style={{ ...s.tab, ...(tab === 'stock' ? s.tabActive : {}) }} onClick={() => setTab('stock')}>📦 在庫</button>
        <button style={{ ...s.tab, ...(tab === 'recipe' ? s.tabActive : {}) }} onClick={() => setTab('recipe')}>🧪 レシピ</button>
        <button style={{ ...s.tab, ...(tab === 'order' ? s.tabActive : {}) }} onClick={() => setTab('order')}>
          📋 発注{activeOrders.length > 0 && <span style={s.tabBadge}>{activeOrders.length}</span>}
        </button>
        {alerts.length > 0 && (
          <button style={{ ...s.tab, ...(tab === 'alert' ? s.tabActive : {}), ...s.tabAlert }} onClick={() => setTab('alert')}>
            ⚠️<span style={s.tabBadge}>{alerts.length}</span>
          </button>
        )}
      </div>

      <main style={s.main}>
        {loading ? (
          <div style={s.center}><div style={s.spinner} /></div>
        ) : (
          <>
            {tab === 'stock' && (
              <div>
                {products.length === 0 ? (
                  <div style={s.empty}>
                    <p style={s.emptyIcon}>💊</p>
                    <p style={s.emptyTitle}>薬剤が登録されていません</p>
                    <p style={s.emptySub}>下のボタンから薬剤を登録してください</p>
                  </div>
                ) : products.map(p => {
                  const isAlert = p.stock < p.threshold
                  const ratio = p.threshold > 0 ? Math.min(p.stock / p.threshold, 1) : 1
                  return (
                    <div key={p.id} style={{ ...s.card, ...(isAlert ? s.cardAlert : {}) }}>
                      <div style={s.cardInner}>
                        <div style={s.cardPhoto}>
                          {p.image_url ? <img src={p.image_url} style={s.cardPhotoImg} alt="" /> : <span style={s.cardPhotoIcon}>💊</span>}
                        </div>
                        <div style={s.cardContent}>
                          <div style={s.cardTop}>
                            <div style={s.cardLeft}>
                              <span style={s.cardName}>{p.name}</span>
                              {p.barcode && <span style={s.cardBarcode}>〒 {p.barcode}</span>}
                            </div>
                            <div style={s.cardRight}>
                              <span style={{ ...s.badge, ...(isAlert ? s.badgeDanger : s.badgeOk) }}>{isAlert ? '要発注' : 'OK'}</span>
                              <button style={s.moreBtn} onClick={() => setModal({ type: 'edit', product: p })}>···</button>
                            </div>
                          </div>
                          <div style={s.stockRow}>
                            <span style={{ ...s.stockNum, color: isAlert ? '#ef3c71' : '#1e1e21' }}>{p.stock}</span>
                            <span style={s.stockUnit}>本</span>
                            <span style={s.thresholdLabel}>発注ライン: {p.threshold}本</span>
                          </div>
                          <div style={s.barBg}>
                            <div style={{ ...s.barFill, width: `${ratio * 100}%`, background: isAlert ? 'linear-gradient(90deg,#ef3c71,#ff727d)' : 'linear-gradient(90deg,#10b981,#34d399)' }} />
                          </div>
                          <div style={s.cardActions}>
                            <button style={s.useBtn} onClick={() => setModal({ type: 'use', product: p })}>使用</button>
                            <button style={s.restockBtn} onClick={() => setModal({ type: 'restock', product: p })}>入荷</button>
                            <button style={s.orderBtn} onClick={() => setModal({ type: 'orderCreate', product: p })}>発注</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'recipe' && (
              <div>
                {recipes.length === 0 ? (
                  <div style={s.empty}>
                    <p style={s.emptyIcon}>🧪</p>
                    <p style={s.emptyTitle}>レシピが登録されていません</p>
                    <p style={s.emptySub}>下のボタンから登録してください</p>
                  </div>
                ) : recipes.map(recipe => (
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
                          <span key={item.id} style={s.ingredientChip}>{item.products?.name} {item.quantity}{item.unit}</span>
                        ))}
                      </div>
                    )}
                    <button style={s.applyBtn} onClick={() => { if (!confirm(`「${recipe.name}」を施術に使いますか？`)) return; handleRecipeApply(recipe) }}>
                      ✓ 施術に使う
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === 'order' && (
              <div>
                {orders.length === 0 ? (
                  <div style={s.empty}>
                    <p style={s.emptyIcon}>📋</p>
                    <p style={s.emptyTitle}>発注履歴がありません</p>
                    <p style={s.emptySub}>在庫一覧の「発注」ボタンから発注できます</p>
                  </div>
                ) : (
                  <>
                    {activeOrders.length > 0 && (
                      <>
                        <p style={s.orderSection}>発注中 ({activeOrders.length}件)</p>
                        {activeOrders.map(order => (
                          <div key={order.id} style={{ ...s.orderCard, ...s.orderCardActive }}>
                            <div style={s.orderTop}>
                              <div>
                                <p style={s.orderProductName}>{order.products?.name ?? '—'}</p>
                                <p style={s.orderMeta}>{formatDate(order.ordered_at)} 発注 · {order.quantity}本</p>
                              </div>
                              <span style={{ ...s.orderBadge, ...s.orderBadgeActive }}>発注中</span>
                            </div>
                            <button style={s.receiveBtn} onClick={() => handleReceiveOrder(order)}>✓ 受け取った</button>
                          </div>
                        ))}
                      </>
                    )}
                    {receivedOrders.length > 0 && (
                      <>
                        <p style={{ ...s.orderSection, marginTop: 16 }}>受け取り済み</p>
                        {receivedOrders.map(order => (
                          <div key={order.id} style={s.orderCard}>
                            <div style={s.orderTop}>
                              <div>
                                <p style={s.orderProductName}>{order.products?.name ?? '—'}</p>
                                <p style={s.orderMeta}>{formatDate(order.ordered_at)} 発注 · {order.quantity}本{order.received_at && ` · ${formatDate(order.received_at)} 受取`}</p>
                              </div>
                              <span style={{ ...s.orderBadge, ...s.orderBadgeDone }}>受取済</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {tab === 'alert' && (
              <div>
                {alerts.length === 0 ? (
                  <div style={s.empty}>
                    <p style={s.emptyIcon}>✅</p>
                    <p style={s.emptyTitle}>要発注はありません</p>
                  </div>
                ) : alerts.map(p => (
                  <div key={p.id} style={{ ...s.card, ...s.cardAlert }}>
                    <div style={s.cardInner}>
                      <div style={s.cardPhoto}>
                        {p.image_url ? <img src={p.image_url} style={s.cardPhotoImg} alt="" /> : <span style={s.cardPhotoIcon}>💊</span>}
                      </div>
                      <div style={s.cardContent}>
                        <div style={s.cardTop}>
                          <span style={s.cardName}>{p.name}</span>
                          <span style={{ ...s.badge, ...s.badgeDanger }}>要発注</span>
                        </div>
                        <div style={s.stockRow}>
                          <span style={{ ...s.stockNum, color: '#ef3c71' }}>{p.stock}</span>
                          <span style={s.stockUnit}>本</span>
                          <span style={s.thresholdLabel}>発注ライン: {p.threshold}本</span>
                        </div>
                        <div style={s.cardActions}>
                          <button style={s.restockBtn} onClick={() => setModal({ type: 'restock', product: p })}>入荷</button>
                          <button style={s.orderBtn} onClick={() => setModal({ type: 'orderCreate', product: p })}>発注</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <div style={s.bottomBar}>
        <div style={s.voiceRow}><VoiceInputButton products={products} onResult={handleVoiceResult} /></div>
        <div style={s.actionRow}>
          <button style={s.addBtn} onClick={() => setModal({ type: 'add' })}>＋ 薬剤を追加</button>
          {tab === 'recipe' && <button style={s.addBtnSub} onClick={() => setModal({ type: 'recipeAdd' })}>＋ レシピ追加</button>}
        </div>
      </div>

      {toast && <div style={s.toast}>{toast}</div>}

      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <ProductModal product={modal.type === 'edit' ? modal.product : null} products={products} onClose={() => setModal(null)} onSave={handleAddOrEdit} onDelete={handleDelete} />
      )}
      {modal?.type === 'use' && <UsageModal product={modal.product} onClose={() => setModal(null)} onSave={handleUse} />}
      {modal?.type === 'restock' && <RestockModal product={modal.product} onClose={() => setModal(null)} onSave={handleRestock} />}
      {modal?.type === 'history' && <HistoryModal logs={logs} onClose={() => setModal(null)} />}
      {modal?.type === 'stockCount' && <StockCountModal products={products} onApply={handleStockCountApply} onClose={() => setModal(null)} />}
      {modal?.type === 'recipeList' && <RecipeListModal recipes={recipes} onClose={() => setModal(null)} onAdd={() => setModal({ type: 'recipeAdd' })} onEdit={(recipe) => setModal({ type: 'recipeEdit', recipe })} onApply={handleRecipeApply} onDelete={handleRecipeDelete} />}
      {(modal?.type === 'recipeAdd' || modal?.type === 'recipeEdit') && (
        <RecipeModal recipe={modal.type === 'recipeEdit' ? modal.recipe : null} products={products} onClose={() => setModal(null)} onSave={handleRecipeSave} />
      )}
      {modal?.type === 'orderCreate' && (
        <OrderCreateModal product={modal.product} onClose={() => setModal(null)} onSave={handleCreateOrder} />
      )}
      {modal?.type === 'profile' && user && (
        <ProfileModal user={user} onClose={() => setModal(null)} onSaved={(p) => setProfile(p)} />
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#f7f7f9', overflow: 'hidden', fontFamily: "'Hiragino Kaku Gothic ProN', 'Hiragino Sans', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(90deg, #ef3c71, #ff727d)', padding: '12px 16px', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10, background: 'none', cursor: 'pointer' },
  avatarBtn: { width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' as const },
  avatarIcon: { fontSize: 20, color: '#fff' },
  logo: { width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  headerName: { fontSize: 15, fontWeight: 700, color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  headerRight: { display: 'flex', gap: 6 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, fontSize: 17, background: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  alertBanner: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff3f6', padding: '10px 16px', borderBottom: '1px solid rgba(239,60,113,0.15)', cursor: 'pointer', flexShrink: 0 },
  alertBannerText: { flex: 1, fontSize: 13, fontWeight: 700, color: '#ef3c71' },
  alertBannerArrow: { fontSize: 18, color: '#ef3c71' },
  tabBar: { display: 'flex', background: '#fff', borderBottom: '1px solid #ebebeb', flexShrink: 0 },
  tab: { flex: 1, padding: '12px 4px', fontSize: 12, fontWeight: 600, color: '#888', background: 'none', borderBottom: '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabActive: { color: '#ef3c71', borderBottom: '2px solid #ef3c71' },
  tabAlert: { color: '#ef3c71', flex: 'none', padding: '12px 12px' },
  tabBadge: { background: '#ef3c71', color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '1px 5px' },
  main: { flex: 1, overflowY: 'auto', padding: '12px' },
  card: { background: '#fff', borderRadius: 14, padding: '12px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1.5px solid #ebebeb' },
  cardAlert: { border: '1.5px solid rgba(239,60,113,0.25)' },
  cardInner: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  cardPhoto: { width: 60, height: 60, borderRadius: 10, background: '#f5f5f7', border: '1px solid #ebebeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  cardPhotoImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardPhotoIcon: { fontSize: 26 },
  cardContent: { flex: 1, minWidth: 0 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardLeft: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  cardRight: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  cardName: { fontSize: 14, fontWeight: 700, color: '#1e1e21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardBarcode: { fontSize: 10, color: '#bbb' },
  badge: { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 },
  badgeOk: { background: 'rgba(16,185,129,0.1)', color: '#059669' },
  badgeDanger: { background: 'rgba(239,60,113,0.1)', color: '#ef3c71' },
  moreBtn: { fontSize: 18, color: '#bbb', padding: '0 2px', background: 'none' },
  stockRow: { display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: 6 },
  stockNum: { fontSize: 28, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.5px' },
  stockUnit: { fontSize: 12, fontWeight: 600, color: '#aaa' },
  thresholdLabel: { fontSize: 11, color: '#bbb', marginLeft: 6 },
  barBg: { height: 4, background: '#f0f0f5', borderRadius: 99, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: '100%', borderRadius: 99, transition: 'width 0.5s ease' },
  cardActions: { display: 'flex', gap: 6 },
  useBtn: { flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(239,60,113,0.08)', color: '#ef3c71' },
  restockBtn: { flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(16,185,129,0.08)', color: '#059669' },
  orderBtn: { flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(99,102,241,0.08)', color: '#6366f1' },
  recipeCard: { background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1.5px solid #ebebeb' },
  recipeTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  recipeName: { fontSize: 15, fontWeight: 700, color: '#1e1e21' },
  recipeMemo: { fontSize: 12, color: '#aaa', marginTop: 2 },
  recipeEditBtn: { fontSize: 12, color: '#aaa', background: '#f5f5f7', padding: '4px 10px', borderRadius: 8 },
  recipeIngredients: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  ingredientChip: { fontSize: 12, fontWeight: 600, background: 'rgba(239,60,113,0.08)', color: '#ef3c71', padding: '3px 10px', borderRadius: 99 },
  applyBtn: { width: '100%', padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'linear-gradient(90deg,#ef3c71,#ff727d)', color: '#fff' },
  orderSection: { fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8, letterSpacing: '0.03em' },
  orderCard: { background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1.5px solid #ebebeb' },
  orderCardActive: { border: '1.5px solid rgba(239,60,113,0.2)', background: '#fffbfc' },
  orderTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderProductName: { fontSize: 15, fontWeight: 700, color: '#1e1e21', marginBottom: 4 },
  orderMeta: { fontSize: 12, color: '#aaa' },
  orderBadge: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 },
  orderBadgeActive: { background: 'rgba(239,60,113,0.1)', color: '#ef3c71' },
  orderBadgeDone: { background: 'rgba(16,185,129,0.1)', color: '#059669' },
  receiveBtn: { width: '100%', padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'linear-gradient(90deg,#ef3c71,#ff727d)', color: '#fff' },
  bottomBar: { background: '#fff', borderTop: '1px solid #ebebeb', padding: '10px 16px 20px', flexShrink: 0 },
  voiceRow: { marginBottom: 8 },
  actionRow: { display: 'flex', gap: 8 },
  addBtn: { flex: 1, padding: '13px', borderRadius: 12, fontSize: 15, fontWeight: 700, background: 'linear-gradient(90deg,#ef3c71,#ff727d)', color: '#fff', boxShadow: '0 3px 12px rgba(239,60,113,0.3)' },
  addBtnSub: { flex: 1, padding: '13px', borderRadius: 12, fontSize: 15, fontWeight: 700, background: '#f5f5f7', color: '#1e1e21' },
  empty: { textAlign: 'center', padding: '60px 20px' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: '#1e1e21', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#aaa' },
  toast: { position: 'fixed', bottom: 120, left: '50%', transform: 'translateX(-50%)', background: 'rgba(30,30,33,0.9)', color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 20px', borderRadius: 99, whiteSpace: 'nowrap', zIndex: 999, backdropFilter: 'blur(8px)' },
  deleteFloat: { position: 'fixed', bottom: 160, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 200, pointerEvents: 'none' },
  deleteFloatBtn: { background: '#fee2e2', color: '#ef3c71', fontWeight: 700, fontSize: 13, padding: '10px 20px', borderRadius: 99, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', pointerEvents: 'all' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' },
  spinner: { width: 32, height: 32, border: '3px solid #eee', borderTop: '3px solid #ef3c71', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
}
