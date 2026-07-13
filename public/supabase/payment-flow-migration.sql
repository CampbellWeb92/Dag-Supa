-- Run once in Supabase SQL Editor on an existing Dag database.
alter table public.dogs
  add column if not exists paypal_order_id text,
  add column if not exists paypal_capture_id text,
  add column if not exists payment_received_at timestamptz;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  breeder_id uuid not null references auth.users(id) on delete cascade,
  paypal_order_id text not null unique,
  paypal_capture_id text unique,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'ZAR',
  status text not null default 'created' check (status in ('created','approved','completed','cancelled','refunded','failed')),
  buyer_email text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.payments enable row level security;
drop policy if exists "Breeders can view payments for own dogs" on public.payments;
create policy "Breeders can view payments for own dogs" on public.payments
for select to authenticated using (auth.uid() = breeder_id);
