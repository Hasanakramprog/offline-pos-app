import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Shield } from 'lucide-react';
import { getUsers, createUser, updateUser, hashPassword } from '../services/auth';
import { toast } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Common/Button';
import { Modal } from '../components/Common/Modal';
import type { User, UserRole } from '../types';

const emptyForm = { username: '', full_name: '', role: 'cashier' as UserRole, password: '' };

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { user: currentUser } = useAuthStore();

  const load = async () => setUsers(await getUsers());
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ username: u.username, full_name: u.full_name, role: u.role, password: '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.username.trim() || !form.full_name.trim()) { toast.error('Username and full name required'); return; }
    if (!editing && !form.password) { toast.error('Password required for new user'); return; }
    setSaving(true);
    try {
      if (editing) {
        const fields: Partial<User> = { full_name: form.full_name, role: form.role };
        if (form.password) fields.password_hash = await hashPassword(form.password);
        await updateUser(editing.id, fields);
        toast.success('User updated');
      } else {
        const hash = await hashPassword(form.password);
        await createUser({
          id: crypto.randomUUID(), username: form.username, full_name: form.full_name,
          role: form.role, password_hash: hash, is_active: 1,
        });
        toast.success('User created');
      }
      setModalOpen(false); load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const toggleActive = async (u: User) => {
    if (u.id === currentUser?.id) { toast.warning("Can't deactivate yourself"); return; }
    await updateUser(u.id, { is_active: u.is_active ? 0 : 1 });
    toast.success(u.is_active ? 'User deactivated' : 'User activated');
    load();
  };

  const roleColor: Record<UserRole, string> = {
    admin: 'badge-blue', manager: 'badge-yellow', cashier: 'badge-green',
  };

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-pos-muted text-sm mt-1">{users.filter(u => u.is_active).length} active users</p>
        </div>
        <Button icon={<Plus size={18} />} onClick={openAdd}>Add User</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {users.map(u => (
          <div key={u.id} className={`card flex flex-col gap-3 ${!u.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pos-primary/20 flex items-center justify-center text-pos-primary font-bold uppercase">
                {u.full_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{u.full_name}</p>
                <p className="text-pos-muted text-xs">@{u.username}</p>
              </div>
              <span className={roleColor[u.role]}>{u.role}</span>
            </div>
            {u.role === 'admin' && (
              <div className="flex items-center gap-1.5 text-xs text-pos-warning">
                <Shield size={12} /> Full system access
              </div>
            )}
            <div className="flex gap-2 mt-1">
              <Button variant="secondary" size="sm" icon={<Edit2 size={13} />} onClick={() => openEdit(u)} className="flex-1">
                Edit
              </Button>
              <Button
                variant={u.is_active ? 'danger' : 'secondary'} size="sm" onClick={() => toggleActive(u)} className="flex-1"
                disabled={u.id === currentUser?.id}
              >
                {u.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit User' : 'Add User'} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSave}>{editing ? 'Save' : 'Create'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-sm text-pos-muted block mb-1">Full Name *</label>
            <input className="input" value={form.full_name} onChange={e => f('full_name', e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label className="text-sm text-pos-muted block mb-1">Username *</label>
            <input className="input" value={form.username} onChange={e => f('username', e.target.value)}
              placeholder="Username" disabled={!!editing} />
          </div>
          <div>
            <label className="text-sm text-pos-muted block mb-1">Role</label>
            <select className="input" value={form.role} onChange={e => f('role', e.target.value)}>
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-pos-muted block mb-1">
              {editing ? 'New Password (leave blank to keep)' : 'Password *'}
            </label>
            <input className="input" type="password" value={form.password}
              onChange={e => f('password', e.target.value)} placeholder="Password" />
          </div>
        </div>
      </Modal>
    </div>
  );
};
