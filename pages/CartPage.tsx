import React from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { CartItem } from '../types';
import { useCompany } from '../context/CompanyContext';

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
);

const CartItemRow: React.FC<{ item: CartItem }> = ({ item }) => {
    const { updateQuantity, removeFromCart } = useCart();
    
    const customizations = Object.entries(item.customization)
        .filter(([, value]) => value)
        .map(([key, value]) => {
            const label = item.product.customizationConfig?.[key as keyof typeof item.product.customizationConfig]?.label || key;
            return { label, value };
        });

    return (
        <div className="flex items-center py-4 border-b">
            <div className="flex-shrink-0 w-24 h-24">
                <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full rounded-md object-cover" />
            </div>
            <div className="ml-4 flex-1 flex flex-col">
                <div>
                    <h3 className="text-lg font-medium text-brand-text">{item.product.name}</h3>
                    {customizations.length > 0 && (
                         <div className="mt-1 text-sm text-gray-500">
                            {customizations.map(c => <p key={c.label}><strong>{c.label}:</strong> {c.value}</p>)}
                        </div>
                    )}
                </div>
                <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-gray-300 rounded-md">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-l-md">-</button>
                        <span className="px-3 py-1">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-r-md">+</button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <TrashIcon />
                    </button>
                </div>
            </div>
            <div className="ml-4 text-right">
                <p className="text-lg font-semibold text-brand-text">${(item.product.price * item.quantity).toFixed(2)}</p>
            </div>
        </div>
    );
};

const CartPage: React.FC = () => {
    const { state, getCartTotal } = useCart();
    const { company } = useCompany();
    const { items } = state;
    const total = getCartTotal();

    const baseUrl = company ? `/${company.slug}` : '';

    if (items.length === 0) {
                return (
                        <div className="container mx-auto px-4 py-16 text-center">
                                <h1 className="text-4xl font-serif font-bold text-brand-text">Tu carrito está vacío</h1>
                                <p className="mt-4 text-gray-600">Parece que aún no has añadido ningún producto.</p>
                                <Link
                                    to={`${baseUrl}/catalogo`}
                                    className="mt-6 inline-block bg-black text-white font-bold py-3 px-6 rounded-md hover:bg-gray-800 transition-colors"
                                >
                                    Ir al Catálogo
                                </Link>
                        </div>
                );
    }

    return (
        <div className="bg-brand-secondary">
            <div className="container mx-auto px-4 py-12">
                <h1 className="text-4xl font-serif font-bold text-center text-brand-text mb-8">Tu Carrito de Compras</h1>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
                        {items.map(item => (
                            <CartItemRow key={item.id} item={item} />
                        ))}
                    </div>
                    <div className="lg:col-span-1">
                         <div className="bg-white p-6 rounded-lg shadow-md sticky top-24">
                            <h2 className="text-2xl font-semibold text-brand-text border-b pb-4">Resumen del Pedido</h2>
                            <div className="flex justify-between items-center mt-4">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-semibold">${total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-gray-600">Envío (estimado)</span>
                                <span className="font-semibold">$5.00</span>
                            </div>
                            <div className="border-t mt-4 pt-4 flex justify-between items-center">
                                                                <span className="text-xl font-bold text-brand-text">Total</span>
                                                                <span className="text-xl font-bold text-brand-text">${(total + 5.00).toFixed(2)}</span>
                                                        </div>
                                                        <Link
                                                            to={`${baseUrl}/checkout`}
                                                            className="flex-1 border border-transparent rounded-md py-3 px-8 flex items-center justify-center text-base font-medium transition-colors"
                                style={{
                                    background: 'var(--brand-primary)',
                                    color: 'var(--brand-on-primary)',
                                }}
                                onMouseOver={e => {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-accent)';
                                }}
                                onMouseOut={e => {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-primary)';
                                }}
                            >
                                                            Proceder al Pago
                                                        </Link>
                            <Link to={`${baseUrl}/catalogo`} className="mt-4 w-full bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-md hover:bg-gray-300 transition-colors flex justify-center">
                                Seguir Comprando
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CartPage;
