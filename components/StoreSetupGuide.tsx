import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SetupProgress, SetupStepKey } from '../utils/storeSetupProgress';

export const setupGuideCollapsedStorageKey = (companyId: string): string =>
    `storeSetupGuideCollapsed_${companyId}`;

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

export const isSetupGuideCollapsed = (
    storage: ReadableStorage | undefined | null,
    companyId: string,
): boolean => {
    if (!storage) {
        return false;
    }
    try {
        return storage.getItem(setupGuideCollapsedStorageKey(companyId)) === 'true';
    } catch {
        return false;
    }
};

export const setSetupGuideCollapsed = (
    storage: WritableStorage | undefined | null,
    companyId: string,
    collapsed: boolean,
): void => {
    if (!storage) {
        return;
    }
    try {
        storage.setItem(setupGuideCollapsedStorageKey(companyId), collapsed ? 'true' : 'false');
    } catch {
        // Ignorar: si no se puede persistir, igualmente se respeta en memoria.
    }
};

const getSafeLocalStorage = (): Storage | null => {
    try {
        if (typeof window === 'undefined') {
            return null;
        }
        return window.localStorage;
    } catch {
        return null;
    }
};

export type SetupStepInfo = {
    title: string;
    description: string;
    href: string;
};

export const SETUP_GUIDE_STEPS: Record<SetupStepKey, (companyId: string) => SetupStepInfo> = {
    store: (companyId) => ({
        title: 'Datos de la tienda',
        description: 'Logo y un teléfono o WhatsApp de contacto',
        href: `/admin/companies/edit/${companyId}`,
    }),
    categories: () => ({
        title: 'Categorías',
        description: 'Al menos una categoría con imagen propia',
        href: '/admin/categories',
    }),
    products: () => ({
        title: 'Productos',
        description: 'Al menos un producto con fotos propias',
        href: '/admin/products',
    }),
    shipping: () => ({
        title: 'Métodos de envío',
        description: 'Al menos un método de envío configurado',
        href: '/admin/shipping',
    }),
};

export const StoreSetupGuide: React.FC<{
    companyId: string;
    progress: SetupProgress;
    /** Inyectable solo para tests; en producción se usa window.localStorage. */
    storage?: (ReadableStorage & WritableStorage) | null;
}> = ({ companyId, progress, storage }) => {
    const effectiveStorage = storage !== undefined ? storage : getSafeLocalStorage();
    const [collapsed, setCollapsed] = useState<boolean>(() =>
        isSetupGuideCollapsed(effectiveStorage, companyId),
    );

    if (progress.completed >= progress.total) {
        return null;
    }

    const toggleCollapsed = () => {
        const next = !collapsed;
        setCollapsed(next);
        setSetupGuideCollapsed(effectiveStorage, companyId, next);
    };

    const counterText = `${progress.completed} de ${progress.total}`;

    if (collapsed) {
        return (
            <div
                role="region"
                aria-label="Primeros pasos para dejar lista tu tienda"
                className="bg-blue-50 border border-blue-200 rounded p-3 mb-6 flex items-center justify-between"
            >
                <span className="text-blue-900 font-semibold">
                    Primeros pasos para dejar lista tu tienda: {counterText}
                </span>
                <button
                    type="button"
                    onClick={toggleCollapsed}
                    className="text-sm font-semibold text-blue-700 underline"
                >
                    Expandir
                </button>
            </div>
        );
    }

    return (
        <div
            role="region"
            aria-label="Primeros pasos para dejar lista tu tienda"
            className="bg-blue-50 border border-blue-200 rounded p-4 mb-6"
        >
            <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-blue-900">
                    Primeros pasos para dejar lista tu tienda ({counterText})
                </p>
                <button
                    type="button"
                    onClick={toggleCollapsed}
                    className="text-sm font-semibold text-blue-700 underline"
                >
                    Minimizar
                </button>
            </div>
            <ul className="space-y-1 text-blue-900">
                {progress.steps.map((step) => {
                    const info = SETUP_GUIDE_STEPS[step.key](companyId);
                    return (
                        <li key={step.key} className="flex items-start gap-2">
                            <span aria-hidden="true">{step.done ? '✅' : '⬜️'}</span>
                            <span>
                                <Link to={info.href} className="font-semibold underline">
                                    {info.title}
                                </Link>
                                {' '}
                                <span className="text-sm text-blue-800">({info.description})</span>
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default StoreSetupGuide;
