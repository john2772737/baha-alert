// File: pages/login.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { googleSignIn } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl text-center max-w-sm w-full">
        <h1 className="text-2xl font-bold text-emerald-400 mb-2">Weather Station</h1>
        <p className="text-slate-400 mb-8 text-sm">Scan QR or Sign in to access</p>
        
        <button
          onClick={googleSignIn}
          className="w-full flex items-center justify-center bg-white text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-slate-200 transition-colors"
        >
          Sign in with Gmail
        </button>
      </div>
    </div>
  );
};

export default Login;