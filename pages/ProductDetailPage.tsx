import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductById, getRelatedProducts } from '../services/productService';
import { Product, CustomizationSelection, CartItem } from '../types';
import Spinner from '../components/Spinner';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { useCompany } from '../context/CompanyContext';

const ProductDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { company } = useCompany();
    const { addToCart } = useCart();
    const [product, setProduct] = useState<Product | null>(null);
    const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [mainImage, setMainImage] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [customization, setCustomization] = useState<CustomizationSelection>({});
    const [notification, setNotification] = useState('');

    useEffect(() => {
        const fetchProduct = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const fetchedProduct = await getProductById(id);
                if (fetchedProduct) {
                    // Ensure product belongs to the current company
                    if (company && fetchedProduct.companyId !== company.id) {
                        setProduct(null); // Or handle as a "not found" case
                    } else {
                        setProduct(fetchedProduct);
                        setMainImage(fetchedProduct.images[0]);
                        const related = await getRelatedProducts(fetchedProduct.id, fetchedProduct.category);
                        setRelatedProducts(related.filter(p => p.companyId === fetchedProduct.companyId));
                    }
                } else {
                    setProduct(null);
                }
            } catch (error) {
                console.error("Error fetching product:", error);
                setProduct(null);
            } finally {
                setLoading(false);
            }
        };
        fetchProduct();
    }, [id, company]);
    
    const handleCustomizationChange = (field: keyof CustomizationSelection, value: string) => {
        setCustomization(prev => ({ ...prev, [field]: value }));
    };

    const handleAddToCart = () => {
      if (!product) return;
      const cartItem: CartItem = {
        id: `${product.id}-${Date.now()}`,
        product,
        quantity,
        customization
      };
      addToCart(cartItem);
      setNotification(`${product.name} ha sido añadido al carrito!`);
      setTimeout(() => setNotification(''), 3000);
    };

    if (loading) return <Spinner />;
    if (!product) return (
        <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-gray-800">Producto no encontrado</h2>
            <p className="text-gray-600 mt-2">
                El producto que buscas no existe o no pertenece a esta tienda.
            </p>
            {company && (
                 <Link to={`/${company.slug}/catalogo`} className="mt-6 inline-block bg-brand-primary text-white font-bold py-2 px-4 rounded hover:bg-brand-primary-dark">
                    Volver al Catálogo
                </Link>
            )}
        </div>
    );

    return (
        <div className="bg-white">
            <div className="container mx-auto pt-6 pb-16 px-4 sm:px-6 lg:px-8">
                 {notification && (
                    <div className="fixed top-20 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg animate-bounce z-50">
                        {notification}
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                    {/* Image gallery */}
                    <div>
                        <div className="aspect-w-1 aspect-h-1 rounded-lg overflow-hidden border">
                            <img src={mainImage} alt={product.name} className="w-full h-full object-center object-cover" />
                        </div>
                        <div className="mt-4 grid grid-cols-5 gap-4">
                            {product.images.map((image, index) => (
                                <button key={index} onClick={() => setMainImage(image)} className={`rounded-lg overflow-hidden border-2 ${mainImage === image ? 'border-brand-primary' : 'border-transparent'}`}>
                                    <img src={image} alt={`${product.name} thumbnail ${index + 1}`} className="w-full h-full object-center object-cover"/>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product info */}
                    <div className="mt-4 md:mt-0">
                        <h1 className="text-3xl font-serif font-bold text-brand-text">{product.name}</h1>
                        <p className="text-3xl text-brand-primary mt-2">${product.price.toFixed(2)}</p>
                        <div className="mt-6">
                            <h3 className="sr-only">Description</h3>
                            <div className="text-base text-gray-700 space-y-4">
                                <p>{product.description}</p>
                            </div>
                        </div>

                        {/* Customization */}
                        {product.customizationConfig && (
                            <div className="mt-6">
                                <h3 className="text-lg font-medium text-brand-text">Personalización</h3>
                                <div className="mt-4 space-y-4">
                                    {product.customizationConfig.text && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">{product.customizationConfig.text.label}</label>
                                            <input type="text" onChange={(e) => handleCustomizationChange('text', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
                                        </div>
                                    )}
                                     {product.customizationConfig.date && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">{product.customizationConfig.date.label}</label>
                                            <input type="date" onChange={(e) => handleCustomizationChange('date', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-brand-primary focus:border-brand-primary sm:text-sm" />
                                        </div>
                                    )}
                                    {product.customizationConfig.color && (
                                         <div>
                                            <label className="block text-sm font-medium text-gray-700">{product.customizationConfig.color.label}</label>
                                            <select onChange={(e) => handleCustomizationChange('color', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-brand-primary focus:border-brand-primary sm:text-sm">
                                                <option value="">Selecciona un color</option>
                                                {product.customizationConfig.color.options.map(color => <option key={color} value={color}>{color}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-8 flex items-center gap-4">
                           <div className="flex items-center border border-gray-300 rounded-md">
                                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-l-md">-</button>
                                <span className="px-4 py-2">{quantity}</span>
                                <button onClick={() => setQuantity(q => q + 1)} className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-r-md">+</button>
                            </div>
                            <button
                                onClick={handleAddToCart}
                                className="flex-1 border border-transparent rounded-md py-3 px-8 flex items-center justify-center text-base font-medium transition-colors"
                                style={{
                                    background: 'var(--brand-primary)',
                                    color: 'var(--brand-on-primary)',
                                }}
                                onMouseOver={e => {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-accent)';
                                }}
                                onMouseOut={e => {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-primary)';
                                }}
                            >
                                Agregar al carrito
                            </button>
                        </div>
                    </div>
                </div>

                {/* Related products */}
                {relatedProducts.length > 0 && (
                    <div className="mt-24">
                        <h2 className="text-2xl font-serif font-bold text-center text-brand-text mb-8">También te podría interesar</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            {relatedProducts.map(related => (
                                <ProductCard key={related.id} product={related} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductDetailPage;
