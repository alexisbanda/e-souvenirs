import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it } from 'vitest';
import { consumeAiGeneration, getAiGenerationsPerHour } from './ai-usage';

const HOUR = 3_600_000;

const fakeDb = () => {
  const docs = new Map<string, Record<string, unknown>>();
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({ path: `${name}/${id}` }),
    }),
    runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback({
        get: async ({ path }: { path: string }) => ({ data: () => docs.get(path) }),
        set: ({ path }: { path: string }, data: Record<string, unknown>) => docs.set(path, data),
      }),
  };
  return { db: db as unknown as Firestore, docs };
};

describe('getAiGenerationsPerHour', () => {
  it.each([[undefined, 10], ['', 10], ['abc', 10], ['0', 10], ['-3', 10], ['1.5', 10], ['5x', 10], ['1e3', 10], ['3', 3], [' 25 ', 25]])(
    '%j usa %i',
    (raw, expected) => {
      const previous = process.env.AI_GENERATIONS_PER_HOUR;
      delete process.env.AI_GENERATIONS_PER_HOUR;
      expect(getAiGenerationsPerHour(raw)).toBe(expected);
      if (previous !== undefined) process.env.AI_GENERATIONS_PER_HOUR = previous;
    },
  );
});

describe('consumeAiGeneration', () => {
  const now = 500 * HOUR + 15 * 60_000;

  it('deja pasar N peticiones y rechaza la N+1 con el tiempo que falta para la siguiente ventana', async () => {
    const { db } = fakeDb();

    for (let i = 0; i < 3; i++) {
      await expect(consumeAiGeneration(db, 'u1', { limit: 3, now })).resolves.toEqual({ allowed: true });
    }

    await expect(consumeAiGeneration(db, 'u1', { limit: 3, now })).resolves.toEqual({ allowed: false, retryAfterSeconds: 45 * 60 });
  });

  it('guarda el contador en aiUsage/{uid}_{ventana}, con expiresAt posterior al fin de la ventana', async () => {
    const { db, docs } = fakeDb();

    await consumeAiGeneration(db, 'u1', { limit: 3, now });

    const usage = docs.get('aiUsage/u1_500') as { count: number; uid: string; expiresAt: Date };
    expect(usage.count).toBe(1);
    expect(usage.uid).toBe('u1');
    expect(usage.expiresAt.getTime()).toBeGreaterThan(501 * HOUR);
  });

  it('no escribe nada cuando rechaza', async () => {
    const { db, docs } = fakeDb();
    await consumeAiGeneration(db, 'u1', { limit: 1, now });

    await consumeAiGeneration(db, 'u1', { limit: 1, now });

    expect((docs.get('aiUsage/u1_500') as { count: number }).count).toBe(1);
  });

  it('cuenta por separado cada usuario y cada ventana', async () => {
    const { db } = fakeDb();
    await consumeAiGeneration(db, 'u1', { limit: 1, now });

    await expect(consumeAiGeneration(db, 'u2', { limit: 1, now })).resolves.toEqual({ allowed: true });
    await expect(consumeAiGeneration(db, 'u1', { limit: 1, now: now + HOUR })).resolves.toEqual({ allowed: true });
  });
});
