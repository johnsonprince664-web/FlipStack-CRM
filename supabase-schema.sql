-- FlipStack CRM production schema
-- Run this once in Supabase SQL Editor after creating your Supabase project.

create extension if not exists "pgcrypto";

-- PROFILES
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  plan text not null default 'side_hustle' check (plan in ('side_hustle','active_flipper','apex')),
  founder_access boolean not null default false,
  billing_status text not null default 'free',
  account_status text not null default 'active' check (account_status in ('active','warning','downgraded_grace','disabled')),
  grace_started_at timestamptz,
  downgraded_at timestamptz,
  disabled_at timestamptz,
  capacity_warning_reason text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- CUSTOMERS
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  instagram_handle text,
  snapchat_handle text,
  depop_handle text,
  vouch_count int not null default 0,
  total_spent numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;
drop policy if exists "customers_own" on public.customers;
create policy "customers_own" on public.customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- INVENTORY
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  customer_id uuid references public.customers(id) on delete set null,
  name text not null,
  brand text,
  category text,
  colorway text,
  size text,
  source text,
  status text not null default 'available' check (status in ('available','pre_sold','sold','personal_rotation')),
  product_cost numeric not null default 0,
  allocated_shipping_cost numeric not null default 0,
  target_sale_price numeric not null default 0,
  sold_price numeric,
  deposit_paid numeric not null default 0,
  image_urls text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.inventory_items enable row level security;
drop policy if exists "inventory_own" on public.inventory_items;
create policy "inventory_own" on public.inventory_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists inventory_user_idx on public.inventory_items(user_id);
create index if not exists inventory_search_idx on public.inventory_items using gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(category,'')));

-- HAULS
create table if not exists public.hauls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  agent_name text,
  tracking_link text,
  vendor_link text,
  status text not null default 'warehouse',
  total_shipping_cost numeric not null default 0,
  total_weight numeric not null default 0,
  declared_value numeric not null default 0,
  carrier text,
  destination_country text,
  item_count int not null default 0,
  qc_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.hauls enable row level security;
drop policy if exists "hauls_own" on public.hauls;
create policy "hauls_own" on public.hauls for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.haul_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  haul_id uuid not null references public.hauls(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  name text not null,
  status text not null default 'incoming',
  created_at timestamptz not null default now()
);

