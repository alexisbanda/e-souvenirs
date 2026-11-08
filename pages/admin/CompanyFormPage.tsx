import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCompany, createCompany, updateCompany } from '../../services/companyService';
import { Company } from '../../types/company';
import { useAuth } from '../../context/AuthContext';
import ImageUpload from '../../components/ImageUpload';
import { companyFormPayload, hasAnyPaymentMethod, resolvePaymentMethods, type ManualPaymentMethod } from '../../utils/paymentMethods';
import {
  getCardProviderStatus,
  setCardProvider,
  type CardProviderFailureReason,
  type CardProviderRequest,
  type CardProviderStatus,
} from '../../services/cardProviderService';

const PROVIDER_NAMES = { payphone: 'Payphone', stripe: 'Stripe' } as const;

const CARD_ERROR_MESSAGES: Record<CardProviderFailureReason, string> = {
  login: 'Tu sesión ha caducado: vuelve a iniciar sesión.',
  forbidden: 'Solo el superadmin puede configurar la tarjeta.',
  validation: 'Revisa los datos: Payphone necesita token y storeId, y el IVA debe ser un decimal entre 0 y 1 (p. ej. 0.15).',
  'last-payment-method': 'No se puede desactivar la tarjeta: la tienda se quedaría sin métodos de pago. Activa y guarda transferencia o efectivo antes.',
  'not-found': 'La empresa no existe.',
  error: 'No se pudo actualizar la tarjeta. Inténtalo de nuevo.',
};

const describeCardStatus = (status: CardProviderStatus) => {
  if (status.provider === null) return 'Tarjeta: desactivada';
  if (status.provider === 'stripe') return 'Tarjeta: Stripe';
  const tax = status.taxRate === undefined ? 'sin IVA desglosado' : `IVA ${status.taxRate}`;
  return `Tarjeta: Payphone · storeId ${status.storeId} · ${tax}`;
};

