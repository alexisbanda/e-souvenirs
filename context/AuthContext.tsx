import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
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
    let userDocUnsubscribe: Unsubscribe | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
        userDocUnsubscribe = undefined;
      }

      if (firebaseUser) {
        setLoading(true);
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        userDocUnsubscribe = onSnapshot(
          userDocRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const appUser = snapshot.data() as AppUser;
              setUser({ ...firebaseUser, ...appUser, id: appUser.id ?? firebaseUser.uid });
            } else {
              setUser(firebaseUser as User & AppUser);
            }
            setLoading(false);
          },
          (error) => {
            console.error('Error observing user document', error);
            setUser(firebaseUser as User & AppUser);
            setLoading(false);
          }
        );
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
      }
      unsubscribeAuth();
    };
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