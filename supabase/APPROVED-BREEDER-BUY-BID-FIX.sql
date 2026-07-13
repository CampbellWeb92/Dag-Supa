-- DAG: APPROVED BREEDER BUY + BID FIX
-- Run once in Supabase > SQL Editor.
-- Safe to run more than once.

-- Approved breeders publish dog listings immediately. Breeders who are still
-- pending remain pending. The trigger, not browser JavaScript, decides this.
create or replace function public.set_dog_approval_from_breeder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.breeder_profiles p
    where p.user_id = new.breeder_id
      and lower(trim(coalesce(p.approval_status, ''))) = 'approved'
  ) then
    new.approval_status := 'approved';
  else
    new.approval_status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists set_dog_approval_from_breeder_trigger on public.dogs;
create trigger set_dog_approval_from_breeder_trigger
before insert on public.dogs
for each row execute function public.set_dog_approval_from_breeder();

-- The browser can insert only its own listing. Approval is assigned by the
-- trigger above, so the browser cannot approve another breeder or listing.
drop policy if exists "Breeders can insert own dogs" on public.dogs;
create policy "Breeders can insert own dogs"
on public.dogs for insert to authenticated
with check (auth.uid() = breeder_id);

-- Repair older pending listings belonging to breeders who are already
-- approved. Deliberately rejected listings are not changed.
update public.dogs d
set approval_status = 'approved',
    updated_at = now()
from public.breeder_profiles p
where p.user_id = d.breeder_id
  and lower(trim(coalesce(p.approval_status, ''))) = 'approved'
  and lower(trim(coalesce(d.approval_status, 'pending'))) = 'pending';

-- Normalise old values so exact spelling/case cannot hide buyer controls.
update public.breeder_profiles
set approval_status = lower(trim(approval_status))
where approval_status is not null
  and approval_status <> lower(trim(approval_status));

update public.dogs
set status = lower(trim(status)),
    approval_status = lower(trim(approval_status))
where (status is not null and status <> lower(trim(status)))
   or (approval_status is not null and approval_status <> lower(trim(approval_status)));
