import React from 'react';
import { Lock, Sparkles, Layers, Code2, Smartphone, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { GoogleSignInButton } from './GoogleSignInButton';

export const AuthLockOverlay: React.FC = () => {
  const { user, isLoading, authError } = useAuthStore();

  // If user is logged in, do not block
  if (user) return null;

  return (
    <div className="absolute inset-0 z-40 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-8 max-w-md w-full text-center flex flex-col items-center animate-in zoom-in-95 duration-200">
        <div className="relative mb-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-indigo-50 border border-indigo-100 p-2 shadow-inner">
            <img src="/logo.jpg" alt="PixelNirmaan Logo" className="w-full h-full object-contain rounded-xl" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shadow">
            <Lock size={12} className="text-amber-400" />
          </div>
        </div>

        <h3 className="text-xl font-bold font-heading text-slate-800 tracking-tight mb-2">
          Unlock PixelNirmaan Studio
        </h3>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Sign in with your Google account to start designing screens, generating responsive variants, and exporting ready-to-use React code.
        </p>

        {/* Feature Highlights */}
        <div className="grid grid-cols-2 gap-2.5 w-full mb-6 text-left">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium text-slate-700">
            <Layers size={15} className="text-indigo-600 shrink-0" />
            <span>Visual Canvas</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium text-slate-700">
            <Smartphone size={15} className="text-emerald-600 shrink-0" />
            <span>Responsive Variants</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium text-slate-700">
            <Sparkles size={15} className="text-amber-500 shrink-0" />
            <span>Master Components</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium text-slate-700">
            <Code2 size={15} className="text-blue-600 shrink-0" />
            <span>One-Click Export</span>
          </div>
        </div>

        {/* Error message if login failed */}
        {authError && (
          <div className="w-full mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium flex items-center gap-2 text-left">
            <AlertCircle size={16} className="shrink-0 text-red-500" />
            <span>{authError}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="flex items-center gap-2 mb-3 text-xs text-indigo-600 font-medium">
            <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Signing you in...</span>
          </div>
        )}

        {/* Google Sign In Button */}
        <div className="w-full flex flex-col items-center justify-center">
          <GoogleSignInButton text="continue_with" theme="outline" size="large" width={280} />
        </div>

        <p className="text-[11px] text-slate-400 mt-5">
          Free to use • No credit card required • Instant access
        </p>
      </div>
    </div>
  );
};
