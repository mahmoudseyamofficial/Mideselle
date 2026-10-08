-- Existing single-period rents map to the matching option and retain their exact price.
create type public.rent_period_option as enum ('weekly', 'monthly');

alter table public.listings
  add column rent_weekly_price numeric(10,2),
  add column rent_monthly_price numeric(10,2);

alter table public.requests
  add column rent_period public.rent_period_option;

alter table public.listings
  drop constraint listings_rent_period_check,
  drop constraint rent_period_matches_type,
  drop constraint price_matches_type;

-- The legacy transition guard rejects updates to terminal requests. Disable only this
-- user trigger during the deterministic one-time period backfill, then restore it below.
drop trigger if exists requests_guard_update on public.requests;

update public.requests as r
set rent_period = case l.rent_period
  when 'week' then 'weekly'::public.rent_period_option
  when 'month' then 'monthly'::public.rent_period_option
  else null
end
from public.listings as l
where l.id = r.listing_id
  and l.type = 'rent';

update public.listings
set rent_weekly_price = case when rent_period = 'week' then price end,
    rent_monthly_price = case when rent_period = 'month' then price end
where type = 'rent';

update public.listings
set price = null
where type = 'rent';

alter table public.listings
  alter column rent_period type public.rent_period_option[]
  using case
    when rent_period = 'week' then array['weekly'::public.rent_period_option]
    when rent_period = 'month' then array['monthly'::public.rent_period_option]
    else null
  end;

alter table public.listings
  add constraint listings_rent_weekly_price_check
    check (rent_weekly_price is null or rent_weekly_price >= 0),
  add constraint listings_rent_monthly_price_check
    check (rent_monthly_price is null or rent_monthly_price >= 0),
  add constraint price_matches_type
    check (
      (type = 'sell' and price is not null)
      or (type = 'rent' and price is null)
      or (type = 'donate' and price is null)
    ),
  add constraint rent_period_matches_type
    check (
      (
        type = 'rent'
        and rent_period is not null
        and (
          (rent_period = array['weekly'::public.rent_period_option]
            and rent_weekly_price is not null and rent_monthly_price is null)
          or (rent_period = array['monthly'::public.rent_period_option]
            and rent_weekly_price is null and rent_monthly_price is not null)
          or (rent_period = array[
            'weekly'::public.rent_period_option,
            'monthly'::public.rent_period_option
          ] and rent_weekly_price is not null and rent_monthly_price is not null)
        )
      )
      or (
        type <> 'rent'
        and rent_period is null
        and rent_weekly_price is null
        and rent_monthly_price is null
      )
    );

grant usage on type public.rent_period_option to anon, authenticated;

drop policy if exists requests_insert_buyer on public.requests;
create policy requests_insert_buyer on public.requests
  for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and status = 'pending'
    and public.current_user_role() = 'buyer'::public.user_role
    and exists (
      select 1
      from public.listings as l
      where l.id = requests.listing_id
        and l.certification_status = 'certified'
        and l.availability = 'available'
        and (
          (l.type = 'rent'
            and requests.rent_period is not null
            and requests.rent_period = any (l.rent_period))
          or (l.type <> 'rent' and requests.rent_period is null)
        )
    )
  );

create or replace function public.guard_request_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_seller boolean;
begin
  if new.listing_id <> old.listing_id or new.buyer_id <> old.buyer_id then
    raise exception 'Request ownership cannot change';
  end if;
  if new.rent_period is distinct from old.rent_period then
    raise exception 'Request rental period cannot change';
  end if;

  if public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  select exists (
    select 1
    from public.listings as l
    where l.id = old.listing_id and l.seller_id = auth.uid()
  ) into is_seller;

  if old.buyer_id = auth.uid() and old.status = 'pending' and new.status = 'cancelled_by_buyer' then
    null;
  elsif is_seller and old.status = 'pending' and new.status in ('accepted', 'rejected') then
    null;
  elsif is_seller and old.status = 'accepted' and new.status in ('completed', 'pending_seller_inspection') then
    null;
  else
    raise exception 'Invalid request status transition';
  end if;

  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.guard_request_update() from public, anon, authenticated;
drop trigger if exists requests_guard_update on public.requests;
create trigger requests_guard_update
  before update on public.requests
  for each row execute function public.guard_request_update();

-- Fee rates mirror OWNER_COMMISSION_RATE and BUYER_SERVICE_FEE_RATE in lib/fees.ts.
create or replace function public.complete_request_with_ledger(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.requests%rowtype;
  v_listing public.listings%rowtype;
  v_base_price numeric(10,2);
  v_commission numeric(10,2);
  v_service_fee numeric(10,2);
  v_earning_type public.wallet_transaction_type;
  v_expected_availability public.availability_status;
  v_owner_commission_rate constant numeric := 0.08;
  v_buyer_service_fee_rate constant numeric := 0.04;
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'request not found';
  end if;

  select * into v_listing
  from public.listings
  where id = v_request.listing_id
  for update;

  if not found
    or v_listing.seller_id is distinct from auth.uid()
    or public.current_user_role() is distinct from 'seller'::public.user_role then
    raise exception 'not allowed';
  end if;

  if v_request.status not in ('accepted', 'completed') then
    raise exception 'request is not accepted';
  end if;
  if v_request.status = 'accepted' and v_listing.availability <> 'available' then
    raise exception 'listing is no longer available';
  end if;

  v_expected_availability := case v_listing.type
    when 'sell' then 'sold'::public.availability_status
    when 'rent' then 'rented'::public.availability_status
    else 'donated'::public.availability_status
  end;

  if v_listing.type = 'rent' then
    v_base_price := case v_request.rent_period
      when 'weekly'::public.rent_period_option then v_listing.rent_weekly_price
      when 'monthly'::public.rent_period_option then v_listing.rent_monthly_price
      else null
    end;
    v_earning_type := 'rental_earning'::public.wallet_transaction_type;
  elsif v_listing.type = 'sell' then
    v_base_price := v_listing.price;
    v_earning_type := 'sale_earning'::public.wallet_transaction_type;
  else
    v_base_price := null;
  end if;

  if v_listing.type <> 'donate' and v_base_price is null then
    raise exception 'request price is unavailable';
  end if;

  if v_request.status = 'accepted' then
    update public.requests
    set status = 'completed'
    where id = p_request_id;
  end if;

  update public.listings
  set availability = v_expected_availability
  where id = v_listing.id and availability = 'available';

  if v_listing.type = 'donate' then
    return;
  end if;

  v_commission := round(v_base_price * v_owner_commission_rate, 2);
  v_service_fee := round(v_base_price * v_buyer_service_fee_rate, 2);

  insert into public.wallet_transactions (user_id, type, amount, related_request_id)
  values
    (v_listing.seller_id, v_earning_type, v_base_price - v_commission, p_request_id),
    (v_listing.seller_id, 'commission_deducted', v_commission, p_request_id),
    (v_request.buyer_id, 'service_fee_charged', v_service_fee, p_request_id)
  on conflict do nothing;
end;
$$;
revoke all on function public.complete_request_with_ledger(uuid) from public, anon, authenticated;
grant execute on function public.complete_request_with_ledger(uuid) to authenticated;

-- Real payment capture and settlement will replace ledger-only completion when Paymob is integrated.

