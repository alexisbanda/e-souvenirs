import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getDocMock, getDocsMock, setDocMock } = vi.hoisted(() => ({
  getDocMock: vi.fn(),
  getDocsMock: vi.fn(),
  setDocMock: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
  getDoc: getDocMock,
  getDocs: getDocsMock,
  limit: (count: number) => ({ limit: count }),
  query: (source: string, ...constraints: unknown[]) => ({ source, constraints }),
  setDoc: setDocMock,
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
}));
vi.mock('./firebase', () => ({ db: {} }));

import { ensureClientDocument } from './userService';

const NOW = '2026-01-15T12:00:00.000Z';
const input = { uid: 'u1', email: 'ana@example.com', name: 'Ana', companyId: 'c1' };

const noDocument = { exists: () => false };
const noCompanies = { empty: true };

describe('ensureClientDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    getDocMock.mockResolvedValue(noDocument);
    getDocsMock.mockResolvedValue(noCompanies);
    setDocMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('crea el documento como client con los campos exactos y el companyId dado', async () => {
    await ensureClientDocument(input);

    expect(setDocMock).toHaveBeenCalledTimes(1);
    expect(setDocMock).toHaveBeenCalledWith('users/u1', {
      id: 'u1',
      email: 'ana@example.com',
      name: 'Ana',
      role: 'client',
      companyId: 'c1',
      createdAt: NOW,
    });
  });

  it('busca la empresa por adminUid, con limit(1)', async () => {
    await ensureClientDocument(input);

    expect(getDocsMock).toHaveBeenCalledWith({
      source: 'companies',
      constraints: [{ field: 'adminUid', op: '==', value: 'u1' }, { limit: 1 }],
    });
  });

  it('no escribe si el documento ya existe, aunque sea de un companyadmin', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ role: 'companyadmin', companyId: 'c9' }) });

    await ensureClientDocument(input);

    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('no escribe si la persona es adminUid de una empresa', async () => {
    getDocsMock.mockResolvedValue({ empty: false });

    await ensureClientDocument(input);

    expect(setDocMock).not.toHaveBeenCalled();
  });

  it.each([
    ['sin name', { uid: 'u1', email: 'ana@example.com', companyId: 'c1' }],
    ['con name vacío', { ...input, name: '' }],
  ])('no escribe undefined ni el campo name %s', async (_case, data) => {
    await ensureClientDocument(data);

    const written = setDocMock.mock.calls[0][1];
    expect(written).not.toHaveProperty('name');
    expect(Object.values(written)).not.toContain(undefined);
  });

  it.each([
    ['del documento', getDocMock],
    ['de las empresas', getDocsMock],
  ])('propaga un error de lectura %s y no escribe', async (_case, readMock) => {
    readMock.mockRejectedValue(new Error('unavailable'));

    await expect(ensureClientDocument(input)).rejects.toThrow('unavailable');

    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('propaga un error de escritura', async () => {
    setDocMock.mockRejectedValue(new Error('permission-denied'));

    await expect(ensureClientDocument(input)).rejects.toThrow('permission-denied');
  });
});
