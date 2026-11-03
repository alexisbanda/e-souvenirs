import * as admin from 'firebase-admin';

/**
 * Inicializa firebase-admin la primera vez que se necesita. Es perezoso para que
 * una petición sin token reciba 401 aunque falte la cuenta de servicio.
 */
export const getFirebaseAdmin = () => {
  if (admin.apps.length === 0) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set.');
    }

    let serviceAccount: admin.ServiceAccount & { private_key?: string };
    try {
      serviceAccount = JSON.parse(serviceAccountKey);
    } catch {
      // El error de JSON.parse puede citar parte de la clave: no se propaga.
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.');
    }
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.GCS_BUCKET_NAME,
    });
  }
  return admin;
};
