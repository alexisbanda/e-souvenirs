import React from 'react';
import { Link } from 'react-router-dom';
import type { UserRole } from '../types/user';

export const setupGuideStorageKey = (companyId: string): string =>
    `storeSetupGuideDismissed_${companyId}`;

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

export const isSetupGuideDismissed = (
    storage: ReadableStorage | undefined | null,
    companyId: string,
): boolean => {
    if (!storage) {
        return false;
    }
    try {
        return storage.getItem(setupGuideStorageKey(companyId)) === 'true';
    } catch {
        return false;
    }
};

export const dismissSetupGuide = (
    storage: WritableStorage | undefined | null,
    companyId: string,
): void => {
    if (!storage) {
        return;
    }
    try {
        storage.setItem(setupGuideStorageKey(companyId), 'true');
    } catch {
        // Ignorar: si no se puede persistir, igualmente se oculta en memoria.
    }
};

export const shouldShowSetupGuide = (
    role: UserRole | undefined,
    companyId: string | undefined | null,
    dismissed: boolean,
): boolean => role === 'companyadmin' && !!companyId && !dismissed;

export type SetupGuideStep = {
    title: string;
    description: string;
    href: string;
};

export const SETUP_GUIDE_STEPS = (companyId: string): SetupGuideStep[] => [
    {
        title: 'Datos de la tienda',
        description: 'Logo, contacto y datos bancarios',
        href: `/admin/companies/edit/${companyId}`,
    },
    {
        title: 'Categorías',
        description: 'La imagen es opcional',
        href: '/admin/categories',
    },
    {
        title: 'Productos',
        description: 'Fotos, nombre, precio y descripción',
        href: '/admin/products',
    },
    {
        title: 'Métodos de envío',
        description: 'Nombre y precio de cada método',
        href: '/admin/shipping',
    },
];

export const StoreSetupGuide: React.FC<{ companyId: string; onDismiss: () => void }> = ({
    companyId,
    onDismiss,
}) => {
    const steps = SETUP_GUIDE_STEPS(companyId);

    return (
        <div
            role="region"
            aria-label="Primeros pasos para dejar lista tu tienda"
            className="bg-blue-50 border border-blue-200 rounded p-4 mb-6"
        >
            <p className="font-bold text-blue-900 mb-2">Primeros pasos para dejar lista tu tienda</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-900">
                {steps.map((step) => (
                    <li key={step.href}>
                        <Link to={step.href} className="font-semibold underline">
                            {step.title}
                        </Link>
                        {' '}
                        <span className="text-sm text-blue-800">({step.description})</span>
                    </li>
                ))}
            </ol>
            <button
                type="button"
                onClick={onDismiss}
                className="mt-3 text-sm font-semibold text-blue-700 underline"
            >
                Entendido
            </button>
        </div>
    );
};

export default StoreSetupGuide;
