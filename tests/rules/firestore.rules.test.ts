import { assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CATALOG, companyA, createEnv, fs, seed } from './helpers';

let env: RulesTestEnvironment;

const as = (uid: string) => fs(env.authenticatedContext(uid));
const anon = () => fs(env.unauthenticatedContext());

beforeAll(async () => {
  env = await createEnv();
});
beforeEach(async () => {
  await seed(env);
});
afterAll(async () => {
  await env.cleanup();
});

describe('client', () => {
  it.each(CATALOG)('no crea, edita ni borra en %s', async (name) => {
    const db = as('client');
    await assertFails(addDoc(collection(db, name), { companyId: 'A', name: 'x' }));
    await assertFails(updateDoc(doc(db, name, `${name}A`), { name: 'x' }));
    await assertFails(deleteDoc(doc(db, name, `${name}A`)));
  });

  it('no crea ni edita companies', async () => {
    const db = as('client');
    await assertFails(addDoc(collection(db, 'companies'), { name: 'x', status: 'PENDING', adminUid: 'client' }));
    await assertFails(updateDoc(doc(db, 'companies', 'A'), { name: 'x' }));
    await assertFails(deleteDoc(doc(db, 'companies', 'A')));
  });

  it('solo lee sus orders', async () => {
    const db = as('client');
    await assertSucceeds(getDoc(doc(db, 'orders', 'orderClientA')));
    await assertFails(getDoc(doc(db, 'orders', 'orderOtroA')));
    await assertFails(getDoc(doc(db, 'orders', 'orderSinUsuario')));
    await assertFails(updateDoc(doc(db, 'orders', 'orderClientA'), { total: 1 }));
    await assertFails(deleteDoc(doc(db, 'orders', 'orderClientA')));
  });

  it('lista sus orders con companyId + userId, como ProfilePage', async () => {
    const snapshot = await assertSucceeds(
      getDocs(query(collection(as('client'), 'orders'), where('companyId', '==', 'A'), where('userId', '==', 'client'))),
    );
    expect(snapshot.docs.map((d) => d.id)).toEqual(['orderClientA']);
  });

  it('no lista orders sin filtrar por su uid', async () => {
    const orders = collection(as('client'), 'orders');
    await assertFails(getDocs(orders));
    await assertFails(getDocs(query(orders, where('companyId', '==', 'A'))));
    await assertFails(getDocs(query(orders, where('companyId', '==', 'A'), where('userId', '==', 'otro'))));
  });

  it('no lee quotes ni otros users', async () => {
    const db = as('client');
    await assertFails(getDoc(doc(db, 'quotes', 'quoteA')));
    await assertFails(getDoc(doc(db, 'users', 'adminA')));
    await assertFails(getDocs(collection(db, 'users')));
  });
});

