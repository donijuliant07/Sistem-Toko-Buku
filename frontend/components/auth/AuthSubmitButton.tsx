"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthSubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export function AuthSubmitButton({
  loading = false,
  loadingText = "Memproses...",
  children,
  className,
  disabled,
  ...props
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        "w-full h-11 px-6 rounded-xl font-semibold text-sm text-white transition-all duration-200",
        "bg-gradient-to-r from-[#128C7E] to-[#25D366] hover:from-[#0E6C61] hover:to-[#20BD5A] active:scale-[0.99]",
        "shadow-md shadow-emerald-700/20 hover:shadow-lg hover:shadow-emerald-700/30",
        "flex items-center justify-center gap-2 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#128C7E]/40 focus-visible:ring-offset-2",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100",
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-white" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
