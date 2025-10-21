import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { getUser } from '../services/userService';
import { AppUser } from '../types/user';

// Define the shape of the context data
interface AuthContextType {
  user: (User & AppUser) | null;
  setUser: React.Dispatch<React.SetStateAction<(User & AppUser) | null>>;
  loading: boolean;
  logout: () => void;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create a provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<(User & AppUser) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const appUser = await getUser(firebaseUser.uid);
        if (appUser) {
          setUser({ ...firebaseUser, ...appUser });
        } else {
          setUser(firebaseUser as (User & AppUser)); // Should not happen if user is in db
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = () => {
    auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Create a custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};