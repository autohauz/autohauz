-- ─────────────────────────────────────────────────────────────────────────────
-- Invoice integrity (audit 2026-09-24: DB-06, DB-08, DB-09, DB-16, DB-23,
-- DB-24). Additive: no data dropped or rewritten.
--
--  1. Per-line GST flag (GST-free lines such as rego / CTP / stamp duty).
--  2. Seller + vehicle snapshots frozen at issue, so a re-rendered tax
--     invoice never picks up a later ABN / bank / address change.
--  3. Value checks on amounts.
--  4. Invoice year in Australian (Sydney) time.
--  5. save_invoice_draft(): header + items in ONE transaction.
--  6. issue_invoice(): conditional on status = 'draft', numbered in the same
--     transaction — two concurrent "Issue" clicks can no longer renumber.
--  7. Issued invoices are immutable (except payment bookkeeping and voiding);
--     their items cannot change; non-drafts cannot be deleted.
--  8. Payments: invoice must be issued / part-paid, amount must not exceed
--     the balance; the row lock serialises concurrent payments; the status
--     recalculation handles DELETE (it used NEW, which is NULL on delete).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1–2. Columns ────────────────────────────────────────────────────────────
alter table public.invoice_items add column if not exists gst_applicable boolean not null default true;
alter table public.invoices add column if not exists document_title text;
alter table public.invoices add column if not exists seller_snapshot jsonb;
alter table public.invoices add column if not exists vehicle_snapshot jsonb;
alter table public.invoices add column if not exists gst_free_cents bigint not null default 0;

-- ── 3. Value checks (NOT VALID: enforced for new/changed rows only) ─────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invoice_items_values_check') then
    alter table public.invoice_items add constraint invoice_items_values_check
      check (quantity > 0 and unit_price_cents >= 0 and discount_cents >= 0
             and discount_cents <= quantity * unit_price_cents) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoice_payments_amount_check') then
    alter table public.invoice_payments add constraint invoice_payments_amount_check
      check (amount_cents > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'invoices_amounts_check') then
    alter table public.invoices add constraint invoices_amounts_check
      check (subtotal_cents >= 0 and line_discounts_cents >= 0 and invoice_discount_cents >= 0
             and net_ex_gst_cents >= 0 and gst_cents >= 0 and total_inc_gst_cents >= 0
             and payments_cents >= 0 and gst_free_cents >= 0) not valid;
  end if;
end $$;

-- ── 4. Invoice numbering in Australian time ─────────────────────────────────
-- Supabase runs in UTC: between 00:00 and ~11:00 AEDT on 1 January the old
-- function numbered invoices into the previous year's sequence.
create or replace function public.next_invoice_number(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_year int := extract(year from (now() at time zone 'Australia/Sydney'))::int;
  v_seq int;
begin
  if p_prefix is null or p_prefix !~ '^[A-Z0-9]{1,6}$' then
    raise exception 'Invalid invoice number prefix' using errcode = '22023';
  end if;

  insert into public.invoice_number_sequences (year, last_value)
  values (v_year, 1)
  on conflict (year) do update
    set last_value = public.invoice_number_sequences.last_value + 1
  returning last_value into v_seq;

  return p_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, 6, '0');
end;
$$;
revoke execute on function public.next_invoice_number(text) from public, anon, authenticated;
grant execute on function public.next_invoice_number(text) to service_role;

