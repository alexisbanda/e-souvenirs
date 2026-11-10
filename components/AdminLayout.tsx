import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCompany } from '../services/companyService';
import type { UserRole } from '../types/user';

export const shouldShowPendingNotice = (role: UserRole | undefined, status: string | null): boolean =>
    role === 'companyadmin' && status === 'PENDING';

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
    const { user } = useAuth();
    const [companySlug, setCompanySlug] = useState<string | null>(null);
    const [companyStatus, setCompanyStatus] = useState<string | null>(null);

    useEffect(() => {
        if (user?.companyId) {
            getCompany(user.companyId).then(company => {
                if (company) {
                    setCompanySlug(company.slug);
                    setCompanyStatus(company.status);
                }
            });
        }
    }, [user]);

    const showPendingNotice = shouldShowPendingNotice(user?.role, companyStatus);

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
                <Outlet />
            </main>
        </div>
    );
};

export default AdminLayout;