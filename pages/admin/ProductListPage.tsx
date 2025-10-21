import React, { useState, useEffect } from 'react';
import { getProducts, deleteProduct } from '../../services/productService';
import { Product, Category } from '../../types';
import Spinner from '../../components/Spinner';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCompanies } from '../../services/companyService';
import { getCategories } from '../../services/categoryService';

const ProductListPage: React.FC = () => {
    const { user } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    useEffect(() => {
        if (user) {
            fetchInitialData();
        }
    }, [user]);

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
            const [productList, categoryList] = await Promise.all([
                getProducts(companyId),
                getCategories(companyId)
            ]);
            
            setProducts(productList);
            setAllProducts(productList);
            setCategories(categoryList);

            if (user?.role === 'superadmin') {
                const companyList = await getCompanies();
                setCompanies(companyList);
            }
        } catch (err) {
            setError('Error al cargar los datos.');
            console.error(err);
        } finally {
            setLoading(false);
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
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    if (error) {
        return <p className="text-center text-red-500">{error}</p>;
    }

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