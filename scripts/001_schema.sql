-- Shefaa marketplace schema: users, listings, requests, validation_documents + RLS + storage

do $$ begin
  create type public.user_role as enum ('buyer', 'seller', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.listing_type as enum ('sell', 'rent', 'donate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.certification_status as enum ('pending', 'certified', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.availability_status as enum ('available', 'rented', 'sold', 'donated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.request_status as enum ('pending', 'accepted', 'rejected', 'cancelled_by_buyer', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role,
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id) on delete cascade,
  type public.listing_type not null,
  title text not null check (char_length(title) between 3 and 140),
  device_type text not null check (device_type in ('wheelchair', 'oxygen_concentrator', 'hospital_bed', 'crutches', 'walker', 'other')),
  condition_description text not null check (char_length(condition_description) between 10 and 4000),
  photos text[] not null default '{}',
  price numeric(10, 2) check (price is null or price >= 0),
  governorate text not null,
  certification_status public.certification_status not null default 'pending',
  availability public.availability_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_matches_type check (
    (type = 'donate' and price is null) or (type <> 'donate' and price is not null)
  )
);

create index if not exists listings_browse_idx on public.listings (certification_status, governorate, device_type);
create index if not exists listings_seller_idx on public.listings (seller_id);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.users(id) on delete cascade,
  status public.request_status not null default 'pending',
  message text check (message is null or char_length(message) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists requests_listing_idx on public.requests (listing_id);
create index if not exists requests_buyer_idx on public.requests (buyer_id);
create unique index if not exists requests_one_open_per_buyer
  on public.requests (listing_id, buyer_id) where status = 'pending';

create table if not exists public.validation_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  file_url text not null,
  review_status public.review_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists validation_documents_request_idx on public.validation_documents (request_id);

-- Helpers (security definer, pinned search_path)

create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$ select role from public.users where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select role = 'admin' from public.users where id = auth.uid()), false) $$;

-- Profile row on signup. Only buyer/seller can be chosen; admin is never self-assigned.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  requested text := new.raw_user_meta_data ->> 'role';
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    case when requested in ('buyer', 'seller') then requested::public.user_role else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- OAuth users pick a role exactly once (role is null until then).

create or replace function public.set_initial_role(new_role public.user_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if new_role not in ('buyer', 'seller') then
    raise exception 'Invalid role';
  end if;
  update public.users set role = new_role where id = auth.uid() and role is null;
  if not found then
    raise exception 'Role already set';
  end if;
end;
$$;

revoke all on function public.set_initial_role(public.user_role) from public, anon;
grant execute on function public.set_initial_role(public.user_role) to authenticated;

-- Guard listing updates: only admins may change certification; seller edits reset to pending.

create or replace function public.guard_listing_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.seller_id <> old.seller_id then
    raise exception 'seller_id cannot change';
  end if;
  if not public.is_admin() then
    if new.certification_status <> old.certification_status then
      raise exception 'Only admins can change certification status';
    end if;
    if (new.title, new.device_type, new.condition_description, new.photos, new.type)
       is distinct from (old.title, old.device_type, old.condition_description, old.photos, old.type) then
      new.certification_status := 'pending';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists listings_guard_update on public.listings;
create trigger listings_guard_update
  before update on public.listings
  for each row execute function public.guard_listing_update();

-- Guard request transitions: buyer may only cancel pending; seller may accept/reject pending or complete accepted.

create or replace function public.guard_request_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  is_seller boolean;
begin
  if new.listing_id <> old.listing_id or new.buyer_id <> old.buyer_id then
    raise exception 'Request ownership cannot change';
  end if;

  if public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  select exists (
    select 1 from public.listings l where l.id = old.listing_id and l.seller_id = auth.uid()
  ) into is_seller;

  if old.buyer_id = auth.uid() and old.status = 'pending' and new.status = 'cancelled_by_buyer' then
    null;
  elsif is_seller and old.status = 'pending' and new.status in ('accepted', 'rejected') then
    null;
  elsif is_seller and old.status = 'accepted' and new.status = 'completed' then
    null;
  else
    raise exception 'Invalid request status transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists requests_guard_update on public.requests;
create trigger requests_guard_update
  before update on public.requests
  for each row execute function public.guard_request_update();

-- RLS

alter table public.users enable row level security;
alter table public.listings enable row level security;
alter table public.requests enable row level security;
alter table public.validation_documents enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists listings_select on public.listings;
create policy listings_select on public.listings for select
  using (certification_status = 'certified' or seller_id = auth.uid() or public.is_admin());

drop policy if exists listings_insert_seller on public.listings;
create policy listings_insert_seller on public.listings for insert
  with check (
    seller_id = auth.uid()
    and public.current_user_role() = 'seller'
    and certification_status = 'pending'
  );

drop policy if exists listings_update_owner on public.listings;
create policy listings_update_owner on public.listings for update
  using (seller_id = auth.uid()) with check (seller_id = auth.uid());

drop policy if exists listings_update_admin on public.listings;
create policy listings_update_admin on public.listings for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists listings_delete_owner on public.listings;
create policy listings_delete_owner on public.listings for delete
  using (seller_id = auth.uid());

drop policy if exists requests_select on public.requests;
create policy requests_select on public.requests for select
  using (
    buyer_id = auth.uid()
    or exists (select 1 from public.listings l where l.id = requests.listing_id and l.seller_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists requests_insert_buyer on public.requests;
create policy requests_insert_buyer on public.requests for insert
  with check (
    buyer_id = auth.uid()
    and status = 'pending'
    and public.current_user_role() = 'buyer'
    and exists (
      select 1 from public.listings l
      where l.id = requests.listing_id and l.certification_status = 'certified' and l.availability = 'available'
    )
  );

drop policy if exists requests_update_buyer on public.requests;
create policy requests_update_buyer on public.requests for update
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid() and status = 'cancelled_by_buyer');

drop policy if exists requests_update_seller on public.requests;
create policy requests_update_seller on public.requests for update
  using (exists (select 1 from public.listings l where l.id = requests.listing_id and l.seller_id = auth.uid()))
  with check (status in ('accepted', 'rejected', 'completed'));

drop policy if exists requests_update_admin on public.requests;
create policy requests_update_admin on public.requests for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists documents_select on public.validation_documents;
create policy documents_select on public.validation_documents for select
  using (
    public.is_admin()
    or exists (select 1 from public.requests r where r.id = validation_documents.request_id and r.buyer_id = auth.uid())
  );

drop policy if exists documents_insert_buyer on public.validation_documents;
create policy documents_insert_buyer on public.validation_documents for insert
  with check (
    review_status = 'pending'
    and exists (select 1 from public.requests r where r.id = validation_documents.request_id and r.buyer_id = auth.uid())
  );

drop policy if exists documents_update_admin on public.validation_documents;
create policy documents_update_admin on public.validation_documents for update
  using (public.is_admin()) with check (public.is_admin());

-- Storage buckets: public listing photos, private validation documents.

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('validation-docs', 'validation-docs', false)
on conflict (id) do nothing;

drop policy if exists listing_photos_read on storage.objects;
create policy listing_photos_read on storage.objects for select
  using (bucket_id = 'listing-photos');

drop policy if exists listing_photos_upload on storage.objects;
create policy listing_photos_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_role() = 'seller'
  );

drop policy if exists listing_photos_delete on storage.objects;
create policy listing_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists validation_docs_upload on storage.objects;
create policy validation_docs_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'validation-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists validation_docs_read on storage.objects;
create policy validation_docs_read on storage.objects for select to authenticated
  using (
    bucket_id = 'validation-docs'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
