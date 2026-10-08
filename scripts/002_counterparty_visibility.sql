-- Sellers can see buyers who requested their listings; buyers can see the seller once a request is accepted.

drop policy if exists users_select_counterparty on public.users;
create policy users_select_counterparty on public.users for select
  using (
    exists (
      select 1
      from public.requests r
      join public.listings l on l.id = r.listing_id
      where (l.seller_id = auth.uid() and r.buyer_id = users.id)
         or (r.buyer_id = auth.uid() and l.seller_id = users.id and r.status in ('accepted', 'completed'))
    )
  );

-- Sellers can see validation documents attached to requests on their own listings (status only; file stays admin/buyer readable in storage).

drop policy if exists documents_select_seller on public.validation_documents;
create policy documents_select_seller on public.validation_documents for select
  using (
    exists (
      select 1
      from public.requests r
      join public.listings l on l.id = r.listing_id
      where r.id = validation_documents.request_id and l.seller_id = auth.uid()
    )
  );
