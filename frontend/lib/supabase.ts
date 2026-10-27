import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigError = !supabaseUrl || !supabaseAnonKey
  ? "Supabase belum dikonfigurasi. Set NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di environment (lokal: .env, Vercel: Project Settings > Environment Variables)."
  : null;

export const supabase = createSupabaseClient(
  supabaseUrl ?? "https://missing-project.supabase.co",
  supabaseAnonKey ?? "missing-anon-key",
);

export const createClient = () => supabase;
