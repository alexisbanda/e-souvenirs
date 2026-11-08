export interface Company {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  logo?: string;
  featured?: boolean;
  contact: {
    email: string;
    contactName?: string;
    contactRole?: string;
  };
  settings: {
    allowCustomizations: boolean;
    enableAIAssistant: boolean;
    transferText?: string;
    cashText?: string;
    heroImage?: string;
    brandColor?: string;
    welcomeMessage?: string;
    hours?: string;
    facebook?: string;
    instagram?: string;
    whatsapp?: string;
    website?: string;
    aiPrompt?: string;
    imageProvider?: 'PEXELS' | 'GOOGLE_IMAGEN';
    theme?: string; // Theme key for company branding
    defaultLanguage?: string;
    businessProfile?: {
      description: string;
      targetAudience: string;
      salesObjective: string;
      seedDescription?: string;
    };
  };
  slug: string;
  /** Proveedor de tarjeta activo. Lo fija el superadmin; las credenciales viven en paymentCredentials. */
  cardProvider?: 'payphone' | 'stripe';
  /** Transferencia y efectivo activos en el checkout. Lo fija el superadmin; si falta una clave, ese método está activo. */
  paymentMethods?: { transfer: boolean; cash: boolean };
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE';
  createdAt?: any;
  adminUid?: string;
}