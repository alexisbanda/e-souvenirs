import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { onSnapshotMock, unsubMock } = vi.hoisted(() => ({ onSnapshotMock: vi.fn(), unsubMock: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
  onSnapshot: onSnapshotMock,
}));
vi.mock('./firebase', () => ({ auth: {}, db: {} }));

import { CONCEPT_JOB_INACTIVITY_TIMEOUT_MS, startConceptGeneration, subscribeToConceptJob } from './conceptJobService';
import { auth } from './firebase';

const concept = (imageUrl: string | null) => ({ id: 'c', imageUrl });

describe('subscribeToConceptJob', () => {
  const onConcepts = vi.fn();
  const onDone = vi.fn();
  let emit: (data: unknown) => void;
  let emitError: (error: Error) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    onSnapshotMock.mockImplementation(
      (_ref: string, listener: (snapshot: { data: () => unknown }) => void, onError: (error: Error) => void) => {
        emit = (data) => listener({ data: () => data });
        emitError = onError;
        return unsubMock;
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  it('no transmite la lista vacía de un job recién creado', () => {
    subscribeToConceptJob('j1', onConcepts, onDone);

    emit({ status: 'pending', concepts: [] });

    expect(onConcepts).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('si el job falla sin conceptos no transmite nada que borre los anteriores', () => {
    subscribeToConceptJob('j1', onConcepts, onDone);

    emit({ status: 'pending', concepts: [] });
    emit({ status: 'failed', concepts: [] });

    expect(onConcepts).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith('failed', []);
  });

  it.each([
    ['una lista vacía', { status: 'completed', concepts: [] }],
    ['sin el campo concepts', { status: 'completed' }],
  ])('un job completed con %s termina como failed', (_name, job) => {
    subscribeToConceptJob('j1', onConcepts, onDone);

    emit(job);

    expect(onDone).toHaveBeenCalledWith('failed', []);
    expect(unsubMock).toHaveBeenCalledTimes(1);
  });

  it('la función devuelta cancela la suscripción y el temporizador al desmontar', () => {
    const stop = subscribeToConceptJob('j1', onConcepts, onDone);

    stop();
    vi.advanceTimersByTime(CONCEPT_JOB_INACTIVITY_TIMEOUT_MS * 2);

    expect(unsubMock).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('termina como failed si el listener da error, con los últimos conceptos', () => {
    subscribeToConceptJob('j1', onConcepts, onDone);
    emit({ status: 'processing', concepts: [concept(null)] });

    emitError(new Error('permission-denied'));

    expect(onDone).toHaveBeenCalledWith('failed', [concept(null)]);
    expect(unsubMock).toHaveBeenCalledTimes(1);
  });

  it('termina como failed si un job nunca da señales', () => {
    subscribeToConceptJob('j1', onConcepts, onDone);

    vi.advanceTimersByTime(CONCEPT_JOB_INACTIVITY_TIMEOUT_MS - 1);
    expect(onDone).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledWith('failed', []);
    expect(unsubMock).toHaveBeenCalledTimes(1);
  });

  it('cada novedad del job reinicia la espera, y la espera agotada conserva los conceptos', () => {
    subscribeToConceptJob('j1', onConcepts, onDone);

    vi.advanceTimersByTime(CONCEPT_JOB_INACTIVITY_TIMEOUT_MS - 1);
    emit({ status: 'processing', concepts: [concept(null)] });
    vi.advanceTimersByTime(CONCEPT_JOB_INACTIVITY_TIMEOUT_MS - 1);
    expect(onDone).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledWith('failed', [concept(null)]);
  });

  it('un snapshot sin documento no reinicia la espera', () => {
    subscribeToConceptJob('j1', onConcepts, onDone);

    vi.advanceTimersByTime(CONCEPT_JOB_INACTIVITY_TIMEOUT_MS - 1);
    emit(undefined);
    vi.advanceTimersByTime(1);

    expect(onDone).toHaveBeenCalledWith('failed', []);
  });

  it('no avisa dos veces: tras completed no salta el temporizador', () => {
    subscribeToConceptJob('j1', onConcepts, onDone);

    emit({ status: 'completed', concepts: [concept('https://img')] });
    vi.advanceTimersByTime(CONCEPT_JOB_INACTIVITY_TIMEOUT_MS * 2);

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('startConceptGeneration con 429', () => {
  const respondWith429 = (json: () => Promise<unknown>) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 429, json }));

  beforeEach(() => {
    (auth as { currentUser?: unknown }).currentUser = { getIdToken: async () => 'token' };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (auth as { currentUser?: unknown }).currentUser;
  });

  it.each([
    ['company', 'companyRateLimited'],
    ['user', 'rateLimited'],
  ])('con alcance %s da el motivo %s', async (scope, reason) => {
    respondWith429(async () => ({ scope }));

    await expect(startConceptGeneration({ companyId: 'c1', userInput: 'taza' })).resolves.toEqual({ ok: false, reason });
  });

  it('sin cuerpo legible da rateLimited', async () => {
    respondWith429(async () => {
      throw new Error('not json');
    });

    await expect(startConceptGeneration({ companyId: 'c1', userInput: 'taza' })).resolves.toEqual({ ok: false, reason: 'rateLimited' });
  });
});
