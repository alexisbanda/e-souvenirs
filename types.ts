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

export type OrderStatus = 'Pendiente' | 'En producción' | 'Enviado' | 'Entregado' | 'Cancelado';

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
        postalCode: string;
    };
    items: {
        productId: string;
        productName: string;
        quantity: number;
        price: number;
        customization: CustomizationSelection;
    }[];
    shippingMethod: string;
    shippingCost: number;
    payment: {
        method: string;
        last4?: string;
    };
}