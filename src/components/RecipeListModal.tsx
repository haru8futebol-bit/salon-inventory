import { useState } from 'react'
import { Recipe } from '../types'

interface Props {
  recipes: Recipe[]
  onClose: () => void
  onAdd: () => void
  onEdit: (recipe: Recipe) => void
  onApply: (recipe: Recipe) => Promise<void>
  onDelete: (recipe: Recipe) => Promise<void>
}

export default function RecipeListModal({ recipes, onClose, onAdd, onEdit, onApply, onDelete }: Props) {
  const [applying, setApplying] = useState<string | null>(null)

  const handleApply = async (recipe: Recipe) => {
    if (!confirm(`「${recipe.name}」を施術に使いますか？\n使用薬剤の在庫が自動で減ります。`)) return
    setApplying(recipe.id)
    await onApply(recipe)
    setApplying(null)
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.sheet} onClick={e => e.stopPropagation()}>
        <div style={s.handle} />
        <div style={s.header}>
          <h2 style={s.title}>🧪 カラーレシピ</h2>
          <button style={s.addBtn} onClick={onAdd}>＋ 新規</button>
        </div>

        {recipes.length === 0 ? (
          <div style={s.empty}>
            <p style={s.emptyTitle}>レシピがありません</p>
            <p style={s.emptySub}>「＋ 新規」からカラーレシピを登録してください</p>
          </div>
        ) : (
          <div style={s.list}>
            {recipes.map(recipe => (
              <div key={recipe.id} style={s.card}>
                <div style={s.cardTop}>
                  <div>
                    <p style={s.recipeName}>{recipe.name}</p>
                    {recipe.memo && <p style={s.recipeMemo}>{recipe.memo}</p>}
                  </div>
                  <button style={s.editBtn} onClick={() => onEdit(recipe)}>編集</button>
                </div>

                {recipe.recipe_items && recipe.recipe_items.length > 0 && (
                  <div style={s.ingredients}>
                    {recipe.recipe_items.map(item => (
                      <span key={item.id} style={s.ingredient}>
                        {item.products?.name ?? '—'} {item.quantity}{item.unit}
                      </span>
                    ))}
                  </div>
                )}

                <div style={s.cardActions}>
                  <button
                    style={s.applyBtn}
                    onClick={() => handleApply(recipe)}
                    disabled={applying === recipe.id}
                  >
                    {applying === recipe.id ? '処理中...' : '✓ 施術に使う'}
                  </button>
                  <button style={s.deleteBtn} onClick={() => onDelete(recipe)}>削除</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button style={s.closeBtn} onClick={onClose}>閉じる</button>
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
    width: '100%', maxWidth: 480, maxHeight: '85vh', display: 'flex',
    flexDirection: 'column', animation: 'slideUp 0.25s ease',
  },
  handle: { width: 40, height: 4, background: '#e2e8f0', borderRadius: 99, margin: '0 auto 16px', flexShrink: 0 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 },
  title: { fontSize: 20, fontWeight: 800 },
  addBtn: {
    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff',
    fontWeight: 700, fontSize: 14, padding: '8px 16px', borderRadius: 12,
  },
  list: { overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 },
  card: {
    background: '#fafafa', borderRadius: 16, padding: '14px 16px',
    border: '1.5px solid var(--border)',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  recipeName: { fontSize: 15, fontWeight: 700, marginBottom: 2 },
  recipeMemo: { fontSize: 12, color: 'var(--text-sub)' },
  editBtn: { fontSize: 12, background: '#f0f0f7', color: 'var(--text-sub)', padding: '4px 10px', borderRadius: 8 },
  ingredients: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  ingredient: {
    fontSize: 12, fontWeight: 600, background: 'rgba(99,102,241,0.08)',
    color: 'var(--primary)', padding: '3px 10px', borderRadius: 99,
  },
  cardActions: { display: 'flex', gap: 8 },
  applyBtn: {
    flex: 1, padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 700,
    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff',
    boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
  },
  deleteBtn: {
    padding: '10px 14px', borderRadius: 12, fontSize: 12,
    background: '#fee2e2', color: 'var(--danger)', fontWeight: 600,
  },
  empty: { textAlign: 'center', padding: '40px 0', flex: 1 },
  emptyTitle: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  emptySub: { fontSize: 13, color: 'var(--text-sub)' },
  closeBtn: {
    width: '100%', padding: '13px', borderRadius: 16, fontSize: 15, fontWeight: 600,
    background: '#f1f0f7', color: 'var(--text-sub)', flexShrink: 0,
  },
}
