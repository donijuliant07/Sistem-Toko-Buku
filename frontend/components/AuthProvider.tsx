"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase, supabaseConfigError } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/api";

/** Peran yang dikenal backend (`profiles.role`); di luar ini diperlakukan `user`. */
export type AppRole = "admin" | "user";

type AuthContextValue = {
  session: Session | null;
  role: AppRole | null;
  /** `true` selama role masih ditanyakan ke backend — jangan ambil keputusan akses dulu. */
  roleLoading: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: "google" | "facebook" | "github" | "apple") => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<{ user: User | null; session: Session | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [loading, setLoading] = useState(!supabaseConfigError);

  useEffect(() => {
    let mounted = true;
    if (supabaseConfigError) {
      return () => {
        mounted = false;
      };
    }
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setLoading(false);
      },
    );
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Role selalu berasal dari backend (`GET /me` -> `profiles.role`), bukan dari
  // metadata sesi Supabase yang bisa diubah sendiri oleh pemilik akun. Ini
  // hanya untuk UX; otorisasi sebenarnya tetap di backend dan RLS.
  useEffect(() => {
    let active = true;

    if (!session?.access_token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- logout: role harus langsung dikosongkan agar UI tidak menampilkan akses lama
      setRole(null);
      setRoleLoading(false);
      return () => {
        active = false;
      };
    }

    setRoleLoading(true);
    getCurrentUser(session.access_token)
      .then((profile) => {
        if (active) setRole(profile.role === "admin" ? "admin" : "user");
      })
      .catch(() => {
        // Gagal menghubungi backend: jangan berasumsi admin.
        if (active) setRole("user");
      })
      .finally(() => {
        if (active) setRoleLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }

  async function signInWithOAuth(provider: "google" | "facebook" | "github" | "apple") {
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, name?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: name ? { data: { full_name: name, name } } : undefined,
    });
    if (error) throw error;
    return { user: data.user, session: data.session };
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  return (
    <AuthContext.Provider value={{ session, role, roleLoading, loading, signIn, signInWithOAuth, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
