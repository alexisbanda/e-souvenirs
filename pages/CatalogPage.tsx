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
                const fetchedProducts = await getProducts(company.id, { category: activeCategory, searchTerm });
                setProducts(fetchedProducts);
            } catch (error) {
                console.error("Error fetching products:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, [activeCategory, searchTerm, company]);
    
    return (
        <div className="bg-white">
            <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-serif font-bold text-brand-text">Nuestro Catálogo</h1>
                    <p className="mt-2 text-lg text-gray-600">Encuentra el detalle perfecto para tu evento.</p>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div className="w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="Buscar productos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary"
                        />
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                        <button
                            key="all"
                            onClick={() => setActiveCategory('all')}
                            className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 ${
                                activeCategory === 'all'
                                    ? 'text-white'
                                    : 'text-gray-700 hover:text-white'
                            }`}
                            style={
                                activeCategory === 'all'
                                    ? { background: 'var(--brand-primary)' }
                                    : { background: 'var(--brand-secondary)' }
                            }
                        >
                            Todos
                        </button>
                        {categories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => setActiveCategory(category.name)}
                                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 ${
                                    activeCategory === category.name
                                        ? 'text-white'
                                        : 'text-gray-700 hover:text-white'
                                }`}
                                style={
                                    activeCategory === category.name
                                        ? { background: 'var(--brand-primary)' }
                                        : { background: 'var(--brand-secondary)' }
                                }
                            >
                                {category.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Product Grid */}
                {loading ? <Spinner /> : (
                  products.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
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
                        {company ? 'Intenta ajustar tu búsqueda o filtros.' : 'Navega a una URL de empresa, como /recuerdos-artesanales/catalogo.'}
                      </p>
                    </div>
                  )
                )}
            </div>
        </div>
    );
};

export default CatalogPage;
