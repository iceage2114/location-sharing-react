import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "../services/api";

interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  google_id?: string;
}

interface AuthState {
  token: string | null;
  refreshTokenValue: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, display_name: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<string>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshTokenValue: null,
      user: null,

      login: async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        set({ token: data.access_token, refreshTokenValue: data.refresh_token, user: data.user });
      },

      register: async (email, password, display_name) => {
        const { data } = await api.post("/auth/register", { email, password, display_name });
        set({ token: data.access_token, refreshTokenValue: data.refresh_token, user: data.user });
      },

      googleLogin: async (idToken) => {
        const { data } = await api.post("/auth/google", { id_token: idToken });
        set({ token: data.access_token, refreshTokenValue: data.refresh_token, user: data.user });
      },

      logout: () => {
        set({ token: null, refreshTokenValue: null, user: null });
      },

      refreshToken: async () => {
        const current = get().refreshTokenValue;
        if (!current) throw new Error("No refresh token");
        const { data } = await api.post("/auth/refresh", { refresh_token: current });
        set({ token: data.access_token, refreshTokenValue: data.refresh_token, user: data.user });
        return data.access_token as string;
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        refreshTokenValue: state.refreshTokenValue,
        user: state.user,
      }),
    }
  )
);
