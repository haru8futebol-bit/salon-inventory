-- Supabase で実行するSQL
-- Table: products（薬剤マスタ）
create table products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  stock integer not null default 0,
  threshold integer not null default 0,
  barcode text,
  created_at timestamptz default now()
);

-- Table: usage_logs（使用・入荷履歴）
create table usage_logs (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references products(id) on delete cascade,
  quantity integer not null,
  note text,
  type text not null check (type in ('use', 'restock')),
  used_at timestamptz default now()
);

-- Table: recipes（カラーレシピ）
create table recipes (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  memo text,
  created_at timestamptz default now()
);

-- Table: recipe_items（レシピの材料）
create table recipe_items (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references recipes(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  quantity numeric not null,
  unit text not null default 'g',
  note text
);

-- RLS（Row Level Security）を無効化 ※プロトタイプ用
alter table products disable row level security;
alter table usage_logs disable row level security;
alter table recipes disable row level security;
alter table recipe_items disable row level security;

-- 既存DBにbarcodeカラムを追加する場合はこちらを実行
-- alter table products add column if not exists barcode text;
