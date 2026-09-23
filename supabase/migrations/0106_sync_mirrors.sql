-- =====================================================================
-- Migration 0106 : A synced change is a copy, not a new event
--
-- Applying a change that came from another computer used to fire this
-- database's own triggers. The ones that derive rows then derived them a
-- second time: a synced sale posted a second journal entry here, while the
-- first one — posted where the sale was made — arrived through the log as
-- well. Every computer ended up with its own extra copy, and the books no
-- longer agreed between them.
--
-- The rows a trigger derives are logged where they are made, so they
-- already travel. A computer receiving a change should mirror it, not
-- recompute it. Postgres has a switch for exactly that
-- (session_replication_role), but a hosted database does not let its users
-- set it. So each trigger gets the condition itself:
--
--     WHEN (current_setting('spir.syncing', true) IS DISTINCT FROM 'on')
--
-- and _spir_apply_change already sets spir.syncing for the duration of one
-- applied change. Two kinds are left alone: the change log's own trigger
-- (it checks the flag itself), and the audit trigger, so the Change &
-- Deletion Log on the main computer still shows what the office did.
-- Foreign keys are Postgres's internal triggers and keep working.
--
-- _spir_guard_triggers() adds the condition to any trigger that lacks it,
-- and the app runs it after every migration pass, as it does for the change
-- log — a trigger added later is covered without anyone remembering.
-- =====================================================================

create or replace function _spir_guard_triggers() returns integer
language plpgsql as $$
declare
    r   record;
    def text;
    n   integer := 0;
begin
    for r in
        select t.tgname, c.relname, pg_get_triggerdef(t.oid) as def
          from pg_trigger t
          join pg_class c      on c.oid = t.tgrelid
          join pg_namespace ns on ns.oid = c.relnamespace
          join pg_proc p       on p.oid = t.tgfoid
         where ns.nspname = 'public'
           and not t.tgisinternal
           and t.tgenabled = 'O'
           and t.tgname <> 'zz_spir_change_log'
           and p.proname <> 'fn_audit'
           and pg_get_triggerdef(t.oid) not like '%spir.syncing%'
    loop
        def := r.def;
        if def ~ ' WHEN \(' then
            def := regexp_replace(
                def, ' WHEN \((.*)\) EXECUTE ',
                ' WHEN ((current_setting(''spir.syncing'', true) IS DISTINCT FROM ''on'') AND (\1)) EXECUTE ');
        else
            def := regexp_replace(
                def, ' EXECUTE (FUNCTION|PROCEDURE) ',
                ' WHEN (current_setting(''spir.syncing'', true) IS DISTINCT FROM ''on'') EXECUTE \1 ');
        end if;
        execute format('drop trigger %I on public.%I', r.tgname, r.relname);
        execute def;
        n := n + 1;
    end loop;
    return n;
end $$;

select _spir_guard_triggers();