describe('companyadmin entre empresas', () => {
  it.each(['orders', 'quotes'])('no lee ni escribe %s de otra empresa', async (name) => {
    const db = as('adminA');
    const id = name === 'orders' ? 'orderB' : 'quoteB';
    await assertFails(getDoc(doc(db, name, id)));
    await assertFails(getDocs(query(collection(db, name), where('companyId', '==', 'B'))));
    await assertFails(getDocs(collection(db, name)));
    await assertFails(updateDoc(doc(db, name, id), { status: 'x' }));
    await assertFails(deleteDoc(doc(db, name, id)));
  });

  it('no lee coupons de otra empresa sin limit(1)', async () => {
    const db = as('adminA');
    await assertFails(getDoc(doc(db, 'coupons', 'couponsB')));
    await assertFails(getDocs(query(collection(db, 'coupons'), where('companyId', '==', 'B'))));
    await assertFails(getDocs(collection(db, 'coupons')));
  });

  it.each(CATALOG)('no escribe %s de otra empresa', async (name) => {
    const db = as('adminA');
    await assertFails(addDoc(collection(db, name), { companyId: 'B', name: 'x' }));
    await assertFails(updateDoc(doc(db, name, `${name}B`), { name: 'x' }));
    await assertFails(deleteDoc(doc(db, name, `${name}B`)));
  });

  it.each(CATALOG)('gestiona %s de su empresa', async (name) => {
    const db = as('adminA');
    await assertSucceeds(addDoc(collection(db, name), { companyId: 'A', name: 'x' }));
    await assertSucceeds(updateDoc(doc(db, name, `${name}A`), { name: 'y' }));
    await assertSucceeds(deleteDoc(doc(db, name, `${name}A`)));
    await assertFails(addDoc(collection(db, name), { name: 'sin empresa' }));
  });

  it.each(['orders', 'quotes'])('gestiona %s de su empresa', async (name) => {
    const db = as('adminA');
    const id = name === 'orders' ? 'orderOtroA' : 'quoteA';
    await assertSucceeds(getDoc(doc(db, name, id)));
    await assertSucceeds(updateDoc(doc(db, name, id), { status: 'Enviado' }));
    await assertSucceeds(deleteDoc(doc(db, name, id)));
  });

  it('lista con where companyId == propio', async () => {
    const db = as('adminA');
    for (const name of ['orders', 'quotes', 'coupons', 'products', 'categories', 'shippingMethods']) {
      await assertSucceeds(getDocs(query(collection(db, name), where('companyId', '==', 'A'))));
    }
  });

  it('un documento sin companyId no se abre a un admin sin empresa', async () => {
    for (const uid of ['adminSinEmpresa', 'adminEmpresaVacia', 'adminA']) {
      const db = as(uid);
      await assertFails(getDoc(doc(db, 'orders', 'orderSinEmpresa')));
      await assertFails(updateDoc(doc(db, 'products', 'productsSinEmpresa'), { name: 'x' }));
    }
    await assertFails(addDoc(collection(as('adminEmpresaVacia'), 'products'), { companyId: '', name: 'x' }));
    await assertSucceeds(getDoc(doc(as('superadmin'), 'orders', 'orderSinEmpresa')));
  });
});

describe('companyId nulo', () => {
  it('un perfil con companyId null no gestiona un pedido con companyId null', async () => {
    const db = as('adminEmpresaNula');
    await assertFails(getDoc(doc(db, 'orders', 'orderEmpresaNula')));
    await assertFails(updateDoc(doc(db, 'orders', 'orderEmpresaNula'), { status: 'x' }));
    await assertFails(deleteDoc(doc(db, 'orders', 'orderEmpresaNula')));
    await assertFails(getDocs(query(collection(db, 'orders'), where('companyId', '==', null))));
    await assertFails(addDoc(collection(db, 'products'), { companyId: null, name: 'x' }));
  });
});

describe('ProfilePage de un companyadmin en otra tienda', () => {
  it('lista sus propias orders de esa tienda y nada más', async () => {
    const orders = collection(as('adminA'), 'orders');
    const snapshot = await assertSucceeds(getDocs(query(orders, where('companyId', '==', 'B'), where('userId', '==', 'adminA'))));
    expect(snapshot.docs.map((d) => d.id)).toEqual(['orderAdminAEnB']);
    await assertFails(getDocs(query(orders, where('companyId', '==', 'B'), where('userId', '==', 'otro'))));
  });
});

describe('edición de orders y quotes', () => {
  const cases = [
    ['orders', 'orderOtroA'],
    ['quotes', 'quoteA'],
  ] as const;

  it.each(cases)('companyadmin no cambia companyId en %s', async (name, id) => {
    await assertFails(updateDoc(doc(as('adminA'), name, id), { companyId: 'B' }));
  });

  it.each(cases)('companyadmin cambia status y observations en %s', async (name, id) => {
    await assertSucceeds(updateDoc(doc(as('adminA'), name, id), { status: 'Enviado', observations: 'nota' }));
  });

  it.each(cases)('superadmin cambia companyId en %s', async (name, id) => {
    await assertSucceeds(updateDoc(doc(as('superadmin'), name, id), { companyId: 'B' }));
  });
});

