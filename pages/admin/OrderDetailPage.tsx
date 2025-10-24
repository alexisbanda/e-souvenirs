import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderById, updateOrder } from '../../services/orderService';
import { Order, OrderStatus } from '../../types';
import Spinner from '../../components/Spinner';

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

const OrderDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<OrderStatus |''>('');

    useEffect(() => {
        if (id) {
            getOrderById(id)
                .then(order => {
                    if (order) {
                        setOrder(order);
                        setStatus(order.status);
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [id]);

    const handleStatusChange = async () => {
        if (id && status) {
            await updateOrder(id, { status });
            // Optionally refetch the order to confirm the change
            const updatedOrder = await getOrderById(id);
            if (updatedOrder) {
                setOrder(updatedOrder);
            }
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><Spinner /></div>;
    }

    if (!order) {
        return <div className="text-center py-12">Pedido no encontrado.</div>;
    }

    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Detalle del Pedido</h1>
                <Link to="/admin/orders" className="text-blue-500 hover:underline">Volver a la lista</Link>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <div className="md:col-span-2">
                        <h2 className="text-2xl font-semibold mb-4">Información del Cliente</h2>
                        <p><strong>Nombre:</strong> {order.customer.name}</p>
                        <p><strong>Email:</strong> {order.customer.email}</p>
                        <p><strong>Dirección:</strong> {`${order.customer.address}, ${order.customer.city}, ${order.customer.postalCode}`}</p>
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold mb-4">Resumen del Pedido</h2>
                        <p><strong>ID del Pedido:</strong> {order.id}</p>
                        <p><strong>Fecha:</strong> {order.date ? new Date(order.date.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                        {order.couponCode && (
                            <p><strong>Cupón:</strong> {order.couponCode} (-${order.discount?.toFixed(2)})</p>
                        )}
                        <p><strong>Método de Envío:</strong> {order.shippingMethod}</p>
                        <div className="flex items-center mt-2">
                            <strong>Estado:</strong> 
                            <span className={`ml-2 text-sm font-medium px-2.5 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                                {order.status}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <h2 className="text-2xl font-semibold mb-4">Actualizar Estado</h2>
                    <div className="flex items-center gap-4">
                        <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className="border rounded-md p-2">
                            <option value="Pendiente">Pendiente</option>
                            <option value="En producción">En producción</option>
                            <option value="Enviado">Enviado</option>
                            <option value="Entregado">Entregado</option>
                            <option value="Cancelado">Cancelado</option>
                        </select>
                        <button onClick={handleStatusChange} className="bg-blue-500 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-600">
                            Actualizar
                        </button>
                    </div>
                </div>

                <div>
                    <h2 className="text-2xl font-semibold mb-4">Artículos del Pedido</h2>
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left p-4 font-medium">Producto</th>
                                    <th className="text-center p-4 font-medium">Cantidad</th>
                                    <th className="text-right p-4 font-medium">Precio Unitario</th>
                                    <th className="text-right p-4 font-medium">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item, index) => {
                                    const customizationDetails = Object.entries(item.customization)
                                        .filter(([, value]) => value)
                                        .map(([key, value]) => `${key}: ${value}`);

                                    return (
                                        <tr key={index} className="border-b">
                                            <td className="p-4">
                                                <p className="font-semibold">{item.productName}</p>
                                                {customizationDetails.length > 0 && (
                                                    <p className="text-sm text-gray-500">Personalización: {customizationDetails.join(', ')}</p>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">{item.quantity}</td>
                                            <td className="p-4 text-right">${item.price.toFixed(2)}</td>
                                            <td className="p-4 text-right">${(item.price * item.quantity).toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end mt-6">
                        <div className="w-full max-w-xs space-y-2">
                            <div className="flex justify-between">
                                <span className="font-medium">Subtotal:</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            {order.discount && order.discount > 0 && (
                                <div className="flex justify-between">
                                    <span className="font-medium">Descuento:</span>
                                    <span>-${order.discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="font-medium">Envío:</span>
                                <span>${order.shippingCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold border-t pt-2">
                                <span>Total:</span>
                                <span>${order.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderDetailPage;