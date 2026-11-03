import type { SouvenirConcept } from '../types';

// Lo que el visitante lleva hecho sobrevive al ir a iniciar sesión. Va en
// sessionStorage: solo vive en esta pestaña y no lo ve nadie más.

export interface WizardDraft {
  step: number;
  selections: { event: string; style: string };
  details: string;
}

const wizardKey = (companyId: string) => `conceptDraft:wizard:${companyId}`;
const conceptsKey = (companyId: string) => `conceptDraft:concepts:${companyId}`;

// sessionStorage puede lanzar con los datos del sitio bloqueados o sin espacio.
const write = (key: string, value: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Could not save the concept draft:', (error as Error).name);
  }
};

const read = (key: string): unknown => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

const remove = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Sin acceso a sessionStorage tampoco hay borrador que limpiar.
  }
};

const isWizardDraft = (value: unknown): value is WizardDraft => {
  const draft = value as Partial<WizardDraft> | null;
  return (
    typeof draft === 'object' &&
    draft !== null &&
    [1, 2, 3].includes(draft.step as number) &&
    typeof draft.selections?.event === 'string' &&
    typeof draft.selections?.style === 'string' &&
    typeof draft.details === 'string'
  );
};

const isConcept = (value: unknown) => {
  const concept = value as Partial<SouvenirConcept> | null;
  return typeof concept === 'object' && concept !== null && typeof concept.name === 'string' && Array.isArray(concept.materials);
};

export const saveWizardDraft = (companyId: string, draft: WizardDraft) => write(wizardKey(companyId), draft);

export const loadWizardDraft = (companyId: string): WizardDraft | null => {
  const draft = read(wizardKey(companyId));
  return isWizardDraft(draft) ? draft : null;
};

export const clearWizardDraft = (companyId: string) => remove(wizardKey(companyId));

export const saveConceptsDraft = (companyId: string, concepts: SouvenirConcept[]) => write(conceptsKey(companyId), concepts);

export const loadConceptsDraft = (companyId: string): SouvenirConcept[] | null => {
  const concepts = read(conceptsKey(companyId));
  return Array.isArray(concepts) && concepts.length > 0 && concepts.every(isConcept) ? (concepts as SouvenirConcept[]) : null;
};

export const clearConceptsDraft = (companyId: string) => remove(conceptsKey(companyId));

/** Ruta a la que volver tras iniciar sesión, solo si es de la misma tienda. */
export const getReturnPath = (state: unknown, slug: string | undefined): string | null => {
  const from = (state as { from?: unknown } | null)?.from;
  if (!slug || typeof from !== 'string') return null;
  return from === `/${slug}` || from.startsWith(`/${slug}/`) ? from : null;
};
