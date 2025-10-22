import React, { useState, useEffect } from 'react';
import { getShippingMethods, createShippingMethod, updateShippingMethod, deleteShippingMethod, ShippingMethod } from '../../services/shippingService';
import { getCompanies, getCompany } from '../../services/companyService';
import { Company } from '../../types/company';
import Spinner from '../../components/Spinner';
import { useAuth } from '../../context/AuthContext';

const ShippingMethodListPage: React.FC = () => {
    const { user } = useAuth();
    const [methods, setMethods] = useState<ShippingMethod[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newMethod, setNewMethod] = useState({ name: '', price: 0, companyId: '' });
    const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null);

    useEffect(() => {
        if (user) {
            if (user.role === 'superadmin' || user.companyId) {
                fetchData();
            }
        } else if (user === null) {
            setLoading(false);
        }
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const companyIdForFilter = user.role === 'superadmin' ? undefined : user.companyId;
            const methodList = await getShippingMethods(companyIdForFilter);
            setMethods(methodList);

            if (user.role === 'superadmin') {
                const companyList = await getCompanies();
                setCompanies(companyList);
                if (companyList.length > 0 && !newMethod.companyId) {
                    setNewMethod(prev => ({ ...prev, companyId: companyList[0].id }));
                }
            } else if (user.companyId) {
                const company = await getCompany(user.companyId);
                if (company) setCompanies([company]);
                setNewMethod(prev => ({ ...prev, companyId: user.companyId! }));
            }
        } catch (err) {
            setError('Error al cargar los datos.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const companyId = user?.role === 'superadmin' ? newMethod.companyId : user?.companyId;
        if (!newMethod.name || !companyId) return;
        try {
            await createShippingMethod({ ...newMethod, companyId });
            setNewMethod({ name: '', price: 0, companyId: user?.role === 'superadmin' ? (companies.length > 0 ? companies[0].id : '') : (user?.companyId || '') });
            fetchData();
        } catch (err) {
            setError('Error al crear el método de envío.');
            console.error(err);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMethod) return;
        try {
            const { id, ...data } = editingMethod;
            await updateShippingMethod(id, data);
            setEditingMethod(null);
            fetchData();
        } catch (err) {
            setError('Error al actualizar el método de envío.');
            console.error(err);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este método de envío?')) {
            try {
                await deleteShippingMethod(id);
                fetchData();
            } catch (err) {
                setError('Error al eliminar el método de envío.');
                console.error(err);
            }
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    if (error) {
        return <p className="text-center text-red-500">{error}</p>;
    }

    const getCompanyName = (companyId: string) => {
        const company = companies.find(c => c.id === companyId);
        return company ? company.name : companyId;
    };

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8">Gestión de Métodos de Envío</h1>

            <div className="bg-white shadow-md rounded-lg p-8 mb-8">
                <h2 className="text-2xl font-bold mb-4">{editingMethod ? 'Editar Método' : 'Añadir Nuevo Método'}</h2>
                <form onSubmit={editingMethod ? handleUpdate : handleCreate} className="flex items-end gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre</label>
                        <input 
                            type="text" 
                            value={editingMethod ? editingMethod.name : newMethod.name}
                            onChange={(e) => editingMethod ? setEditingMethod({...editingMethod, name: e.target.value}) : setNewMethod({...newMethod, name: e.target.value})}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Precio</label>
                        <input 
                            type="number"
                            step="0.01"
                            value={editingMethod ? (isNaN(editingMethod.price) ? '' : editingMethod.price) : (isNaN(newMethod.price) ? '' : newMethod.price)}
                            onChange={(e) => {
                                const value = e.target.value;
                                const price = value === '' ? NaN : parseFloat(value);
                                if (editingMethod) {
                                    setEditingMethod({ ...editingMethod, price });
                                } else {
                                    setNewMethod({ ...newMethod, price });
                                }
                            }}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            required
                        />
                    </div>
                    {user?.role === 'superadmin' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Compañía</label>
                            <select
                                value={editingMethod ? editingMethod.companyId : newMethod.companyId}
                                onChange={(e) => {
                                    const companyId = e.target.value;
                                    if (editingMethod) {
                                        setEditingMethod({ ...editingMethod, companyId });
                                    } else {
                                        setNewMethod({ ...newMethod, companyId });
                                    }
                                }}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                required
                            >
                                {companies.map(company => (
                                    <option key={company.id} value={company.id}>
                                        {company.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button type="submit" className="bg-brand-primary text-white font-bold py-2 px-4 rounded-md">
                        {editingMethod ? 'Guardar' : 'Añadir'}
                    </button>
                    {editingMethod && (
                        <button type="button" onClick={() => setEditingMethod(null)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md">
                            Cancelar
                        </button>
                    )}
                </form>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nombre</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Precio</th>
                            {user?.role === 'superadmin' && <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Compañía</th>}
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {methods.map(method => (
                            <tr key={method.id}>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{method.name}</td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">${method.price.toFixed(2)}</td>
                                {user?.role === 'superadmin' && <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{getCompanyName(method.companyId)}</td>}
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                                    <button onClick={() => setEditingMethod(method)} className="text-indigo-600 hover:text-indigo-900 mr-4">Editar</button>
                                    <button onClick={() => handleDelete(method.id)} className="text-red-600 hover:text-red-900">Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ShippingMethodListPage;
