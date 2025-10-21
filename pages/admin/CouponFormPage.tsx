import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { createCoupon, updateCoupon, getCouponsByCompany } from '../../services/couponService';
import { getCompanies } from '../../services/companyService';
import { Coupon } from '../../types/coupon';
import { Company } from '../../types/company';
import Spinner from '../../components/Spinner';

type FormInputs = {
    code: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    isActive: boolean;
    validUntil?: string;
    minPurchase?: number;
    companyId: string;
};

const CouponFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormInputs>();
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const isEditMode = Boolean(id);

    const selectedCompanyId = watch('companyId');

    useEffect(() => {
        if (user?.role === 'superadmin') {
            getCompanies().then(setCompanies);
        }
    }, [user]);

    useEffect(() => {
        const companyIdFromState = location.state?.companyId;
        if (user?.role === 'superadmin' && companyIdFromState) {
            setValue('companyId', companyIdFromState);
        } else if (user?.companyId) {
            setValue('companyId', user.companyId);
        }
    }, [user, location.state, setValue]);

    useEffect(() => {
        if (isEditMode) {
            setLoading(true);
            // This logic might need adjustment if a superadmin edits a coupon
            // For now, it assumes the coupon belongs to the user's company if not superadmin
            const companyToFetch = user?.role === 'superadmin' ? selectedCompanyId : user?.companyId;
            if (companyToFetch) {
                getCouponsByCompany(companyToFetch)
                    .then(coupons => {
                        const coupon = coupons.find(c => c.id === id);
                        if (coupon) {
                            setValue('code', coupon.code);
                            setValue('discountType', coupon.discountType);
                            setValue('discountValue', coupon.discountValue);
                            setValue('isActive', coupon.isActive);
                            setValue('companyId', coupon.companyId);
                            if (coupon.validUntil) {
                                setValue('validUntil', coupon.validUntil.toISOString().split('T')[0]);
                            }
                            if (coupon.minPurchase) {
                                setValue('minPurchase', coupon.minPurchase);
                            }
                        }
                    })
                    .finally(() => setLoading(false));
            } else {
                setLoading(false);
            }
        }
    }, [id, isEditMode, user, setValue, selectedCompanyId]);

    const onSubmit: SubmitHandler<FormInputs> = async (data) => {
        const companyId = user?.role === 'superadmin' ? data.companyId : user?.companyId;

        if (!companyId) {
            setError("No se ha seleccionado una compañía.");
            return;
        }

        setLoading(true);
        setError(null);

        const couponData: Omit<Coupon, 'id'> = {
            code: data.code,
            discountType: data.discountType,
            discountValue: data.discountValue,
            isActive: data.isActive,
            companyId: companyId,
            validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
            minPurchase: data.minPurchase || 0,
        };

        try {
            if (isEditMode) {
                await updateCoupon(id!, couponData);
            } else {
                await createCoupon(couponData);
            }
            navigate('/admin/coupons');
        } catch (err) {
            setError('Error al guardar el cupón. Asegúrate de que el código no esté ya en uso.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Spinner />;

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">{isEditMode ? 'Editar' : 'Crear'} Cupón</h1>
            {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{error}</p>}
            <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-8 rounded-lg shadow-md space-y-6">
                
                {user?.role === 'superadmin' && (
                    <div>
                        <label htmlFor="companyId" className="block text-sm font-medium text-gray-700">Empresa</label>
                        <select
                            id="companyId"
                            {...register('companyId', { required: 'La empresa es obligatoria' })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={!isEditMode && companies.length === 0}
                        >
                            <option value="">-- Selecciona una empresa --</option>
                            {companies.map(company => (
                                <option key={company.id} value={company.id}>{company.name}</option>
                            ))}
                        </select>
                        {errors.companyId && <p className="text-red-500 text-xs mt-1">{errors.companyId.message}</p>}
                    </div>
                )}

                <div>
                    <label htmlFor="code" className="block text-sm font-medium text-gray-700">Código</label>
                    <input
                        id="code"
                        {...register('code', { required: 'El código es obligatorio' })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="discountType" className="block text-sm font-medium text-gray-700">Tipo de Descuento</label>
                        <select
                            id="discountType"
                            {...register('discountType')}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="percentage">Porcentaje</option>
                            <option value="fixed">Monto Fijo</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="discountValue" className="block text-sm font-medium text-gray-700">Valor del Descuento</label>
                        <input
                            id="discountValue"
                            type="number"
                            step="0.01"
                            {...register('discountValue', { required: 'El valor es obligatorio', valueAsNumber: true })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        {errors.discountValue && <p className="text-red-500 text-xs mt-1">{errors.discountValue.message}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="validUntil" className="block text-sm font-medium text-gray-700">Válido Hasta (opcional)</label>
                        <input
                            id="validUntil"
                            type="date"
                            {...register('validUntil')}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label htmlFor="minPurchase" className="block text-sm font-medium text-gray-700">Compra Mínima (opcional)</label>
                        <input
                            id="minPurchase"
                            type="number"
                            step="0.01"
                            {...register('minPurchase', { valueAsNumber: true })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="isActive" className="flex items-center">
                        <input
                            id="isActive"
                            type="checkbox"
                            {...register('isActive')}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-900">Activo</span>
                    </label>
                </div>

                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/coupons')}
                        className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded hover:bg-gray-300"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-blue-300"
                    >
                        {loading ? <Spinner size="sm" /> : 'Guardar Cupón'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CouponFormPage;
