import { collection, getDocs, updateDoc, doc, setDoc, deleteDoc, getDoc, limit, query, where } from 'firebase/firestore';
import { db, firebaseConfig } from './firebase';
import { AppUser, UserRole } from '../types/user';
import { deleteApp, FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, getAuth, createUserWithEmailAndPassword, deleteUser as deleteAuthUser, inMemoryPersistence, initializeAuth, signOut, updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword, User } from 'firebase/auth';

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

// Numera las instancias secundarias: Firebase no deja inicializar dos veces el mismo nombre.
let secondaryAppCount = 0;

// Solo registra el código: los errores de Auth pueden llevar el email en customData.
function logAddUserError(message: string, error: unknown): void {
  console.error(message, (error as { code?: string } | null)?.code ?? 'sin código');
}

// Nunca lanza: un fallo aquí no debe ocultar el resultado ni el error del alta.
async function closeSecondaryApp(secondaryApp: FirebaseApp, secondaryAuth?: Auth): Promise<void> {
  if (secondaryAuth) {
    try {
      await signOut(secondaryAuth);
    } catch (error) {
      logAddUserError('addUser: no se pudo cerrar la sesión secundaria', error);
    }
  }
  try {
    await deleteApp(secondaryApp);
  } catch (error) {
    logAddUserError('addUser: no se pudo eliminar la instancia secundaria', error);
  }
}

/**
 * Crea la cuenta y su documento users/{uid} sin tocar la sesión de quien la crea.
 * createUserWithEmailAndPassword inicia sesión con la cuenta nueva, así que se llama sobre
 * una instancia secundaria, sin persistencia para que no deje nada guardado en el navegador.
 * El documento se escribe con db, es decir, con la sesión del superadmin. Si esa escritura
 * falla, se intenta borrar la cuenta para no dejarla sin documento.
 */
export async function addUser(user: Omit<AppUser, 'id'> & { password: string }): Promise<AppUser> {
  if (!user.password) throw new Error('Se requiere una contraseña para crear el usuario');

  const secondaryApp = initializeApp(firebaseConfig, `alta-usuario-${++secondaryAppCount}`);
  let secondaryAuth: Auth | undefined;
  try {
    secondaryAuth = initializeAuth(secondaryApp, { persistence: inMemoryPersistence });
    const cred = await createUserWithEmailAndPassword(secondaryAuth, user.email, user.password);
    const userId = cred.user.uid;

    const userData: Omit<AppUser, 'id'> = {
      email: user.email,
      role: user.role || 'client',
      name: user.name,
      companyId: user.companyId,
      createdAt: new Date().toISOString(),
    };

    // Firestore rechaza los campos con undefined.
    if (!userData.companyId) {
      delete userData.companyId;
    }
    if (!userData.name) {
      delete userData.name;
    }

    try {
      await setDoc(doc(db, USERS_COLLECTION, userId), userData);
    } catch (error) {
      try {
        await deleteAuthUser(cred.user);
      } catch (deleteError) {
        logAddUserError('addUser: no se pudo borrar la cuenta tras fallar su documento', deleteError);
      }
      throw error;
    }

    return { id: userId, ...userData };
  } finally {
    await closeSecondaryApp(secondaryApp, secondaryAuth);
  }
}

/**
 * Crea users/{uid} con rol client para quien se registra o inicia sesión en una tienda.
 * No hace nada si el documento ya existe, para no sobrescribir ni tocar a un administrador,
 * ni si la persona figura como adminUid de una empresa: un registro de empresa que falló a
 * medias deja al administrador sin documento, y crearle uno de cliente le quitaría el acceso.
 * Lanza el error si falla; quien la llama decide qué hacer.
 */
export async function ensureClientDocument({ uid, email, name, companyId }: {
  uid: string;
  email: string;
  name?: string;
  companyId: string;
}): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return;

  const adminOf = await getDocs(query(collection(db, 'companies'), where('adminUid', '==', uid), limit(1)));
  if (!adminOf.empty) return;

  const userData: AppUser = {
    id: uid,
    email,
    role: 'client',
    companyId,
    createdAt: new Date().toISOString(),
    // Firestore rechaza los campos con undefined.
    ...(name ? { name } : {}),
  };
  await setDoc(userRef, userData);
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