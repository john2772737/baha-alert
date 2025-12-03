// lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCCbezGFx-tvaislfIIHPbvTbZgPzabWMI",
  authDomain: "baha-alert.firebaseapp.com",
  projectId: "baha-alert",
  storageBucket: "baha-alert.firebasestorage.app",
  messagingSenderId: "102257594100",
  appId: "1:102257594100:web:dfd16684b0510b3ad318a1",
  measurementId: "G-181XG0GK0T"
};

// 1. Initialize App (Singleton Pattern: prevents re-initialization errors)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 2. Export Auth & Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// 3. Export Analytics (SAFE INIT: Only runs in browser)
export const analytics = typeof window !== "undefined" ? 
  isSupported().then((yes) => yes ? getAnalytics(app) : null) 
  : null;