import React, { useState, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../../services/categoryService';
import { getCompanies } from '../../services/companyService';
import { Category } from '../../types';
import Spinner from '../../components/Spinner';
import ImageUpload from '../../components/ImageUpload';
import { useAuth } from '../../context/AuthContext';

const CategoryListPage: React.FC = () => {
    const { user } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [companies, setCompanies] = useState<{ id: string, name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newCategory, setNewCategory] = useState({ name: '', icon: '', companyId: '', image: '', featured: false });
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState('all');
    const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);

    useEffect(() => {
        if (user) {
            if (user.role === 'superadmin' || user.companyId) {
                fetchCategories();
                if (user.role === 'superadmin') {
                    fetchCompanies();
                }
            }
        } else if (user === null) {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        let items = categories;
        if (user?.role === 'superadmin' && selectedCompany !== 'all') {
            items = items.filter(c => c.companyId === selectedCompany);
        }
        setFilteredCategories(items);
    }, [selectedCompany, categories, user]);

    const fetchCompanies = async () => {
        try {
            const companyList = await getCompanies();
            setCompanies(companyList);
        } catch (err) {
            setError('Error al cargar las compañías.');
            console.error(err);
        }
    };

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const companyId = user?.role === 'superadmin' ? undefined : user?.companyId;
            const categoryList = await getCategories(companyId);
            setCategories(categoryList);
        } catch (err) {
            setError('Error al cargar las categorías.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const companyId = user?.role === 'superadmin' ? newCategory.companyId : user?.companyId;
        if (!newCategory.name || !companyId) return;
        try {
            await createCategory({ ...newCategory, companyId });
            setNewCategory({ name: '', icon: '', companyId: user?.role === 'superadmin' ? '' : user?.companyId || '', image: '', featured: false });
            fetchCategories();
        } catch (err) {
            setError('Error al crear la categoría.');
            console.error(err);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory || !editingCategory.companyId) return;
        try {
            const { id, ...data } = editingCategory;
            await updateCategory(id, data);
            setEditingCategory(null);
            fetchCategories();
        } catch (err) {
            setError('Error al actualizar la categoría.');
            console.error(err);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar esta categoría?')) {
            try {
                await deleteCategory(id);
                fetchCategories();
            } catch (err) {
                setError('Error al eliminar la categoría.');
                console.error(err);
            }
        }
    };

    const handleImageChange = (urls: string[]) => {
        const imageUrl = urls[0] || '';
        if (editingCategory) {
            setEditingCategory({ ...editingCategory, image: imageUrl });
        } else {
            setNewCategory({ ...newCategory, image: imageUrl });
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
            <h1 className="text-3xl font-bold mb-8">Gestión de Categorías</h1>

            {/* Create/Edit Form */}
            <div className="bg-white shadow-md rounded-lg p-8 mb-8">
                <h2 className="text-2xl font-bold mb-4">{editingCategory ? 'Editar Categoría' : 'Añadir Nueva Categoría'}</h2>
                <form onSubmit={editingCategory ? handleUpdate : handleCreate} className="flex flex-wrap items-end gap-4">
                    <div className="flex items-center mt-2">
                        <input
                            type="checkbox"
                            checked={editingCategory ? !!editingCategory.featured : !!newCategory.featured}
                            onChange={e => editingCategory ? setEditingCategory({...editingCategory, featured: e.target.checked}) : setNewCategory({...newCategory, featured: e.target.checked})}
                            className="mr-2"
                        />
                        <label className="text-sm font-medium text-gray-700">Destacada</label>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre</label>
                        <input 
                            type="text" 
                            value={editingCategory ? editingCategory.name : newCategory.name}
                            onChange={(e) => editingCategory ? setEditingCategory({...editingCategory, name: e.target.value}) : setNewCategory({...newCategory, name: e.target.value})}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                            required
                        />
                    </div>
                    <div style={{ position: 'relative' }}>
                        <label className="block text-sm font-medium text-gray-700">Icono (Emoji)</label>
                        <div className="flex gap-2 items-center mt-1">
                            <input 
                                type="text" 
                                value={editingCategory ? editingCategory.icon : newCategory.icon}
                                onChange={(e) => editingCategory ? setEditingCategory({...editingCategory, icon: e.target.value}) : setNewCategory({...newCategory, icon: e.target.value})}
                                className="block w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                placeholder="Ej: 🎉"
                            />
                            <button type="button" className="px-2 py-2 border rounded-md bg-white shadow-sm" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                                <span role="img" aria-label="emoji">🙂</span>
                            </button>
                        </div>
                        {showEmojiPicker && (
                            <div style={{ position: 'absolute', zIndex: 10 }}>
                                <EmojiPicker
                                    onEmojiClick={(emojiData) => {
                                        const emojiChar = emojiData.emoji;
                                        if (editingCategory) {
                                            setEditingCategory({ ...editingCategory, icon: emojiChar });
                                        } else {
                                            setNewCategory({ ...newCategory, icon: emojiChar });
                                        }
                                        setShowEmojiPicker(false);
                                    }}
                                    width={350}
                                    height={400}
                                    searchDisabled={false}
                                />
                            </div>
                        )}
                    </div>
                    {user?.role === 'superadmin' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Compañía</label>
                            <select
                                value={editingCategory ? editingCategory.companyId || '' : newCategory.companyId}
                                onChange={e => editingCategory ? setEditingCategory({ ...editingCategory, companyId: e.target.value }) : setNewCategory({ ...newCategory, companyId: e.target.value })}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                                required
                            >
                                <option value="" disabled>Selecciona una compañía</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)} 
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Imagen de Fondo</label>
                        <ImageUpload
                            initialUrls={editingCategory ? (editingCategory.image ? [editingCategory.image] : []) : (newCategory.image ? [newCategory.image] : [])}
                            onUrlsChange={handleImageChange}
                            maxImages={1}
                            storagePath="category-images"
                        />
                    </div>
                    <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                        {editingCategory ? 'Guardar' : 'Añadir'}
                    </button>
                    {editingCategory && (
                        <button type="button" onClick={() => setEditingCategory(null)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md">
                            Cancelar
                        </button>
                    )}
                </form>
            </div>

            {/* Category List */}
            {user?.role === 'superadmin' && (
                <div className="mb-4">
                    <label htmlFor="company-filter" className="block text-sm font-medium text-gray-700">Filtrar por Compañía</label>
                    <select
                        id="company-filter"
                        value={selectedCompany}
                        onChange={e => setSelectedCompany(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                        <option value="all">Todas las compañías</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)} 
                    </select>
                </div>
            )}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Icono</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nombre</th>
                            {user?.role === 'superadmin' && <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Compañía</th>}
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Imagen</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCategories.map(category => (
                            <tr key={category.id}>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-2xl">{category.icon}</td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{category.name}</td>
                                {user?.role === 'superadmin' && <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    {companies.find(c => c.id === category.companyId)?.name || ''}
                                </td>}
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    {category.image && (
                                        <img src={category.image} alt="Fondo" className="w-16 h-10 object-cover rounded" />
                                    )}
                                </td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-right">
                                    <button onClick={() => setEditingCategory(category)} className="text-indigo-600 hover:text-indigo-900 mr-4">Editar</button>
                                    <button onClick={() => handleDelete(category.id)} className="text-red-600 hover:text-red-900">Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CategoryListPage;