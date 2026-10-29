"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { initialUrlHash, supabase, supabaseConfigError } from "@/lib/supabase";
import { isPasswordRecoveryUrl } from "@/lib/auth-utils";
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
  signUp: (email: string, password: string, name?: string) => Promise<{ user: User | null; session: Session | null }>;
  signOut: () => Promise<void>;
  /** Kirim tautan reset ke email. `redirectTo` diisi halaman pemanggil (`window` tidak dipakai di sini). */
  requestPasswordReset: (email: string, redirectTo?: string) => Promise<void>;
  /** Simpan kata sandi baru untuk sesi aktif — dipakai halaman `/reset-password`. */
  updatePassword: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  // Server dan klien sama-sama mulai dengan `true` (markup SSR & hydration identik).
  // Setelah mount, `getSession()` memperbarui nilainya; saat dev, StrictMode sengaja
  // menjalankan ulang effect ini sekali (alasan komentar eslint di bawah).
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (supabaseConfigError) {
      // Jangan biarkan UI menunggu selamanya: tanpa konfigurasi, anggap sesi kosong.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- konfigurasi hilang saat mount
      setLoading(false);
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
      (event, nextSession) => {
        setSession(nextSession);
        setLoading(false);
        // Supabase memancarkan event ini setelah tautan `type=recovery` ditukar
        // menjadi sesi — sumber kanonik, tidak bergantung timing hash/polling.
        if (event === "PASSWORD_RECOVERY") {
          router.replace("/reset-password");
        }
      },
    );
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  // Tautan reset kata sandi membawa sesi recovery. Klien Supabase menukarnya
  // di halaman mana pun tautan mendarat (fragment `type=recovery`), tetapi
  // hanya `/reset-password` yang punya formulir sandi baru — tanpa pengalihan
  // ini pengguna kembali ke beranda/halaman masuk dan tautannya terbuang.
  useEffect(() => {
    if (!isPasswordRecoveryUrl(window.location.search, initialUrlHash)) return;
    const timer = setTimeout(() => router.replace("/reset-password"), 0);
    return () => clearTimeout(timer);
  }, [router]);

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

  async function requestPasswordReset(email: string, redirectTo?: string) {
    if (supabaseConfigError) throw new Error(supabaseConfigError);
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) throw error;
  }

  async function updatePassword(password: string) {
    if (supabaseConfigError) throw new Error(supabaseConfigError);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        role,
        roleLoading,
        loading,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
