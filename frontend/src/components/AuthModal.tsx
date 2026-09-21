import React from 'react';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { GoogleSignInButton } from './GoogleSignInButton';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, isLoading, authError } = useAuthStore();

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-100 flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>

        {/* Brand Logo & Heading */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-slate-100 bg-white p-2">
          <img src="/logo.jpg" alt="PixelNirmaan Logo" className="w-full h-full object-contain rounded-xl" />
        </div>

        <h2 className="text-2xl font-bold font-heading text-slate-800 tracking-tight mb-2">
          Sign In to PixelNirmaan
        </h2>
        <p className="text-sm text-slate-500 max-w-xs mb-6">
          Access the canvas, create responsive designs, build master components, and export code.
        </p>

        {/* Error message if login failed */}
        {authError && (
          <div className="w-full mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium flex items-center gap-2 text-left">
            <AlertCircle size={16} className="shrink-0 text-red-500" />
            <span>{authError}</span>
          </div>
        )}

        {/* Google Sign-in Section */}
        <div className="w-full flex flex-col items-center justify-center gap-4">
          <GoogleSignInButton text="continue_with" theme="outline" size="large" width={300} />

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium">
              <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Authenticating with server...</span>
            </div>
          )}
        </div>

        {/* Security badge */}
        <div className="mt-8 pt-6 border-t border-slate-100 w-full flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>Secure authentication powered by Google</span>
        </div>
      </div>
    </div>
  );
};
