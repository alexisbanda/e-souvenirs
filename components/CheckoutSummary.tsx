import React from 'react';
import { useTranslation } from 'react-i18next';

interface CheckoutSummaryProps {
    subtotal: number;
    discount: number;
    couponCode?: string;
    shipping: number;
    total: number;
}

/** Resumen del total en el checkout: subtotal, descuento (si aplica), envío y total. */
const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({ subtotal, discount, couponCode, shipping, total }) => {
    const { t } = useTranslation();

    return (
        <div className="border-t pt-4 mt-6 space-y-2">
            <div className="flex justify-between font-semibold">
                <span>{t('cart.subtotal')}</span>
                <span>${subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
                <div className="flex justify-between font-semibold text-green-600">
                    <span>
                        {t('cart.discount')}
                        {couponCode ? ` (${couponCode})` : ''}
                    </span>
                    <span>-${discount.toFixed(2)}</span>
                </div>
            )}
            <div className="flex justify-between font-semibold">
                <span>{t('cart.shipping_estimated')}</span>
                <span>${shipping.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold">
                <span>{t('cart.total')}</span>
                <span>${total.toFixed(2)}</span>
            </div>
        </div>
    );
};

export default CheckoutSummary;