describe('cambio de companyId en update', () => {
  it.each(CATALOG)('companyadmin no cambia companyId en %s', async (name) => {
    await assertFails(updateDoc(doc(as('adminA'), name, `${name}A`), { companyId: 'B' }));
  });

  it.each(CATALOG)('superadmin sí cambia companyId en %s', async (name) => {
    await assertSucceeds(updateDoc(doc(as('superadmin'), name, `${name}A`), { companyId: 'B' }));
  });
});

describe('users', () => {
  it('nadie cambia su propio role ni companyId; sí otros campos', async () => {
    for (const uid of ['client', 'adminA']) {
      const ref = doc(as(uid), 'users', uid);
      await assertFails(updateDoc(ref, { role: 'superadmin' }));
      await assertFails(updateDoc(ref, { companyId: 'B' }));
      await assertSucceeds(updateDoc(ref, { name: 'Nuevo nombre' }));
    }
  });

  it('un client no sube de rol ni por setDoc ni borrando su documento', async () => {
    const ref = doc(as('client'), 'users', 'client');
    await assertFails(setDoc(ref, { role: 'companyadmin', companyId: 'A' }));
    await assertFails(setDoc(ref, { role: 'superadmin' }));
    await assertFails(deleteDoc(ref));
  });

  it('superadmin cambia role y companyId, lista, crea y borra', async () => {
    const db = as('superadmin');
    await assertSucceeds(updateDoc(doc(db, 'users', 'client'), { role: 'companyadmin' }));
    await assertSucceeds(updateDoc(doc(db, 'users', 'adminA'), { companyId: 'B' }));
    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertSucceeds(setDoc(doc(db, 'users', 'nuevo'), { role: 'superadmin' }));
    await assertSucceeds(deleteDoc(doc(db, 'users', 'nuevo')));
  });

  it('companyadmin no lee ni escribe otros users', async () => {
    const db = as('adminA');
    await assertFails(getDoc(doc(db, 'users', 'client')));
    await assertFails(getDocs(query(collection(db, 'users'), where('companyId', '==', 'A'))));
    await assertFails(updateDoc(doc(db, 'users', 'client'), { role: 'companyadmin' }));
    await assertFails(setDoc(doc(db, 'users', 'nuevo'), { role: 'client' }));
  });

  it('ensureClientDocument: una sesión sin documento comprueba y crea el suyo como client', async () => {
    const db = as('nuevoCliente');
    const ref = doc(db, 'users', 'nuevoCliente');
    const snapshot = await assertSucceeds(getDoc(ref));
    expect(snapshot.exists()).toBe(false);
    await assertSucceeds(getDocs(query(collection(db, 'companies'), where('adminUid', '==', 'nuevoCliente'), limit(1))));
    await assertSucceeds(
      setDoc(ref, { id: 'nuevoCliente', email: 'n@example.com', name: 'N', role: 'client', companyId: 'A', createdAt: new Date().toISOString() }),
    );
  });

  it('un companyadmin no pierde su rol por un setDoc sobre su documento', async () => {
    const ref = doc(as('adminA'), 'users', 'adminA');
    await assertFails(setDoc(ref, { id: 'adminA', email: 'a@example.com', role: 'client', companyId: 'A' }));
    const snapshot = await getDoc(ref);
    expect(snapshot.data()?.role).toBe('companyadmin');
  });

  it('el alta propia no admite superadmin, empresa ajena ni rol ausente', async () => {
    const ref = doc(as('nuevo'), 'users', 'nuevo');
    await assertFails(setDoc(ref, { role: 'superadmin' }));
    await assertFails(setDoc(ref, { role: 'companyadmin', companyId: 'A' }));
    await assertFails(setDoc(ref, { role: 'companyadmin', companyId: 'C' }));
    await assertFails(setDoc(ref, { role: 'companyadmin', companyId: 'noExiste' }));
    await assertFails(setDoc(ref, { role: 'companyadmin' }));
    await assertFails(setDoc(ref, { email: 'n@example.com' }));
    await assertSucceeds(setDoc(ref, { role: 'client' }));
  });

  it('el alta propia como companyadmin solo vale para una empresa PENDING', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = fs(context);
      await deleteDoc(doc(db, 'users', 'adminA'));
      await setDoc(doc(db, 'companies', 'activa'), { name: 'Activa', status: 'ACTIVE', adminUid: 'adminA' });
      await setDoc(doc(db, 'companies', 'pendiente'), { name: 'Pendiente', status: 'PENDING', adminUid: 'adminA' });
      await setDoc(doc(db, 'companies', 'sinEstado'), { name: 'Sin estado', adminUid: 'adminA' });
    });
    const ref = doc(as('adminA'), 'users', 'adminA');
    await assertFails(setDoc(ref, { role: 'companyadmin', companyId: 'A' }));
    await assertFails(setDoc(ref, { role: 'companyadmin', companyId: 'activa' }));
    await assertFails(setDoc(ref, { role: 'companyadmin', companyId: 'sinEstado' }));
    await assertSucceeds(setDoc(ref, { role: 'companyadmin', companyId: 'pendiente' }));
  });

  it('no se crea el documento de otro uid', async () => {
    await assertFails(setDoc(doc(as('nuevo'), 'users', 'otro'), { role: 'client' }));
    await assertFails(setDoc(doc(anon(), 'users', 'otro'), { role: 'client' }));
  });

  it('addUser (sesión del usuario nuevo) solo da de alta el rol client', async () => {
    const data = { email: 'n@example.com', name: 'N', createdAt: new Date().toISOString() };
    await assertSucceeds(setDoc(doc(as('nuevoClient'), 'users', 'nuevoClient'), { ...data, role: 'client', companyId: 'A' }));
    await assertFails(setDoc(doc(as('nuevoAdmin'), 'users', 'nuevoAdmin'), { ...data, role: 'companyadmin', companyId: 'A' }));
    await assertFails(setDoc(doc(as('nuevoSuper'), 'users', 'nuevoSuper'), { ...data, role: 'superadmin' }));
  });
});

