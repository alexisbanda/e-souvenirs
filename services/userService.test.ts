import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createUserMock,
  deleteAppMock,
  deleteAuthUserMock,
  docMock,
  firebaseConfig,
  getAuthMock,
  getDocMock,
  getDocsMock,
  initializeAppMock,
  initializeAuthMock,
  mainAuth,
  mainDb,
  memoryPersistence,
  secondaryApp,
  secondaryAuth,
  setDocMock,
  signOutMock,
} = vi.hoisted(() => {
  const mainAuth = { name: 'auth-principal' };
  return {
    createUserMock: vi.fn(),
    deleteAppMock: vi.fn(),
    deleteAuthUserMock: vi.fn(),
    docMock: vi.fn((_db: unknown, collection: string, id: string) => `${collection}/${id}`),
    firebaseConfig: { apiKey: 'clave-de-prueba' },
    getAuthMock: vi.fn(() => mainAuth),
    getDocMock: vi.fn(),
    getDocsMock: vi.fn(),
    initializeAppMock: vi.fn(),
    initializeAuthMock: vi.fn(),
    mainAuth,
    mainDb: { name: 'db-principal' },
    memoryPersistence: { type: 'NONE' },
    secondaryApp: { name: 'app-secundaria' },
    secondaryAuth: { name: 'auth-secundaria' },
    setDocMock: vi.fn(),
    signOutMock: vi.fn(),
  };
});

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  doc: docMock,
  getDoc: getDocMock,
  getDocs: getDocsMock,
  limit: (count: number) => ({ limit: count }),
  query: (source: string, ...constraints: unknown[]) => ({ source, constraints }),
  setDoc: setDocMock,
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
}));
vi.mock('firebase/app', () => ({
  deleteApp: deleteAppMock,
  initializeApp: initializeAppMock,
}));
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: createUserMock,
  deleteUser: deleteAuthUserMock,
  getAuth: getAuthMock,
  inMemoryPersistence: memoryPersistence,
  initializeAuth: initializeAuthMock,
  signOut: signOutMock,
}));
vi.mock('./firebase', () => ({ auth: mainAuth, db: mainDb, firebaseConfig }));

import { addUser, ensureClientDocument } from './userService';

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

