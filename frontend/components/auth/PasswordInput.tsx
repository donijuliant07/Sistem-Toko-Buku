"use client";

import React, { useState, forwardRef } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  id: string;
  error?: string;
  hint?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, id, error, hint, required, className, disabled, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="space-y-1.5 w-full text-left">
        <label
          htmlFor={id}
          className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground,#14201B)]"
        >
          {label}
          {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>

        <div className="relative rounded-xl shadow-2xs">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-4 h-4" />
          </div>

          <input
            ref={ref}
            id={id}
            name={id}
            type={showPassword ? "text" : "password"}
            required={required}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            className={cn(
              "w-full h-11 text-sm bg-[var(--surface-muted,#F6F8F6)] text-[var(--foreground,#14201B)] rounded-xl border transition-all duration-150 outline-none pl-10 pr-11",
              "placeholder:text-slate-400 placeholder:text-sm",
              error
                ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-3 focus:ring-red-500/15"
                : "border-[var(--border,#E3EAE5)] hover:border-[var(--border-strong,#CBD7CF)] focus:border-[#128C7E] focus:bg-white focus:ring-3 focus:ring-[#128C7E]/15",
              disabled && "opacity-60 cursor-not-allowed bg-slate-100",
              className
            )}
            {...props}
          />

          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors focus:outline-none focus:text-slate-900 cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>

        {error && (
          <p id={`${id}-error`} className="text-xs font-medium text-red-600 flex items-center gap-1 mt-1" role="alert">
            {error}
          </p>
        )}

        {!error && hint && (
          <p id={`${id}-hint`} className="text-xs text-[var(--muted-foreground,#5C6B63)] mt-1">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
