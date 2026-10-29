import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? "Supabase belum dikonfigurasi. Set NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di environment (lokal: .env, Vercel: Project Settings > Environment Variables)."
  : null;

/**
 * Salinan `location.hash` saat halaman pertama dimuat. Klien Supabase menukar
 * `#access_token=...&type=recovery` menjadi sesi lalu menghapus hash-nya sendiri
 * saat initialize(); salinan ini harus diambil SEBELUM klien dibuat agar
 * AuthProvider masih bisa mengenali tautan pemulihan kata sandi.
 */
export const initialUrlHash =
  typeof window !== "undefined" ? window.location.hash : "";

export const supabase = createSupabaseClient(
  supabaseUrl ?? "https://missing-project.supabase.co",
  supabaseAnonKey ?? "missing-anon-key",
);

export const createClient = () => supabase;
