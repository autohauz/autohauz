-- Revert the dangerously permissive grants from 20280101000000_fix_permissions.sql
-- The bad migration overrode the explicit security revocations from 20260924100000_security_hardening.sql.
-- We must re-apply the explicit revocations for privileged RPCs.

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_lead_with_event(jsonb)',
    'public.increment_vehicle_view(uuid)',
    'public.record_cta_click(uuid, text)',
    'public.expire_stale_vdps()',
    'public.anonymize_stale_leads(integer)',
    'public.next_invoice_number(text)',
    'public.publish_scheduled_articles()',
    'public.handle_new_user()',
    'public.handle_vehicle_price_change()',
    'public.enqueue_search_index_job()',
    'public.touch_syndication_vehicle_extra()',
    'public.update_invoice_payment_status()',
    'public.enforce_invoice_status_transition()'
  ]
  loop
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', fn);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regprocedure('public.get_admin_dashboard_metrics(integer)') is not null then
    revoke execute on function public.get_admin_dashboard_metrics(integer) from public, anon;
  end if;
end $$;

-- Restore the default privileges protection
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['bids', 'chat_threads', 'chat_messages'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;
