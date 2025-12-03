// pages/login.jsx
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { googleSignIn, anonymousSignIn, user } = useAuth();
  const router = useRouter();

  // ⭐ Auto-Login Logic
  useEffect(() => {
    // 1. If user is already logged in, go to dashboard
    if (user) {
      router.push('/');
      return;
    }

    // 2. Check URL for "?mode=scan"
    if (router.isReady) {
      const { mode } = router.query;
      if (mode === 'scan') {
        anonymousSignIn(); // Trigger automatic login
      }
    }
  }, [user, router.isReady, router.query]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center max-w-sm w-full">
        <h1 className="text-2xl font-bold text-emerald-400 mb-2">Weather Station</h1>
        
        {/* Change text based on whether it's auto-logging in */}
        {router.query.mode === 'scan' ? (
             <p className="text-emerald-400 animate-pulse mb-8 text-sm font-bold">
               🚀 QR Verified. Logging in...
             </p>
        ) : (
            <>
                <p className="text-slate-400 mb-8 text-sm">Sign in to access real-time data</p>
                <button
                onClick={googleSignIn}
                className="w-full flex items-center justify-center bg-white text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-slate-200 transition-colors mb-4"
                >
                Sign in with Gmail
                </button>
                
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-600"></div>
                    <span className="flex-shrink mx-4 text-slate-500 text-xs">OR</span>
                    <div className="flex-grow border-t border-slate-600"></div>
                </div>

                <button
                onClick={anonymousSignIn}
                className="w-full mt-2 text-slate-400 text-sm hover:text-white underline"
                >
                Continue as Guest
                </button>
            </>
        )}
      </div>
    </div>
  );
};

export default Login;