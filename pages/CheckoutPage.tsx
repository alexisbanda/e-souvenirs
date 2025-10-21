import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { Link, useNavigate } from 'react-router-dom';
import { createOrder } from '../services/orderService';
import { getShippingMethods, ShippingMethod } from '../services/shippingService';
import { Order } from '../types';
import Spinner from '../components/Spinner';
import { loadStripe, PaymentIntent } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PaymentForm from '../components/PaymentForm';
import { useCompany } from '../context/CompanyContext';
import { useAuth } from '../context/AuthContext';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const CheckoutPage: React.FC = () => {
    const { state, getCartTotal, clearCart } = useCart();
    const { company } = useCompany();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [shippingInfo, setShippingInfo] = useState({
        name: '',
        email: '',
        address: '',
        city: '',
        postalCode: '',
    });
    const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
    const [selectedShipping, setSelectedShipping] = useState<ShippingMethod | null>(null);
    const [loadingShipping, setLoadingShipping] = useState(true);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer' | 'cash'>('card');

    useEffect(() => {
        if (!company) return;
        console.log('Fetching shipping methods...');
        getShippingMethods(company.id)
            .then(methods => {
                console.log('Shipping methods fetched:', methods);
                setShippingMethods(methods);
                if (methods.length > 0) {
                    setSelectedShipping(methods[0]);
                }
            })
            .catch(err => {
                console.error("Error fetching shipping methods:", err);
            })
            .finally(() => {
                console.log('Finished fetching shipping methods.');
                setLoadingShipping(false)
            });
    }, [company]);

    const subtotal = getCartTotal();
    const total = subtotal + (selectedShipping?.price || 0);

    useEffect(() => {
        if (step === 2 && total > 0 && paymentMethod === 'card') {
            // Create PaymentIntent as soon as the checkout page is loaded
            fetch('/.netlify/functions/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: Math.round(total * 100) }), // Amount in cents
            })
            .then((res) => res.json())
            .then((data) => setClientSecret(data.clientSecret));
        }
    }, [step, total, paymentMethod]);

    const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setShippingInfo({ ...shippingInfo, [e.target.name]: e.target.value });
    };

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        if (step === 1) {
            setStep(2);
        }
    };

    const handleSuccessfulPayment = async (paymentIntent?: PaymentIntent) => {
        if (!selectedShipping || !company || !user) return;
        setIsProcessing(true);
        let payment;
        if (paymentMethod === 'card' && paymentIntent) {
            payment = {
                method: paymentIntent.payment_method_types[0],
                last4: '',
            };
            if (paymentIntent.charges?.data?.[0]?.payment_method_details?.card?.last4) {
                payment.last4 = paymentIntent.charges.data[0].payment_method_details.card.last4;
            }
                // Stripe PaymentIntent no expone last4 directamente
        } else if (paymentMethod === 'transfer') {
            payment = { method: 'transfer', last4: '' };
        } else if (paymentMethod === 'cash') {
            payment = { method: 'cash', last4: '' };
        }

        const order: Omit<Order, 'id' | 'date' | 'status'> = {
            userId: user.id,
            companyId: company.id,
            customer: shippingInfo,
            items: state.items.map(item => ({
                productId: item.product.id,
                productName: item.product.name,
                quantity: item.quantity,
                price: item.product.price,
                customization: item.customization,
            })),
            total: total,
            shippingMethod: selectedShipping.name,
            shippingCost: selectedShipping.price,
            payment: payment
        };

        try {
            await createOrder(order);
            clearCart();
            setStep(3);
        } catch (error) {
            console.error("Error creating order:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const appearance = {
        theme: 'stripe',
    };
    const options = {
        clientSecret,
        appearance,
    };

    if (state.items.length === 0 && step < 3) {
            return (
                        <div className="container mx-auto px-4 py-16 text-center">
                                <h1 className="text-4xl font-serif font-bold text-brand-text">Tu carrito está vacío</h1>
                                <p className="mt-4 text-gray-600">No puedes proceder al pago sin productos.</p>
                                <Link
                                    to={company ? `/${company.slug}/catalogo` : '/catalogo'}
                                    className="mt-6 inline-block bg-brand-primary font-bold py-3 px-6 rounded-md hover:bg-brand-accent transition-colors"
                                    style={{ color: 'var(--brand-on-primary)' }}
                                >
                                    Ir al Catálogo
                                </Link>
                        </div>
            )
    }

    return (
        <div className="container mx-auto px-4 py-12">
            <h1 className="text-4xl font-serif font-bold text-center text-brand-text mb-8">Checkout</h1>
            
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
                {step === 1 && (
                    <div>
                        <h2 className="text-2xl font-semibold mb-6">1. Dirección de Envío</h2>
                        <form onSubmit={handleNextStep}>
                            <div className="grid grid-cols-1 gap-6">
                                <input type="text" name="name" placeholder="Nombre completo" required className="w-full px-4 py-2 border rounded-md" value={shippingInfo.name} onChange={handleShippingChange} />
                                <input type="email" name="email" placeholder="Correo electrónico" required className="w-full px-4 py-2 border rounded-md" value={shippingInfo.email} onChange={handleShippingChange} />
                                <input type="text" name="address" placeholder="Dirección" required className="w-full px-4 py-2 border rounded-md" value={shippingInfo.address} onChange={handleShippingChange} />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" name="city" placeholder="Ciudad" required className="w-full px-4 py-2 border rounded-md" value={shippingInfo.city} onChange={handleShippingChange} />
                                    <input type="text" name="postalCode" placeholder="Código Postal" required className="w-full px-4 py-2 border rounded-md" value={shippingInfo.postalCode} onChange={handleShippingChange} />
                                </div>
                                <button type="submit" 
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
                                    Continuar al Pago
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {step === 2 && (
                    <div>
                        <h2 className="text-2xl font-semibold mb-6">2. Pago</h2>
                        <div className="border-t pt-4">
                            <h3 className="text-lg font-semibold mb-4">Método de Envío</h3>
                            {loadingShipping ? <Spinner /> : (
                                <div className="space-y-2">
                                    {shippingMethods.map(method => (
                                        <label key={method.id} className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                                            <input type="radio" name="shipping" value={method.id} checked={selectedShipping?.id === method.id} onChange={() => setSelectedShipping(method)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                                            <span className="ml-3 text-sm font-medium text-gray-900">{method.name}</span>
                                            <span className="ml-auto text-sm font-semibold text-gray-900">${method.price.toFixed(2)}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="border-t pt-4 mt-6">
                            <h3 className="text-lg font-semibold mb-4">Forma de Pago</h3>
                            <div className="space-y-2">
                                <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                                    <input type="radio" name="paymentMethod" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                                    <span className="ml-3 text-sm font-medium text-gray-900">Tarjeta</span>
                                </label>
                                <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                                    <input type="radio" name="paymentMethod" value="transfer" checked={paymentMethod === 'transfer'} onChange={() => setPaymentMethod('transfer')} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                                    <span className="ml-3 text-sm font-medium text-gray-900">Transferencia</span>
                                </label>
                                <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                                    <input type="radio" name="paymentMethod" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                                    <span className="ml-3 text-sm font-medium text-gray-900">Efectivo</span>
                                </label>
                            </div>
                        </div>
                        <div className="border-t pt-4 mt-6 space-y-2">
                             <div className="flex justify-between font-semibold">
                                <span>Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                             <div className="flex justify-between font-semibold">
                                <span>Envío</span>
                                <span>${(selectedShipping?.price || 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xl font-bold">
                                <span>Total</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="mt-8">
                            {paymentMethod === 'card' && clientSecret && (
                                <Elements options={options} stripe={stripePromise}>
                                    <PaymentForm onSuccess={handleSuccessfulPayment} />
                                </Elements>
                            )}
                                    {paymentMethod === 'transfer' && (
                                        <>
                                            <div className="mb-6 p-4 border rounded-md bg-gray-50">
                                                <h4 className="font-semibold mb-2">Datos para Transferencia Bancaria</h4>
                                                <p className="text-sm text-gray-700 mb-2">
                                                    {company?.settings?.transferText?.trim() ? company.settings.transferText : 'Realiza la transferencia a la siguiente cuenta y confirma tu pago.'}
                                                </p>                                                
                                            </div>
                                            <button
                                                className="w-full bg-black text-white font-bold py-3 rounded-md hover:bg-gray-800"
                                                disabled={isProcessing}
                                                onClick={() => handleSuccessfulPayment()}
                                            >
                                                Confirmar Pedido
                                            </button>
                                        </>
                                    )}
                                    {paymentMethod === 'cash' && (
                                        <>
                                            <div className="mb-6 p-4 border rounded-md bg-gray-50">
                                                <h4 className="font-semibold mb-2">Pago en Efectivo</h4>
                                                <p className="text-sm text-gray-700 mb-2">
                                                    {company?.settings?.cashText?.trim() ? company.settings.cashText : 'Podrás pagar en efectivo al recibir tu pedido o en el punto de entrega acordado.'}
                                                </p>
                                            </div>
                                            <button
                                                className="w-full bg-black text-white font-bold py-3 rounded-md hover:bg-gray-800"
                                                disabled={isProcessing}
                                                onClick={() => handleSuccessfulPayment()}
                                            >
                                                Confirmar Pedido
                                            </button>
                                        </>
                                    )}
                        </div>
                        <div className="flex justify-between mt-8">
                            <button onClick={() => setStep(1)} className="bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-md">
                                Volver
                            </button>
                        </div>
                    </div>
                )}
                
                {step === 3 && (
                     <div className="text-center">
                        <svg className="w-16 h-16 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <h2 className="text-3xl font-bold text-brand-text mt-4">¡Gracias por tu compra!</h2>
                        <p className="text-gray-600 mt-2">Tu pedido ha sido realizado con éxito.</p>
                        <button onClick={() => navigate(company ? `/${company.slug}` : '/')} className="mt-8 bg-brand-primary text-white font-bold py-3 px-6 rounded-md hover:bg-brand-accent">
                            Volver a la Página Principal
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheckoutPage;