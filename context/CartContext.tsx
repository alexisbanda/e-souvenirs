import React, { createContext, useReducer, useContext, ReactNode, useEffect } from 'react';
import { CartItem } from '../types';
import { useCompany } from './CompanyContext';

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: CartItem }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' };

const initialState: CartState = {
  items: [],
};

const CartContext = createContext<{
  state: CartState;
  dispatch: React.Dispatch<CartAction>;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getItemCount: () => number;
}>({
  state: initialState,
  dispatch: () => null,
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  getCartTotal: () => 0,
  getItemCount: () => 0,
});

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const newItem = action.payload;
      // Find an item with the same product ID and identical customizations.
      const existingItemIndex = state.items.findIndex(
        (item) =>
          item.product.id === newItem.product.id &&
          JSON.stringify(item.customization) === JSON.stringify(newItem.customization)
      );

      if (existingItemIndex > -1) {
        // If found, update the quantity of the existing item.
        const updatedItems = state.items.map((item, index) => {
          if (index === existingItemIndex) {
            return {
              ...item,
              quantity: item.quantity + newItem.quantity,
            };
          }
          return item;
        });
        return { ...state, items: updatedItems };
      } else {
        // If not found, add the new item to the cart.
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
            ? { ...item, quantity: Math.max(0, action.payload.quantity) } // Allow quantity to be 0 to facilitate removal
            : item
        ).filter(item => item.quantity > 0), // Remove items if quantity becomes 0
      };
    case 'CLEAR_CART':
      return { ...state, items: [] };
    default:
      return state;
  }
}

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { company } = useCompany();
  const cartKey = company ? `cartState_${company.id}` : 'cartState_global'; // Use a dynamic key for localStorage

  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // Load cart from localStorage when company (and thus cartKey) changes
  useEffect(() => {
    try {
      const storedState = localStorage.getItem(cartKey);
      if (storedState) {
        const parsedState = JSON.parse(storedState);
        if (parsedState && Array.isArray(parsedState.items)) {
          // Instead of returning, we dispatch an action to set the loaded state
          dispatch({ type: 'CLEAR_CART' }); // Clear previous state
          parsedState.items.forEach((item: CartItem) => dispatch({ type: 'ADD_ITEM', payload: item }));
        } else {
           dispatch({ type: 'CLEAR_CART' });
        }
      } else {
        dispatch({ type: 'CLEAR_CART' }); // Clear cart if no state is found for the new company
      }
    } catch (e) {
      console.error("Failed to load cart state from localStorage.", e);
      dispatch({ type: 'CLEAR_CART' });
    }
  }, [cartKey]);


  // Save cart to localStorage whenever it changes
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

  const getCartTotal = () => {
    return state.items.reduce((total, item) => total + item.product.price * item.quantity, 0);
  };

  const getItemCount = () => {
    return state.items.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{ state, dispatch, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal, getItemCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
