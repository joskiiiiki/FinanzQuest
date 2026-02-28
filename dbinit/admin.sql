CREATE SCHEMA IF NOT EXISTS users;
GRANT USAGE ON SCHEMA users TO authenticated;

CREATE TYPE users.special_role AS ENUM (
    'admin',
    'teacher'
);

CREATE TABLE users.special_roles (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_role users.special_role NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY(user_id, user_role)
);

CREATE OR REPLACE FUNCTION users.grant_role(p_user_id UUID, p_user_role users.special_role)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO users.special_roles (user_id, user_role) VALUES (p_user_id, p_user_role);
END;
$$;

CREATE OR REPLACE FUNCTION users.grant_teacher(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT (users.has_any_role('admin', 'teacher') OR current_user = 'postgres') THEN
        RAISE EXCEPTION 'Unauthorized: Admin or Teacher role required'
            USING ERRCODE = '42501';
    END IF;
    INSERT INTO users.special_roles (user_id, user_role) VALUES (p_user_id, 'teacher');
    UPDATE auth.users SET is_super_admin = true;
END;
$$ SECURITY DEFINER;


GRANT EXECUTE ON FUNCTION users.grant_teacher(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION users.revoke_teacher(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT (users.has_any_role('admin', 'teacher') OR current_user = 'postgres') THEN
        RAISE EXCEPTION 'Unauthorized: Admin or Teacher role required'
            USING ERRCODE = '42501';
    END IF;
    DELETE FROM users.special_roles WHERE user_id = p_user_id AND user_role = 'teacher' ;
    UPDATE auth.users SET is_super_admin = false WHERE id = p_user_id;
END;
$$ SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION users.grant_teacher(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION users.revoke_role(p_user_id UUID, p_user_role users.special_role)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM users.special_roles
    WHERE user_id = p_user_id
    AND user_role = p_user_role;
END;
$$;

GRANT EXECUTE ON FUNCTION users.revoke_role(UUID, users.special_role) TO authenticated;


CREATE OR REPLACE FUNCTION users.has_role(required_role users.special_role)
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM users.special_roles
        WHERE user_id = auth.uid() AND user_role = required_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
GRANT EXECUTE ON FUNCTION users.has_role(users.special_role) TO authenticated;

-- Check if user has ANY of the specified roles
CREATE OR REPLACE FUNCTION users.has_any_role(VARIADIC required_roles users.special_role[])
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM users.special_roles
        WHERE user_id = auth.uid() 
        AND user_role = ANY(required_roles)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION users.has_any_role(VARIADIC users.special_role[]) TO authenticated;

GRANT SELECT ON users.special_roles TO authenticated;
GRANT UPDATE ON users.special_roles TO authenticated;
GRANT INSERT ON users.special_roles TO authenticated;
GRANT DELETE ON users.special_roles TO authenticated;

ALTER TABLE users.special_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role
CREATE POLICY "Users can view own role"
ON users.special_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only admins can update roles
CREATE POLICY "Admins can update roles"
ON users.special_roles FOR UPDATE
TO authenticated
USING (users.has_role('admin'));


-- Admins can insert new user roles
CREATE POLICY "Admins can insert roles"
ON users.special_roles FOR INSERT
TO authenticated
WITH CHECK (users.has_role('admin'));

-- Admins can delete user roles
CREATE POLICY "Admins can delete roles"
ON users.special_roles FOR DELETE
TO authenticated
USING (users.has_role('admin'));

-- Teachers - Depots 
CREATE POLICY "Teachers can view all Depots"
ON depots.depots FOR SELECT TO authenticated
USING (users.has_role('teacher'));

CREATE POLICY "Teachers can edit all Depots"
ON depots.depots FOR UPDATE TO authenticated
USING (users.has_role('teacher'));

CREATE POLICY "Teachers can insert Depots"
ON depots.depots FOR INSERT TO authenticated
WITH CHECK (users.has_role('teacher'));

CREATE POLICY "Teachers can delete Depots"
ON depots.depots FOR DELETE TO authenticated
USING (users.has_role('teacher'));

-- Teachers - Positions
CREATE POLICY "Teachers can view all Positions"
ON depots.positions FOR SELECT TO authenticated
USING (users.has_role('teacher'));

-- Teachers - Transactions
CREATE POLICY "Teachers can view all transactions"
ON depots.transactions FOR SELECT TO authenticated
USING (users.has_role('teacher'));

-- Teachers - Savings Plans
CREATE POLICY "Teachers can view all savings plans entrys"
ON depots.savings_plans FOR SELECT TO authenticated
USING (users.has_role('teacher'));

-- Teachers - Special Roles
CREATE POLICY "Teachers can view special roles"
ON users.special_roles FOR SELECT TO authenticated
USING (users.has_role('teacher'));

CREATE OR REPLACE FUNCTION users.get_all_profiles()
RETURNS TABLE(user_id uuid, name text, created_at timestamptz) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        au.id AS user_id,
        au.raw_user_meta_data->>'name' AS name,
        au."created_at"
    FROM auth.users as au;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Then create the view using the function
CREATE OR REPLACE VIEW users.profile AS
SELECT * FROM users.get_all_profiles();

GRANT SELECT ON users.profile TO authenticated;


-- Create table
CREATE TABLE IF NOT EXISTS depots.savings_plans_budget(
    depot_id BIGINT NOT NULL REFERENCES depots.depots(id) ON DELETE CASCADE,
    budget INT NOT NULL,
    last_changed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (depot_id) 
);

-- Enable RLS
ALTER TABLE depots.savings_plans_budget ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON depots.savings_plans_budget TO authenticated;

-- Create policies
CREATE POLICY "Users can read their budget" ON depots.savings_plans_budget
FOR SELECT TO authenticated
USING (depots.is_depot_member(depot_id));

CREATE POLICY "Teachers can read all budgets" ON depots.savings_plans_budget
FOR SELECT TO authenticated
USING (users.has_role('teacher'));

CREATE POLICY "Teachers can grant budget" ON depots.savings_plans_budget
FOR INSERT TO authenticated
WITH CHECK (users.has_role('teacher'));

CREATE POLICY "Teachers can update all budgets" ON depots.savings_plans_budget
FOR UPDATE TO authenticated
USING (users.has_role('teacher'));

-- Create function
CREATE OR REPLACE FUNCTION depots.change_budget(p_depot_id BIGINT, p_budget INT) 
RETURNS VOID 
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO depots.savings_plans_budget (depot_id, budget, last_changed) 
    VALUES (p_depot_id, p_budget, NOW())
    ON CONFLICT (depot_id) DO UPDATE
    SET
        budget = EXCLUDED.budget,
        last_changed = EXCLUDED.last_changed;
END;
$$;

-- Create trigger
CREATE OR REPLACE FUNCTION depots.grant_default_budget_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    budget INT;
BEGIN
    budget := COALESCE(current_setting('config.monthly_budget_start')::INT, 0);
    PERFORM depots.change_budget(NEW.id, budget); -- Set default budget, adjust as needed
    RETURN NEW;
END;
$$ SECURITY DEFINER;

CREATE TRIGGER grant_default_budget 
AFTER INSERT ON depots.depots
FOR EACH ROW
EXECUTE FUNCTION depots.grant_default_budget_trigger();


-- Overview with counts
CREATE OR REPLACE FUNCTION users.get_admin_overview() 
RETURNS TABLE(
    id uuid,
    email text,
    created_at timestamptz,
    meta_data jsonb,
    user_name text,
    banned_until timestamptz,
    user_roles users.special_role[],
    role_granted_at timestamptz[],
    depot_count bigint,
    position_count bigint,
    transaction_count bigint
) AS $$
BEGIN
    IF NOT (users.has_any_role('admin', 'teacher') OR current_user = 'postgres') THEN
        RAISE EXCEPTION 'Unauthorized: Admin or Teacher role required'
            USING ERRCODE = '42501';
    END IF;
    
    RETURN QUERY
    SELECT
        au.id as user_id,
        au.email::text,
        au.created_at,
        au.raw_user_meta_data,
        au.raw_user_meta_data->>'name' AS user_name,
        au.banned_until,
        roles.user_roles,
        roles.role_granted_at,
        COUNT(DISTINCT d.id) AS depot_count,
        COUNT(DISTINCT p.id) AS position_count,
        COUNT(DISTINCT t.id) AS transaction_count
    FROM auth.users AS au
    LEFT JOIN LATERAL (
        SELECT 
            array_agg(us.user_role ORDER BY us.granted_at) AS user_roles,
            array_agg(us.granted_at ORDER BY us.granted_at) AS role_granted_at
        FROM users.special_roles AS us
        WHERE us.user_id = au.id
    ) roles ON true
    LEFT JOIN depots.depots AS d ON au.id = ANY(d.users)
    LEFT JOIN depots.positions AS p ON d.id = p.depot_id
    LEFT JOIN depots.transactions AS t ON d.id = t.depot_id
    GROUP BY au.id, au.email, au.created_at, au.raw_user_meta_data, roles.user_roles, roles.role_granted_at;
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE VIEW users.admin_overview AS SELECT * FROM users.get_admin_overview();

GRANT SELECT ON users.admin_overview TO authenticated;

CREATE OR REPLACE FUNCTION depots.get_depot_overview() RETURNS TABLE(
    id bigint,
    cash bigint,
    cash_start bigint,
    transaction_count bigint,
    position_count bigint,
    user_names text[],
    user_ids uuid[],
    all_ids uuid[],
    monthly_budget int
) AS $$
    BEGIN
        IF NOT (users.has_any_role('admin', 'teacher') OR current_user = 'postgres') THEN
            RAISE EXCEPTION 'Unauthorized: Admin or Teacher role required'
            USING ERRCODE = '42501';
        END IF;

        RETURN QUERY
        SELECT
            d.id,
            d.cash,
            d.cash_start,
            COUNT(DISTINCT dt.id) as transaction_count, 
            COUNT(DISTINCT dp.id) as position_count,
            u.user_names,
            u.user_ids,
            d.users as all_ids,
            dsb.budget as monthly_budget
        FROM depots.depots AS d
        LEFT JOIN depots.transactions AS dt
        ON dt.depot_id = d.id
        LEFT JOIN depots.positions AS dp
        ON dp.depot_id = d.id
        LEFT JOIN LATERAL (
            SELECT
                array_agg(up.name ORDER BY up.user_id) AS user_names,
                array_agg(up.user_id ORDER BY up.user_id) AS user_ids
            FROM users.profile AS up
            WHERE up.user_id = ANY(d.users)
        ) u ON TRUE
        LEFT JOIN depots.savings_plans_budget AS dsb
        ON dsb.depot_id = d.id
        GROUP BY d.id, u.user_names, u.user_ids, dsb.budget;
    END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION depots.get_depot_overview() TO authenticated;

CREATE OR REPLACE VIEW depots.depot_overview AS SELECT * FROM depots.get_depot_overview();

GRANT SELECT ON depots.depot_overview TO authenticated;

CREATE OR REPLACE VIEW depots.savings_plans_budget_overview AS
SELECT
    dsb.budget,
    dsb.depot_id,
    dsb.last_changed,
    SUM(dsp.worth * depots.sp_to_per_month(dsp.period)) as monthly_expenses,
    dsb.budget - SUM(dsp.worth * depots.sp_to_per_month(dsp.period)) as remaining_budget
FROM depots.savings_plans_budget AS dsb
LEFT JOIN depots.savings_plans AS dsp ON dsp.depot_id = dsb.depot_id
GROUP BY dsb.budget, dsb.depot_id, dsb.last_changed;

GRANT SELECT ON depots.savings_plans_budget_overview TO authenticated;

CREATE OR REPLACE FUNCTION users."stats" () RETURNS TABLE(
    user_count bigint, teacher_count bigint, admin_count bigint, student_count bigint
) AS $$
DECLARE
    v_user_count bigint;
    v_teacher_count bigint;
    v_admin_count bigint;
    v_student_count bigint;
BEGIN
    IF NOT (users.has_any_role('admin', 'teacher') OR current_user = 'postgres') THEN
        RAISE EXCEPTION 'Unauthorized: Admin or Teacher role required'
            USING ERRCODE = '42501';
    END IF;

    -- Total user count
    SELECT COUNT(*) INTO v_user_count
    FROM auth.users;

    -- Teacher count
    SELECT COUNT(DISTINCT user_id) INTO v_teacher_count
    FROM users.special_roles
    WHERE user_role = 'teacher';

    -- Admin count
    SELECT COUNT(DISTINCT user_id) INTO v_admin_count
    FROM users.special_roles
    WHERE user_role = 'admin';

    -- Student count (users with no special roles)
    SELECT COUNT(*) INTO v_student_count
    FROM auth.users au
    WHERE NOT EXISTS (
        SELECT 1 FROM users.special_roles sr
        WHERE sr.user_id = au.id
    );

    RETURN QUERY SELECT v_user_count, v_teacher_count, v_admin_count, v_student_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION users."stats"() TO authenticated;

CREATE OR REPLACE FUNCTION depots.grant_reward(p_depot_id BIGINT, p_amount INT) 
RETURNS VOID AS $$
    BEGIN
        IF NOT (users.has_any_role('teacher') OR current_user = 'postgres') THEN
            RAISE EXCEPTION 'Unauthorized: Admin or Teacher role required'
                USING ERRCODE = '42501';
        END IF;
        UPDATE depots.depots AS d
        SET cash = d.cash + p_amount
        WHERE d.id = p_depot_id;
    END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION depots.grant_reward(bigint, int) TO authenticated;
