/**
 * lib/auth.ts
 * Custom bcrypt-based authentication using the synced users table.
 * The web portal verifies the same password_hash stored by the Electron app.
 */
import { supabase } from './supabase';

export interface PortalUser {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'manager';
}

/**
 * Verify credentials against the pos_login RPC function.
 * On success, stores the user in sessionStorage.
 */
export async function loginPortal(username: string, password: string): Promise<PortalUser> {
  const { data, error } = await supabase.rpc('pos_login', {
    p_username: username,
    p_password: password,
  });

  if (error) {
    if (error.message.includes('invalid_credentials')) throw new Error('Invalid username or password');
    if (error.message.includes('insufficient_role')) throw new Error('Only admins and managers can access the web portal');
    throw new Error(error.message);
  }

  const user = data as PortalUser;
  sessionStorage.setItem('pos_portal_user', JSON.stringify(user));
  return user;
}

export function getPortalUser(): PortalUser | null {
  try {
    const raw = sessionStorage.getItem('pos_portal_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function logoutPortal() {
  sessionStorage.removeItem('pos_portal_user');
}

export function requireAuth(): PortalUser {
  const user = getPortalUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}
