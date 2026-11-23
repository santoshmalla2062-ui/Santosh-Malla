import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export function formatFirebaseAuthError(error: unknown, lang: 'en' | 'ne' = 'en'): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const rawMessage = error instanceof Error ? error.message : String(error || '');

  switch (code) {
    case 'auth/operation-not-allowed':
      return lang === 'ne'
        ? 'Firebase Console मा Email/Password लग-इन अझै Enable गरिएको छैन (Authentication → Sign-in method)। कृपया Google वा Staff PIN प्रयोग गर्नुहोस्।'
        : 'Email/Password sign-in is not enabled yet in Firebase Console (Authentication → Sign-in method). Use Google or Staff PIN in the meantime.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return lang === 'ne'
        ? 'इमेल वा पासवर्ड मिलेन। कृपया जाँच गरी पुनः प्रयास गर्नुहोस्।'
        : 'Incorrect email or password. Please check your credentials and try again.';
    case 'auth/invalid-email':
      return lang === 'ne'
        ? 'कृपया सही इमेल ठेगाना प्रविष्ट गर्नुहोस्।'
        : 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return lang === 'ne'
        ? 'यो खाता निष्क्रिय गरिएको छ। Admin वा Manager सँग सम्पर्क गर्नुहोस्।'
        : 'This account has been disabled. Contact your Admin or Manager.';
    case 'auth/too-many-requests':
      return lang === 'ne'
        ? 'धेरै पटक गलत प्रयास भयो। कृपया केही बेर पर्खेर पुनः प्रयास गर्नुहोस्।'
        : 'Too many failed attempts. Please wait a moment before trying again.';
    case 'auth/network-request-failed':
      return lang === 'ne'
        ? 'इन्टरनेट जडान समस्या देखियो। नेटवर्क जाँच गरी पुनः प्रयास गर्नुहोस्।'
        : 'Network error. Check your internet connection and try again.';
    case 'auth/email-already-in-use':
      return lang === 'ne'
        ? 'यो इमेल पहिले नै दर्ता भइसकेको छ।'
        : 'This email address is already registered.';
    case 'auth/weak-password':
      return lang === 'ne'
        ? 'पासवर्ड कम्तीमा ६ अक्षरको बलियो राख्नुहोस्।'
        : 'Password should be at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return lang === 'ne'
        ? 'Google लग-इन पपअप बन्द गरियो।'
        : 'Google sign-in popup was closed before completing.';
    default:
      return rawMessage || (lang === 'ne' ? 'प्रमाणीकरण असफल भयो। पुनः प्रयास गर्नुहोस्।' : 'Authentication failed. Please try again.');
  }
}

export async function signInWithGooglePopup(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
  rememberMe: boolean = true
): Promise<User> {
  await setPersistence(
    auth,
    rememberMe ? browserLocalPersistence : browserSessionPersistence
  );
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function registerWithEmailPassword(
  email: string,
  password: string,
  rememberMe: boolean = true,
  displayName?: string
): Promise<User> {
  await setPersistence(
    auth,
    rememberMe ? browserLocalPersistence : browserSessionPersistence
  );
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName && displayName.trim()) {
    try {
      await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 120) });
    } catch {
      // Best-effort profile update
    }
  }
  await sendEmailVerification(cred.user);
  return cred.user;
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function sendUserEmailVerification(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}


