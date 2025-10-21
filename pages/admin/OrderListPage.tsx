import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../../services/orderService';
import { Order, OrderStatus } from '../../types';
import Spinner from '../../components/Spinner';
import { useAuth } from '../../context/AuthContext';

const getStatusColor = (status: OrderStatus) => {
    switch (status) {
        case 'Entregado': return 'bg-green-100 text-green-800';
        case 'En producción': return 'bg-blue-100 text-blue-800';
        case 'Enviado': return 'bg-yellow-100 text-yellow-800';
        case 'Pendiente': return 'bg-gray-100 text-gray-800';
        case 'Cancelado': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const OrderListPage: React.FC = () => {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        if (user) {
            const companyId = user.role === 'superadmin' ? undefined : user.companyId;
            getOrders(companyId)
                .then(orders => {
                    setOrders(orders);
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [user]);

    const filteredOrders = useMemo(() => {
        let filtered = orders.filter(order => {
            const searchTermLower = searchTerm.toLowerCase();
            return (
                order.customer.name.toLowerCase().includes(searchTermLower) ||
                order.customer.email.toLowerCase().includes(searchTermLower) ||
                order.id.toLowerCase().includes(searchTermLower)
            );
        });

        if (statusFilter !== 'all') {
            filtered = filtered.filter(order => order.status === statusFilter);
        }

        return filtered;
    }, [orders, searchTerm, statusFilter]);

    const sortedOrders = useMemo(() => {
        if (!sortConfig) return filteredOrders;

        return [...filteredOrders].sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [filteredOrders, sortConfig]);

    const requestSort = (key: keyof Order) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Gestión de Pedidos</h1>

            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        type="text"
                        placeholder="Buscar por cliente, email o ID de pedido..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="px-4 py-2 border rounded-md w-full"
                    />
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as OrderStatus | 'all')}
                        className="px-4 py-2 border rounded-md w-full"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="En producción">En producción</option>
                        <option value="Enviado">Enviado</option>
                        <option value="Entregado">Entregado</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                </div>
            </div>

            <div className="bg-white overflow-x-auto rounded-lg shadow-md">
                <table className="w-full table-auto">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-sm font-medium text-gray-600">
                            <th className="p-4 cursor-pointer" onClick={() => requestSort('id')}>ID Pedido</th>
                            <th className="p-4 cursor-pointer" onClick={() => requestSort('date')}>Fecha</th>
                            <th className="p-4">Cliente</th>
                            <th className="p-4">Email</th>
                            <th className="p-4 cursor-pointer text-right" onClick={() => requestSort('total')}>Total</th>
                            <th className="p-4 text-center">Estado</th>
                            <th className="p-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {sortedOrders.map(order => (
                            <tr key={order.id} className="hover:bg-gray-50">
                                <td className="p-4 text-sm text-gray-800 font-mono">{order.id.substring(0, 8)}...</td>
                                <td className="p-4 text-sm text-gray-600">{order.date ? new Date(order.date.seconds * 1000).toLocaleDateString() : 'Fecha no disponible'}</td>
                                <td className="p-4 font-medium text-gray-900">{order.customer.name}</td>
                                <td className="p-4 text-sm text-gray-600">{order.customer.email}</td>
                                <td className="p-4 text-right font-semibold text-gray-800">${order.total.toFixed(2)}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <Link to={`/admin/orders/${order.id}`} className="text-blue-500 hover:underline font-medium">Ver Detalle</Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OrderListPage;