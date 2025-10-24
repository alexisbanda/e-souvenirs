import { collection, getDocs, updateDoc, doc, setDoc, deleteDoc, getDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { AppUser, UserRole } from '../types/user';
import { getAuth, createUserWithEmailAndPassword, updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword, User } from 'firebase/auth';

// Colección de usuarios en Firestore
const USERS_COLLECTION = 'users';

export async function getUser(id: string): Promise<AppUser | null> {
    const userRef = doc(db, USERS_COLLECTION, id);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return { id: userSnap.id, ...userSnap.data() } as AppUser;
    }
    return null;
}

export async function getAllUsers(companyId?: string): Promise<AppUser[]> {
    if (companyId) {
        const q = query(collection(db, USERS_COLLECTION), where("companyId", "==", companyId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
    } else {
        const snapshot = await getDocs(collection(db, USERS_COLLECTION));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
    }
}

export async function updateUserRole(userId: string, newRole: UserRole): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, userId);
  await updateDoc(userRef, { role: newRole });
}

export async function updateUserCompany(userId: string, companyId: string): Promise<void> {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, { companyId });
}

export async function addUser(user: Omit<AppUser, 'id'> & { password: string }): Promise<AppUser> {
  const auth = getAuth();
  if (!user.password) throw new Error('Se requiere una contraseña para crear el usuario');
  const cred = await createUserWithEmailAndPassword(auth, user.email, user.password);
  const userId = cred.user.uid;
  
  const userData: Omit<AppUser, 'id'> = {
    email: user.email,
    role: user.role || 'client',
    name: user.name,
    companyId: user.companyId,
    createdAt: new Date().toISOString(),
  };

  if (!userData.companyId) {
    delete userData.companyId;
  }

  const userRef = doc(db, USERS_COLLECTION, userId);
  await setDoc(userRef, userData);
  
  return { id: userId, ...userData };
}

export async function deleteUser(userId: string): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, userId);
  await deleteDoc(userRef);
}

export async function updateUserProfile(user: User, profile: { displayName?: string }): Promise<void> {
    await updateProfile(user, profile);
}

export async function reauthenticate(email: string, password: string): Promise<void> {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("No user is currently signed in.");
    
    const credential = EmailAuthProvider.credential(email, password);
    await reauthenticateWithCredential(user, credential);
}

export async function updateUserPassword(newPassword: string): Promise<void> {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error("No user is currently signed in.");

    await updatePassword(user, newPassword);
}