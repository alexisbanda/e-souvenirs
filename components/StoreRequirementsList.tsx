import React from 'react';
import { useTranslation } from 'react-i18next';

export const STORE_REQUIREMENT_KEYS = [
    'logo',
    'description',
    'products',
    'categories',
    'shipping',
    'bank',
    'contact',
] as const;

const StoreRequirementsList: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-4 mb-6">
            <p className="font-semibold text-sm text-slate-100 mb-1">
                {t('company_registration.requirements_title')}
            </p>
            <p className="text-xs text-slate-400 mb-2">
                {t('company_registration.requirements_intro')}
            </p>
            <ul className="space-y-1 text-sm text-slate-300">
                {STORE_REQUIREMENT_KEYS.map((key) => (
                    <li key={key} className="flex items-start">
                        <span className="mr-2" aria-hidden="true">•</span>
                        <span>{t(`company_registration.requirements_items.${key}`)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default StoreRequirementsList;