const inputClass = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';

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
    featured: false,
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
      defaultLanguage: 'es',
    },
    status: 'PENDING',
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basic');
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const isSuperadmin = user?.role === 'superadmin';
  // Tarjeta (solo superadmin): el estado viene del servidor; el token nunca vuelve al cliente.
  const [cardStatus, setCardStatus] = useState<CardProviderStatus | null>(null);
  const [cardForm, setCardForm] = useState({ provider: 'payphone' as 'payphone' | 'stripe', token: '', storeId: '', taxRate: '' });
  const [cardSaving, setCardSaving] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperadmin || !id) return;
    let cancelled = false;
    getCardProviderStatus(id).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setCardStatus(result.status);
      } else {
        setCardError(CARD_ERROR_MESSAGES[result.reason]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isSuperadmin, id]);

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

  const handleLogoChange = (urls: string[]) => {
    setCompany(prev => ({ ...prev, logo: urls[0] || '' }));
  };

  // Solo el superadmin escribe paymentMethods (ver companyFormPayload).
  const handlePaymentMethodToggle = (method: ManualPaymentMethod, checked: boolean) => {
    setPaymentMethodsError(null);
    setCompany(prev => ({ ...prev, paymentMethods: { ...resolvePaymentMethods(prev.paymentMethods), [method]: checked } }));
  };

  const handleCardFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCardError(null);
    setCardForm(prev => ({ ...prev, [name]: value }));
  };

  // Los botones de tarjeta guardan al momento, aparte del botón Update del formulario.
  const saveCardProvider = async (disable: boolean) => {
    if (!id) return;
    let request: CardProviderRequest;
    if (disable) {
      request = { companyId: id, disable: true };
    } else if (cardForm.provider === 'stripe') {
      request = { companyId: id, provider: 'stripe' };
    } else {
      const taxRateText = cardForm.taxRate.trim().replace(',', '.');
      const taxRate = taxRateText === '' ? undefined : Number(taxRateText);
      if (!cardForm.token.trim() || !cardForm.storeId.trim() || (taxRate !== undefined && !(taxRate >= 0 && taxRate < 1))) {
        setCardError(CARD_ERROR_MESSAGES.validation);
        return;
      }
      request = {
        companyId: id,
        provider: 'payphone',
        token: cardForm.token.trim(),
        storeId: cardForm.storeId.trim(),
        ...(taxRate === undefined ? {} : { taxRate }),
      };
    }

    setCardSaving(true);
    setCardError(null);
    const result = await setCardProvider(request);
    setCardSaving(false);
    setCardForm(prev => ({ ...prev, token: '' }));
    if (!result.ok) {
      setCardError(CARD_ERROR_MESSAGES[result.reason]);
      return;
    }
    const { provider } = result.status;
    setCardStatus(result.status);
    setPaymentMethodsError(null);
    // La validación «al menos un método» de handleSubmit mira company.cardProvider.
    setCompany(prev => {
      const next = { ...prev };
      if (provider) next.cardProvider = provider;
      else delete next.cardProvider;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuperadmin) {
      const paymentMethods = resolvePaymentMethods(company.paymentMethods);
      if (!hasAnyPaymentMethod({ ...paymentMethods, card: Boolean(company.cardProvider) })) {
        setPaymentMethodsError('La tienda necesita al menos un método de pago activo: activa transferencia o efectivo (o configura la tarjeta).');
        return;
      }
    }
    // Sin cardProvider: solo lo escribe manage-card-provider (ver companyFormPayload).
    const data = companyFormPayload(company, isSuperadmin);
    setPaymentMethodsError(null);
    try {
      if (id) {
        await updateCompany(id, data);
      } else {
        await createCompany(data);
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
              <label className="block text-gray-700 text-sm font-bold mb-2">Logo</label>
              <ImageUpload
                  initialUrls={company.logo ? [company.logo] : []}
                  onUrlsChange={handleLogoChange}
                  maxImages={1}
                  storagePath="company-logos"
              />
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
              <>
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
                <div className="flex items-center my-4">
                  <input
                    type="checkbox"
                    name="featured"
                    id="featured"
                    checked={company.featured || false}
                    onChange={handleChange}
                    className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="featured" className="text-gray-700 text-sm font-bold">Compañía Destacada</label>
                </div>
              </>
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
              <label htmlFor="settings.defaultLanguage" className="block text-gray-700 text-sm font-bold mb-2">Idioma por Defecto</label>
              <select
                name="settings.defaultLanguage"
                id="settings.defaultLanguage"
                value={company.settings.defaultLanguage || 'es'}
                onChange={handleChange}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
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
            {isSuperadmin && (
              <fieldset className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <legend className="px-1 text-gray-700 text-sm font-bold">Métodos de pago activos en el checkout</legend>
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="paymentMethodTransfer"
                    checked={resolvePaymentMethods(company.paymentMethods).transfer}
                    onChange={(e) => handlePaymentMethodToggle('transfer', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="paymentMethodTransfer" className="ml-2 block text-sm text-gray-900">Transferencia</label>
                </div>
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="paymentMethodCash"
                    checked={resolvePaymentMethods(company.paymentMethods).cash}
                    onChange={(e) => handlePaymentMethodToggle('cash', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="paymentMethodCash" className="ml-2 block text-sm text-gray-900">Efectivo</label>
                </div>
              </fieldset>
            )}
            {isSuperadmin && id && (
              <fieldset
                className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200"
                // Enter en estos campos no debe enviar el formulario de la empresa.
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              >
                <legend className="px-1 text-gray-700 text-sm font-bold">Tarjeta</legend>
                <p className="mt-2 text-sm text-gray-600">{cardStatus ? describeCardStatus(cardStatus) : 'Tarjeta: cargando…'}</p>
                <div className="mt-4">
                  <label htmlFor="cardProvider" className="block text-gray-700 text-sm font-bold mb-2">Proveedor</label>
                  <select id="cardProvider" name="provider" value={cardForm.provider} onChange={handleCardFormChange} className={inputClass}>
                    <option value="payphone">Payphone</option>
                    <option value="stripe">Stripe</option>
                  </select>
                </div>
                {cardForm.provider === 'payphone' && (
                  <>
                    <div className="mt-4">
                      <label htmlFor="cardToken" className="block text-gray-700 text-sm font-bold mb-2">Token de Payphone</label>
                      <input type="password" id="cardToken" name="token" autoComplete="new-password" value={cardForm.token} onChange={handleCardFormChange} className={inputClass} />
                    </div>
                    <div className="mt-4">
                      <label htmlFor="cardStoreId" className="block text-gray-700 text-sm font-bold mb-2">storeId</label>
                      <input type="text" id="cardStoreId" name="storeId" autoComplete="off" value={cardForm.storeId} onChange={handleCardFormChange} className={inputClass} />
                    </div>
                    <div className="mt-4">
                      <label htmlFor="cardTaxRate" className="block text-gray-700 text-sm font-bold mb-2">IVA incluido en los precios (opcional, decimal: 0.15 = 15 %)</label>
                      <input type="text" inputMode="decimal" id="cardTaxRate" name="taxRate" autoComplete="off" value={cardForm.taxRate} onChange={handleCardFormChange} className={inputClass} placeholder="0.15" />
                    </div>
                  </>
                )}
                {cardError && (
                  <p role="alert" className="mt-4 p-3 rounded-md bg-red-50 text-sm text-red-700">{cardError}</p>
                )}
                <div className="flex gap-4 mt-4">
                  <button
                    type="button"
                    onClick={() => saveCardProvider(false)}
                    disabled={cardSaving}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded"
                  >
                    Activar tarjeta
                  </button>
                  <button
                    type="button"
                    onClick={() => saveCardProvider(true)}
                    disabled={cardSaving || cardStatus?.provider === null}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded"
                  >
                    Desactivar tarjeta
                  </button>
                </div>
              </fieldset>
            )}
            {!isSuperadmin && (
              <p className="mt-6 text-sm text-gray-600">
                Tarjeta: {company.cardProvider ? PROVIDER_NAMES[company.cardProvider] : 'desactivada'}
              </p>
            )}
            <div className="flex items-center mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                name="settings.enableAIAssistant"
                id="enableAIAssistant"
                checked={company.settings.enableAIAssistant}
                onChange={handleChange}
                className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <div className="flex flex-col">
                <label htmlFor="enableAIAssistant" className="font-bold text-gray-700">Activar Generador de Ideas (IA)</label>
                <span className="text-sm text-gray-500">Permite a los clientes generar conceptos de regalos personalizados usando IA en la página de inicio.</span>
              </div>
            </div>
          </div>
        );
      case 'ai':
        return (
          <div>
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
        {paymentMethodsError && (
          <p role="alert" className="mt-6 p-3 rounded-md bg-red-50 text-sm text-red-700">{paymentMethodsError}</p>
        )}
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

