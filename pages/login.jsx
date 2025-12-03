// pages/login.jsx
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { googleSignIn, anonymousSignIn, tokenSignIn, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/');
      return;
    }

    if (router.isReady) {
      // ⭐ CHECK FOR TOKEN
      const { token, mode } = router.query;
      
      if (token) {
        tokenSignIn(token); // Log in as the shared user
      } else if (mode === 'scan') {
        anonymousSignIn();
      }
    }
  }, [user, router.isReady, router.query]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        {/* ... same UI as before ... */}
        {router.query.token && (
             <p className="text-emerald-400 animate-pulse font-bold">
               Syncing Account...
             </p>
        )}
    </div>
  );
};
export default Login;