describe('registro de empresa', () => {
  it('completa la secuencia real con una sesión nueva sin documento', async () => {
    const uid = 'registro';
    const db = as(uid);
    const userRef = doc(db, 'users', uid);

    // AuthContext observa el documento propio antes de que exista.
    const firstSnapshot = await assertSucceeds(
      new Promise<boolean>((resolve, reject) => {
        const unsubscribe = onSnapshot(
          userRef,
          (snapshot) => {
            unsubscribe();
            resolve(snapshot.exists());
          },
          reject,
        );
      }),
    );
    expect(firstSnapshot).toBe(false);

    const companyRef = await assertSucceeds(
      addDoc(collection(db, 'companies'), {
        name: 'Nueva',
        slug: 'nueva',
        status: 'PENDING',
        adminUid: uid,
        createdAt: serverTimestamp(),
      }),
    );
    const companyId = companyRef.id;

    await assertSucceeds(
      setDoc(userRef, { id: uid, email: 'r@example.com', name: 'R', role: 'companyadmin', companyId, createdAt: serverTimestamp() }),
    );
    await assertSucceeds(addDoc(collection(db, 'categories'), { name: 'Cat', companyId, createdAt: serverTimestamp() }));
    await assertSucceeds(addDoc(collection(db, 'products'), { name: 'Prod', category: 'Cat', companyId, createdAt: serverTimestamp() }));
    await assertSucceeds(getDoc(userRef));
  });

  it('crear empresa no da acceso de admin a otra empresa ni a status', async () => {
    const uid = 'registro';
    const db = as(uid);
    const companyRef = await assertSucceeds(addDoc(collection(db, 'companies'), { name: 'Nueva', status: 'PENDING', adminUid: uid }));

    // Antes de tener documento: sin permisos sobre su propia empresa.
    await assertFails(updateDoc(companyRef, { name: 'x' }));
    await assertFails(addDoc(collection(db, 'products'), { companyId: companyRef.id, name: 'x' }));

    await assertSucceeds(setDoc(doc(db, 'users', uid), { role: 'companyadmin', companyId: companyRef.id }));

    await assertFails(updateDoc(companyRef, { status: 'APPROVED' }));
    await assertFails(updateDoc(companyRef, { featured: true }));
    await assertFails(updateDoc(doc(db, 'companies', 'A'), { name: 'x' }));
    await assertFails(addDoc(collection(db, 'products'), { companyId: 'A', name: 'x' }));
    await assertFails(getDoc(doc(db, 'orders', 'orderB')));
    await assertFails(getDoc(doc(db, 'quotes', 'quoteA')));
    await assertFails(getDoc(doc(db, 'users', 'adminA')));
    await assertFails(updateDoc(doc(db, 'users', uid), { companyId: 'A' }));
    await assertFails(updateDoc(doc(db, 'users', uid), { role: 'superadmin' }));
  });

  it('el create exige PENDING y adminUid propio, y no lo hace un anónimo', async () => {
    const companies = collection(as('nuevo'), 'companies');
    await assertFails(addDoc(companies, { name: 'x', status: 'APPROVED', adminUid: 'nuevo' }));
    await assertFails(addDoc(companies, { name: 'x', adminUid: 'nuevo' }));
    await assertFails(addDoc(companies, { name: 'x', status: 'PENDING', adminUid: 'otro' }));
    await assertFails(addDoc(companies, { name: 'x', status: 'PENDING' }));
    await assertFails(addDoc(collection(anon(), 'companies'), { name: 'x', status: 'PENDING', adminUid: 'nuevo' }));
  });

  it('el create sin superadmin no admite featured', async () => {
    const companies = collection(as('nuevo'), 'companies');
    const base = { name: 'x', status: 'PENDING', adminUid: 'nuevo' };
    await assertFails(addDoc(companies, { ...base, featured: true }));
    await assertFails(addDoc(companies, { ...base, featured: 'true' }));
    await assertSucceeds(addDoc(companies, { ...base, featured: false }));
    await assertSucceeds(addDoc(companies, base));
    await assertSucceeds(addDoc(collection(as('superadmin'), 'companies'), { name: 'x', status: 'ACTIVE', featured: true }));
  });

  it('el create sin superadmin no admite cardProvider', async () => {
    const companies = collection(as('nuevo'), 'companies');
    const base = { name: 'x', status: 'PENDING', adminUid: 'nuevo' };
    await assertFails(addDoc(companies, { ...base, cardProvider: 'payphone' }));
    await assertFails(addDoc(companies, { ...base, cardProvider: 'stripe' }));
    await assertSucceeds(addDoc(companies, { ...base, cardProvider: null }));
    await assertSucceeds(addDoc(collection(as('superadmin'), 'companies'), { name: 'x', status: 'ACTIVE', cardProvider: 'stripe' }));
  });

  it('un companyadmin que crea otra empresa no gana permisos sobre ella', async () => {
    const db = as('adminA');
    const companyRef = await assertSucceeds(addDoc(collection(db, 'companies'), { name: 'Otra', status: 'PENDING', adminUid: 'adminA' }));
    await assertFails(updateDoc(companyRef, { name: 'x' }));
    await assertFails(updateDoc(doc(db, 'users', 'adminA'), { companyId: companyRef.id }));
  });
});

