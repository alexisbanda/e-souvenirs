import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCompany, createCompany, updateCompany } from '../../services/companyService';
import { Company } from '../../types/company';
import { useAuth } from '../../context/AuthContext';

const CompanyFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [company, setCompany] = useState<Omit<Company, 'id' | 'slug'>>({
    name: '',
    description: '',
    address: '',
    phone: '',
    logo: '',
    contact: { email: '', contactName: '', contactRole: '' },
    settings: {
      allowCustomizations: false,
      enableAIAssistant: false,
      transferText: '',
      cashText: '',
      heroImage: '',
      brandColor: '',
      welcomeMessage: '',
      hours: '',
      facebook: '',
      instagram: '',
      whatsapp: '',
      website: '',
      aiPrompt: '',
      imageProvider: 'PEXELS',
      theme: 'default',
    },
    status: 'PENDING',
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    if (id) {
      if (user?.role === 'companyadmin' && user.companyId !== id) {
        console.error('Access denied');
        navigate('/admin');
        return;
      }
      const fetchCompany = async () => {
        try {
          const fetchedCompany = await getCompany(id);
          if (fetchedCompany) {
            setCompany(fetchedCompany);
          }
        } catch (error) {
          console.error("Error fetching company:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchCompany();
    } else {
      setLoading(false);
    }
  }, [id, user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (name.startsWith('contact.')) {
      const field = name.split('.')[1];
      setCompany(prev => ({ ...prev, contact: { ...prev.contact, [field]: value } }));
    } else if (name.startsWith('settings.')) {
      const field = name.split('.')[1];
      if (type === 'checkbox') {
        setCompany(prev => ({ ...prev, settings: { ...prev.settings, [field]: checked } }));
      } else {
        setCompany(prev => ({ ...prev, settings: { ...prev.settings, [field]: value } }));
      }
    } else {
      setCompany(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (id) {
        await updateCompany(id, company);
      } else {
        await createCompany(company);
      }
      navigate('/admin/companies');
    } catch (error) {
      console.error("Error saving company:", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'basic':
        return (
          <div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">Nombre de la Compañía</label>
              <input type="text" name="name" id="name" value={company.name} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">Descripción</label>
              <textarea name="description" id="description" value={company.description || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" rows={2} />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="address">Dirección</label>
              <input type="text" name="address" id="address" value={company.address || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone">Teléfono</label>
              <input type="text" name="phone" id="phone" value={company.phone || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="logo">Logo (URL)</label>
              <input type="text" name="logo" id="logo" value={company.logo || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="https://..." />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="contactName">Persona de Contacto</label>
              <input type="text" name="contact.contactName" id="contactName" value={company.contact.contactName || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="contactRole">Cargo de Contacto</label>
              <input type="text" name="contact.contactRole" id="contactRole" value={company.contact.contactRole || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">Email de Contacto</label>
              <input type="email" name="contact.email" id="email" value={company.contact.email} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" required />
            </div>
            {user?.role === 'superadmin' && id && (
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="status">Estado de la Compañía</label>
                <select
                  name="status"
                  id="status"
                  value={company.status}
                  onChange={handleChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                  <option value="PENDING">Pendiente</option>
                  <option value="APPROVED">Aprobada</option>
                  <option value="ACTIVE">Activa</option>
                  <option value="REJECTED">Rechazada</option>
                </select>
              </div>
            )}
          </div>
        );
      case 'general':
        return (
          <div>
            <div className="mt-4">
              <label htmlFor="settings.theme" className="block text-gray-700 text-sm font-bold mb-2">Tema visual</label>
              <select
                name="settings.theme"
                id="settings.theme"
                value={company.settings.theme || 'default'}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              >
                <option value="default">Clásico (Marrón)</option>
                <option value="ocean">Ocean (Azul)</option>
                <option value="forest">Forest (Verde)</option>
                <option value="sunset">Sunset (Naranja)</option>
                <option value="rose">Rose (Rosa)</option>
                <option value="slate">Slate (Gris)</option>
                <option value="amber">Amber (Amarillo)</option>
                <option value="lavender">Lavender (Violeta)</option>
                <option value="mint">Mint (Verde agua)</option>
              </select>
            </div>
            <div className="mt-4">
              <label htmlFor="brandColor" className="block text-gray-700 text-sm font-bold mb-2">Color de Marca</label>
              <input type="text" name="settings.brandColor" id="brandColor" value={company.settings.brandColor || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="#123456" />
            </div>
            <div className="mt-4">
              <label htmlFor="welcomeMessage" className="block text-gray-700 text-sm font-bold mb-2">Mensaje de Bienvenida</label>
              <textarea name="settings.welcomeMessage" id="welcomeMessage" value={company.settings.welcomeMessage || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" rows={2} />
            </div>
            <div className="mt-4">
              <label htmlFor="hours" className="block text-gray-700 text-sm font-bold mb-2">Horario de Atención</label>
              <input type="text" name="settings.hours" id="hours" value={company.settings.hours || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Lun-Vie 9:00-18:00" />
            </div>
            <div className="mt-4">
              <label htmlFor="facebook" className="block text-gray-700 text-sm font-bold mb-2">Facebook</label>
              <input type="text" name="settings.facebook" id="facebook" value={company.settings.facebook || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="https://facebook.com/empresa" />
            </div>
            <div className="mt-4">
              <label htmlFor="instagram" className="block text-gray-700 text-sm font-bold mb-2">Instagram</label>
              <input type="text" name="settings.instagram" id="instagram" value={company.settings.instagram || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="https://instagram.com/empresa" />
            </div>
            <div className="mt-4">
              <label htmlFor="whatsapp" className="block text-gray-700 text-sm font-bold mb-2">WhatsApp</label>
              <input type="text" name="settings.whatsapp" id="whatsapp" value={company.settings.whatsapp || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="https://wa.me/123456789" />
            </div>
            <div className="mt-4">
              <label htmlFor="website" className="block text-gray-700 text-sm font-bold mb-2">Sitio Web</label>
              <input type="text" name="settings.website" id="website" value={company.settings.website || ''} onChange={handleChange} className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="https://empresa.com" />
            </div>
            <div className="flex items-center mt-4">
              <input
                type="checkbox"
                name="settings.allowCustomizations"
                id="allowCustomizations"
                checked={company.settings.allowCustomizations}
                onChange={handleChange}
                className="mr-2"
              />
              <label htmlFor="allowCustomizations">Allow Customizations</label>
            </div>
            <div className="mt-4">
              <label htmlFor="heroImage" className="block text-gray-700 text-sm font-bold mb-2">Hero Image URL</label>
              <input
                type="text"
                name="settings.heroImage"
                id="heroImage"
                value={company.settings.heroImage}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="https://..."
              />
            </div>
            <div className="mt-4">
              <label htmlFor="transferText" className="block text-gray-700 text-sm font-bold mb-2">Texto para pago por transferencia</label>
              <textarea
                name="settings.transferText"
                id="transferText"
                value={company.settings.transferText}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                rows={3}
                placeholder="Ejemplo: Realiza la transferencia a la cuenta X..."
              />
            </div>
            <div className="mt-4">
              <label htmlFor="cashText" className="block text-gray-700 text-sm font-bold mb-2">Texto para pago en efectivo</label>
              <textarea
                name="settings.cashText"
                id="cashText"
                value={company.settings.cashText}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                rows={2}
                placeholder="Ejemplo: Podrás pagar en efectivo al recibir tu pedido..."
              />
            </div>
          </div>
        );
      case 'ai':
        return (
          <div>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                name="settings.enableAIAssistant"
                id="enableAIAssistant"
                checked={company.settings.enableAIAssistant}
                onChange={handleChange}
                className="mr-2"
              />
              <label htmlFor="enableAIAssistant">Enable AI Assistant</label>
            </div>
            <div className="mt-4">
              <label htmlFor="aiPrompt" className="block text-gray-700 text-sm font-bold mb-2">Prompt personalizado para IA</label>
              <textarea
                name="settings.aiPrompt"
                id="aiPrompt"
                value={company.settings.aiPrompt || ''}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                rows={3}
                placeholder="Ejemplo: Actúa como un director creativo en mi empresa..."
              />
            </div>
            <div className="mt-4">
              <label htmlFor="settings.imageProvider" className="block text-gray-700 text-sm font-bold mb-2">Proveedor de Imágenes IA</label>
              <select
                name="settings.imageProvider"
                id="settings.imageProvider"
                value={company.settings.imageProvider || 'PEXELS'}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              >
                <option value="PEXELS">Pexels (Rápido y Gratuito)</option>
                <option value="GOOGLE_IMAGEN">Google Imagen (Avanzado y de Pago)</option>
              </select>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{id ? 'Edit Company' : 'New Company'}</h1>
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('basic')}
            className={`${
              activeTab === 'basic'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Información básica
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`${
              activeTab === 'general'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Configuración general
          </button>
          {user?.role === 'superadmin' && (
            <button
              onClick={() => setActiveTab('ai')}
              className={`${
                activeTab === 'ai'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              IA Settings
            </button>
          )}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
        {renderContent()}
        <div className="flex items-center justify-between mt-6">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            {id ? 'Update' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/companies')}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CompanyFormPage;