alter table public.haul_items enable row level security;
drop policy if exists "haul_items_own" on public.haul_items;
create policy "haul_items_own" on public.haul_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- BUNDLES
create table if not exists public.bundles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  customer_id uuid references public.customers(id) on delete set null,
  name text not null,
  bundle_price numeric not null default 0,
  deposit_paid numeric not null default 0,
  status text not null default 'hold' check (status in ('hold','paid','delivered','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.bundles enable row level security;
drop policy if exists "bundles_own" on public.bundles;
create policy "bundles_own" on public.bundles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.bundle_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.bundle_items enable row level security;
drop policy if exists "bundle_items_own" on public.bundle_items;
create policy "bundle_items_own" on public.bundle_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- TRANSACTIONS / LEDGER
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  customer_id uuid references public.customers(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  bundle_id uuid references public.bundles(id) on delete set null,
  type text not null default 'payment',
  amount numeric not null default 0,
  note text,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
drop policy if exists "transactions_own" on public.transactions;
create policy "transactions_own" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SHIPPING LABELS
create table if not exists public.shipping_labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  order_id uuid,
  customer_id uuid references public.customers(id) on delete set null,
  shippo_shipment_id text,
  shippo_transaction_id text,
  carrier text,
  service_level text,
  tracking_number text,
  tracking_url text,
  label_url text,
  label_format text default 'PDF',
  amount numeric,
  currency text default 'USD',
  status text default 'created',
  address_from jsonb,
  address_to jsonb,
  parcel jsonb,
  created_at timestamptz not null default now()
);

alter table public.shipping_labels enable row level security;
drop policy if exists "shipping_labels_own" on public.shipping_labels;
create policy "shipping_labels_own" on public.shipping_labels for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- STORAGE BUCKET NOTES:
-- In Supabase Dashboard, create a private or public bucket named inventory-images.
-- For MVP public image previews are easiest. For production, use signed URLs and tighter policies.

-- ACCOUNT LOAD FUNCTION
create or replace function public.account_load_for(target_user uuid)
returns table (
  active_inventory int,
  incoming_haul_items int,
  active_hauls int,
  total_load int
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.inventory_items i where i.user_id = target_user and i.status <> 'sold') as active_inventory,
    (
      (select coalesce(sum(h.item_count), 0)::int from public.hauls h where h.user_id = target_user and h.status not in ('received','cancelled'))
      +
      (select count(*)::int from public.haul_items hi where hi.user_id = target_user and hi.status not in ('received','cancelled'))
    ) as incoming_haul_items,
    (select count(*)::int from public.hauls h where h.user_id = target_user and h.status not in ('received','cancelled')) as active_hauls,
    (
      (select count(*)::int from public.inventory_items i where i.user_id = target_user and i.status <> 'sold')
      +
      (select coalesce(sum(h.item_count), 0)::int from public.hauls h where h.user_id = target_user and h.status not in ('received','cancelled'))
      +
      (select count(*)::int from public.haul_items hi where hi.user_id = target_user and hi.status not in ('received','cancelled'))
    ) as total_load;
$$;

-- DAILY ENFORCEMENT
create or replace function public.enforce_account_capacity()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  load record;
  total_limit int;
  haul_limit int;
  incoming_limit int;
  over_limit boolean;
  reason text;
  changed int := 0;
begin
  for p in select * from public.profiles loop
    if p.founder_access then
      update public.profiles
      set account_status = 'active',
          grace_started_at = null,
          downgraded_at = null,
          disabled_at = null,
          capacity_warning_reason = null
      where user_id = p.user_id;
      continue;
    end if;

    select * into load from public.account_load_for(p.user_id);

    total_limit := case p.plan when 'side_hustle' then 20 when 'active_flipper' then 250 else 2147483647 end;
    haul_limit := case p.plan when 'side_hustle' then 2 when 'active_flipper' then 5 else 2147483647 end;
    incoming_limit := case p.plan when 'side_hustle' then 10 when 'active_flipper' then 250 else 2147483647 end;

    over_limit := load.total_load > total_limit or load.active_hauls > haul_limit or load.incoming_haul_items > incoming_limit;

    reason := 'Account load ' || load.total_load || '/' || total_limit ||
              ', active hauls ' || load.active_hauls || '/' || haul_limit ||
              ', incoming haul items ' || load.incoming_haul_items || '/' || incoming_limit || '.';

    if not over_limit then
      update public.profiles
      set account_status = 'active',
          grace_started_at = null,
          downgraded_at = null,
          disabled_at = null,
          capacity_warning_reason = null
      where user_id = p.user_id;
      changed := changed + 1;
    else
      if p.account_status = 'active' then
        update public.profiles
        set account_status = 'warning',
            grace_started_at = now(),
            capacity_warning_reason = reason
        where user_id = p.user_id;
        changed := changed + 1;
      elsif p.account_status = 'warning' and p.grace_started_at is not null and now() >= p.grace_started_at + interval '30 days' then
        if p.plan <> 'side_hustle' then
          update public.profiles
          set plan = 'side_hustle',
              billing_status = 'downgraded',
              account_status = 'downgraded_grace',
              grace_started_at = now(),
              downgraded_at = now(),
              capacity_warning_reason = 'Paid plan exceeded limit for 30 days and was downgraded. ' || reason
          where user_id = p.user_id;
        else
          update public.profiles
          set account_status = 'disabled',
              disabled_at = now(),
              capacity_warning_reason = 'Free account exceeded limit for 30 days. ' || reason
          where user_id = p.user_id;
        end if;
        changed := changed + 1;
      elsif p.account_status = 'downgraded_grace' and p.grace_started_at is not null and now() >= p.grace_started_at + interval '30 days' then
        update public.profiles
        set account_status = 'disabled',
            disabled_at = now(),
            capacity_warning_reason = 'Downgraded account exceeded limit for second 30-day window. ' || reason
        where user_id = p.user_id;
        changed := changed + 1;
      else
        update public.profiles
        set capacity_warning_reason = reason
        where user_id = p.user_id;
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'changed', changed, 'ran_at', now());
end;
$$;