describe('companies', () => {
  it('companyadmin no cambia status, featured, slug ni adminUid', async () => {
    const ref = doc(as('adminA'), 'companies', 'A');
    await assertFails(updateDoc(ref, { status: 'ACTIVE' }));
    await assertFails(updateDoc(ref, { featured: false }));
    await assertFails(updateDoc(ref, { slug: 'otra' }));
    await assertFails(updateDoc(ref, { adminUid: 'adminB' }));
  });

  it('companyadmin guarda el documento entero con esos campos sin cambios', async () => {
    await assertSucceeds(
      updateDoc(doc(as('adminA'), 'companies', 'A'), { ...companyA, id: 'A', name: 'Editada', updatedAt: serverTimestamp() }),
    );
  });

  it('una empresa sin adminUid la edita el companyadmin de users.companyId', async () => {
    const db = as('adminC');
    await assertSucceeds(updateDoc(doc(db, 'companies', 'C'), { name: 'Editada' }));
    await assertFails(updateDoc(doc(db, 'companies', 'C'), { adminUid: 'adminC' }));
    await assertFails(updateDoc(doc(as('adminA'), 'companies', 'C'), { name: 'x' }));
  });

  it('el adminUid no autoriza sin users.companyId', async () => {
    await assertFails(updateDoc(doc(as('adminB'), 'companies', 'A'), { name: 'x' }));
    await assertSucceeds(updateDoc(doc(as('superadmin'), 'users', 'adminA'), { companyId: 'B' }));
    await assertFails(updateDoc(doc(as('adminA'), 'companies', 'A'), { name: 'x' }));
  });

  it('superadmin crea sin adminUid con cualquier status, edita todo y borra', async () => {
    const db = as('superadmin');
    await assertSucceeds(addDoc(collection(db, 'companies'), { name: 'x', status: 'PENDING' }));
    const ref = await assertSucceeds(addDoc(collection(db, 'companies'), { name: 'y', status: 'ACTIVE' }));
    await assertSucceeds(updateDoc(doc(db, 'companies', 'A'), { status: 'ACTIVE', featured: false, slug: 'otra', adminUid: 'adminB' }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('companyadmin no borra su empresa', async () => {
    await assertFails(deleteDoc(doc(as('adminA'), 'companies', 'A')));
  });
});

describe('visitante anónimo', () => {
  it.each(['products', 'categories', 'shippingMethods', 'companies', 'conceptJobs'])('lee %s', async (name) => {
    await assertSucceeds(getDocs(collection(anon(), name)));
  });

  it('lee un conceptJob pero no lo escribe', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'conceptJobs', 'job1')));
    await assertFails(setDoc(doc(anon(), 'conceptJobs', 'job2'), { status: 'x' }));
    await assertFails(setDoc(doc(as('superadmin'), 'conceptJobs', 'job2'), { status: 'x' }));
  });

  it('no lee ni escribe aiUsage', async () => {
    for (const db of [anon(), as('superadmin')]) {
      await assertFails(getDoc(doc(db, 'aiUsage', 'u1_1')));
      await assertFails(setDoc(doc(db, 'aiUsage', 'u1_1'), { count: 0 }));
    }
  });

  it('crea quotes pero no orders', async () => {
    await assertFails(addDoc(collection(anon(), 'orders'), { companyId: 'A', total: 1, date: serverTimestamp() }));
    await assertSucceeds(addDoc(collection(anon(), 'quotes'), { companyId: 'A', name: 'x', createdAt: new Date() }));
  });

  it('no lee users, orders ni quotes', async () => {
    const db = anon();
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(getDoc(doc(db, 'users', 'adminA')));
    await assertFails(getDocs(collection(db, 'orders')));
    await assertFails(getDoc(doc(db, 'orders', 'orderSinUsuario')));
    await assertFails(getDocs(collection(db, 'quotes')));
    await assertFails(getDoc(doc(db, 'quotes', 'quoteA')));
  });

  it('consulta coupons con limit(1) como la tienda, y no sin limit', async () => {
    const coupons = collection(anon(), 'coupons');
    const found = await assertSucceeds(
      getDocs(query(coupons, where('companyId', '==', 'A'), where('code', '==', 'CODIGOA'), limit(1))),
    );
    expect(found.size).toBe(1);
    await assertFails(getDocs(query(coupons, where('companyId', '==', 'A'), where('code', '==', 'CODIGOA'))));
    await assertFails(getDocs(query(coupons, where('companyId', '==', 'A'), limit(2))));
    await assertFails(getDocs(coupons));
    await assertFails(getDoc(doc(anon(), 'coupons', 'couponsA')));
  });

  it('no escribe en catálogo ni en companies', async () => {
    for (const name of [...CATALOG, 'companies']) {
      await assertFails(addDoc(collection(anon(), name), { companyId: 'A' }));
    }
  });

  it('una colección no declarada queda denegada', async () => {
    await assertFails(getDoc(doc(as('superadmin'), 'otraColeccion', 'x')));
    await assertFails(setDoc(doc(as('superadmin'), 'otraColeccion', 'x'), { a: 1 }));
  });
});

