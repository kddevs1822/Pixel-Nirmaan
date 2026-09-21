import { create } from 'zustand';
import { useCanvasStore } from './useCanvasStore';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authError: string | null;

  initAuth: () => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<boolean>;
  logout: () => void;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  clearError: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'pixelnirmaan_auth_token';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isLoading: true,
  isAuthModalOpen: false,
  authError: null,

  openAuthModal: () => set({ isAuthModalOpen: true, authError: null }),
  closeAuthModal: () => set({ isAuthModalOpen: false, authError: null }),
  clearError: () => set({ authError: null }),

  initAuth: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ user: null, token: null, isLoading: false });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        set({ user: data.user, token, isLoading: false });
      } else {
        // Token expired or invalid
        localStorage.removeItem(TOKEN_KEY);
        set({ user: null, token: null, isLoading: false });
      }
    } catch (error) {
      console.error('Error verifying auth session:', error);
      set({ user: null, token: null, isLoading: false });
    }
  },

  loginWithGoogle: async (credential: string) => {
    set({ isLoading: true, authError: null });
    try {
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.details || err.error || `Server error (${response.status})`);
      }

      const data = await response.json();
      localStorage.setItem(TOKEN_KEY, data.token);

      set({
        user: data.user,
        token: data.token,
        isLoading: false,
        isAuthModalOpen: false,
        authError: null,
      });

      const welcomeName = data.user.name || 'there';
      useCanvasStore.getState().setToastMessage(`Welcome back, ${welcomeName}!`);

      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      const msg = error.message || 'Authentication failed. Please verify the backend server is running.';
      set({ isLoading: false, authError: msg });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({
      user: null,
      token: null,
      isAuthModalOpen: false,
      authError: null,
    });
    useCanvasStore.getState().setToastMessage('Signed out successfully.');
  },
}));
