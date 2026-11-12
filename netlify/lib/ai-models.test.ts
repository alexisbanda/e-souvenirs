import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getGeminiTextFallbackModel, getGeminiTextModel, getImagenModel } from './ai-models';

describe('ai-models', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.GEMINI_TEXT_MODEL;
    delete process.env.IMAGEN_MODEL;
    delete process.env.GEMINI_TEXT_FALLBACK_MODEL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getGeminiTextModel', () => {
    it('devuelve gemini-3.5-flash-lite por defecto cuando la variable no está definida', () => {
      expect(getGeminiTextModel()).toBe('gemini-3.5-flash-lite');
    });

    it('devuelve el valor de GEMINI_TEXT_MODEL cuando está definida', () => {
      process.env.GEMINI_TEXT_MODEL = 'gemini-custom-text';
      expect(getGeminiTextModel()).toBe('gemini-custom-text');
    });

    it('usa el valor por defecto cuando GEMINI_TEXT_MODEL está vacía o solo espacios', () => {
      process.env.GEMINI_TEXT_MODEL = '   ';
      expect(getGeminiTextModel()).toBe('gemini-3.5-flash-lite');
    });
  });

  describe('getGeminiTextFallbackModel', () => {
    it('devuelve gemini-3.8-flash por defecto', () => {
      expect(getGeminiTextFallbackModel()).toBe('gemini-3.8-flash');
    });

    it('devuelve el valor de GEMINI_TEXT_FALLBACK_MODEL cuando está definida', () => {
      process.env.GEMINI_TEXT_FALLBACK_MODEL = 'gemini-respaldo';
      expect(getGeminiTextFallbackModel()).toBe('gemini-respaldo');
    });

    it('devuelve null con el valor none (sin respaldo)', () => {
      process.env.GEMINI_TEXT_FALLBACK_MODEL = 'none';
      expect(getGeminiTextFallbackModel()).toBeNull();
    });
  });

  describe('getImagenModel', () => {
    it('devuelve imagen-4.0-fast-generate-001 por defecto cuando la variable no está definida', () => {
      expect(getImagenModel()).toBe('imagen-4.0-fast-generate-001');
    });

    it('devuelve el valor de IMAGEN_MODEL cuando está definida', () => {
      process.env.IMAGEN_MODEL = 'imagen-custom';
      expect(getImagenModel()).toBe('imagen-custom');
    });

    it('usa el valor por defecto cuando IMAGEN_MODEL está vacía o solo espacios', () => {
      process.env.IMAGEN_MODEL = '   ';
      expect(getImagenModel()).toBe('imagen-4.0-fast-generate-001');
    });
  });

  describe('lectura en tiempo de ejecución (no hardcodear ni cachear)', () => {
    it('getGeminiTextModel refleja un cambio de la variable entre dos llamadas', () => {
      expect(getGeminiTextModel()).toBe('gemini-3.5-flash-lite');
      process.env.GEMINI_TEXT_MODEL = 'gemini-otro-modelo';
      expect(getGeminiTextModel()).toBe('gemini-otro-modelo');
    });

    it('getImagenModel refleja un cambio de la variable entre dos llamadas', () => {
      expect(getImagenModel()).toBe('imagen-4.0-fast-generate-001');
      process.env.IMAGEN_MODEL = 'imagen-otro-modelo';
      expect(getImagenModel()).toBe('imagen-otro-modelo');
    });
  });
});
