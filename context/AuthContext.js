// context/AuthContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  signInAnonymously, 
  signInWithCustomToken 
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useRouter } from 'next/router';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 1. Listen for auth state changes (logged in / logged out)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user ? user : null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Google Login Function
  const googleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/');
    } catch (error) {
      console.error("Google Login failed", error);
    }
  };

  // 3. Guest (Anonymous) Login Function
  const anonymousSignIn = async () => {
    try {
      await signInAnonymously(auth);
      router.push('/');
    } catch (error) {
      console.error("Guest Login failed", error);
    }
  };

  // 4. ⭐ Token Login Function (For Secure QR Scan)
  const tokenSignIn = async (token) => {
    try {
      await signInWithCustomToken(auth, token);
      router.push('/');
    } catch (error) {
      console.error("Token Login failed", error);
    }
  };

  // 5. Logout Function
  const logOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, googleSignIn, anonymousSignIn, tokenSignIn, logOut, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};