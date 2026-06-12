import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Firebase web config. These are PUBLIC client identifiers (not secrets) — access
// is governed by Firestore security rules + Auth, not by hiding these values.
const firebaseConfig = {
  apiKey: 'AIzaSyDuzR_bgGkWU1Q-3agfPwS2FUlGt7VsOmY',
  authDomain: 'dugout-draft.firebaseapp.com',
  projectId: 'dugout-draft',
  storageBucket: 'dugout-draft.firebasestorage.app',
  messagingSenderId: '655377338328',
  appId: '1:655377338328:web:fa1dc7e9cfa6d992006cad',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

let cachedUid: string | null = null;
let authPromise: Promise<string> | null = null;

/** Ensure an anonymous session, returning the uid. One-tap, no signup. */
export function ensureAuth(): Promise<string> {
  if (cachedUid) return Promise.resolve(cachedUid);
  if (authPromise) return authPromise;
  authPromise = new Promise<string>((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) { cachedUid = user.uid; resolve(user.uid); }
    });
    signInAnonymously(auth).catch(reject);
  });
  return authPromise;
}

export function currentUid(): string | null {
  return cachedUid;
}
