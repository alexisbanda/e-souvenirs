import React, { useState, useEffect } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { useParams, useNavigate } from 'react-router-dom';
import { Product, Category, CustomizationConfig as CustomizationConfigType } from '../../types';
import { Company } from '../../types/company';
import { getCompanies } from '../../services/companyService';
import { getProductById, createProduct, updateProduct } from '../../services/productService';
import { getCategories } from '../../services/categoryService';
import Spinner from '../../components/Spinner';
import { useAuth } from '../../context/AuthContext';
import ImageUpload from '../../components/ImageUpload';

const ProductFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [product, setProduct] = useState<Partial<Product>>({
        name: '',
        description: '',
        price: 0,
        category: '',
        images: [],
        isFeatured: false,
    });
    const [categories, setCategories] = useState<Category[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isEditing = !!id;

    useEffect(() => {
        const loadInitialData = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const companyIdForFetching = user.role === 'superadmin' ? undefined : user.companyId;
                
                const categoryList = await getCategories(companyIdForFetching);
                setCategories(categoryList);

                let companyList: Company[] = [];
                if (user.role === 'superadmin') {
                    companyList = await getCompanies();
                    setCompanies(companyList);
                }

                if (isEditing) {
                    const prod = await getProductById(id!);
                    if (prod) {
                        setProduct(prod);
                    } else {
                        setError('Producto no encontrado.');
                    }
                } else {
                    // Set initial state for a new product
                    const initialProductState: Partial<Product> = {
                        name: '',
                        description: '',
                        price: 0,
                        images: [],
                        isFeatured: false,
                        category: categoryList.length > 0 ? categoryList[0].name : '',
                        companyId: user.role === 'superadmin' 
                            ? (companyList.length > 0 ? companyList[0].id : '') 
                            : user.companyId,
                    };
                    setProduct(initialProductState);
                }
            } catch (err) {
                setError('Error al cargar los datos iniciales.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadInitialData();
    }, [id, isEditing, user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setProduct(prev => ({ ...prev, [name]: checked }));
        } else {
            setProduct(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
        }
    };

    const handleImageUrlsChange = (urls: string[]) => {
        setProduct(prev => ({ ...prev, images: urls }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            if (isEditing) {
                await updateProduct(id!, product);
            } else {
                await createProduct(product);
            }
            navigate('/admin/products');
        } catch (err) {
            setError('Error al guardar el producto.');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    if (error) {
        return <p className="text-center text-red-500">{error}</p>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold mb-8">{isEditing ? 'Editar Producto' : 'Añadir Producto'}</h1>
            <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {user?.role === 'superadmin' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Compañía</label>
                            <select name="companyId" value={product.companyId || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required>
                                <option value="" disabled>Selecciona una compañía</option>
                                {companies.map(comp => (
                                    <option key={comp.id} value={comp.id}>{comp.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre</label>
                        <input type="text" name="name" value={product.name} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Categoría</label>
                        <select name="category" value={product.category} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                            {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Descripción</label>
                        <textarea name="description" value={product.description} onChange={handleChange} rows={4} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Precio</label>
                        <input type="number" name="price" value={product.price} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required />
                    </div>
                    <div>
                        <label className="flex items-center">
                            <input type="checkbox" name="isFeatured" checked={product.isFeatured} onChange={handleChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                            <span className="ml-2 text-sm text-gray-900">Producto Destacado</span>
                        </label>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Imágenes</label>
                        <ImageUpload
                            initialUrls={product.images}
                            onUrlsChange={handleImageUrlsChange}
                        />
                    </div>
                    {/* Editor visual de campos de personalización */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Campos de Personalización</label>
                        <ErrorBoundary>
                          <CustomizationConfigEditor
                              value={product.customizationConfig}
                              onChange={customizationConfig =>
                                  setProduct(prev => ({ ...prev, customizationConfig }))
                              }
                          />
                        </ErrorBoundary>
                    </div>
                </div>
                <div className="mt-8 flex justify-end">
                    <button type="button" onClick={() => navigate('/admin/products')} className="mr-4 bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300">
                        Cancelar
                    </button>
                    <button type="submit" disabled={isSubmitting} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                        {isSubmitting ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Producto')}
                    </button>
                </div>
            </form>
        </div>
    );
};


// Editor visual para configuración de personalización
type CustomizationConfig = Record<string, {
    label: string;
    options?: string[];
}>;

interface CustomizationConfigEditorProps {
    value?: CustomizationConfigType;
    onChange: (value: CustomizationConfigType) => void;
}

const CustomizationConfigEditor: React.FC<CustomizationConfigEditorProps> = ({ value = {}, onChange }) => {
    const fields = React.useMemo(() => Object.entries(value), [value]);

    const handleFieldChange = (idx: number, key: string, field: { label: string; options?: string[] }) => {
        const newFields = [...fields];
        newFields[idx] = [key, field];
        onChange(Object.fromEntries(newFields) as CustomizationConfigType);
    };

    const handleKeyChange = (idx: number, newKey: string) => {
        const newFields = [...fields];
        newFields[idx] = [newKey, newFields[idx][1]];
        onChange(Object.fromEntries(newFields) as CustomizationConfigType);
    };

    const addField = () => {
        const newFields = [...fields, [`nuevoCampo${fields.length + 1}`, { label: '' }]];
        onChange(Object.fromEntries(newFields) as CustomizationConfigType);
    };

    const removeField = (idx: number) => {
        const newFields = fields.filter((_, i) => i !== idx);
        onChange(Object.fromEntries(newFields) as CustomizationConfigType);
    };

    const keyOptions = [
        { value: 'text', label: 'Texto' },
        { value: 'date', label: 'Fecha' },
        { value: 'color', label: 'Color' },
    ];

    return (
        <div className="space-y-4">
            {fields.map(([key, field], idx) => (
                <div key={key + idx} className="flex flex-col md:flex-row md:items-end gap-2 border-b pb-2">
                    <select
                        className="border px-2 py-1 rounded w-32"
                        value={key}
                        onChange={e => handleKeyChange(idx, e.target.value)}
                    >
                        <option value="">Tipo...</option>
                        {keyOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        className="border px-2 py-1 rounded flex-1"
                        value={field.label}
                        onChange={e => handleFieldChange(idx, key, { ...field, label: e.target.value })}
                        placeholder="Etiqueta"
                    />
                    <input
                        type="text"
                        className="border px-2 py-1 rounded flex-1"
                        value={field.options ? field.options.join(', ') : ''}
                        onChange={e =>
                            handleFieldChange(idx, key, {
                                ...field,
                                options: e.target.value
                                    ? e.target.value.split(',').map(opt => opt.trim())
                                    : undefined,
                            })
                        }
                        placeholder="Opciones (separadas por coma, opcional)"
                        disabled={key !== 'color'}
                    />
                    <button
                        type="button"
                        className="text-red-500 ml-2"
                        onClick={() => removeField(idx)}
                        title="Eliminar campo"
                    >
                        ✕
                    </button>
                </div>
            ))}
            <button
                type="button"
                className="bg-gray-100 border px-3 py-1 rounded text-sm hover:bg-gray-200"
                onClick={addField}
            >
                + Añadir campo
            </button>
        </div>
    );
};

export default ProductFormPage;
