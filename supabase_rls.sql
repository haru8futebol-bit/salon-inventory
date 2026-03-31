-- ============================================================
-- RLS（行レベルセキュリティ）ポリシー設定
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 1. user_id カラムを各テーブルに追加
alter table products    add column if not exists user_id uuid references auth.users(id);
alter table usage_logs  add column if not exists user_id uuid references auth.users(id);
alter table recipes     add column if not exists user_id uuid references auth.users(id);
alter table orders      add column if not exists user_id uuid references auth.users(id);

-- 2. RLS を有効化
alter table products    enable row level security;
alter table usage_logs  enable row level security;
alter table recipes     enable row level security;
alter table recipe_items enable row level security;
alter table orders      enable row level security;

-- 3. 古いポリシーを削除（既存のものがある場合）
drop policy if exists "allow_all_products"   on products;
drop policy if exists "allow_all_usage_logs" on usage_logs;
drop policy if exists "全員読み取り可能"      on products;
drop policy if exists "全員読み取り可能"      on usage_logs;

-- 4. products：自分のデータのみ CRUD 可
create policy "products_own" on products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. usage_logs：自分のデータのみ CRUD 可
create policy "usage_logs_own" on usage_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. recipes：自分のデータのみ CRUD 可
create policy "recipes_own" on recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7. recipe_items：親レシピが自分のものなら CRUD 可
create policy "recipe_items_own" on recipe_items
  for all using (
    exists (select 1 from recipes where recipes.id = recipe_items.recipe_id and recipes.user_id = auth.uid())
  )
  with check (
    exists (select 1 from recipes where recipes.id = recipe_items.recipe_id and recipes.user_id = auth.uid())
  );

-- 8. orders：自分のデータのみ CRUD 可
create policy "orders_own" on orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
