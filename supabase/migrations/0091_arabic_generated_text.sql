-- =====================================================================
-- Migration 0091 : Arabic for text the database itself writes
--
-- Two pieces of English were reaching the screen from the database rather
-- than from the UI, so no amount of translating in the pages could reach
-- them:
--
--   * `journal_entries.user_remark` on automatic GL postings, written by
--     fn_post_sale_gl / fn_post_purchase_gl / fn_post_return_gl as
--     "Auto GL for sale <uuid>". It carries an id, so it is not a fixed
--     string the UI could look up — it has to be written in Arabic.
--   * the demo account's display name from 0084.
--
-- `voucher_type` is deliberately NOT translated: the app filters on it
-- (journal-entries searches `ilike voucher_type`), so the stored value stays
-- a stable English key and the list translates it at render.
--
-- The functions are rewritten from their own current definitions rather than
-- restated here, so this cannot drift from whatever 0077 and 0080 last left
-- in place. Re-runnable: after the first pass the English literals are gone,
-- the replacements no-op, and the functions are recreated identically.
-- =====================================================================

do $$
declare
    d text;
    pairs text[][] := array[
        ['Auto GL for sale ',         'قيد آلي لبيع '],
        ['Auto GL for purchase ',     'قيد آلي لشراء '],
        ['Auto GL for sales return ', 'قيد آلي لمرتجع بيع ']
    ];
    i int;
begin
    for d in
        select pg_get_functiondef(p.oid)
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('fn_post_sale_gl', 'fn_post_purchase_gl', 'fn_post_return_gl')
    loop
        for i in 1 .. array_length(pairs, 1) loop
            -- Only the inserted remark, never the `raise warning` diagnostics:
            -- those are server-log text for whoever is debugging, and the
            -- quoted form there differs, so a plain replace leaves them alone.
            d := replace(d, quote_literal(pairs[i][1]), quote_literal(pairs[i][2]));
        end loop;
        execute d;
    end loop;
end $$;

-- Rows already posted keep their English remark otherwise.
update journal_entries set user_remark = replace(user_remark, 'Auto GL for sale ', 'قيد آلي لبيع ')
 where user_remark like 'Auto GL for sale %';
update journal_entries set user_remark = replace(user_remark, 'Auto GL for purchase ', 'قيد آلي لشراء ')
 where user_remark like 'Auto GL for purchase %';
update journal_entries set user_remark = replace(user_remark, 'Auto GL for sales return ', 'قيد آلي لمرتجع بيع ')
 where user_remark like 'Auto GL for sales return %';

-- The demo account's display name (created by 0084).
update app_users set full_name = 'المستخدم التجريبي'
 where email = 'demo@spir.local' and full_name = 'Demo User';
