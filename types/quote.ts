import { SouvenirConcept } from '.';

export type QuoteStatus = 'Pendiente' | 'Contactado' | 'En negociación' | 'Ganada' | 'Perdida';

export interface Quote {
    id: string;
    name: string;
    email: string;
    quantity: number;
    concept: SouvenirConcept;
    companyId?: string;
    createdAt: any; // Should be a Timestamp, but using any for now
    status: QuoteStatus;
    observations: string;
}
