import { create } from "zustand";
import { authApi } from "../api/auth";

type User = { id: number; username: string; role: string };

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  initFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("token"),
  loading: true,

  login: async (username, password) => {
    const res: any = await authApi.login(username, password);
    localStorage.setItem("token", res.access_token);
    set({ token: res.access_token, user: res.user });
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ token: null, user: null });
  },

  initFromStorage: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const user: any = await authApi.getProfile();
      set({ user, token, loading: false });
    } catch {
      localStorage.removeItem("token");
      set({ token: null, user: null, loading: false });
    }
  },
}));
