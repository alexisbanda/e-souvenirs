import { collection, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { Category } from "../types";

const CATEGORIES_COLLECTION = "categories";

const mapDocToCategory = (doc: any): Category => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
    } as Category;
};

export const getCategories = async (companyId?: string): Promise<Category[]> => {
    let q;
    if (companyId) {
        q = query(collection(db, CATEGORIES_COLLECTION), where("companyId", "==", companyId));
    } else {
        q = collection(db, CATEGORIES_COLLECTION);
    }
    const categorySnapshot = await getDocs(q);
    return categorySnapshot.docs.map(mapDocToCategory);
};

export const getCategoryById = async (id: string): Promise<Category | undefined> => {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return mapDocToCategory(docSnap);
    } else {
        return undefined;
    }
};

export const createCategory = async (category: Partial<Category>): Promise<string> => {
    const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), category);
    return docRef.id;
};

export const updateCategory = async (id: string, category: Partial<Category>): Promise<void> => {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    await updateDoc(docRef, category);
};

export const deleteCategory = async (id: string): Promise<void> => {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    await deleteDoc(docRef);
};