describe('addUser', () => {
  const newUser = {
    email: 'nueva@example.com',
    password: 'secreto123',
    name: 'Nueva',
    role: 'companyadmin' as const,
    companyId: 'c1',
  };
  const createdAccount = { uid: 'nuevo-uid' };

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    initializeAppMock.mockReturnValue(secondaryApp);
    initializeAuthMock.mockReturnValue(secondaryAuth);
    createUserMock.mockResolvedValue({ user: createdAccount });
    setDocMock.mockResolvedValue(undefined);
    deleteAuthUserMock.mockResolvedValue(undefined);
    signOutMock.mockResolvedValue(undefined);
    deleteAppMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });

  it('crea la cuenta en la auth secundaria, sin persistencia, y nunca en la principal', async () => {
    await addUser(newUser);

    expect(initializeAppMock).toHaveBeenCalledWith(firebaseConfig, expect.any(String));
    expect(initializeAuthMock).toHaveBeenCalledWith(secondaryApp, { persistence: memoryPersistence });
    expect(createUserMock).toHaveBeenCalledTimes(1);
    expect(createUserMock).toHaveBeenCalledWith(secondaryAuth, newUser.email, newUser.password);
    expect(createUserMock.mock.calls[0][0]).not.toBe(mainAuth);
    expect(getAuthMock).not.toHaveBeenCalled();
  });

  it('escribe users/{uid} con la db principal y los campos exactos, y devuelve el usuario', async () => {
    const created = await addUser(newUser);

    const expected = {
      email: 'nueva@example.com',
      role: 'companyadmin',
      name: 'Nueva',
      companyId: 'c1',
      createdAt: NOW,
    };
    expect(docMock).toHaveBeenCalledWith(mainDb, 'users', 'nuevo-uid');
    expect(setDocMock).toHaveBeenCalledTimes(1);
    expect(setDocMock).toHaveBeenCalledWith('users/nuevo-uid', expected);
    expect(created).toEqual({ id: 'nuevo-uid', ...expected });
  });

  it('cierra la sesión secundaria y luego elimina la instancia, sin borrar la cuenta', async () => {
    await addUser(newUser);

    expect(signOutMock).toHaveBeenCalledWith(secondaryAuth);
    expect(deleteAppMock).toHaveBeenCalledWith(secondaryApp);
    expect(signOutMock.mock.invocationCallOrder[0]).toBeLessThan(deleteAppMock.mock.invocationCallOrder[0]);
    expect(deleteAuthUserMock).not.toHaveBeenCalled();
  });

  it.each([
    ['sin name ni companyId', { email: newUser.email, password: newUser.password, role: 'client' as const }],
    ['con name y companyId vacíos', { ...newUser, role: 'client' as const, name: '', companyId: '' }],
  ])('no escribe esos campos %s', async (_case, data) => {
    await addUser(data);

    expect(setDocMock).toHaveBeenCalledWith('users/nuevo-uid', {
      email: newUser.email,
      role: 'client',
      createdAt: NOW,
    });
  });

  it('sin contraseña lanza, no crea nada ni abre una instancia', async () => {
    await expect(addUser({ ...newUser, password: '' })).rejects.toThrow('Se requiere una contraseña');

    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(createUserMock).not.toHaveBeenCalled();
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('si no se puede preparar la auth secundaria, lanza y elimina la instancia', async () => {
    initializeAuthMock.mockImplementation(() => {
      throw new Error('auth-init-failed');
    });

    await expect(addUser(newUser)).rejects.toThrow('auth-init-failed');

    expect(createUserMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
    expect(deleteAppMock).toHaveBeenCalledWith(secondaryApp);
  });

  it('si falla crear la cuenta, lanza, no escribe y elimina la instancia', async () => {
    createUserMock.mockRejectedValue(new Error('auth/email-already-in-use'));

    await expect(addUser(newUser)).rejects.toThrow('auth/email-already-in-use');

    expect(setDocMock).not.toHaveBeenCalled();
    expect(deleteAuthUserMock).not.toHaveBeenCalled();
    expect(deleteAppMock).toHaveBeenCalledWith(secondaryApp);
  });

  it('si falla setDoc, borra la cuenta secundaria, relanza el error y elimina la instancia', async () => {
    const writeError = new Error('permission-denied');
    setDocMock.mockRejectedValue(writeError);

    await expect(addUser(newUser)).rejects.toBe(writeError);

    expect(deleteAuthUserMock).toHaveBeenCalledWith(createdAccount);
    expect(signOutMock).toHaveBeenCalledWith(secondaryAuth);
    expect(deleteAppMock).toHaveBeenCalledWith(secondaryApp);
  });

  it('si fallan setDoc y el borrado, relanza el de setDoc y registra el otro sin datos personales', async () => {
    const writeError = new Error('permission-denied');
    setDocMock.mockRejectedValue(writeError);
    deleteAuthUserMock.mockRejectedValue(
      Object.assign(new Error('fallo'), { code: 'auth/network-request-failed', customData: { email: newUser.email } }),
    );

    await expect(addUser(newUser)).rejects.toBe(writeError);

    expect(deleteAppMock).toHaveBeenCalledWith(secondaryApp);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logged = consoleErrorSpy.mock.calls[0];
    expect(logged).toContain('auth/network-request-failed');
    expect(JSON.stringify(logged)).not.toContain(newUser.email);
    expect(JSON.stringify(logged)).not.toContain(createdAccount.uid);
  });

  it('si falla signOut tras un alta correcta, elimina la instancia y devuelve el usuario', async () => {
    signOutMock.mockRejectedValue(new Error('signout-failed'));

    await expect(addUser(newUser)).resolves.toMatchObject({ id: 'nuevo-uid', email: newUser.email });

    expect(deleteAppMock).toHaveBeenCalledWith(secondaryApp);
  });

  it('si falla deleteApp tras un alta correcta, devuelve el usuario', async () => {
    deleteAppMock.mockRejectedValue(new Error('delete-app-failed'));

    await expect(addUser(newUser)).resolves.toMatchObject({ id: 'nuevo-uid', email: newUser.email });
  });

  it('un fallo de limpieza no oculta el error original', async () => {
    const createError = new Error('auth/weak-password');
    createUserMock.mockRejectedValue(createError);
    signOutMock.mockRejectedValue(new Error('signout-failed'));
    deleteAppMock.mockRejectedValue(new Error('delete-app-failed'));

    await expect(addUser(newUser)).rejects.toBe(createError);
  });

  it('dos llamadas seguidas usan nombres de instancia distintos', async () => {
    await addUser(newUser);
    await addUser(newUser);

    const [firstName, secondName] = initializeAppMock.mock.calls.map(call => call[1]);
    expect(firstName).not.toBe(secondName);
  });
});
