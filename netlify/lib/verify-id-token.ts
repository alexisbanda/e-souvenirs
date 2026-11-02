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

/** Verifica un ID token de Firebase. Devuelve el uid, o null si no es válido. */
export const verifyIdToken = async (idToken: string, verifier: IdTokenVerifier): Promise<string | null> => {
  try {
    const { uid } = await verifier.verifyIdToken(idToken);
    return uid || null;
  } catch (error) {
    const code = (error as { code?: string }).code ?? 'unknown';
    console.warn(`Rejected Firebase ID token (${code}).`);
    return null;
  }
};
