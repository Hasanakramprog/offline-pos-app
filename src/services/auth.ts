import bcrypt from 'bcryptjs';
import { db } from './db';
import type { User } from '../types';

export async function loginUser(username: string, password: string): Promise<User> {
  const rows = await db.query<User>(
    'SELECT * FROM users WHERE username = ? AND is_active = 1',
    [username]
  );
  if (!rows.length) throw new Error('User not found');
  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error('Invalid password');

  // Update last_login
  await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  return user;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function getUsers(): Promise<User[]> {
  return db.query<User>('SELECT * FROM users ORDER BY created_at DESC');
}

export async function createUser(user: Omit<User, 'created_at' | 'last_login'>): Promise<void> {
  await db.run(
    `INSERT INTO users (id, username, full_name, role, password_hash, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user.id, user.username, user.full_name, user.role, user.password_hash, user.is_active]
  );
}

export async function updateUser(
  id: string,
  fields: Partial<Pick<User, 'full_name' | 'role' | 'is_active' | 'password_hash'>>
): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  vals.push(id);
  await db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteUser(id: string): Promise<void> {
  await db.run('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
}
