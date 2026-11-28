import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
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
  const hostname =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'this domain';

  switch (code) {
    case 'auth/unauthorized-domain':
      return lang === 'ne'
        ? `यो मोबाइल/वेब डोमेन (${hostname}) Firebase Console मा Authorized Domains भित्र थपिएको छैन (Authentication → Settings → Authorized domains)। कृपया डोमेन थप्नुहोस् वा Email/Password लग-इन जाँच गर्नुहोस्।`
        : `This mobile/web domain (${hostname}) is not listed in Firebase Console → Authentication → Settings → Authorized domains yet.`;
    case 'auth/popup-blocked':
      return lang === 'ne'
        ? 'मोबाइल ब्राउजरले Google पपअप रोक्यो। कृपया पपअप Allow गर्नुहोस् वा माथि इमेल/पासवर्ड बाट लग-इन गर्नुहोस्।'
        : 'Browser blocked the Google sign-in popup. Allow popups or sign in using Email & Password above.';
    case 'auth/cancelled-popup-request':
      return lang === 'ne'
        ? 'Google लग-इन पपअप अवरुद्ध भयो। कृपया एक पटक फेरि थिच्नुहोस्।'
        : 'Google sign-in request was interrupted. Please tap once to try again.';
    case 'auth/operation-not-supported-in-this-environment':
      return lang === 'ne'
        ? 'यो एप भित्रको ब्राउजर (WebView) ले Google पपअप समर्थन गर्दैन। कृपया माथिको इमेल/पासवर्ड लग-इन प्रयोग गर्नुहोस् वा Chrome मा खोल्नुहोस्।'
        : 'This app WebView does not support Google popups. Use Email & Password login above or open in Chrome.';
    case 'auth/account-exists-with-different-credential':
      return lang === 'ne'
        ? 'यो इमेल अर्को तरिका (Google वा Email/Password) बाट दर्ता भइसकेको छ। कृपया त्यही तरिकाबाट लग-इन गर्नुहोस्।'
        : 'An account already exists with this email using a different sign-in method (Google vs Email/Password). Use the original sign-in method.';
    case 'auth/operation-not-allowed':
      return lang === 'ne'
        ? 'Firebase Console मा Email/Password लग-इन अझै Enable गरिएको छैन (Authentication → Sign-in method)। कृपया Google वा Staff PIN प्रयोग गर्नुहोस्।'
        : 'Email/Password sign-in is not enabled yet in Firebase Console (Authentication → Sign-in method). Use Google or Staff PIN in the meantime.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return lang === 'ne'
        ? 'इमेल वा पासवर्ड मिलेन। यदि पहिलो पटक इमेलबाट लग-इन गर्दै हुनुहुन्छ भने माथि "नयाँ इमेल सेटअप" ट्याबबाट पासवर्ड बनाउनुहोस् वा "Google बाट १-क्लिक लग-इन" प्रयोग गर्नुहोस्।'
        : 'Incorrect email or password. If this is your first email login on mobile, tap "First-Time Email" above to set your password, or use "Continue with Google".';
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
        ? 'यो इमेलमा पहिले नै पासवर्ड बनिसकेको छ। कृपया माथि "साइन इन (Sign In)" बाट लग-इन गर्नुहोस् वा पासवर्ड बिर्सनुभएको भए "पासवर्ड बिर्सनुभयो?" थिच्नुहोस्।'
        : 'This email already has a password set. Switch to "Sign In" above or tap "Forgot Password?" to reset it.';
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
      return lang === 'ne'
        ? 'यो प्रमाणिकरण वा रिसेट लिंकको म्याद सकिएको छ। कृपया लग-इन गरेर नयाँ लिंक मगाउनुहोस्।'
        : 'This verification or reset link has expired or was already used. Request a fresh link from Sign In.';
    case 'auth/requires-recent-login':
      return lang === 'ne'
        ? 'सुरक्षाका लागि कृपया एक पटक Sign Out गरी पुनः लग-इन गर्नुहोस्।'
        : 'For security, please sign out and sign back in to complete this action.';
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

export async function signInWithGooglePopup(): Promise<User | null> {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    // Ignore storage persistence fallback restrictions
  }
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
    const isTopLevelWindow = typeof window !== 'undefined' && window.self === window.top;
    if (
      isTopLevelWindow &&
      (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment')
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
}

export async function consumeGoogleRedirectResult(): Promise<{ user: User | null; error?: unknown }> {
  try {
    const res = await getRedirectResult(auth);
    return { user: res?.user || null };
  } catch (error) {
    return { user: null, error };
  }
}

export async function reloadFirebaseUser(user: User): Promise<User> {
  await reload(user);
  try {
    await user.getIdToken(true);
  } catch {
    // Best-effort token refresh
  }
  return auth.currentUser || user;
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


