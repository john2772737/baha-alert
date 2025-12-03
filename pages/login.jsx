// pages/login.jsx
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  // Get all auth functions from our Context
  const { googleSignIn, anonymousSignIn, tokenSignIn, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 1. If user is already logged in, redirect to Dashboard immediately
    if (user) {
      router.push('/');
      return;
    }

    // 2. Check for Auto-Login Triggers in the URL
    if (router.isReady) {
      const { token, mode } = router.query;
      
      if (token) {
        // Case A: Secure QR Scan (Syncs with your admin account)
        tokenSignIn(token); 
      } else if (mode === 'scan') {
        // Case B: Guest QR Scan (Logs in as anonymous)
        anonymousSignIn();
      }
    }
  }, [user, router.isReady, router.query, tokenSignIn, anonymousSignIn, router]);

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center max-w-sm w-full">
        <h1 className="text-2xl font-bold text-emerald-400 mb-2">Weather Station</h1>
        
        {/* CONDITIONAL UI: Show different text based on what is happening */}
        {router.query.token ? (
            // State 1: Syncing via Secure Token
            <div className="animate-pulse flex flex-col items-center my-8">
               <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
               <p className="text-emerald-400 font-bold">Syncing Account...</p>
               <p className="text-slate-500 text-xs mt-2">Verifying secure key</p>
            </div>
        ) : router.query.mode === 'scan' ? (
            // State 2: Logging in as Guest via QR
             <div className="animate-pulse flex flex-col items-center my-8">
               <p className="text-emerald-400 font-bold mb-4">🚀 QR Verified</p>
               <p className="text-slate-400 text-sm">Logging you in...</p>
             </div>
        ) : (
            // State 3: Standard Login Screen
            <>
                <p className="text-slate-400 mb-8 text-sm">Sign in to access real-time data</p>
                
                {/* Google Button */}
                <button
                  onClick={googleSignIn}
                  className="w-full flex items-center justify-center bg-white text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-slate-200 transition-colors mb-4"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"/></svg>
                  Sign in with Gmail
                </button>
                
                {/* Divider */}
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-600"></div>
                    <span className="flex-shrink mx-4 text-slate-500 text-xs">OR</span>
                    <div className="flex-grow border-t border-slate-600"></div>
                </div>

                {/* Guest Button */}
                <button
                  onClick={anonymousSignIn}
                  className="w-full mt-2 text-slate-400 text-sm hover:text-white underline"
                >
                  Continue as Guest
                </button>
            </>
        )}
      </div>
      
      {/* Footer info */}
      <div className="mt-8 text-slate-600 text-xs">
        System ID: BHA-2025-V1
      </div>
    </div>
  );
};

export default Login;