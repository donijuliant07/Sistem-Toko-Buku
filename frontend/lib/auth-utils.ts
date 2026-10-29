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
  if (
    lower.includes("otp_expired") ||
    lower.includes("token has expired") ||
    lower.includes("invalid or has expired")
  ) {
    return "Tautan reset sudah kedaluwarsa atau sudah dipakai. Minta tautan baru.";
  }
  if (lower.includes("different from the old password") || lower.includes("same password")) {
    return "Kata sandi baru harus berbeda dari kata sandi lama.";
  }
  if (lower.includes("weak password") || lower.includes("password is too weak")) {
    return "Kata sandi terlalu lemah. Gunakan kombinasi yang lebih kuat.";
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

/**
 * Apakah URL saat ini hasil klik tautan reset kata sandi. Klien Supabase
 * (implicit flow, default) menaruh sesi recovery di fragment:
 * `#access_token=...&refresh_token=...&type=recovery`. Fragment tidak pernah
 * sampai ke server dan `redirectTo` bisa jatuh ke Site URL bila belum
 * didaftarkan, sehingga halaman mana pun harus bisa mengenali tautan ini.
 * Tautan kedaluwarsa membawa `error_code=otp_expired`.
 */
export function isPasswordRecoveryUrl(search: string, hash: string): boolean {
  const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const query = new URLSearchParams(search);
  if (hashParams.get("type") === "recovery" && hashParams.has("access_token")) return true;
  // Hanya mau menangkap tautan reset: `next=/reset-password` dipasang aplikasi
  // ini sendiri di `redirectTo`, sedangkan tautan konfirmasi pendaftaran tidak.
  const errorCode = query.get("error_code") ?? hashParams.get("error_code");
  return query.get("next") === "/reset-password" && errorCode === "otp_expired";
}
