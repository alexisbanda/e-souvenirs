import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ShippingInfo {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
}

export const EMPTY_SHIPPING_INFO: ShippingInfo = { name: '', email: '', phone: '', address: '', city: '', postalCode: '' };

interface CheckoutShippingFieldsProps {
    value: ShippingInfo;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const inputClass = 'w-full px-4 py-2 border rounded-md';

/** Campos de datos de envío del paso 1 del checkout. El código postal es opcional. */
const CheckoutShippingFields: React.FC<CheckoutShippingFieldsProps> = ({ value, onChange }) => {
    const { t } = useTranslation();
    return (
        <>
            <input type="text" name="name" placeholder={t('checkout.name_label')} required autoComplete="name" className={inputClass} value={value.name} onChange={onChange} />
            <input type="email" name="email" placeholder={t('checkout.email_label')} required autoComplete="email" className={inputClass} value={value.email} onChange={onChange} />
            <input type="tel" name="phone" placeholder={t('checkout.phone_label')} required autoComplete="tel" pattern="[0-9 +\(\)\-]{7,20}" title={t('checkout.phone_hint')} className={inputClass} value={value.phone} onChange={onChange} />
            <input type="text" name="address" placeholder={t('checkout.address_label')} required className={inputClass} value={value.address} onChange={onChange} />
            <div className="grid grid-cols-2 gap-4">
                <input type="text" name="city" placeholder={t('checkout.city_label')} required className={inputClass} value={value.city} onChange={onChange} />
                <input type="text" name="postalCode" placeholder={t('checkout.postal_code_optional_label')} autoComplete="postal-code" className={inputClass} value={value.postalCode} onChange={onChange} />
            </div>
        </>
    );
};

export default CheckoutShippingFields;
