-- Device checks: seller pre-handover, seller post-rental, buyer pre-purchase.
do $$ begin
  alter type public.request_status add value if not exists 'pending_seller_inspection';
exception when duplicate_object then null; end $$;

-- MIGRATION_BOUNDARY

do $$ begin
  create type public.check_trigger_type as enum ('post_rental_return', 'pre_sale_handover', 'pre_purchase_inspection');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.check_status as enum ('pending', 'passed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.check_charge_target as enum ('seller', 'buyer');
exception when duplicate_object then null; end $$;

create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  related_request_id uuid not null references public.requests(id) on delete cascade,
  trigger_type public.check_trigger_type not null,
  status public.check_status not null default 'pending',
  cost numeric(10,2) not null default 0 check (cost >= 0),
  details text not null default '',
  charged_to public.check_charge_target,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint one_pending_check_per_request unique (related_request_id, trigger_type)
);

alter table public.checks enable row level security;
drop policy if exists checks_select_participants on public.checks;
create policy checks_select_participants on public.checks for select using (
  public.is_admin() or exists (select 1 from public.requests r where r.id = checks.related_request_id and (r.buyer_id = auth.uid() or exists (select 1 from public.listings l where l.id = r.listing_id and l.seller_id = auth.uid())))
);
drop policy if exists checks_insert_seller on public.checks;
create policy checks_insert_seller on public.checks for insert with check (
  trigger_type in ('post_rental_return', 'pre_sale_handover') and status = 'pending' and exists (select 1 from public.requests r join public.listings l on l.id = r.listing_id where r.id = checks.related_request_id and l.id = checks.listing_id and l.seller_id = auth.uid() and ((trigger_type = 'pre_sale_handover' and l.type = 'sell' and r.status = 'accepted') or (trigger_type = 'post_rental_return' and l.type = 'rent' and r.status = 'accepted')))
);
drop policy if exists checks_insert_buyer on public.checks;
create policy checks_insert_buyer on public.checks for insert with check (
  trigger_type = 'pre_purchase_inspection' and status = 'pending' and exists (select 1 from public.requests r join public.listings l on l.id = r.listing_id where r.id = checks.related_request_id and l.id = checks.listing_id and r.buyer_id = auth.uid() and r.status = 'accepted')
);
drop policy if exists checks_update_admin on public.checks;
create policy checks_update_admin on public.checks for update using (public.is_admin()) with check (public.is_admin());

create or replace function public.guard_check_update() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    if new.status = 'passed' then new.resolved_at := now(); new.charged_to := case when new.trigger_type in ('post_rental_return','pre_sale_handover') then 'seller'::public.check_charge_target else 'buyer'::public.check_charge_target end;
    elsif new.status = 'failed' then new.resolved_at := now(); end if;
    return new;
  end if;
  raise exception 'Only admins can resolve checks';
end; $$;
drop trigger if exists checks_guard_update on public.checks;
create trigger checks_guard_update before update on public.checks for each row execute function public.guard_check_update();

create or replace function public.sync_check_resolution() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'passed' then
    update public.requests set status = 'accepted' where id = new.related_request_id and status = 'pending_seller_inspection';
  elsif new.status = 'failed' then
    update public.requests set status = 'rejected' where id = new.related_request_id and status = 'pending_seller_inspection';
    if new.trigger_type = 'pre_sale_handover' then update public.listings set certification_status = 'pending' where id = new.listing_id; end if;
  end if;
  return new;
end; $$;
drop trigger if exists checks_sync_resolution on public.checks;
create trigger checks_sync_resolution after update of status on public.checks for each row when (old.status = 'pending' and new.status in ('passed','failed')) execute function public.sync_check_resolution();

create or replace function public.guard_request_update() returns trigger language plpgsql security definer set search_path = '' as $$
declare is_seller boolean;
begin
  if new.listing_id <> old.listing_id or new.buyer_id <> old.buyer_id then raise exception 'Request ownership cannot change'; end if;
  if public.is_admin() then new.updated_at := now(); return new; end if;
  select exists (select 1 from public.listings l where l.id = old.listing_id and l.seller_id = auth.uid()) into is_seller;
  if old.buyer_id = auth.uid() and old.status = 'pending' and new.status = 'cancelled_by_buyer' then null;
  elsif is_seller and old.status = 'pending' and new.status in ('accepted','rejected') then null;
  elsif is_seller and old.status = 'accepted' and new.status = 'completed' then null;
  elsif is_seller and old.status = 'accepted' and new.status = 'pending_seller_inspection' then null;
  else raise exception 'Invalid request status transition'; end if;
  new.updated_at := now(); return new;
end; $$;

 drop policy if exists requests_update_seller on public.requests;
 create policy requests_update_seller on public.requests for update using (exists (select 1 from public.listings l where l.id = requests.listing_id and l.seller_id = auth.uid())) with check (status in ('accepted','rejected','completed','pending_seller_inspection'));
 grant select, insert, update on public.checks to authenticated;
grant usage on type public.check_trigger_type, public.check_status, public.check_charge_target to authenticated;
-- seller action transitions a request into inspection atomically through the insert RLS path.
create or replace function public.create_seller_check(p_request_id uuid, p_trigger public.check_trigger_type, p_cost numeric, p_details text) returns uuid language plpgsql security invoker set search_path = '' as $$ declare v_id uuid; v_listing uuid; begin select r.listing_id into v_listing from public.requests r join public.listings l on l.id=r.listing_id where r.id=p_request_id and l.seller_id=auth.uid() and ((p_trigger='pre_sale_handover' and l.type='sell' and r.status='accepted') or (p_trigger='post_rental_return' and l.type='rent' and r.status='accepted')); if v_listing is null then raise exception 'not allowed'; end if; update public.requests set status='pending_seller_inspection' where id=p_request_id; insert into public.checks(listing_id,related_request_id,trigger_type,cost,details) values(v_listing,p_request_id,p_trigger,p_cost,coalesce(p_details,'')) returning id into v_id; return v_id; end; $$;
revoke all on function public.create_seller_check(uuid, public.check_trigger_type, numeric, text) from public;
grant execute on function public.create_seller_check(uuid, public.check_trigger_type, numeric, text) to authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.checks TO authenticated;
GRANT SELECT, UPDATE ON public.requests TO authenticated;
GRANT SELECT, UPDATE ON public.listings TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_seller_check(uuid, public.check_trigger_type, numeric, text) TO authenticated;

drop policy if exists requests_update_admin on public.requests;
create policy requests_update_admin on public.requests for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists listings_update_admin on public.listings;
create policy listings_update_admin on public.listings for update using (public.is_admin()) with check (public.is_admin());

-- Existing post-rental checks, if present, are seller-paid by the resolution trigger above.
