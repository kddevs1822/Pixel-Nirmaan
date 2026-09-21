import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';

interface GoogleSignInButtonProps {
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  width?: number;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  text = 'continue_with',
  theme = 'outline',
  size = 'large',
  width = 280,
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('Missing VITE_GOOGLE_CLIENT_ID in frontend .env');
      return;
    }

    const initGoogleBtn = () => {
      if (window.google?.accounts?.id && buttonRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            if (response?.credential) {
              await loginWithGoogle(response.credential);
            }
          },
        });

        // Clear existing children before re-rendering
        buttonRef.current.innerHTML = '';

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme,
          size,
          text,
          width,
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      }
    };

    if (window.google?.accounts?.id) {
      initGoogleBtn();
    } else {
      // Poll briefly if the GIS script is still loading
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGoogleBtn();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [loginWithGoogle, text, theme, size, width]);

  return <div ref={buttonRef} className="flex justify-center items-center min-h-[44px]" />;
};
