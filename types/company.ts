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
    businessProfile?: {
      description: string;
      targetAudience: string;
      salesObjective: string;
      seedDescription?: string;
    };
  };
  slug: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE';
  createdAt?: any;
  adminUid?: string;
}