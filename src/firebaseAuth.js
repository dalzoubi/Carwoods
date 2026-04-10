import { initializeApp } from 'firebase/app';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  getAuth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY ?? '').trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '').trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '').trim(),
};

export const FIREBASE_AUTH_CONFIGURED = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);

const app = FIREBASE_AUTH_CONFIGURED ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;

export const googleProvider = new GoogleAuthProvider();
export const microsoftProvider = new OAuthProvider('microsoft.com');
export const appleProvider = new OAuthProvider('apple.com');
export const facebookProvider = new FacebookAuthProvider();