describe('superadmin', () => {
  it('lista sin filtro', async () => {
    const db = as('superadmin');
    for (const name of ['users', 'orders', 'quotes', 'coupons', 'products', 'categories', 'shippingMethods', 'companies']) {
      await assertSucceeds(getDocs(collection(db, name)));
    }
  });

  it('actualiza y borra orders y quotes', async () => {
    const db = as('superadmin');
    await assertSucceeds(updateDoc(doc(db, 'orders', 'orderB'), { status: 'x' }));
    await assertSucceeds(deleteDoc(doc(db, 'orders', 'orderB')));
    await assertSucceeds(updateDoc(doc(db, 'quotes', 'quoteB'), { status: 'x' }));
    await assertSucceeds(deleteDoc(doc(db, 'quotes', 'quoteB')));
  });
});

describe('sesión sin permisos de admin', () => {
  it.each(['sinDocumento', 'sinRol'])('%s no tiene permisos de admin', async (uid) => {
    const db = as(uid);
    for (const name of CATALOG) {
      await assertFails(addDoc(collection(db, name), { companyId: 'A' }));
      await assertFails(updateDoc(doc(db, name, `${name}A`), { name: 'x' }));
    }
    await assertFails(getDoc(doc(db, 'orders', 'orderOtroA')));
    await assertFails(getDoc(doc(db, 'quotes', 'quoteA')));
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(updateDoc(doc(db, 'companies', 'A'), { name: 'x' }));
    await assertFails(deleteDoc(doc(db, 'companies', 'A')));
  });

  it('sin documento lee su documento inexistente y solo ese', async () => {
    const db = as('sinDocumento');
    const own = await assertSucceeds(getDoc(doc(db, 'users', 'sinDocumento')));
    expect(own.exists()).toBe(false);
    await assertFails(getDoc(doc(db, 'users', 'client')));
  });
});