-- ── 5. Transactional draft save ──────────────────────────────────────────────
-- p_header: invoice columns (totals computed and unit-tested in the app,
--           src/lib/invoices/calc.ts). p_items: [{description, quantity,
--           unit_price_cents, discount_cents, gst_applicable, sort_order}].
create or replace function public.save_invoice_draft(p_invoice_id uuid, p_header jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := p_invoice_id;
  v_status public.invoice_status;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'items must be an array' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.invoices (status, billing_name) values ('draft', p_header->>'billing_name')
    returning id into v_id;
  else
    select status into v_status from public.invoices where id = v_id for update;
    if not found then
      raise exception 'Invoice not found' using errcode = 'P0002';
    end if;
    if v_status <> 'draft' then
      raise exception 'Only draft invoices can be edited' using errcode = '55000';
    end if;
  end if;

  update public.invoices set
    lead_id                = nullif(p_header->>'lead_id', '')::uuid,
    vehicle_id             = nullif(p_header->>'vehicle_id', '')::uuid,
    billing_name           = p_header->>'billing_name',
    billing_email          = nullif(p_header->>'billing_email', ''),
    billing_phone          = nullif(p_header->>'billing_phone', ''),
    billing_address        = nullif(p_header->>'billing_address', ''),
    billing_abn            = nullif(p_header->>'billing_abn', ''),
    gst_enabled            = (p_header->>'gst_enabled')::boolean,
    gst_rate               = (p_header->>'gst_rate')::numeric,
    prices_include_gst     = (p_header->>'prices_include_gst')::boolean,
    subtotal_cents         = (p_header->>'subtotal_cents')::bigint,
    line_discounts_cents   = (p_header->>'line_discounts_cents')::bigint,
    invoice_discount_cents = (p_header->>'invoice_discount_cents')::bigint,
    net_ex_gst_cents       = (p_header->>'net_ex_gst_cents')::bigint,
    gst_cents              = (p_header->>'gst_cents')::bigint,
    gst_free_cents         = coalesce((p_header->>'gst_free_cents')::bigint, 0),
    total_inc_gst_cents    = (p_header->>'total_inc_gst_cents')::bigint,
    due_date               = nullif(p_header->>'due_date', '')::date,
    notes                  = nullif(p_header->>'notes', ''),
    payment_terms          = nullif(p_header->>'payment_terms', ''),
    footer_note            = nullif(p_header->>'footer_note', '')
  where id = v_id;

  delete from public.invoice_items where invoice_id = v_id;

  insert into public.invoice_items
    (invoice_id, description, quantity, unit_price_cents, discount_cents, gst_applicable, sort_order)
  select v_id,
         item->>'description',
         (item->>'quantity')::int,
         (item->>'unit_price_cents')::bigint,
         coalesce((item->>'discount_cents')::bigint, 0),
         coalesce((item->>'gst_applicable')::boolean, true),
         coalesce((item->>'sort_order')::int, (ord - 1)::int)
  from jsonb_array_elements(p_items) with ordinality as t(item, ord);

  return v_id;
end;
$$;
revoke execute on function public.save_invoice_draft(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_invoice_draft(uuid, jsonb, jsonb) to service_role;

-- ── 6. Atomic issue ──────────────────────────────────────────────────────────
create or replace function public.issue_invoice(
  p_invoice_id uuid,
  p_prefix text,
  p_document_title text,
  p_seller jsonb,
  p_vehicle jsonb
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.invoices%rowtype;
  v_number text;
begin
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_inv.status <> 'draft' then
    raise exception 'Only draft invoices can be issued (current status: %)', v_inv.status using errcode = '55000';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = p_invoice_id) then
    raise exception 'Add at least one line item before issuing' using errcode = '55000';
  end if;
  if v_inv.total_inc_gst_cents <= 0 then
    raise exception 'An invoice total must be greater than zero' using errcode = '55000';
  end if;

  v_number := public.next_invoice_number(p_prefix);

  update public.invoices set
    status           = 'issued',
    invoice_number   = v_number,
    issued_at        = now(),
    document_title   = p_document_title,
    seller_snapshot  = p_seller,
    vehicle_snapshot = p_vehicle
  where id = p_invoice_id;

  return v_number;
end;
$$;
revoke execute on function public.issue_invoice(uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.issue_invoice(uuid, text, text, jsonb, jsonb) to service_role;

-- ── 7. Immutability ─────────────────────────────────────────────────────────
-- Once issued, only payment bookkeeping, voiding and timestamps may change.
create or replace function app_private.enforce_invoice_immutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  mutable text[] := array['status', 'payments_cents', 'paid_at', 'voided_at', 'updated_at'];
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Issued invoices cannot be deleted; void them instead' using errcode = '55000';
    end if;
    return old;
  end if;

  -- lead_id / vehicle_id are ON DELETE SET NULL: deleting the lead or vehicle
  -- may clear the link (the vehicle is preserved in vehicle_snapshot), but an
  -- issued invoice can never be re-pointed at a different lead or vehicle.
  if new.lead_id is null then mutable := array_append(mutable, 'lead_id'); end if;
  if new.vehicle_id is null then mutable := array_append(mutable, 'vehicle_id'); end if;

  if old.status <> 'draft'
     and (to_jsonb(new) - mutable) is distinct from (to_jsonb(old) - mutable) then
    raise exception 'Issued invoices cannot be edited' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoices_immutable on public.invoices;
create trigger trg_invoices_immutable
  before update or delete on public.invoices
  for each row execute function app_private.enforce_invoice_immutability();

create or replace function app_private.enforce_invoice_item_immutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_status public.invoice_status;
begin
  select status into v_status from public.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  -- Parent already gone (cascade from a draft delete) or still a draft: fine.
  if v_status is null or v_status = 'draft' then
    return coalesce(new, old);
  end if;
  raise exception 'Line items of an issued invoice cannot be changed' using errcode = '55000';
end;
$$;

drop trigger if exists trg_invoice_items_immutable on public.invoice_items;
create trigger trg_invoice_items_immutable
  before insert or update or delete on public.invoice_items
  for each row execute function app_private.enforce_invoice_item_immutability();

-- ── 8. Payments ─────────────────────────────────────────────────────────────
create or replace function app_private.check_invoice_payment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_inv public.invoices%rowtype;
begin
  -- Row lock: concurrent payments on one invoice are applied one at a time,
  -- so two partial payments cannot both pass the balance check.
  select * into v_inv from public.invoices where id = new.invoice_id for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_inv.status not in ('issued', 'partially_paid') then
    raise exception 'Payments can only be recorded against issued invoices (status: %)', v_inv.status
      using errcode = '55000';
  end if;
  if new.amount_cents > v_inv.total_inc_gst_cents - v_inv.payments_cents then
    raise exception 'Payment exceeds the balance due' using errcode = '22003';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_payments_check on public.invoice_payments;
create trigger trg_invoice_payments_check
  before insert on public.invoice_payments
  for each row execute function app_private.check_invoice_payment();

-- Payments are append-only records: corrections are voids/credit notes, not edits.
create or replace function app_private.forbid_payment_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Recorded payments cannot be changed or deleted' using errcode = '55000';
end;
$$;

drop trigger if exists trg_invoice_payments_append_only on public.invoice_payments;
create trigger trg_invoice_payments_append_only
  before update or delete on public.invoice_payments
  for each row execute function app_private.forbid_payment_mutation();

create or replace function public.update_invoice_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice_id uuid := coalesce(new.invoice_id, old.invoice_id);
  v_total_paid bigint;
  v_total bigint;
  v_status public.invoice_status;
begin
  select coalesce(sum(amount_cents), 0) into v_total_paid
  from public.invoice_payments where invoice_id = v_invoice_id;

  select total_inc_gst_cents, status into v_total, v_status
  from public.invoices where id = v_invoice_id;

  -- Void invoices keep their status; payment totals are still recorded.
  update public.invoices set
    payments_cents = v_total_paid,
    status = case
      when v_status = 'void' then v_status
      when v_total_paid >= v_total then 'paid'::public.invoice_status
      when v_total_paid > 0 then 'partially_paid'::public.invoice_status
      else v_status
    end,
    paid_at = case when v_status <> 'void' and v_total_paid >= v_total then coalesce(paid_at, now()) else paid_at end
  where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;
revoke execute on function public.update_invoice_payment_status() from public, anon, authenticated;
