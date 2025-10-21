import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { getOrders } from '../services/orderService';
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
    const { user } = useAuth();
    const { company } = useCompany();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user && company) {
            getOrders(company.id, user.uid)
                .then(setOrders)
                .catch(() => setError('Error al cargar los pedidos.'))
                .finally(() => setLoading(false));
        }
    }, [user, company]);

    if (!user) {
        return <p className="text-center py-12">Por favor, inicia sesión para ver tu perfil.</p>;
    }

    return (
        <div className="container mx-auto px-4 py-12">
            <h1 className="text-4xl font-serif font-bold text-center text-brand-text mb-8">Mi Perfil</h1>
            
            <div className="max-w-4xl mx-auto">
                <div className="bg-white p-8 rounded-lg shadow-md mb-8">
                    <h2 className="text-2xl font-semibold mb-4 text-brand-text">Mis Datos</h2>
                    <p><strong>Nombre:</strong> {user.displayName || 'No especificado'}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                </div>
                
                <div className="bg-white p-8 rounded-lg shadow-md">
                    <h2 className="text-2xl font-semibold mb-4 text-brand-text">Historial de Pedidos</h2>
                    {loading ? (
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
                                            <p className="text-sm text-gray-500">Fecha: {new Date(order.date.seconds * 1000).toLocaleDateString()}</p>
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