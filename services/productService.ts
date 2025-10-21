import { collection, getDocs, getDoc, doc, query, where, limit, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";
import { Product, Category } from "../types";

const productsCol = collection(db, "products");

const mapDocToProduct = (doc: any): Product => {
    const data = doc.data();
    return {
        id: doc.id,
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        images: data.images,
        isFeatured: data.isFeatured,
        customizationConfig: data.customizationConfig,
        companyId: data.companyId, // <-- This was missing
    } as Product;
};

export const getProducts = async (companyId?: string, filters: { category?: Category | 'all'; searchTerm?: string } = {}): Promise<Product[]> => {
    let q;
    if (companyId) {
        q = query(productsCol, where("companyId", "==", companyId));
        if (filters.category && filters.category !== 'all') {
            q = query(q, where("category", "==", filters.category));
        }
    } else {
        q = productsCol;
    }
    const productSnapshot = await getDocs(q);
    let productList = productSnapshot.docs.map(mapDocToProduct);
    if (filters.searchTerm) {
        productList = productList.filter(p => 
            p.name.toLowerCase().includes(filters.searchTerm!.toLowerCase()) || 
            p.description.toLowerCase().includes(filters.searchTerm!.toLowerCase())
        );
    }
    return productList;
};

export const getProductById = async (id: string): Promise<Product | undefined> => {
    const docRef = doc(db, "products", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return mapDocToProduct(docSnap);
    } else {
        return undefined;
    }
};

export const getRelatedProducts = async (productId: string, category: string): Promise<Product[]> => {
    const q = query(productsCol, where("category", "==", category), where("__name__", "!=", productId), limit(4));
    const productSnapshot = await getDocs(q);
    return productSnapshot.docs.map(mapDocToProduct);
};

export const getFeaturedProducts = async (companyId: string): Promise<Product[]> => {
    const q = query(productsCol, where("companyId", "==", companyId), where("isFeatured", "==", true), limit(4));
    const productSnapshot = await getDocs(q);
    return productSnapshot.docs.map(mapDocToProduct);
};

export const createProduct = async (product: Partial<Product>): Promise<string> => {
    const docRef = await addDoc(productsCol, product);
    return docRef.id;
};

export const updateProduct = async (id: string, product: Partial<Product>): Promise<void> => {
    const docRef = doc(db, "products", id);
    await updateDoc(docRef, product);
};

export const deleteProduct = async (id: string): Promise<void> => {
    const docRef = doc(db, "products", id);
    await deleteDoc(docRef);
};