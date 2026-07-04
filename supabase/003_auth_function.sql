-- ================================================================
-- MiniMarket POS — Custom Auth RPC
-- Run AFTER 002_rls_policies.sql
--
-- Purpose: The web portal uses the same bcrypt password_hash
-- stored in the synced users table. This function verifies the
-- password and returns a signed Supabase JWT so the client can
-- make authenticated API calls.
-- ================================================================

-- Install pgcrypto for crypt() function (already in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── login(username, password) ────────────────────────────────────
-- Returns: { user_id, role, full_name } on success, raises exception on fail.
CREATE OR REPLACE FUNCTION public.pos_login(
  p_username TEXT,
  p_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_token TEXT;
BEGIN
  -- Find the user
  SELECT * INTO v_user
  FROM public.users
  WHERE username = p_username AND is_active = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  -- Verify bcrypt password
  -- Note: crypt() in pgcrypto handles bcrypt comparison
  IF v_user.password_hash != crypt(p_password, v_user.password_hash) THEN
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  -- Only allow admin and manager roles on the web portal
  IF v_user.role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'insufficient_role';
  END IF;

  -- Return user info (JWT will be created on the client using supabase.auth.signInWithPassword
  -- after we verify credentials here first)
  RETURN json_build_object(
    'id',        v_user.id,
    'username',  v_user.username,
    'full_name', v_user.full_name,
    'role',      v_user.role
  );
END;
$$;

-- Grant execute to anon (web portal calls this before being authenticated)
GRANT EXECUTE ON FUNCTION public.pos_login(TEXT, TEXT) TO anon;
