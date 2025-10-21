import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCouponsByCompany, deleteCoupon } from '../../services/couponService';
import { getCompanies } from '../../services/companyService';
import { Coupon } from '../../types/coupon';
import { Company } from '../../types/company';
import Spinner from '../../components/Spinner';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';

const CouponListPage: React.FC = () => {
    const { user } = useAuth();
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user?.role === 'superadmin') {
            getCompanies().then(setCompanies);
        } else if (user?.companyId) {
            setSelectedCompanyId(user.companyId);
        }
    }, [user]);

    useEffect(() => {
        if (selectedCompanyId) {
            fetchCoupons(selectedCompanyId);
        } else {
            setCoupons([]);
            setLoading(false);
        }
    }, [selectedCompanyId]);

    const fetchCoupons = (companyId: string) => {
        setLoading(true);
        getCouponsByCompany(companyId)
            .then(setCoupons)
            .catch(() => setError('Error al cargar los cupones.'))
            .finally(() => setLoading(false));
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este cupón?')) {
            try {
                await deleteCoupon(id);
                if (selectedCompanyId) fetchCoupons(selectedCompanyId);
            } catch {
                setError('No se pudo eliminar el cupón.');
            }
        }
    };

    if (loading && coupons.length === 0) return <Spinner />;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Cupones de Descuento</h1>
                {selectedCompanyId && (
                    <Link
                        to="/admin/coupons/new"
                        state={{ companyId: selectedCompanyId }}
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
                    >
                        <FiPlus className="mr-2" /> Crear Cupón
                    </Link>
                )}
            </div>

            {user?.role === 'superadmin' && (
                <div className="mb-6">
                    <label htmlFor="company-select" className="block text-sm font-medium text-gray-700 mb-2">
                        Seleccionar Empresa
                    </label>
                    <select
                        id="company-select"
                        value={selectedCompanyId}
                        onChange={(e) => setSelectedCompanyId(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                        <option value="">-- Selecciona una empresa --</option>
                        {companies.map(company => (
                            <option key={company.id} value={company.id}>{company.name}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Código</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tipo</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Valor</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="text-center py-5"><Spinner /></td></tr>
                        ) : coupons.length > 0 ? (
                            coupons.map(coupon => (
                                <tr key={coupon.id}>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{coupon.code}</td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{coupon.discountType === 'fixed' ? 'Fijo' : 'Porcentaje'}</td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{coupon.discountType === 'fixed' ? `$${coupon.discountValue}` : `${coupon.discountValue}%`}</td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${coupon.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {coupon.isActive ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                        <div className="flex items-center gap-4">
                                            <Link to={`/admin/coupons/edit/${coupon.id}`} className="text-blue-600 hover:text-blue-900">
                                                <FiEdit />
                                            </Link>
                                            <button onClick={() => handleDelete(coupon.id)} className="text-red-600 hover:text-red-900">
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan={5} className="text-center py-5 text-gray-500">No hay cupones para esta empresa.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CouponListPage;
