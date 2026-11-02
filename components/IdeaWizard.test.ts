import { beforeEach, describe, expect, it, vi } from 'vitest';

const { onSnapshotMock, unsubMock } = vi.hoisted(() => ({ onSnapshotMock: vi.fn(), unsubMock: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
  onSnapshot: onSnapshotMock,
}));
vi.mock('../services/firebase', () => ({ auth: {}, db: {} }));

import { subscribeToConceptJob } from './IdeaWizard';

const concept = (imageUrl: string | null) => ({ id: 'c', imageUrl });

describe('subscribeToConceptJob', () => {
  const onConcepts = vi.fn();
  const onDone = vi.fn();
  let emit: (data: unknown) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    onSnapshotMock.mockImplementation((_ref: string, listener: (snapshot: { data: () => unknown }) => void) => {
      emit = (data) => listener({ data: () => data });
      return unsubMock;
    });
  });

  it('escucha el documento del job', () => {
    subscribeToConceptJob('j1', onConcepts, onDone);

    expect(onSnapshotMock.mock.calls[0][0]).toBe('conceptJobs/j1');
  });

  it('transmite los conceptos sin terminar mientras el job sigue en curso', () => {
    subscribeToConceptJob('j1', onConcepts, onDone);

    emit({ status: 'processing', concepts: [concept(null)] });

    expect(onConcepts).toHaveBeenCalledWith([concept(null)]);
    expect(onDone).not.toHaveBeenCalled();
    expect(unsubMock).not.toHaveBeenCalled();
  });

  it('termina y cancela la suscripción cuando el job se completa con todas las imágenes', () => {
    subscribeToConceptJob('j1', onConcepts, onDone);

    emit({ status: 'completed', concepts: [concept('https://img')] });

    expect(onDone).toHaveBeenCalledWith('completed', [concept('https://img')]);
    expect(unsubMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['sin imageUrl', { id: 'c' }],
    ['con imageUrl null e isGeneratingImage false', { id: 'c', imageUrl: null, isGeneratingImage: false }],
  ])('termina con completed aunque un concepto quede %s', (_name, incomplete) => {
    subscribeToConceptJob('j1', onConcepts, onDone);

    emit({ status: 'completed', concepts: [concept('https://img'), incomplete] });

    expect(onDone).toHaveBeenCalledWith('completed', [concept('https://img'), incomplete]);
    expect(unsubMock).toHaveBeenCalledTimes(1);
  });

  it('termina también con failed, aunque no haya conceptos', () => {
    subscribeToConceptJob('j1', onConcepts, onDone);

    emit({ status: 'failed' });

    expect(onDone).toHaveBeenCalledWith('failed', []);
    expect(unsubMock).toHaveBeenCalledTimes(1);
  });

  it('devuelve la función que cancela la suscripción al desmontar', () => {
    expect(subscribeToConceptJob('j1', onConcepts, onDone)).toBe(unsubMock);
  });
});
