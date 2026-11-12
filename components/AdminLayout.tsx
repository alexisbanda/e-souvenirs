import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCompany } from '../services/companyService';
import { getCategories } from '../services/categoryService';
import { getProducts } from '../services/productService';
import { getShippingMethods } from '../services/shippingService';
import type { ShippingMethod } from '../services/shippingService';
import type { UserRole } from '../types/user';
import type { Company } from '../types/company';
import type { Category, Product } from '../types';
import { computeSetupProgress, type SetupProgress } from '../utils/storeSetupProgress';
import { StoreSetupGuide } from './StoreSetupGuide';

export type SetupServices = {
    getCompany: (companyId: string) => Promise<Company | null>;
    getCategories: (companyId: string) => Promise<Category[]>;
    getProducts: (companyId: string) => Promise<Product[]>;
    getShippingMethods: (companyId: string) => Promise<ShippingMethod[]>;
};

export type SetupData = {
    company: Company | null;
    categories: Category[];
    products: Product[];
    shippingMethods: ShippingMethod[];
};

export const loadSetupData = async (
    companyId: string,
    services: SetupServices,
): Promise<SetupData> => {
    const [company, categories, products, shippingMethods] = await Promise.all([
        services.getCompany(companyId),
        services.getCategories(companyId),
        services.getProducts(companyId),
        services.getShippingMethods(companyId),
    ]);
    return { company, categories, products, shippingMethods };
};

const defaultSetupServices: SetupServices = {
    getCompany,
    getCategories,
    getProducts,
    getShippingMethods,
};

export const shouldShowPendingNotice = (role: UserRole | undefined, status: string | null): boolean =>
    role === 'companyadmin' && status === 'PENDING';

export const shouldLoadSetupData = (
    role: UserRole | undefined,
    companyId: string | undefined | null,
    alreadyCompleted: boolean,
): boolean => role === 'companyadmin' && !!companyId && !alreadyCompleted;

export const shouldShowSetupGuide = (
    role: UserRole | undefined,
    companyId: string | undefined | null,
    progress: SetupProgress | null,
): boolean => role === 'companyadmin' && !!companyId && !!progress && progress.completed < progress.total;

export const PendingApprovalNotice: React.FC<{ visible: boolean }> = ({ visible }) => {
    if (!visible) {
        return null;
    }
    return (
        <div role="status" className="bg-amber-50 border border-amber-300 text-amber-900 rounded p-4 mb-6">
            <p className="font-bold">Tu tienda está en revisión</p>
            <p>Mientras la aprobamos puedes seguir cargando productos, categorías y métodos de envío. Hasta entonces la tienda no recibirá pedidos ni generará ideas con IA.</p>
        </div>
    );
};

const AdminLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const [companySlug, setCompanySlug] = useState<string | null>(null);
    const [companyStatus, setCompanyStatus] = useState<string | null>(null);
    const [setupProgress, setSetupProgress] = useState<SetupProgress | null>(null);
    const setupCompletedRef = useRef(false);

    useEffect(() => {
        if (!shouldLoadSetupData(user?.role, user?.companyId, setupCompletedRef.current)) {
            return;
        }
        const companyId = user!.companyId!;
        loadSetupData(companyId, defaultSetupServices)
            .then((data) => {
                if (data.company) {
                    setCompanySlug(data.company.slug);
                    setCompanyStatus(data.company.status);
                }
                const progress = computeSetupProgress(data);
                setupCompletedRef.current = progress.completed >= progress.total;
                setSetupProgress(progress);
            })
            .catch(() => {
                setSetupProgress(null);
            });
    }, [user?.role, user?.companyId, location.pathname]);

    const showPendingNotice = shouldShowPendingNotice(user?.role, companyStatus);
    const showSetupGuide = shouldShowSetupGuide(user?.role, user?.companyId, setupProgress);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    return (
        <div className="flex min-h-screen">
            <aside className="w-64 bg-gray-800 text-white p-4 flex flex-col">
                <div>
                    <h1 className="text-2xl font-serif font-bold mb-8">Admin Panel</h1>
                    <nav>
                        <ul>
                            <li>
                                <NavLink to="/admin/products" className={({ isActive }) => isActive ? 'block py-2 px-4 bg-gray-700 rounded' : 'block py-2 px-4 hover:bg-gray-700 rounded'}>
                                    Productos
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/admin/orders" className={({ isActive }) => isActive ? 'block py-2 px-4 bg-gray-700 rounded' : 'block py-2 px-4 hover:bg-gray-700 rounded'}>
                                    Pedidos
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/admin/categories" className={({ isActive }) => isActive ? 'block py-2 px-4 bg-gray-700 rounded' : 'block py-2 px-4 hover:bg-gray-700 rounded'}>
                                    Categorías
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/admin/coupons" className={({ isActive }) => isActive ? 'block py-2 px-4 bg-gray-700 rounded' : 'block py-2 px-4 hover:bg-gray-700 rounded'}>
                                    Cupones
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/admin/shipping" className={({ isActive }) => isActive ? 'block py-2 px-4 bg-gray-700 rounded' : 'block py-2 px-4 hover:bg-gray-700 rounded'}>
                                    Métodos de Envío
                                </NavLink>
                            </li>
                            <li>
                                <NavLink to="/admin/quotes" className={({ isActive }) => isActive ? 'block py-2 px-4 bg-gray-700 rounded' : 'block py-2 px-4 hover:bg-gray-700 rounded'}>
                                    Cotizaciones
                                </NavLink>
                            </li>
                            {user?.role === 'superadmin' && (
                                <li>
                                    <NavLink to="/admin/companies" className={({ isActive }) => isActive ? 'block py-2 px-4 bg-gray-700 rounded' : 'block py-2 px-4 hover:bg-gray-700 rounded'}>
                                        Empresas
                                    </NavLink>
                                </li>
                            )}
                            {user?.role === 'companyadmin' && user.companyId && (
                                <li>
                                    <NavLink to={`/admin/companies/edit/${user.companyId}`} className={({ isActive }) => isActive ? 'block py-2 px-4 bg-gray-700 rounded' : 'block py-2 px-4 hover:bg-gray-700 rounded'}>
                                        Empresa
                                    </NavLink>
                                </li>
                            )}
                            {user?.role === 'superadmin' && (
                                <li>
                                    <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'block py-2 px-4 bg-gray-700 rounded' : 'block py-2 px-4 hover:bg-gray-700 rounded'}>
                                        Usuarios
                                    </NavLink>
                                </li>
                            )}
                        </ul>
                    </nav>
                </div>
                <div className="mt-auto">
                    {user?.role === 'companyadmin' && companySlug && (
                        <NavLink to={`/${companySlug}`} className="block w-full text-left py-2 px-4 hover:bg-gray-700 rounded">
                            Ver mi tienda
                        </NavLink>
                    )}
                    <button onClick={handleLogout} className="w-full text-left py-2 px-4 hover:bg-red-700 rounded">
                        Cerrar Sesión
                    </button>
                </div>
            </aside>
            <main className="flex-grow p-8 bg-gray-100">
                <PendingApprovalNotice visible={showPendingNotice} />
                {showSetupGuide && user?.companyId && setupProgress && (
                    <StoreSetupGuide companyId={user.companyId} progress={setupProgress} />
                )}
                <Outlet />
            </main>
        </div>
    );
};

export default AdminLayout;