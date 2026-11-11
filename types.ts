export interface Category {
  id: string;
  name: string;
  icon: string;
  companyId: string;
  image?: string;
  featured?: boolean;
}

export interface CustomizationConfig {
  text?: { label: string };
  date?: { label: string };
  color?: { label: string; options: string[] };
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string; // Now a string
  images: string[];
  isFeatured?: boolean;
  customizationConfig?: CustomizationConfig;
  companyId: string;
}

export interface CustomizationSelection {
  text?: string;
  date?: string;
  color?: string;
}

export interface CartItem {
  id: string; // A unique ID for the cart item instance (e.g., product.id + timestamp)
  product: Product;
  quantity: number;
  customization: CustomizationSelection;
}

export type OrderStatus = 'Pendiente' | 'Pendiente de pago' | 'En producción' | 'Enviado' | 'Entregado' | 'Cancelado';

export interface Order {
    id: string;
    userId: string;
    companyId: string;
    date: any; // Firestore serverTimestamp
    total: number;
    status: OrderStatus;
    customer: {
        name: string;
        email: string;
        address: string;
        city: string;
        /** Opcional: los pedidos anteriores a #64 no lo tienen. */
        phone?: string;
        postalCode?: string;
    };
    items: {
        productId: string;
        productName: string;
        quantity: number;
        price: number;
        customization: CustomizationSelection;
        /** Etiquetas de los campos al momento de la compra; los pedidos anteriores a #66 no las tienen. */
        customizationLabels?: Record<string, string>;
    }[];
    shippingMethod: string;
    shippingCost: number;
    payment: {
        method: string;
        /** Pago con tarjeta: 'payphone' o 'stripe'. */
        provider?: string;
        /** Referencia del proveedor: transactionId de Payphone o id de la Checkout Session de Stripe. */
        transactionId?: string;
        paymentIntentId?: string;
        last4?: string;
    };
    couponCode?: string;
    discount?: number;
    /** Correos ya enviados de este pedido (#67): los escribe el servidor, una vez cada uno. */
    notifications?: {
        buyerEmailSentAt?: unknown;
        sellerEmailSentAt?: unknown;
    };
}

export interface SouvenirConcept {
  id: string;
  name: string;
  description: string;
  materials: string[];
  imagePrompt: string;
  imageUrl: string | null;
  isGeneratingImage: boolean;
}