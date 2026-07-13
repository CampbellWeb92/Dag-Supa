-- DAG DATABASE REPAIR AND SETUP
-- Run this complete file in Supabase > SQL Editor.
-- It is safe to run more than once and keeps existing profiles and dog listings.

create extension if not exists pgcrypto;

-- =========================================================
-- BREEDER PROFILES
-- =========================================================
create table if not exists public.breeder_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  whatsapp text,
  paypal_me_url text,
  province text,
  town text,
  breeds text,
  description text,
  profile_image_url text,
  registration_number text,
  approval_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.breeder_profiles add column if not exists whatsapp text;
alter table public.breeder_profiles add column if not exists paypal_me_url text;
alter table public.breeder_profiles add column if not exists province text;
alter table public.breeder_profiles add column if not exists town text;
alter table public.breeder_profiles add column if not exists breeds text;
alter table public.breeder_profiles add column if not exists description text;
alter table public.breeder_profiles add column if not exists profile_image_url text;
alter table public.breeder_profiles add column if not exists registration_number text;
alter table public.breeder_profiles add column if not exists approval_status text default 'pending';
alter table public.breeder_profiles add column if not exists created_at timestamptz default now();
alter table public.breeder_profiles add column if not exists updated_at timestamptz default now();
create unique index if not exists breeder_profiles_user_id_unique on public.breeder_profiles(user_id);

create or replace function public.create_breeder_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.breeder_profiles (
    user_id, business_name, contact_name, email, phone, province, town, breeds, approval_status
  ) values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'business_name', ''), nullif(new.raw_user_meta_data ->> 'contact_name', ''), split_part(coalesce(new.email, 'New breeder'), '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'contact_name', ''), nullif(new.raw_user_meta_data ->> 'business_name', ''), 'New breeder'),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'province', ''),
    nullif(new.raw_user_meta_data ->> 'town', ''),
    nullif(new.raw_user_meta_data ->> 'breeds', ''),
    'pending'
  ) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_breeder_profile_after_signup on auth.users;
create trigger create_breeder_profile_after_signup
  after insert on auth.users
  for each row execute procedure public.create_breeder_profile_for_new_user();

-- Repair breeder profiles missing from older Auth accounts.
insert into public.breeder_profiles (
  user_id, business_name, contact_name, email, phone, province, town, breeds, approval_status
)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'business_name', ''), nullif(u.raw_user_meta_data ->> 'contact_name', ''), split_part(coalesce(u.email, 'New breeder'), '@', 1)),
  coalesce(nullif(u.raw_user_meta_data ->> 'contact_name', ''), nullif(u.raw_user_meta_data ->> 'business_name', ''), 'New breeder'),
  coalesce(u.email, ''),
  nullif(u.raw_user_meta_data ->> 'phone', ''),
  nullif(u.raw_user_meta_data ->> 'province', ''),
  nullif(u.raw_user_meta_data ->> 'town', ''),
  nullif(u.raw_user_meta_data ->> 'breeds', ''),
  'pending'
from auth.users u
left join public.breeder_profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

-- =========================================================
-- DOG LISTINGS
-- =========================================================
create table if not exists public.dogs (
  id uuid primary key default gen_random_uuid(),
  breeder_id uuid not null,
  name text not null,
  breed text not null,
  sex text,
  date_of_birth date,
  colour text,
  price numeric(12,2) not null default 0,
  description text,
  vaccinated boolean default false,
  microchipped boolean default false,
  registered boolean default false,
  health_tests text,
  bloodline text,
  status text not null default 'available',
  main_image_url text,
  approval_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paypal_order_id text,
  paypal_capture_id text,
  payment_received_at timestamptz
);

alter table public.dogs add column if not exists sex text;
alter table public.dogs add column if not exists date_of_birth date;
alter table public.dogs add column if not exists colour text;
alter table public.dogs add column if not exists price numeric(12,2) default 0;
alter table public.dogs add column if not exists description text;
alter table public.dogs add column if not exists vaccinated boolean default false;
alter table public.dogs add column if not exists microchipped boolean default false;
alter table public.dogs add column if not exists registered boolean default false;
alter table public.dogs add column if not exists health_tests text;
alter table public.dogs add column if not exists bloodline text;
alter table public.dogs add column if not exists status text default 'available';
alter table public.dogs add column if not exists main_image_url text;
alter table public.dogs add column if not exists approval_status text default 'pending';
alter table public.dogs add column if not exists created_at timestamptz default now();
alter table public.dogs add column if not exists updated_at timestamptz default now();
alter table public.dogs add column if not exists paypal_order_id text;
alter table public.dogs add column if not exists paypal_capture_id text;
alter table public.dogs add column if not exists payment_received_at timestamptz;

