-- Ledger rows are append-only for app users. Fee rates are mirrored in lib/fees.ts.
do $$ begin
  create type public.wallet_transaction_type as enum (
    'rental_earning',
    'sale_earning',
    'commission_deducted',
    'service_fee_charged',
    'inspection_fee_deducted',
    'deposit_held',
    'deposit_returned'
  );
exception when duplicate_object then null; end $$;

alter table public.listings add column if not exists deposit numeric(10,2);
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.listings'::regclass and conname = 'listings_deposit_nonnegative'
  ) then
    alter table public.listings
      add constraint listings_deposit_nonnegative check (deposit is null or deposit >= 0);
  end if;
end $$;

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  type public.wallet_transaction_type not null,
  amount numeric(10,2) not null check (amount >= 0),
  related_request_id uuid references public.requests(id) on delete set null,
  related_check_id uuid references public.checks(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions(user_id, created_at desc);
create unique index if not exists wallet_transactions_request_type_unique
  on public.wallet_transactions(related_request_id, type)
  where related_request_id is not null
    and type in ('rental_earning', 'sale_earning', 'commission_deducted', 'service_fee_charged');
create unique index if not exists wallet_transactions_check_fee_unique
  on public.wallet_transactions(related_check_id)
  where related_check_id is not null and type = 'inspection_fee_deducted';

alter table public.wallet_transactions enable row level security;
revoke all on table public.wallet_transactions from public, anon, authenticated;
grant select on table public.wallet_transactions to authenticated;
drop policy if exists wallet_transactions_select_own on public.wallet_transactions;
create policy wallet_transactions_select_own on public.wallet_transactions
  for select to authenticated
  using ((select auth.uid()) = user_id or public.is_admin());

revoke all on type public.wallet_transaction_type from public, anon, authenticated;
grant usage on type public.wallet_transaction_type to authenticated;

-- Earnings are recorded net of commission, so the commission row is informational here.
create or replace view public.wallet_balances with (security_invoker = true) as
select
  user_id,
  coalesce(sum(
    case
      when type in ('rental_earning', 'sale_earning', 'deposit_returned') then amount
      when type in ('inspection_fee_deducted', 'deposit_held', 'service_fee_charged') then -amount
      else 0
    end
  ), 0)::numeric(12,2) as balance
from public.wallet_transactions
group by user_id;
revoke all on table public.wallet_balances from public, anon, authenticated;
grant select on table public.wallet_balances to authenticated;

-- Keep this flat amount mirrored with INSPECTION_FEE_EGP in lib/fees.ts.
create or replace function public.set_flat_inspection_fee_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cost := 200.00;
  return new;
end;
$$;
revoke all on function public.set_flat_inspection_fee_on_insert() from public, anon, authenticated;
drop trigger if exists checks_set_flat_inspection_fee on public.checks;
create trigger checks_set_flat_inspection_fee
  before insert on public.checks
  for each row execute function public.set_flat_inspection_fee_on_insert();

-- Resolution and its ledger charge commit atomically; the existing check trigger assigns charged_to.
create or replace function public.resolve_device_check(
  p_check_id uuid,
  p_decision public.check_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check public.checks%rowtype;
  v_user_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'not allowed';
  end if;
  if p_decision not in ('passed', 'failed') then
    raise exception 'invalid decision';
  end if;

  select * into v_check
  from public.checks
  where id = p_check_id
  for update;

  if not found or v_check.status <> 'pending' then
    raise exception 'check is not pending';
  end if;

  update public.checks
  set status = p_decision
  where id = p_check_id
  returning * into v_check;

  if v_check.charged_to is null then
    return;
  elsif v_check.charged_to = 'seller'::public.check_charge_target then
    select l.seller_id into v_user_id
    from public.listings as l
    where l.id = v_check.listing_id;
  else
    select r.buyer_id into v_user_id
    from public.requests as r
    where r.id = v_check.related_request_id;
  end if;

  if v_user_id is null then
    raise exception 'inspection fee recipient not found';
  end if;

  insert into public.wallet_transactions (
    user_id, type, amount, related_request_id, related_check_id
  ) values (
    v_user_id,
    'inspection_fee_deducted',
    v_check.cost,
    v_check.related_request_id,
    v_check.id
  )
  on conflict do nothing;
end;
$$;
revoke all on function public.resolve_device_check(uuid, public.check_status) from public, anon, authenticated;
grant execute on function public.resolve_device_check(uuid, public.check_status) to authenticated;

-- Check status changes now go through the atomic resolver above.
revoke update on table public.checks from public, anon, authenticated;
grant select, insert on table public.checks to authenticated;

-- Remove the older RPCs whose public execution or balance handling was unsafe.
drop function if exists public.record_inspection_fee(uuid);
drop function if exists public.record_request_completion(uuid);

-- Real payment capture and settlement will replace these ledger-only entries when Paymob is integrated.

