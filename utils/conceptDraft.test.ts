import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SouvenirConcept } from '../types';
import {
  clearConceptsDraft,
  clearWizardDraft,
  getReturnPath,
  loadConceptsDraft,
  loadWizardDraft,
  saveConceptsDraft,
  saveWizardDraft,
} from './conceptDraft';

const wizard = { step: 3, selections: { event: 'Boda', style: 'modern' }, details: 'con iniciales' };
const concepts = [{ id: 'a', name: 'Taza', description: 'd', materials: ['Barro'], imageUrl: null }] as unknown as SouvenirConcept[];

describe('conceptDraft', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('recupera el asistente y los conceptos guardados, y deja de hacerlo al limpiarlos', () => {
    saveWizardDraft('c1', wizard);
    saveConceptsDraft('c1', concepts);

    expect(loadWizardDraft('c1')).toEqual(wizard);
    expect(loadConceptsDraft('c1')).toEqual(concepts);

    clearWizardDraft('c1');
    clearConceptsDraft('c1');

    expect(loadWizardDraft('c1')).toBeNull();
    expect(loadConceptsDraft('c1')).toBeNull();
  });

  it('no mezcla los borradores de dos tiendas', () => {
    saveWizardDraft('c1', wizard);

    expect(loadWizardDraft('c2')).toBeNull();
  });

  it.each([
    ['JSON roto', '{no-json'],
    ['paso fuera de rango', JSON.stringify({ ...wizard, step: 9 })],
    ['sin selecciones', JSON.stringify({ step: 2, details: '' })],
    ['null', 'null'],
  ])('ignora un asistente guardado con %s', (_name, raw) => {
    store.set('conceptDraft:wizard:c1', raw);

    expect(loadWizardDraft('c1')).toBeNull();
  });

  it.each([
    ['JSON roto', '{no-json'],
    ['una lista vacía', '[]'],
    ['un concepto sin materiales', JSON.stringify([{ name: 'Taza' }])],
  ])('ignora unos conceptos guardados con %s', (_name, raw) => {
    store.set('conceptDraft:concepts:c1', raw);

    expect(loadConceptsDraft('c1')).toBeNull();
  });

  it('no falla si sessionStorage lanza', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });

    expect(() => saveWizardDraft('c1', wizard)).not.toThrow();
    expect(() => clearWizardDraft('c1')).not.toThrow();
    expect(loadWizardDraft('c1')).toBeNull();
  });
});

describe('getReturnPath', () => {
  it.each([
    [{ from: '/tienda' }, 'tienda', '/tienda'],
    [{ from: '/tienda/catalogo' }, 'tienda', '/tienda/catalogo'],
    [{ from: '/otra' }, 'tienda', null],
    [{ from: '/tienda-falsa' }, 'tienda', null],
    [{ from: '//evil.example' }, 'tienda', null],
    [{ from: 'https://evil.example/tienda' }, 'tienda', null],
    [{ from: 5 }, 'tienda', null],
    [null, 'tienda', null],
    [undefined, 'tienda', null],
    [{ from: '/tienda' }, undefined, null],
  ])('con %j y slug %s da %s', (state, slug, expected) => {
    expect(getReturnPath(state, slug)).toBe(expected);
  });
});
