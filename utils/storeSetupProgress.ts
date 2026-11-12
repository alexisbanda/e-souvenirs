import type { Company } from '../types/company';
import type { Category, Product } from '../types';
import type { ShippingMethod } from '../services/shippingService';
import { defaultHeroImages } from './constants';

export type SetupStepKey = 'store' | 'categories' | 'products' | 'shipping';

export type SetupStep = {
    key: SetupStepKey;
    done: boolean;
};

export type SetupProgress = {
    steps: SetupStep[];
    completed: number;
    total: number;
};

const isNonEmpty = (value: string | undefined | null): boolean => !!value && value.trim() !== '';

const isCustomImage = (image: string | undefined | null): boolean =>
    isNonEmpty(image) && !defaultHeroImages.includes(image as string);

const isStoreStepDone = (company: Company | undefined | null): boolean => {
    if (!company) {
        return false;
    }
    const hasLogo = isNonEmpty(company.logo);
    const hasContact = isNonEmpty(company.phone) || isNonEmpty(company.settings?.whatsapp);
    return hasLogo && hasContact;
};

const isCategoriesStepDone = (categories: Category[] | undefined | null): boolean =>
    !!categories?.some((category) => isCustomImage(category.image));

const isProductsStepDone = (products: Product[] | undefined | null): boolean =>
    !!products?.some((product) => product.images?.some((image) => isCustomImage(image)));

const isShippingStepDone = (shippingMethods: ShippingMethod[] | undefined | null): boolean =>
    !!shippingMethods && shippingMethods.length > 0;

export const computeSetupProgress = ({
    company,
    categories,
    products,
    shippingMethods,
}: {
    company: Company | undefined | null;
    categories: Category[] | undefined | null;
    products: Product[] | undefined | null;
    shippingMethods: ShippingMethod[] | undefined | null;
}): SetupProgress => {
    const steps: SetupStep[] = [
        { key: 'store', done: isStoreStepDone(company) },
        { key: 'categories', done: isCategoriesStepDone(categories) },
        { key: 'products', done: isProductsStepDone(products) },
        { key: 'shipping', done: isShippingStepDone(shippingMethods) },
    ];

    return {
        steps,
        completed: steps.filter((step) => step.done).length,
        total: steps.length,
    };
};
