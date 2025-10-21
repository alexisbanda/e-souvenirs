import { collection, getDocs, query, where, doc, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Company } from '../types/company';

export const getCompanyBySlug = async (slug: string): Promise<Company | null> => {
  const q = query(collection(db, 'companies'), where('slug', '==', slug));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const companyDoc = querySnapshot.docs[0];
  return { id: companyDoc.id, ...companyDoc.data() } as Company;
};

export const getCompanies = async (): Promise<Company[]> => {
  const querySnapshot = await getDocs(collection(db, 'companies'));
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Company));
};

export const getCompany = async (id: string): Promise<Company | null> => {
  const docRef = doc(db, 'companies', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Company;
  }
  return null;
};

export const createCompany = async (company: Omit<Company, 'id' | 'slug'>) => {
  const slug = company.name.toLowerCase().replace(/\s+/g, '-');
  const newCompany = {
    ...company,
    slug,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'companies'), newCompany);
  return docRef.id;
};

export const updateCompany = async (id: string, company: Partial<Omit<Company, 'id' | 'slug'>>) => {
  const docRef = doc(db, 'companies', id);
  const updatedCompany = {
    ...company,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(docRef, updatedCompany);
};