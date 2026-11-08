/** true si el usuario `users/{uid}` tiene el rol de superadmin. Lee con el Admin SDK. */
export const isSuperadmin = async (db: FirebaseFirestore.Firestore, uid: string): Promise<boolean> => {
  const snapshot = await db.collection('users').doc(uid).get();
  return snapshot.exists && snapshot.data()?.role === 'superadmin';
};
