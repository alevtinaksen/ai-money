-- Supabase / PostgreSQL schema for AI Money
-- Extensions
create extension if not exists "uuid-ossp";

-- Accounts table (Счета)
create table if not exists accounts (
    id uuid primary key default gen_random_uuid(),
    user_id bigint not null,
    name text not null,
    group_name text not null default 'Личное', -- 'Личное', 'Общее', 'Инвестиции'
    balance numeric(14, 2) not null default 0.00,
    currency text not null default 'RUB',
    icon text default '💳', -- emoji or icon key
    color text default '#2B5BFF',
    is_default boolean not null default false,
    sort_order int not null default 0,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Categories table (Категории)
create table if not exists categories (
    id uuid primary key default gen_random_uuid(),
    user_id bigint not null,
    name text not null,
    type text not null check (type in ('expense', 'income')),
    icon text not null default '📦', -- emoji: '🍔', '🚗', '🛍️', '🎬', '💊', etc.
    color text default '#F3F4F6',
    budget_limit numeric(14, 2) default null,
    sort_order int not null default 0,
    created_at timestamp with time zone default now()
);

-- Transactions table (Транзакции)
create table if not exists transactions (
    id uuid primary key default gen_random_uuid(),
    user_id bigint not null,
    account_id uuid not null references accounts(id) on delete cascade,
    to_account_id uuid references accounts(id) on delete set null, -- для переводов (type = 'transfer')
    category_id uuid references categories(id) on delete set null,
    amount numeric(14, 2) not null,
    type text not null check (type in ('expense', 'income', 'transfer')),
    note text,
    created_at timestamp with time zone default now()
);

-- Indexes for lightning fast queries
create index if not exists idx_accounts_user on accounts(user_id);
create index if not exists idx_categories_user on categories(user_id);
create index if not exists idx_transactions_user on transactions(user_id);
create index if not exists idx_transactions_created on transactions(created_at desc);
create index if not exists idx_transactions_account on transactions(account_id);
