import React, { useState, useEffect } from 'react';
import { getProducts, deleteProduct } from '../../services/productService';
import { Product, Category } from '../../types';
import Spinner from '../../components/Spinner';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCompanies } from '../../services/companyService';
import { getCategories } from '../../services/categoryService';

const ProductListPage: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    console.log('[ProductListPage] render', {
        authLoading,
        userRole: user?.role,
        userCompanyId: user?.companyId,
        hasUser: Boolean(user),
        loadingState: loading,
    });

    useEffect(() => {
        console.log('[ProductListPage] effect invoked', {
            authLoading,
            userRole: user?.role,
            userCompanyId: user?.companyId,
        });
        if (authLoading) {
            console.log('[ProductListPage] auth still loading, keep spinner visible');
            setLoading(true);
            return;
        }
        if (user) {
            if (user.role === 'superadmin' || user.companyId) {
                console.log('[ProductListPage] user ready, fetching initial data');
                fetchInitialData();
            } else {
                console.log('[ProductListPage] user lacks companyId', { user });
                setLoading(false);
            }
        } else if (user === null) {
            console.log('[ProductListPage] no authenticated user detected');
            setLoading(false);
        }
    }, [user, user?.companyId, authLoading]);

    useEffect(() => {
        let filteredProducts = allProducts;

        if (searchTerm) {
            filteredProducts = filteredProducts.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (selectedCategory !== 'all') {
            filteredProducts = filteredProducts.filter(p => p.category === selectedCategory);
        }

        setProducts(filteredProducts);
    }, [searchTerm, selectedCategory, allProducts]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const companyId = user?.role === 'superadmin' ? undefined : user?.companyId;
            console.log('[ProductListPage] fetchInitialData start', { companyId });
            const [productList, categoryList] = await Promise.all([
                getProducts(companyId),
                getCategories(companyId)
            ]);
            
            setProducts(productList);
            setAllProducts(productList);
            setCategories(categoryList);
            console.log('[ProductListPage] fetchInitialData success', {
                productsLoaded: productList.length,
                categoriesLoaded: categoryList.length,
            });

            if (user?.role === 'superadmin') {
                const companyList = await getCompanies();
                setCompanies(companyList);
                console.log('[ProductListPage] superadmin companies loaded', {
                    companiesLoaded: companyList.length,
                });
            }
        } catch (err) {
            setError('Error al cargar los datos.');
            console.error('[ProductListPage] fetchInitialData error', err);
        } finally {
            setLoading(false);
            console.log('[ProductListPage] fetchInitialData finished');
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este producto?')) {
            try {
                await deleteProduct(id);
                setProducts(products.filter(p => p.id !== id));
            } catch (err) {
                setError('Error al eliminar el producto.');
                console.error(err);
            }
        }
    };

    const getCompanyName = (companyId: string) => {
        return companies.find(c => c.id === companyId)?.name || companyId;
    };

    if (loading) {
        console.log('[ProductListPage] rendering spinner', { loading, authLoading });
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    if (error) {
        console.log('[ProductListPage] rendering error message', { error });
        return <p className="text-center text-red-500">{error}</p>;
    }

    if (user && user.role !== 'superadmin' && !user.companyId) {
        console.log('[ProductListPage] rendering pending assignment notice', {
            userRole: user.role,
            userCompanyId: user.companyId,
        });
        return (
            <div className="text-center p-8">
                <h1 className="text-2xl font-bold mb-4">Cuenta Pendiente de Asignación</h1>
                <p className="text-slate-600">Tu cuenta ha sido registrada pero aún no ha sido asignada a una empresa. Por favor, contacta al administrador.</p>
            </div>
        );
    }

    console.log('[ProductListPage] rendering product table', {
        productsLoaded: products.length,
        categoriesLoaded: categories.length,
    });
    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Gestión de Productos</h1>
                <Link to="/admin/products/new" className="bg-brand-primary text-white font-bold py-2 px-4 rounded-md hover:bg-brand-accent transition-colors">
                    Añadir Producto
                </Link>
            </div>

            {/* Filters */}
            <div className="mb-4 flex gap-4">
                <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                />
                <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                >
                    <option value="all">Todas las categorías</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                </select>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Nombre
                            </th>
                            {user?.role === 'superadmin' && (
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Compañía
                                </th>
                            )}
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Categoría
                            </th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                Precio
                            </th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(product => (
                            <tr key={product.id}>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    <p className="text-gray-900 whitespace-no-wrap">{product.name}</p>
                                </td>
                                {user?.role === 'superadmin' && (
                                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                        <p className="text-gray-900 whitespace-no-wrap">{getCompanyName(product.companyId)}</p>
                                    </td>
                                )}
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    <p className="text-gray-900 whitespace-no-wrap">{product.category}</p>
                                </td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    <p className="text-gray-900 whitespace-no-wrap">${product.price.toFixed(2)}</p>
                                </td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                                    <Link to={`/admin/products/edit/${product.id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">Editar</Link>
                                    <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900">Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProductListPage;