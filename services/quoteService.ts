import { SouvenirConcept } from '../types';
import { Company } from '../types/company';
import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc } from "firebase/firestore";
import { Quote, QuoteStatus } from '../types/quote';

interface QuotePayload {
    name: string;
    email: string;
    quantity: number;
    concept: SouvenirConcept;
    companyId: string | undefined;
}

export const quoteService = {
    sendQuote: async (payload: QuotePayload): Promise<{ success: boolean }> => {
        console.log('Sending quote request:', payload);

        try {
            await addDoc(collection(db, "quotes"), {
                ...payload,
                createdAt: new Date(),
                status: 'Pendiente',
                observations: ''
            });
            return { success: true };
        } catch (error) {
            console.error("Error adding document: ", error);
            return { success: false };
        }
    },

    getQuotes: async (companyId?: string): Promise<Quote[]> => {
        const quotesCollection = collection(db, 'quotes');
        let q = query(quotesCollection);
        if (companyId) {
            q = query(quotesCollection, where("companyId", "==", companyId));
        }
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote));
    },

    getQuoteById: async (id: string): Promise<Quote | null> => {
        const docRef = doc(db, "quotes", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Quote;
        }
        return null;
    },

    updateQuote: async (id: string, data: { status?: QuoteStatus, observations?: string }): Promise<void> => {
        const docRef = doc(db, "quotes", id);
        return await updateDoc(docRef, data);
    }
};

export const getQuotes = quoteService.getQuotes;
export const getQuoteById = quoteService.getQuoteById;
export const updateQuote = quoteService.updateQuote;
