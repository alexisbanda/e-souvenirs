/**
 * Activa o desactiva el pago con tarjeta de una tienda. Solo para el superadmin.
 *
 *   npm run payments:set-provider -- --company <id> --provider payphone --token <t> --store-id <s> [--tax-rate 0.15]
 *   npm run payments:set-provider -- --company <id> --provider stripe
 *   npm run payments:set-provider -- --company <id> --disable
 *
 * Credenciales de Firebase: GOOGLE_APPLICATION_CREDENTIALS o --service-account <ruta>.
 * El token de Payphone también se puede pasar en PAYPHONE_TOKEN para no dejarlo en el historial.
 * Nunca se imprime el token.
 */
import { parseArgs } from 'node:util';
import admin from 'firebase-admin';
import { parseCardCredentials, PAYMENT_CREDENTIALS_COLLECTION } from '../netlify/lib/payments/credentials';

const usage = `Uso:
  npm run payments:set-provider -- --company <id> --provider payphone --token <t> --store-id <s> [--tax-rate 0.15]
  npm run payments:set-provider -- --company <id> --provider stripe
  npm run payments:set-provider -- --company <id> --disable
Opciones: --service-account <ruta> (si no, GOOGLE_APPLICATION_CREDENTIALS); PAYPHONE_TOKEN en lugar de --token.`;

const fail = (message: string): never => {
  console.error(`${message}\n\n${usage}`);
  process.exit(1);
};

const main = async () => {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        company: { type: 'string' },
        provider: { type: 'string' },
        token: { type: 'string' },
        'store-id': { type: 'string' },
        'tax-rate': { type: 'string' },
        disable: { type: 'boolean', default: false },
        'service-account': { type: 'string' },
        help: { type: 'boolean', default: false },
      },
    }));
  } catch (error) {
    return fail((error as Error).message);
  }
  if (values.help) {
    console.log(usage);
    return;
  }

  const companyId = values.company;
  if (!companyId || companyId.includes('/')) return fail('Falta --company o no es un id válido.');
  if (values.disable === Boolean(values.provider)) return fail('Indica --provider o --disable (solo uno).');

  let credentials: Record<string, unknown> | null = null;
  if (values.provider === 'payphone') {
    const token = values.token ?? process.env.PAYPHONE_TOKEN;
    const taxRate = values['tax-rate'] === undefined ? undefined : Number(values['tax-rate']);
    credentials = {
      provider: 'payphone',
      payphone: { token, storeId: values['store-id'], ...(taxRate === undefined ? {} : { taxRate }) },
    };
    if (!parseCardCredentials(credentials)) {
      return fail('Payphone necesita --token (o PAYPHONE_TOKEN) y --store-id; --tax-rate debe estar entre 0 y 1 (p. ej. 0.15).');
    }
  } else if (values.provider === 'stripe') {
    credentials = { provider: 'stripe' };
  } else if (values.provider) {
    return fail(`Proveedor desconocido: ${values.provider}.`);
  }

  // firebase-admin lee el archivo de clave; este script no lo abre.
  admin.initializeApp({
    credential: values['service-account'] ? admin.credential.cert(values['service-account']) : admin.credential.applicationDefault(),
  });
  const db = admin.firestore();

  const companyRef = db.collection('companies').doc(companyId);
  if (!(await companyRef.get()).exists) return fail(`No existe la empresa ${companyId}.`);

  const credentialsRef = db.collection(PAYMENT_CREDENTIALS_COLLECTION).doc(companyId);
  const batch = db.batch();
  if (credentials) {
    batch.set(credentialsRef, { ...credentials, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    batch.update(companyRef, { cardProvider: credentials.provider });
  } else {
    batch.delete(credentialsRef);
    batch.update(companyRef, { cardProvider: admin.firestore.FieldValue.delete() });
  }
  await batch.commit();

  if (!credentials) {
    console.log(`Pago con tarjeta desactivado en ${companyId}.`);
  } else if (values.provider === 'payphone') {
    const taxRate = (credentials.payphone as { taxRate?: number }).taxRate;
    console.log(`Pago con tarjeta por Payphone activado en ${companyId} (storeId ${values['store-id']}, ${taxRate === undefined ? 'sin IVA desglosado' : `IVA ${taxRate}`}).`);
  } else {
    console.log(`Pago con tarjeta por Stripe activado en ${companyId}.`);
  }
};

main().catch((error) => {
  // Solo el código: el mensaje podría incluir datos de la petición.
  console.error('No se pudo actualizar el proveedor:', (error as { code?: string }).code ?? (error as Error).name);
  process.exit(1);
});
