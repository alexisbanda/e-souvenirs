export type BusinessSuggestion = {
    headline: string;
    description: string;
    targetAudience: string;
    salesObjective: string;
    welcomeMessage: string;
    aiPrompt: string;
};

/**
 * Perfil de negocio básico a partir de lo que escribió el emprendedor, para que
 * pueda registrar la tienda aunque la IA no esté disponible. Lo podrá completar
 * después desde su panel. Un `aiPrompt` vacío hace que la generación de ideas
 * use su prompt por defecto.
 */
export const buildManualBusinessSuggestion = (
    seedDescription: string,
    texts: { headline: string; welcomeMessage: string },
): BusinessSuggestion => ({
    headline: texts.headline,
    description: seedDescription.trim(),
    targetAudience: '',
    salesObjective: '',
    welcomeMessage: texts.welcomeMessage,
    aiPrompt: '',
});