-- Repair listings created by older code that stored breeder_profiles.id instead of user_id.
alter table public.dogs drop constraint if exists dogs_breeder_id_fkey;
update public.dogs d
set breeder_id = p.user_id
from public.breeder_profiles p
where d.breeder_id = p.id and d.breeder_id <> p.user_id;

alter table public.dogs
  add constraint dogs_breeder_id_fkey
  foreign key (breeder_id) references public.breeder_profiles(user_id) on delete cascade
  not valid;

create index if not exists dogs_breeder_id_idx on public.dogs(breeder_id);
create index if not exists dogs_created_at_idx on public.dogs(created_at desc);
create unique index if not exists dogs_paypal_order_id_unique on public.dogs(paypal_order_id) where paypal_order_id is not null;
create unique index if not exists dogs_paypal_capture_id_unique on public.dogs(paypal_capture_id) where paypal_capture_id is not null;

-- =========================================================
-- BIDS AND PAYMENTS
-- =========================================================
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  breeder_id uuid not null references auth.users(id) on delete cascade,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  amount numeric(12,2) not null check (amount > 0),
  message text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  breeder_id uuid not null references auth.users(id) on delete cascade,
  paypal_order_id text not null unique,
  paypal_capture_id text unique,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'ZAR',
  status text not null default 'created',
  buyer_email text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table public.breeder_profiles enable row level security;
alter table public.dogs enable row level security;
alter table public.bids enable row level security;
alter table public.payments enable row level security;

drop policy if exists "Public can view approved breeder profiles" on public.breeder_profiles;
create policy "Public can view approved breeder profiles"
on public.breeder_profiles for select
using (approval_status = 'approved' or auth.uid() = user_id);

drop policy if exists "Breeders can insert own profile" on public.breeder_profiles;
create policy "Breeders can insert own profile"
on public.breeder_profiles for insert to authenticated
with check (auth.uid() = user_id and approval_status = 'pending');

drop policy if exists "Breeders can update own profile" on public.breeder_profiles;
create policy "Breeders can update own profile"
on public.breeder_profiles for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Public can view approved dogs" on public.dogs;
create policy "Public can view approved dogs"
on public.dogs for select
using (approval_status = 'approved' or auth.uid() = breeder_id);

drop policy if exists "Breeders can insert own dogs" on public.dogs;
create policy "Breeders can insert own dogs"
on public.dogs for insert to authenticated
with check (auth.uid() = breeder_id and approval_status = 'pending');

drop policy if exists "Breeders can update own dogs" on public.dogs;
create policy "Breeders can update own dogs"
on public.dogs for update to authenticated
using (auth.uid() = breeder_id)
with check (auth.uid() = breeder_id);

drop policy if exists "Breeders can delete own dogs" on public.dogs;
create policy "Breeders can delete own dogs"
on public.dogs for delete to authenticated
using (auth.uid() = breeder_id);

drop policy if exists "Visitors can submit bids" on public.bids;
create policy "Visitors can submit bids"
on public.bids for insert to anon, authenticated
with check (
  exists (
    select 1 from public.dogs d
    where d.id = dog_id
      and d.breeder_id = breeder_id
      and d.approval_status = 'approved'
      and d.status in ('available','reserved')
  )
);

drop policy if exists "Breeders can view bids for their dogs" on public.bids;
create policy "Breeders can view bids for their dogs"
on public.bids for select to authenticated
using (auth.uid() = breeder_id);

drop policy if exists "Breeders can update their bids" on public.bids;
create policy "Breeders can update their bids"
on public.bids for update to authenticated
using (auth.uid() = breeder_id)
with check (auth.uid() = breeder_id);

drop policy if exists "Breeders can view payments for own dogs" on public.payments;
create policy "Breeders can view payments for own dogs"
on public.payments for select to authenticated
using (auth.uid() = breeder_id);

-- =========================================================
-- IMAGE STORAGE
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dog-images', 'dog-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view dog images" on storage.objects;
create policy "Public can view dog images"
on storage.objects for select
using (bucket_id = 'dog-images');

drop policy if exists "Breeders can upload own images" on storage.objects;
create policy "Breeders can upload own images"
on storage.objects for insert to authenticated
with check (bucket_id = 'dog-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Breeders can update own images" on storage.objects;
create policy "Breeders can update own images"
on storage.objects for update to authenticated
using (bucket_id = 'dog-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'dog-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Breeders can delete own images" on storage.objects;
create policy "Breeders can delete own images"
on storage.objects for delete to authenticated
using (bucket_id = 'dog-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- Reload PostgREST's schema cache after table and relationship repairs.
notify pgrst, 'reload schema';