describe('orders solo las crea el servidor', () => {
  const order = { companyId: 'A', total: 1, status: 'Pendiente', date: serverTimestamp() };

  it.each(['client', 'adminA', 'superadmin', 'sinDocumento'])('%s no crea orders', async (uid) => {
    const db = as(uid);
    await assertFails(addDoc(collection(db, 'orders'), { ...order, userId: uid }));
    await assertFails(setDoc(doc(db, 'orders', 'card_falsa'), { ...order, userId: uid, status: 'En producción' }));
  });

  it('un anónimo no crea orders', async () => {
    await assertFails(addDoc(collection(anon(), 'orders'), order));
  });
});

describe('pagos con tarjeta', () => {
  it.each(['paymentCredentials', 'cardPayments'])('nadie lee ni escribe %s', async (name) => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(fs(context), name, 'A'), { companyId: 'A', userId: 'client', provider: 'payphone', payphone: { token: 'SECRET-TOKEN-XYZ', storeId: 's' } });
    });
    for (const db of [anon(), as('client'), as('adminA'), as('superadmin')]) {
      await assertFails(getDoc(doc(db, name, 'A')));
      await assertFails(getDocs(collection(db, name)));
      await assertFails(setDoc(doc(db, name, 'A'), { provider: 'stripe' }));
      await assertFails(setDoc(doc(db, name, 'nuevo'), { provider: 'stripe' }));
      await assertFails(updateDoc(doc(db, name, 'A'), { status: 'paid' }));
      await assertFails(deleteDoc(doc(db, name, 'A')));
    }
  });

  it('companyadmin no cambia cardProvider; superadmin sí', async () => {
    await assertFails(updateDoc(doc(as('adminA'), 'companies', 'A'), { cardProvider: 'payphone' }));
    await assertSucceeds(updateDoc(doc(as('superadmin'), 'companies', 'A'), { cardProvider: 'payphone' }));
    await assertFails(updateDoc(doc(as('adminA'), 'companies', 'A'), { cardProvider: 'stripe' }));
    await assertSucceeds(updateDoc(doc(as('adminA'), 'companies', 'A'), { name: 'Editada' }));
  });
});
