import * as admin from 'firebase-admin';

let isInitialized = false;

if (!admin.apps.length) {
  try {
    let credential;
    try {
      const serviceAccount = require('@/classbyai-firebase.json');
      credential = admin.credential.cert(serviceAccount);
    } catch {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
      }
    }

    if (credential) {
      admin.initializeApp({
        credential,
      });
      isInitialized = true;
    } else {
      console.warn('Firebase admin credentials not found (classbyai-firebase.json or FIREBASE_SERVICE_ACCOUNT). Running without Firebase Admin.');
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
} else {
  isInitialized = true;
}

export const adminAuth = isInitialized ? admin.auth() : (null as unknown as admin.auth.Auth);
export const adminDb = isInitialized ? admin.firestore() : (null as unknown as admin.firestore.Firestore);
export { admin };
