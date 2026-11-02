import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, RulesTestContext, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, Firestore, setDoc, setLogLevel } from 'firebase/firestore';

// Las denegaciones esperadas no deben llenar la salida de los tests.
setLogLevel('silent');

export const PROJECT_ID = 'demo-e-souvenirs';

export const createEnv = (): Promise<RulesTestEnvironment> =>
  initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(__dirname, '../../storage.rules'), 'utf8') },
  });

export const fs = (context: RulesTestContext): Firestore => context.firestore() as unknown as Firestore;

export const CATALOG = ['products', 'categories', 'shippingMethods', 'coupons'] as const;

/** Empresa con todos los campos que el formulario de edición envía de vuelta. */
export const companyA = {
  name: 'Empresa A',
  slug: 'empresa-a',
  status: 'APPROVED',
  featured: true,
  adminUid: 'adminA',
  contact: { email: 'a@example.com', contactName: 'A' },
  settings: { theme: 'default' },
};

const seedDocs: Record<string, Record<string, Record<string, unknown>>> = {
  users: {
    superadmin: { role: 'superadmin', email: 's@example.com' },
    adminA: { role: 'companyadmin', companyId: 'A', email: 'a@example.com', name: 'Admin A' },
    adminB: { role: 'companyadmin', companyId: 'B', email: 'b@example.com' },
    adminC: { role: 'companyadmin', companyId: 'C', email: 'c@example.com' },
    adminSinEmpresa: { role: 'companyadmin', email: 'x@example.com' },
    adminEmpresaVacia: { role: 'companyadmin', companyId: '', email: 'y@example.com' },
    client: { role: 'client', companyId: 'A', email: 'client@example.com' },
    sinRol: { email: 'r@example.com', companyId: 'A' },
  },
  companies: {
    A: companyA,
    B: { name: 'Empresa B', slug: 'empresa-b', status: 'APPROVED', featured: false, adminUid: 'adminB' },
    // Empresa sin adminUid: su edición depende de users.companyId.
    C: { name: 'Empresa C', slug: 'empresa-c', status: 'ACTIVE' },
  },
  orders: {
    orderClientA: { companyId: 'A', userId: 'client', total: 10 },
    orderOtroA: { companyId: 'A', userId: 'otro', total: 20 },
    orderClientB: { companyId: 'B', userId: 'client', total: 30 },
    orderB: { companyId: 'B', userId: 'otro', total: 40 },
    orderSinUsuario: { companyId: 'A', total: 50 },
    orderSinEmpresa: { userId: 'otro', total: 60 },
  },
  quotes: {
    quoteA: { companyId: 'A', status: 'Pendiente' },
    quoteB: { companyId: 'B', status: 'Pendiente' },
  },
  conceptJobs: { job1: { status: 'done' } },
};

for (const collectionName of CATALOG) {
  seedDocs[collectionName] = {
    [`${collectionName}A`]: { companyId: 'A', name: 'a', code: 'CODIGOA' },
    [`${collectionName}B`]: { companyId: 'B', name: 'b', code: 'CODIGOB' },
    [`${collectionName}SinEmpresa`]: { name: 'sin empresa', code: 'SINEMPRESA' },
  };
}

export const seed = async (env: RulesTestEnvironment): Promise<void> => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = fs(context);
    for (const [collectionName, docs] of Object.entries(seedDocs)) {
      for (const [id, data] of Object.entries(docs)) {
        await setDoc(doc(db, collectionName, id), data);
      }
    }
  });
};
