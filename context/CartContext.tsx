import React, { createContext, useReducer, useContext, ReactNode, useEffect } from 'react';
import { CartItem } from '../types';
import { Coupon } from '../types/coupon';
import { useCompany } from './CompanyContext';

interface CartState {
  items: CartItem[];
  appliedCoupon: Coupon | null;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'APPLY_COUPON'; payload: Coupon }
  | { type: 'REMOVE_COUPON' }
  | { type: 'SET_STATE'; payload: CartState };

const CartContext = createContext<{
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (coupon: Coupon) => void;
  removeCoupon: () => void;
  getCartTotal: () => { subtotal: number; discount: number; total: number };
  getItemCount: () => number;
}>({
  state: { items: [], appliedCoupon: null },
  dispatch: () => null,
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  applyCoupon: () => {},
  removeCoupon: () => {},
  getCartTotal: () => ({ subtotal: 0, discount: 0, total: 0 }),
  getItemCount: () => 0,
});

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const newItem = action.payload;
      const existingItemIndex = state.items.findIndex(
        (item) =>
          item.product.id === newItem.product.id &&
          JSON.stringify(item.customization) === JSON.stringify(newItem.customization)
      );

      if (existingItemIndex > -1) {
        const updatedItems = state.items.map((item, index) => {
          if (index === existingItemIndex) {
            return { ...item, quantity: item.quantity + newItem.quantity };
          }
          return item;
        });
        return { ...state, items: updatedItems };
      } else {
        return { ...state, items: [...state.items, newItem] };
      }
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload.id),
      };
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: Math.max(0, action.payload.quantity) }
            : item
        ).filter(item => item.quantity > 0),
      };
    case 'CLEAR_CART':
      return { items: [], appliedCoupon: null };
    case 'APPLY_COUPON':
      return { ...state, appliedCoupon: action.payload };
    case 'REMOVE_COUPON':
      return { ...state, appliedCoupon: null };
    case 'SET_STATE':
        return action.payload;
    default:
      return state;
  }
}

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { company } = useCompany();
  const cartKey = company ? `cartState_${company.id}` : 'cartState_global';

  const [state, dispatch] = useReducer(cartReducer, { items: [], appliedCoupon: null });

  useEffect(() => {
    try {
      const storedState = localStorage.getItem(cartKey);
      if (storedState) {
        const parsedState = JSON.parse(storedState);
        if (parsedState) {
            dispatch({ type: 'SET_STATE', payload: parsedState });
        }
      } else {
        dispatch({ type: 'CLEAR_CART' });
      }
    } catch (e) {
      console.error("Failed to load cart state from localStorage.", e);
      dispatch({ type: 'CLEAR_CART' });
    }
  }, [cartKey]);

  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save cart state to localStorage.", e);
    }
  }, [state, cartKey]);

  const addToCart = (item: CartItem) => {
    if (!company || item.product.companyId !== company.id) {
        alert("No puedes añadir productos de otra empresa al carrito actual.");
        return;
    }
    dispatch({ type: 'ADD_ITEM', payload: item });
  };

  const removeFromCart = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  };
  
  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const applyCoupon = (coupon: Coupon) => {
    dispatch({ type: 'APPLY_COUPON', payload: coupon });
  };

  const removeCoupon = () => {
    dispatch({ type: 'REMOVE_COUPON' });
  };

  const getCartTotal = () => {
    const subtotal = state.items.reduce((total, item) => total + item.product.price * item.quantity, 0);
    let discount = 0;

    if (state.appliedCoupon) {
        if (state.appliedCoupon.minPurchase && subtotal < state.appliedCoupon.minPurchase) {
            // Coupon is not valid if min purchase is not met, but we don't remove it yet
        } else {
            if (state.appliedCoupon.discountType === 'percentage') {
                discount = subtotal * (state.appliedCoupon.discountValue / 100);
            } else {
                discount = state.appliedCoupon.discountValue;
            }
        }
    }
    
    const total = Math.max(0, subtotal - discount);
    return { subtotal, discount, total };
  };

  const getItemCount = () => {
    return state.items.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{ state, dispatch, addToCart, removeFromCart, updateQuantity, clearCart, applyCoupon, removeCoupon, getCartTotal, getItemCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
