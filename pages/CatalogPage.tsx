import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import Spinner from '../components/Spinner';
import { getProducts } from '../services/productService';
import { getCategories } from '../services/categoryService';
import { Product, Category } from '../types';
import { useCompany } from '../context/CompanyContext';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const CatalogPage: React.FC = () => {
    const { company } = useCompany();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);
    const query = useQuery();
    
    const [activeCategory, setActiveCategory] = useState<string | 'all'>(query.get('category') || 'all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('default');

    useEffect(() => {
        const fetchCategories = async () => {
            if (company) {
                try {
                    const fetchedCategories = await getCategories(company.id);
                    setCategories(fetchedCategories);
                } catch (error) {
                    console.error("Error fetching categories:", error);
                }
            } else {
                setCategories([]);
            }
        };
        fetchCategories();
    }, [company]);

    useEffect(() => {
      const categoryFromQuery = query.get('category');
      if (categoryFromQuery && (categories.some(c => c.name === categoryFromQuery) || categoryFromQuery === 'all')) {
        setActiveCategory(categoryFromQuery);
      } else {
        setActiveCategory('all');
      }
    }, [query, categories]);


    useEffect(() => {
        const fetchProducts = async () => {
            if (!company) {
                setProducts([]);
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const fetchedProducts = await getProducts(company.id, { category: activeCategory, searchTerm, sortBy: sortOption });
                setProducts(fetchedProducts);
            } catch (error) {
                console.error("Error fetching products:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, [activeCategory, searchTerm, company, sortOption]);
    
    return (
        <div className="bg-white">
            <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-serif font-bold text-brand-text">Nuestro Catálogo</h1>
                    <p className="mt-2 text-lg text-gray-600">Encuentra el detalle perfecto para tu evento.</p>
                </div>

                {/* Filters and Product Grid */}
                <div className="lg:grid lg:grid-cols-4 lg:gap-x-8">
                    {/* Filters Sidebar */}
                    <aside className="lg:col-span-1">
                        <h2 className="sr-only">Filtros</h2>

                        <div className="space-y-6">
                            {/* Search */}
                            <div>
                                <label htmlFor="search" className="block text-sm font-medium text-gray-700">Buscar</label>
                                <input
                                    type="text"
                                    id="search"
                                    placeholder="Buscar productos..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                                />
                            </div>

                            {/* Sort */}
                            <div>
                                <label htmlFor="sort" className="block text-sm font-medium text-gray-700">Ordenar por</label>
                                <select
                                    id="sort"
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value)}
                                    className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                                >
                                    <option value="default">Relevancia</option>
                                    <option value="price-asc">Precio: Menor a Mayor</option>
                                    <option value="price-desc">Precio: Mayor a Menor</option>
                                    <option value="name-asc">Nombre: A-Z</option>
                                    <option value="name-desc">Nombre: Z-A</option>
                                </select>
                            </div>

                            {/* Categories */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-900">Categorías</h3>
                                <div className="mt-2 space-y-2">
                                    <button
                                        key="all"
                                        onClick={() => setActiveCategory('all')}
                                        className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                                            activeCategory === 'all'
                                                ? 'text-white'
                                                : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                        style={
                                            activeCategory === 'all'
                                                ? { background: 'var(--brand-primary)' }
                                                : {}
                                        }
                                    >
                                        Todos
                                    </button>
                                    {categories.map((category) => (
                                        <button
                                            key={category.id}
                                            onClick={() => setActiveCategory(category.name)}
                                            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                                                activeCategory === category.name
                                                    ? 'text-white'
                                                    : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                            style={
                                                activeCategory === category.name
                                                    ? { background: 'var(--brand-primary)' }
                                                    : {}
                                            }
                                        >
                                            {category.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Product Grid */}
                    <div className="mt-6 lg:mt-0 lg:col-span-3">
                        {loading ? <Spinner /> : (
                            products.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {products.map((product) => (
                                        <ProductCard key={product.id} product={product} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-16">
                                    <h3 className="text-xl font-semibold text-gray-700">
                                        {company ? 'No se encontraron productos' : 'Por favor, selecciona una empresa para ver el catálogo.'}
                                    </h3>
                                    <p className="text-gray-500 mt-2">
                                        {company ? 'Intenta ajustar tu búsqueda o filtros.' : 'Navega a una URL de empresa, como /mi-tienda/catalogo.'}
                                    </p>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CatalogPage;
