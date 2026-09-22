-- =====================================================================
-- Migration 0090 : Arabic master data, second pass
--
-- Migration 0087 translated the master data seeded by 0012–0052, but three
-- lists seeded by 0027 and 0031 were missed and still read English in the
-- UI: cost centres, sales people and the partner types.
--
-- Same rules as 0087: brand names are left alone (MedSupply, LabDirect are
-- companies, not labels), and every rename goes through the guard so the
-- file can be replayed — the renames free the English names, so replaying a
-- seed migration re-inserts them and a second run would otherwise collide on
-- the unique name.
-- =====================================================================

do $$
declare
    -- tbl, name column, English, Arabic
    pairs text[][] := array[
        -- Cost centres (journal_entry_accounts.cost_center references these
        -- by name, as does cost_centers.parent_cost_center — both repointed
        -- below before the row itself is renamed).
        ['cost_centers', 'name', 'Main',           'رئيسي'],
        ['cost_centers', 'name', 'Sales',          'المبيعات'],
        ['cost_centers', 'name', 'Service',        'الخدمة'],
        ['cost_centers', 'name', 'Administration', 'الإدارة'],

        -- Sales people (the group row, then the two seeded names)
        ['sales_persons', 'name', 'Sales Team',  'فريق المبيعات'],
        ['sales_persons', 'name', 'Ali Hassan',  'علي حسن'],
        ['sales_persons', 'name', 'Sara Kareem', 'سارة كريم'],

        -- Partner types (the partner companies themselves keep their names)
        ['sales_partners', 'partner_type', 'Distributor', 'موزّع'],
        ['sales_partners', 'partner_type', 'Reseller',    'بائع معتمد']
    ];
    i int;
    taken boolean;
begin
    for i in 1 .. array_length(pairs, 1) loop
        -- Repoint the by-name references before the name itself changes.
        if pairs[i][1] = 'cost_centers' then
            update cost_centers set parent_cost_center = pairs[i][4]
             where parent_cost_center = pairs[i][3];
            update journal_entry_accounts set cost_center = pairs[i][4]
             where cost_center = pairs[i][3];
        end if;

        -- partner_type is not unique, so it is a plain update; the others
        -- are, and need the replay guard.
        if pairs[i][2] <> 'name' then
            execute format('update %I set %I = $1 where %I = $2',
                           pairs[i][1], pairs[i][2], pairs[i][2])
              using pairs[i][4], pairs[i][3];
            continue;
        end if;

        execute format('select exists (select 1 from %I where %I = $1)', pairs[i][1], pairs[i][2])
           into taken using pairs[i][4];

        if taken then
            begin
                execute format('delete from %I where %I = $1', pairs[i][1], pairs[i][2])
                  using pairs[i][3];
            exception when foreign_key_violation then
                null;  -- still referenced; leaving it is the safe outcome
            end;
        else
            execute format('update %I set %I = $1 where %I = $2',
                           pairs[i][1], pairs[i][2], pairs[i][2])
              using pairs[i][4], pairs[i][3];
        end if;
    end loop;
end $$;
