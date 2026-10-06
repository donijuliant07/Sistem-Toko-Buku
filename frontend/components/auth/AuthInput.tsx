"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
  icon?: React.ReactNode;
  hint?: string;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, id, error, icon, hint, required, className, disabled, ...props }, ref) => {
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
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            name={id}
            required={required}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            className={cn(
              "w-full h-11 text-sm bg-[var(--surface-muted,#F6F8F6)] text-[var(--foreground,#14201B)] rounded-xl border transition-all duration-150 outline-none",
              "placeholder:text-slate-400 placeholder:text-sm",
              icon ? "pl-10 pr-3.5" : "px-3.5",
              error
                ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-3 focus:ring-red-500/15"
                : "border-[var(--border,#E3EAE5)] hover:border-[var(--border-strong,#CBD7CF)] focus:border-[#128C7E] focus:bg-white focus:ring-3 focus:ring-[#128C7E]/15",
              disabled && "opacity-60 cursor-not-allowed bg-slate-100",
              className
            )}
            {...props}
          />
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

AuthInput.displayName = "AuthInput";
