export interface IdTokenVerifier {
  verifyIdToken(idToken: string): Promise<{ uid: string }>;
}

type Headers = Record<string, string | undefined>;

/** Extrae el token de `Authorization: Bearer <token>`, o null si no está. */
export const getBearerToken = (headers: Headers): string | null => {
  const header = headers.authorization ?? headers.Authorization;
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
};

/**
 * firebase-admin también informa con `auth/argument-error` de los fallos al descargar
 * sus claves públicas, así que el código no basta: lo que descarta el token menciona
 * el token en el mensaje; un fallo de red o de Google trae el mensaje de ese fallo.
 * verify-id-token.sdk.test.ts lo comprueba contra el SDK real: si falla tras actualizar
 * firebase-admin, hay que ajustar esta comprobación a los mensajes nuevos.
 */
const isInvalidTokenError = (error: unknown): boolean => {
  const { code, message } = error as { code?: string; message?: string };
  if (code === 'auth/id-token-expired') return true;
  return code === 'auth/argument-error' && /Firebase ID token|First argument to/.test(message ?? '');
};

/**
 * Verifica un ID token de Firebase. Devuelve el uid, o null si el token no es válido.
 * Si no se ha podido comprobar (red, claves, credenciales), lanza el error.
 */
export const verifyIdToken = async (idToken: string, verifier: IdTokenVerifier): Promise<string | null> => {
  try {
    const { uid } = await verifier.verifyIdToken(idToken);
    return uid || null;
  } catch (error) {
    if (!isInvalidTokenError(error)) {
      throw error;
    }
    console.warn(`Rejected Firebase ID token (${(error as { code?: string }).code}).`);
    return null;
  }
};
