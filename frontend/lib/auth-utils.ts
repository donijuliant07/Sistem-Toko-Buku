/**
 * Helper untuk menerjemahkan pesan error Supabase Auth menjadi pesan yang ramah pengguna
 */
export function formatAuthError(error: unknown): string {
  if (!error) return "";

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials") || lower.includes("invalid_credentials")) {
    return "Email atau password salah. Silakan periksa kembali.";
  }
  if (lower.includes("user already registered") || lower.includes("already registered") || lower.includes("user_already_exists")) {
    return "Email ini sudah terdaftar. Silakan masuk menggunakan akun Anda.";
  }
  if (lower.includes("password should be at least")) {
    return "Password minimal harus 6 karakter.";
  }
  if (lower.includes("email not confirmed") || lower.includes("email_not_confirmed")) {
    return "Email Anda belum dikonfirmasi. Silakan periksa kotak masuk email Anda.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("over_email_send_rate_limit")) {
    return "Terlalu banyak percobaan. Silakan tunggu beberapa saat lagi.";
  }
  if (lower.includes("network") || lower.includes("fetch failed") || lower.includes("failed to fetch")) {
    return "Gagal terhubung ke server. Periksa koneksi internet Anda.";
  }
  if (lower.includes("signup requires a valid password")) {
    return "Masukkan password yang valid.";
  }
  if (lower.includes("anonymous provider is disabled")) {
    return "Pendaftaran akun belum diaktifkan pada sistem.";
  }

  return message;
}
