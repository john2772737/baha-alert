// context/AuthContext.js
import { createContext, useContext, useEffect, useState } from 'react';
// ⭐ Import signInAnonymously
import { onAuthStateChanged, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { useRouter } from 'next/router';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthContextProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user ? user : null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const googleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/');
    } catch (error) {
      console.error("Google Login failed", error);
    }
  };

  // ⭐ NEW: Anonymous Login Function
  const anonymousSignIn = async () => {
    try {
      await signInAnonymously(auth);
      router.push('/');
    } catch (error) {
      console.error("Guest Login failed", error);
    }
  };

  const logOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    // ⭐ Expose anonymousSignIn
    <AuthContext.Provider value={{ user, googleSignIn, anonymousSignIn, logOut, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};