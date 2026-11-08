/**
 * Firestore en memoria para los tests de las funciones de pago. No es un test:
 * Netlify solo empaqueta lo que importan las funciones.
 */
type Data = Record<string, unknown>;

export const createFakeFirestore = () => {
  const docs = new Map<string, Data>();
  const writes: { op: string; path: string }[] = [];
  const failures = { write: null as Error | null };

  const snapshot = (path: string) => ({
    id: path.split('/').pop() as string,
    ref: docRef(path),
    exists: docs.has(path),
    data: () => (docs.has(path) ? { ...docs.get(path) } : undefined),
  });

  const write = (op: string, path: string, apply: () => void) => {
    if (failures.write) throw failures.write;
    writes.push({ op, path });
    apply();
  };

  const setDoc = (path: string, data: Data) => write('set', path, () => docs.set(path, structuredClone(data)));
  const updateDoc = (path: string, data: Data) => {
    if (!docs.has(path)) throw Object.assign(new Error(`No document to update: ${path}`), { code: 5 });
    write('update', path, () => docs.set(path, { ...docs.get(path), ...structuredClone(data) }));
  };
  const createDoc = (path: string, data: Data) => {
    if (docs.has(path)) throw Object.assign(new Error(`Already exists: ${path}`), { code: 6 });
    setDoc(path, data);
  };

  function docRef(path: string) {
    return {
      id: path.split('/').pop() as string,
      path,
      get: async () => snapshot(path),
      set: async (data: Data) => setDoc(path, data),
      update: async (data: Data) => updateDoc(path, data),
      create: async (data: Data) => createDoc(path, data),
      delete: async () => write('delete', path, () => docs.delete(path)),
    };
  }

  const queryOn = (name: string, filters: [string, unknown][], max: number): unknown => ({
    where: (field: string, _op: string, value: unknown) => queryOn(name, [...filters, [field, value]], max),
    limit: (count: number) => queryOn(name, filters, count),
    get: async () => {
      const matches = [...docs.keys()]
        .filter((key) => key.startsWith(`${name}/`) && key.split('/').length === 2)
        .filter((key) => filters.every(([field, value]) => docs.get(key)?.[field] === value))
        .slice(0, max)
        .map(snapshot);
      return { empty: matches.length === 0, docs: matches };
    },
  });

  let nextId = 0;
  // Las transacciones se ejecutan de una en una: así se comporta Firestore con
  // transacciones que compiten por el mismo documento (reintenta la que pierde).
  let queue: Promise<unknown> = Promise.resolve();

  const db = {
    collection: (name: string) => ({
      doc: (id: string) => docRef(`${name}/${id}`),
      add: async (data: Data) => {
        const id = `auto-${++nextId}`;
        setDoc(`${name}/${id}`, data);
        return docRef(`${name}/${id}`);
      },
      where: (field: string, op: string, value: unknown) =>
        (queryOn(name, [], Infinity) as { where: (...args: unknown[]) => unknown }).where(field, op, value),
    }),
    getAll: async (...refs: { path: string }[]) => refs.map((ref) => snapshot(ref.path)),
    runTransaction: <T>(fn: (transaction: unknown) => Promise<T>): Promise<T> => {
      const run = async () => {
        const pending: (() => void)[] = [];
        const transaction = {
          get: async (ref: { path: string }) => snapshot(ref.path),
          set: (ref: { path: string }, data: Data) => { pending.push(() => setDoc(ref.path, data)); return transaction; },
          update: (ref: { path: string }, data: Data) => { pending.push(() => updateDoc(ref.path, data)); return transaction; },
          create: (ref: { path: string }, data: Data) => { pending.push(() => createDoc(ref.path, data)); return transaction; },
        };
        const result = await fn(transaction);
        pending.forEach((apply) => apply());
        return result;
      };
      const result = queue.then(run, run);
      queue = result.catch(() => undefined);
      return result;
    },
  };

  return {
    db: db as unknown as FirebaseFirestore.Firestore,
    docs,
    writes,
    failures,
    keys: (collection: string) => [...docs.keys()].filter((key) => key.startsWith(`${collection}/`)),
  };
};
