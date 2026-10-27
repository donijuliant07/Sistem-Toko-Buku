"use client";

import React from "react";
import Link from "next/link";

interface ReadrLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  showTagline?: boolean;
  variant?: "default" | "white" | "dark";
  className?: string;
  href?: string;
}

export default function ReadrLogo({
  size = "md",
  showText = true,
  showTagline = false,
  variant = "default",
  className = "",
  href,
}: ReadrLogoProps) {
  const iconSizeClasses = {
    sm: "w-8 h-8 rounded-lg",
    md: "w-9 h-9 rounded-xl",
    lg: "w-11 h-11 rounded-2xl",
  }[size];

  const svgSizeClasses = {
    sm: "w-4.5 h-4.5",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  }[size];

  const titleSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  }[size];

  const textColorClass = {
    default: "text-[#0052cc]",
    white: "text-white",
    dark: "text-gray-900",
  }[variant];

  const content = (
    <div className={`flex items-center gap-2.5 shrink-0 select-none group ${className}`}>
      {/* Icon Mark: Smart Monogram 'R' with Book & Illumination Spark */}
      <div
        className={`${iconSizeClasses} bg-gradient-to-tr from-[#0052cc] via-[#1d4ed8] to-blue-500 flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-105 shrink-0`}
      >
        <svg
          className={svgSizeClasses}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Book Spine (Left Pillar of R) */}
          <rect x="10" y="8" width="7" height="32" rx="3.5" fill="white" />
          {/* Upper Book Loop (Head of R) */}
          <path
            d="M14 9H26C31.5228 9 36 13.4772 36 19C36 24.5228 31.5228 29 26 29H14"
            stroke="white"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Dynamic Page Bend (Leg of R) */}
          <path
            d="M22 28L34 40"
            stroke="#38bdf8"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Illumination / Reading Spark Star */}
          <circle cx="37" cy="9" r="3.2" fill="#facc15" />
        </svg>
      </div>

      {/* Typography Wordmark */}
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-black tracking-tight flex items-baseline ${titleSizeClasses} ${textColorClass}`}
          >
            Read
            <span className={variant === "default" ? "text-blue-700" : "opacity-90"}>
              r
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] ml-0.5 inline-block shrink-0 shadow-2xs self-start" />
          </span>

          {showTagline && (
            <span className="text-[10px] text-gray-400 font-semibold tracking-wider uppercase mt-0.5">
              Toko Buku Online
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
