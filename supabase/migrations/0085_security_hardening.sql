-- =====================================================================
-- Migration 0085 : Security hardening
--
-- Addresses the Supabase database-linter findings on the hosted project:
--
--   1. SECURITY DEFINER views (24)  — switch to SECURITY INVOKER so RLS
--      is enforced against the querying user instead of the view's owner.
--   2. Mutable function search_path (89) — pin every fn_* / trg_* in the
--      public schema to `public, pg_temp` so no schema-shadowing attack
--      can hijack a call. The value is stable across sessions once ALTERed.
--   3. fn_audit() reachable via /rest/v1/rpc — revoke EXECUTE from the
--      anon and authenticated roles. It is only ever called from
--      triggers (internally), never from client code.
-- =====================================================================

-- 1) Views: enforce security_invoker so RLS applies per caller.
do $$
declare v record;
begin
    for v in
        select c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'v'
          and n.nspname = 'public'
          and not exists (
              select 1 from unnest(coalesce(c.reloptions, array[]::text[])) as o
              where o in ('security_invoker=true', 'security_invoker=on')
          )
    loop
        execute format('alter view public.%I set (security_invoker = true)', v.relname);
    end loop;
end $$;

-- 2) Functions: pin search_path on every fn_* / trg_* in public.
do $$
declare r record;
begin
    for r in
        select n.nspname,
               p.proname,
               pg_get_function_identity_arguments(p.oid) as args
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.prokind = 'f'
          and (p.proname like 'fn\_%' escape '\'
               or p.proname like 'trg\_%' escape '\')
    loop
        execute format(
            'alter function %I.%I(%s) set search_path = public, pg_temp',
            r.nspname, r.proname, r.args
        );
    end loop;
end $$;

-- 3) Lock down fn_audit(): it is a trigger helper, not a public RPC.
--
-- `anon` and `authenticated` are Supabase-specific roles. The embedded PGlite
-- backend only creates `authenticated` (see src/lib/db/pglite.ts), and `anon`
-- does not exist there at all — revoking from a missing role aborts the whole
-- migration with "role \"anon\" does not exist" and leaves the database
-- unbootstrapped. Revoke per-role, and only from roles that actually exist.
do $$
declare r text;
begin
    if not exists (
        select 1 from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'fn_audit'
    ) then
        return;
    end if;

    execute 'revoke execute on function public.fn_audit() from public';

    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke execute on function public.fn_audit() from %I', r);
        end if;
    end loop;
end $$;
