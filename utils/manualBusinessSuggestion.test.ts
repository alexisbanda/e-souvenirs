import { describe, expect, it } from 'vitest';
import { buildManualBusinessSuggestion } from './manualBusinessSuggestion';

describe('buildManualBusinessSuggestion', () => {
    it('usa la descripción del emprendedor y deja vacíos los campos que generaría la IA', () => {
        const suggestion = buildManualBusinessSuggestion('  Tazas pintadas a mano  ', {
            headline: 'Productos destacados',
            welcomeMessage: '¡Bienvenido a Marca!',
        });

        expect(suggestion).toEqual({
            headline: 'Productos destacados',
            description: 'Tazas pintadas a mano',
            targetAudience: '',
            salesObjective: '',
            welcomeMessage: '¡Bienvenido a Marca!',
            aiPrompt: '',
        });
    });
});
