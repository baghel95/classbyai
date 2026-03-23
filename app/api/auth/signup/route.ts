import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Create user in Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    // Create user document in Firestore (to stay in sync with NextAuth's adapter)
    try {
      await adminDb.collection('users').doc(userRecord.uid).set({
        name: name || null,
        email: email,
        image: null,
        emailVerified: null,
        createdAt: new Date(),
      });
    } catch (dbError: any) {
      console.error('Firestore write error:', dbError);
      // We don't necessarily want to fail the whole signup if just the Firestore sync fails, 
      // but the 5 NOT_FOUND is a critical configuration issue.
      return NextResponse.json({ 
        error: 'Authentication successful but database sync failed. Please ensure Firestore is initialized in Firebase Console.',
        details: dbError.message 
      }, { status: 500 });
    }

    return NextResponse.json({ message: 'User created successfully', uid: userRecord.uid }, { status: 201 });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
  }
}
