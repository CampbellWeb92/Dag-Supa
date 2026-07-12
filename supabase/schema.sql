-- DAG DATABASE SETUP
-- Run this complete file in Supabase > SQL Editor.

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
  province text,
  town text,
  breeds text,
  description text,
  profile_image_url text,
  registration_number text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create a pending breeder profile from registration metadata.
-- This works even when email confirmation means the browser has no session yet.
create or replace function public.create_breeder_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.breeder_profiles (
    user_id,
    business_name,
    contact_name,
    email,
    phone,
    province,
    town,
    breeds,
    approval_status
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'New breeder'),
    coalesce(new.raw_user_meta_data ->> 'contact_name', 'New breeder'),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'province',
    new.raw_user_meta_data ->> 'town',
    new.raw_user_meta_data ->> 'breeds',
    'pending'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_breeder_profile_after_signup on auth.users;
create trigger create_breeder_profile_after_signup
  after insert on auth.users
  for each row execute procedure public.create_breeder_profile_for_new_user();

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
  price numeric(12, 2) not null default 0,
  description text,
  vaccinated boolean default false,
  microchipped boolean default false,
  registered boolean default false,
  health_tests text,
  bloodline text,
  status text not null default 'available'
    check (status in ('available', 'reserved', 'sold', 'unavailable')),
  main_image_url text,
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dogs_breeder_id_fkey
    foreign key (breeder_id)
    references public.breeder_profiles(user_id)
    on delete cascade
);

-- =========================================================
-- BUYER BIDS
-- =========================================================
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  breeder_id uuid not null references auth.users(id) on delete cascade,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  amount numeric(12, 2) not null check (amount > 0),
  message text,
  status text not null default 'new'
    check (status in ('new', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now()
);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table public.breeder_profiles enable row level security;
alter table public.dogs enable row level security;
alter table public.bids enable row level security;

drop policy if exists "Public can view approved breeder profiles" on public.breeder_profiles;
create policy "Public can view approved breeder profiles"
on public.breeder_profiles
for select
using (approval_status = 'approved' or auth.uid() = user_id);

drop policy if exists "Breeders can insert own profile" on public.breeder_profiles;
create policy "Breeders can insert own profile"
on public.breeder_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Breeders can update own profile" on public.breeder_profiles;
create policy "Breeders can update own profile"
on public.breeder_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Public can view approved dogs" on public.dogs;
create policy "Public can view approved dogs"
on public.dogs
for select
using (approval_status = 'approved' or auth.uid() = breeder_id);

drop policy if exists "Breeders can insert own dogs" on public.dogs;
create policy "Breeders can insert own dogs"
on public.dogs
for insert
to authenticated
with check (auth.uid() = breeder_id);

drop policy if exists "Breeders can update own dogs" on public.dogs;
create policy "Breeders can update own dogs"
on public.dogs
for update
to authenticated
using (auth.uid() = breeder_id)
with check (auth.uid() = breeder_id);

drop policy if exists "Breeders can delete own dogs" on public.dogs;
create policy "Breeders can delete own dogs"
on public.dogs
for delete
to authenticated
using (auth.uid() = breeder_id);

drop policy if exists "Visitors can submit bids" on public.bids;
create policy "Visitors can submit bids"
on public.bids
for insert
to anon, authenticated
with check (true);

drop policy if exists "Breeders can view bids for their dogs" on public.bids;
create policy "Breeders can view bids for their dogs"
on public.bids
for select
to authenticated
using (auth.uid() = breeder_id);

drop policy if exists "Breeders can update their bids" on public.bids;
create policy "Breeders can update their bids"
on public.bids
for update
to authenticated
using (auth.uid() = breeder_id)
with check (auth.uid() = breeder_id);

-- =========================================================
-- IMAGE STORAGE
-- =========================================================
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'dog-images',
  'dog-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view dog images" on storage.objects;
create policy "Public can view dog images"
on storage.objects
for select
using (bucket_id = 'dog-images');

drop policy if exists "Breeders can upload own images" on storage.objects;
create policy "Breeders can upload own images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'dog-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Breeders can update own images" on storage.objects;
create policy "Breeders can update own images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'dog-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Breeders can delete own images" on storage.objects;
create policy "Breeders can delete own images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'dog-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
