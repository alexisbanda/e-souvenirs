import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { CheckoutPaymentMethod } from '../utils/paymentMethods';

interface OrderConfirmationProps {
    orderNumber: string;
    total: number;
    method: CheckoutPaymentMethod;
    transferText?: string;
    cashText?: string;
    /** Slug de la tienda para el enlace al perfil; sin tienda, el enlace cae al perfil general. */
    slug?: string;
    onBackHome: () => void;
}

/** Pantalla final del checkout: número de pedido, total e instrucciones según el método de pago. */
const OrderConfirmation: React.FC<OrderConfirmationProps> = ({ orderNumber, total, method, transferText, cashText, slug, onBackHome }) => {
    const { t } = useTranslation();
    const profileLink = slug ? `/${slug}/perfil` : '/perfil';

    return (
        <div className="text-center">
            <svg className="w-16 h-16 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <h2 className="text-3xl font-bold text-brand-text mt-4">{t('checkout.success_title')}</h2>
            <p className="text-gray-600 mt-2">{t('checkout.success_subtitle')}</p>
            <p className="text-lg font-semibold text-brand-text mt-4">{t('checkout.order_number_label', { number: orderNumber })}</p>
            <p className="text-xl font-bold text-brand-text mt-2">{t('checkout.success_total', { amount: total.toFixed(2) })}</p>

            {method === 'transfer' && (
                <div className="mt-6 p-4 border rounded-md bg-gray-50 text-left max-w-md mx-auto">
                    <h3 className="font-semibold mb-2">{t('checkout.transfer_title')}</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-line">
                        {transferText?.trim() ? transferText : t('checkout.transfer_default_text')}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">
                        {t('checkout.send_receipt_hint', { number: orderNumber })}
                    </p>
                </div>
            )}

            {method === 'cash' && (
                <div className="mt-6 p-4 border rounded-md bg-gray-50 text-left max-w-md mx-auto">
                    <h3 className="font-semibold mb-2">{t('checkout.cash_title')}</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-line">
                        {cashText?.trim() ? cashText : t('checkout.cash_default_text')}
                    </p>
                </div>
            )}

            {method === 'card' && (
                <div className="mt-6 p-4 border rounded-md bg-gray-50 text-left max-w-md mx-auto">
                    <p className="text-sm text-gray-700">{t('checkout.card_approved')}</p>
                </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={onBackHome} className="bg-brand-primary text-white font-bold py-3 px-6 rounded-md hover:bg-brand-accent">
                    {t('checkout.back_home_button')}
                </button>
                <Link to={profileLink} className="bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-md hover:bg-gray-300 inline-flex items-center justify-center">
                    {t('checkout.view_my_orders_link')}
                </Link>
            </div>
        </div>
    );
};

export default OrderConfirmation;
