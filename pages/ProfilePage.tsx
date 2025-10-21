import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { getOrders } from '../services/orderService';
import { updateUserProfile, reauthenticate, updateUserPassword } from '../services/userService';
import { Order } from '../types';
import Spinner from '../components/Spinner';

const getStatusColor = (status: Order['status']) => {
    switch (status) {
        case 'Entregado': return 'bg-green-100 text-green-800';
        case 'En producción': return 'bg-blue-100 text-blue-800';
        case 'Enviado': return 'bg-yellow-100 text-yellow-800';
        case 'Pendiente': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

const ProfilePage: React.FC = () => {
    const { user, setUser } = useAuth();
    const { company } = useCompany();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State for profile editing
    const [isEditing, setIsEditing] = useState(false);
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // State for password change
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [loadingPassword, setLoadingPassword] = useState(false);

    useEffect(() => {
        if (user && company) {
            setLoadingOrders(true);
            getOrders(company.id, user.uid)
                .then(setOrders)
                .catch(() => setError('Error al cargar los pedidos.'))
                .finally(() => setLoadingOrders(false));
        } else {
            setLoadingOrders(false);
        }
    }, [user, company]);

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoadingProfile(true);
        setNotification(null);

        try {
            await updateUserProfile(user, { displayName });
            // We need a non-null assertion for user because of the check above
            setUser({ ...user!, displayName }); // Actualizar el contexto localmente
            setNotification({ type: 'success', message: 'Perfil actualizado con éxito.' });
            setIsEditing(false);
        } catch (err) {
            setNotification({ type: 'error', message: 'Error al actualizar el perfil.' });
        } finally {
            setLoadingProfile(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !user.email) return;
        if (newPassword !== confirmNewPassword) {
            setNotification({ type: 'error', message: 'Las nuevas contraseñas no coinciden.' });
            return;
        }
        if (newPassword.length < 6) {
            setNotification({ type: 'error', message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
            return;
        }

        setLoadingPassword(true);
        setNotification(null);

        try {
            await reauthenticate(user.email, currentPassword);
            await updateUserPassword(newPassword);
            setNotification({ type: 'success', message: 'Contraseña actualizada con éxito.' });
            // Limpiar campos
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } catch (err: any) {
            if (err.code === 'auth/wrong-password') {
                setNotification({ type: 'error', message: 'La contraseña actual es incorrecta.' });
            } else {
                setNotification({ type: 'error', message: 'Error al cambiar la contraseña.' });
            }
        } finally {
            setLoadingPassword(false);
        }
    };

    if (!user) {
        return <p className="text-center py-12">Por favor, inicia sesión para ver tu perfil.</p>;
    }

    return (
        <div className="container mx-auto px-4 py-12">
            <h1 className="text-4xl font-serif font-bold text-center text-brand-text mb-8">Mi Perfil</h1>
            
            {notification && (
                <div className={`max-w-4xl mx-auto p-4 mb-4 rounded-md text-center ${notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {notification.message}
                </div>
            )}

            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Profile Info */}
                <div className="bg-white p-8 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-semibold text-brand-text">Mis Datos</h2>
                        {!isEditing && (
                            <button onClick={() => setIsEditing(true)} className="text-sm font-medium text-brand-primary hover:underline">
                                Editar
                            </button>
                        )}
                    </div>

                    {!isEditing ? (
                        <div className="space-y-2">
                            <p><strong>Nombre:</strong> {user.displayName || 'No especificado'}</p>
                            <p><strong>Email:</strong> {user.email}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleProfileUpdate}>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">Nombre</label>
                                    <input
                                        type="text"
                                        id="displayName"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary"
                                    />
                                </div>
                                <p className="text-sm text-gray-500"><strong>Email:</strong> {user.email} (no se puede cambiar)</p>
                                <div className="flex items-center justify-end gap-4">
                                    <button type="button" onClick={() => setIsEditing(false)} className="text-sm font-medium text-gray-600 hover:underline">
                                        Cancelar
                                    </button>
                                    <button type="submit" disabled={loadingProfile} className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400">
                                        {loadingProfile ? <Spinner /> : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {/* Change Password */}
                <div className="bg-white p-8 rounded-lg shadow-md">
                    <h2 className="text-2xl font-semibold mb-4 text-brand-text">Cambiar Contraseña</h2>
                    <form onSubmit={handlePasswordChange}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="currentPassword">Contraseña Actual</label>
                                <input
                                    type="password"
                                    id="currentPassword"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="newPassword">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    id="newPassword"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="confirmNewPassword">Confirmar Nueva Contraseña</label>
                                <input
                                    type="password"
                                    id="confirmNewPassword"
                                    value={confirmNewPassword}
                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary"
                                    required
                                />
                            </div>
                            <div className="text-right">
                                <button type="submit" disabled={loadingPassword} className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-opacity-90 disabled:bg-gray-400">
                                    {loadingPassword ? <Spinner /> : 'Actualizar Contraseña'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            
                {/* Order History */}
                <div className="bg-white p-8 rounded-lg shadow-md lg:col-span-2">
                    <h2 className="text-2xl font-semibold mb-4 text-brand-text">Historial de Pedidos</h2>
                    {loadingOrders ? (
                        <Spinner />
                    ) : error ? (
                        <p className="text-red-500">{error}</p>
                    ) : (
                        <div className="space-y-6">
                            {orders.length > 0 ? orders.map(order => (
                                <div key={order.id} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-lg text-brand-primary">Pedido #{order.id}</h3>
                                            <p className="text-sm text-gray-500">Fecha: {order.date ? new Date(order.date.seconds * 1000).toLocaleDateString() : 'Fecha no disponible'}</p>
                                        </div>
                                        <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <div className="mt-4 border-t pt-4">
                                        <ul className="space-y-2 text-sm">
                                            {order.items.map((item, index) => (
                                                <li key={index} className="flex justify-between">
                                                    <span>{item.productName} x{item.quantity}</span>
                                                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="text-right font-bold mt-2">
                                        Total: ${order.total.toFixed(2)}
                                    </div>
                                </div>
                            )) : (
                                <p>No has realizado ningún pedido todavía.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;