import React, { useEffect, useState } from 'react';
import { getCompanies } from '../../services/companyService';
import { getAllUsers, updateUserRole, addUser, deleteUser, updateUserCompany } from '../../services/userService';
import { AppUser, UserRole } from '../../types/user';
import { useAuth } from '../../context/AuthContext';

const roleLabels: Record<UserRole, string> = {
  superadmin: 'Admin General',
  companyadmin: 'Admin de Compañía',
  client: 'Cliente',
};

const UserAdminPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<{email: string; name: string; role: UserRole; companyId?: string; password: string}>({ email: '', name: '', role: 'client', companyId: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (currentUser) {
      setLoading(true);
      const companyId = currentUser.role === 'superadmin' ? undefined : currentUser.companyId;
      getAllUsers(companyId)
        .then(setUsers)
        .catch(() => setError('Error al cargar usuarios'))
        .finally(() => setLoading(false));
      
      if (currentUser.role === 'superadmin') {
        getCompanies()
          .then(cs => setCompanies(cs.map(c => ({ id: c.id, name: c.name }))))
          .catch(() => setError('Error al cargar compañías'));
      } else {
        // For non-superadmin, we don't need to load all companies
        setCompanies([]);
      }
    }
  }, [currentUser]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setSaving(userId);
    try {
      await updateUserRole(userId, newRole);
      setUsers(users => users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch {
      setError('No se pudo actualizar el rol');
    } finally {
      setSaving(null);
    }
  };

  const handleCompanyChange = async (userId: string, newCompanyId: string) => {
    setSaving(userId);
    try {
      await updateUserCompany(userId, newCompanyId);
      setUsers(users.map(u => u.id === userId ? { ...u, companyId: newCompanyId } : u));
    } catch (err) {
      setError('No se pudo actualizar la compañía del usuario.');
    } finally {
      setSaving(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const userToCreate = { ...newUser };
      if (currentUser?.role !== 'superadmin') {
        userToCreate.companyId = currentUser?.companyId;
      }
      const created = await addUser(userToCreate);
      setUsers(users => [...users, created]);
      setNewUser({ email: '', name: '', role: 'client', companyId: '', password: '' });
    } catch {
      setError('No se pudo crear el usuario');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('¿Eliminar este usuario?')) return;
    setSaving(userId);
    try {
      await deleteUser(userId);
      setUsers(users => users.filter(u => u.id !== userId));
    } catch {
      setError('No se pudo eliminar el usuario');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8 text-brand-text">Administración de Usuarios</h1>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <form onSubmit={handleCreateUser} className="mb-8 flex flex-wrap gap-4 items-end bg-gray-50 p-4 rounded">
        <input type="email" required placeholder="Email" className="border rounded px-2 py-1" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
        <input type="password" required placeholder="Contraseña" className="border rounded px-2 py-1" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
        <input type="text" placeholder="Nombre" className="border rounded px-2 py-1" value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} />
        {currentUser?.role === 'superadmin' && (
          <select value={newUser.companyId} onChange={e => setNewUser(u => ({ ...u, companyId: e.target.value }))} className="border rounded px-2 py-1 min-w-[180px]">
            <option value="">Sin compañía</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value as UserRole }))} className="border rounded px-2 py-1">
          {Object.entries(roleLabels).map(([role, label]) => (
            <option key={role} value={role}>{label}</option>
          ))}
        </select>
        <button type="submit" disabled={creating} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
          {creating ? 'Creando...' : 'Crear Usuario'}
        </button>
      </form>
      {loading ? (
        <div>Cargando usuarios...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded shadow">
            <thead>
              <tr>
                <th className="py-2 px-4 border-b">Email</th>
                <th className="py-2 px-4 border-b">Nombre</th>
                <th className="py-2 px-4 border-b">Rol</th>
                {currentUser?.role === 'superadmin' && <th className="py-2 px-4 border-b">Compañía</th>}
                <th className="py-2 px-4 border-b">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td className="py-2 px-4 border-b">{user.email}</td>
                  <td className="py-2 px-4 border-b">{user.name || '-'}</td>
                  <td className="py-2 px-4 border-b">
                    <select
                      value={user.role}
                      onChange={e => handleRoleChange(user.id, e.target.value as UserRole)}
                      disabled={saving === user.id}
                      className="border rounded px-2 py-1"
                    >
                      {Object.entries(roleLabels).map(([role, label]) => (
                        <option key={role} value={role}>{label}</option>
                      ))}
                    </select>
                  </td>
                  {currentUser?.role === 'superadmin' && (
                                    <td className="py-2 px-4 border-b">
                                        <select
                                            value={user.companyId || ''}
                                            onChange={e => handleCompanyChange(user.id, e.target.value)}
                                            disabled={saving === user.id}
                                            className="border rounded px-2 py-1 min-w-[180px]"
                                        >
                                            <option value="">Sin compañía</option>
                                            {companies.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                )}
                  <td className="py-2 px-4 border-b">
                    {saving === user.id ? 'Guardando...' : (
                      <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:underline">Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UserAdminPage;
