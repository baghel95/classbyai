import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = require('@/classbyai-firebase.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export { admin };
