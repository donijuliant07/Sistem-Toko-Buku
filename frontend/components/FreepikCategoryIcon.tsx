import React from "react";

export type CategoryIconId =
  | "all"
  | "fiksi"
  | "self-dev"
  | "bisnis"
  | "edukasi"
  | "komik"
  | "english"
  | "teknologi"
  | "anak"
  | "religi"
  | "biografi"
  | string;

interface FreepikCategoryIconProps {
  id: CategoryIconId;
  className?: string;
  size?: number;
}

export default function FreepikCategoryIcon({
  id,
  className = "w-12 h-12",
  size = 48,
}: FreepikCategoryIconProps) {
  switch (id) {
    case "all":
      // Freepik 3D: Colorful Isometric Stack of Books with Golden Star & Bookmark
      return (
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Ambient Shadow */}
            <radialGradient id="all-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0" />
            </radialGradient>
            {/* Bottom Book: Vibrant Blue */}
            <linearGradient id="all-b1" x1="12" y1="44" x2="52" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1d4ed8" />
              <stop offset="50%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
            {/* Middle Book: Emerald Green */}
            <linearGradient id="all-b2" x1="10" y1="32" x2="50" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#047857" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            {/* Top Book: Coral / Rose Red */}
            <linearGradient id="all-b3" x1="14" y1="20" x2="54" y2="30" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#be123c" />
              <stop offset="50%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#fb7185" />
            </linearGradient>
            {/* Golden Star */}
            <linearGradient id="all-gold" x1="42" y1="6" x2="56" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
            {/* White glossy shine */}
            <linearGradient id="all-shine" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Soft Shadow */}
          <ellipse cx="32" cy="56" rx="22" ry="5" fill="url(#all-shadow)" />

          {/* Book 1 (Bottom - Blue) */}
          <rect x="12" y="44" width="40" height="9" rx="3.5" fill="url(#all-b1)" />
          <rect x="14" y="46" width="35" height="5" rx="1.5" fill="#f8fafc" />
          <rect x="12" y="44" width="9" height="9" rx="2.5" fill="#1e40af" />
          {/* Spine glossy strip */}
          <rect x="14" y="45" width="2" height="7" rx="1" fill="url(#all-shine)" />

          {/* Book 2 (Middle - Emerald) */}
          <rect x="10" y="32" width="42" height="9" rx="3.5" fill="url(#all-b2)" />
          <rect x="13" y="34" width="36" height="5" rx="1.5" fill="#f1f5f9" />
          <rect x="10" y="32" width="9" height="9" rx="2.5" fill="#065f46" />
          <rect x="12" y="33" width="2" height="7" rx="1" fill="url(#all-shine)" />

          {/* Yellow Ribbon Marker hanging out */}
          <path d="M42 36 L42 48 L45 45 L48 48 L48 36 Z" fill="#fbbf24" />

          {/* Book 3 (Top - Coral Pink) */}
          <rect x="14" y="20" width="38" height="9" rx="3.5" fill="url(#all-b3)" />
          <rect x="17" y="22" width="32" height="5" rx="1.5" fill="#ffffff" />
          <rect x="14" y="20" width="9" height="9" rx="2.5" fill="#9f1239" />
          <rect x="16" y="21" width="2" height="7" rx="1" fill="url(#all-shine)" />

          {/* Freepik 3D Star Accent */}
          <path
            d="M49 8 C49 13 46 15 41 15 C46 15 49 17 49 22 C49 17 52 15 57 15 C52 15 49 13 49 8 Z"
            fill="url(#all-gold)"
            filter="drop-shadow(0 2px 4px rgba(234, 179, 8, 0.4))"
          />
          {/* Mini Sparkle */}
          <circle cx="20" cy="14" r="2" fill="#38bdf8" />
          <circle cx="56" cy="27" r="1.5" fill="#fbbf24" />
        </svg>
      );

    case "fiksi":
      // Freepik 3D: Open Magical Book with Levitating Golden Quill & Sparkles
      return (
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="fiksi-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="fiksi-cover" x1="6" y1="46" x2="58" y2="46" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#581c87" />
              <stop offset="50%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#4c1d95" />
            </linearGradient>
            <linearGradient id="fiksi-page-l" x1="10" y1="26" x2="31" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fdf4ff" />
              <stop offset="100%" stopColor="#fae8ff" />
            </linearGradient>
            <linearGradient id="fiksi-page-r" x1="33" y1="26" x2="54" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fae8ff" />
              <stop offset="100%" stopColor="#f5d0fe" />
            </linearGradient>
            <linearGradient id="fiksi-quill" x1="42" y1="8" x2="58" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="fiksi-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>

          {/* Ambient Glow / Shadow */}
          <ellipse cx="32" cy="54" rx="22" ry="5" fill="url(#fiksi-shadow)" />

          {/* Book Hardcover Base */}
          <path
            d="M8 40 C18 42 28 44 32 46 C36 44 46 42 56 40 L54 47 C44 49 35 51 32 53 C29 51 20 49 10 47 Z"
            fill="url(#fiksi-cover)"
          />

          {/* Left Pages Thick Curve */}
          <path
            d="M10 26 C20 27 28 30 31 34 L31 46 C28 42 20 39 10 38 Z"
            fill="url(#fiksi-page-l)"
            stroke="#e9d5ff"
            strokeWidth="0.8"
          />
          {/* Right Pages Thick Curve */}
          <path
            d="M54 26 C44 27 36 30 33 34 L33 46 C36 42 44 39 54 38 Z"
            fill="url(#fiksi-page-r)"
            stroke="#e9d5ff"
            strokeWidth="0.8"
          />

          {/* Book Spine Center Glow */}
          <path d="M31 34 C31.5 35 32.5 35 33 34 L33 46 C32.5 47 31.5 47 31 46 Z" fill="#9333ea" />

          {/* Magical Lines on pages */}
          <path d="M14 31 Q20 32 26 34" stroke="#c084fc" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M14 35 Q20 36 26 38" stroke="#c084fc" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M38 34 Q44 32 50 31" stroke="#c084fc" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M38 38 Q44 36 50 35" stroke="#c084fc" strokeWidth="1.2" strokeLinecap="round" />

          {/* Golden Feather Quill levitating */}
          <path
            d="M53 7 C49 9 44 14 42 21 C45 20 48 18 51 14 C52 18 50 22 47 25 L45 27 L43 27 L42 24 C41 21 42 16 46 11 Z"
            fill="url(#fiksi-quill)"
            filter="drop-shadow(0 2px 4px rgba(217, 119, 6, 0.4))"
          />
          <path d="M43 27 L40 31 L42 29 Z" fill="#78350f" />

          {/* Magic 3D Sparkles */}
          <path d="M22 14 C22 17 20 18 17 18 C20 18 22 19 22 22 C22 19 24 18 27 18 C24 18 22 17 22 14 Z" fill="url(#fiksi-gold)" />
          <circle cx="32" cy="18" r="2" fill="#f472b6" />
          <circle cx="48" cy="36" r="1.5" fill="#fde047" />
        </svg>
      );

    case "self-dev":
      // Freepik 3D: Sprouting Terracotta Pot with Vibrant Glossy Leaves & Warm Aura
      return (
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="dev-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#065f46" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#065f46" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="dev-sun" x1="32" y1="8" x2="32" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
            </linearGradient>
            {/* Terracotta Pot */}
            <linearGradient id="dev-pot" x1="20" y1="36" x2="44" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="50%" stopColor="#c2410c" />
              <stop offset="100%" stopColor="#9a3412" />
            </linearGradient>
            <linearGradient id="dev-soil" x1="22" y1="35" x2="42" y2="39" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#78350f" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>
            {/* Glossy Green Leaves */}
            <linearGradient id="dev-leaf-l" x1="18" y1="14" x2="32" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="50%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
            <linearGradient id="dev-leaf-r" x1="46" y1="12" x2="32" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="50%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#166534" />
            </linearGradient>
            <linearGradient id="dev-pot-shine" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Ambient Glow */}
          <ellipse cx="32" cy="56" rx="18" ry="4.5" fill="url(#dev-shadow)" />
          {/* Sun Aura */}
          <circle cx="32" cy="22" r="14" fill="url(#dev-sun)" />

          {/* Pot Base */}
          <path
            d="M21 40 L24 53 C24.5 54.5 26 55.5 28 55.5 L36 55.5 C38 55.5 39.5 54.5 40 53 L43 40 Z"
            fill="url(#dev-pot)"
          />
          {/* Pot Rim */}
          <rect x="19" y="36" width="26" height="5" rx="2.5" fill="#f97316" />
          <ellipse cx="32" cy="37" rx="11" ry="2" fill="url(#dev-soil)" />

          {/* Pot Highlights */}
          <path d="M23 42 L25 51" stroke="url(#dev-pot-shine)" strokeWidth="1.8" strokeLinecap="round" />

          {/* Sprout Stem */}
          <path d="M32 37 Q32 28 32 20" stroke="#15803d" strokeWidth="3" strokeLinecap="round" />

          {/* Left Sprout Leaf */}
          <path
            d="M32 28 C26 28 17 25 17 18 C23 18 30 22 32 28 Z"
            fill="url(#dev-leaf-l)"
            filter="drop-shadow(0 2px 3px rgba(22, 101, 52, 0.3))"
          />
          {/* Left Leaf Spine */}
          <path d="M32 28 Q24 24 19 19" stroke="#bbf7d0" strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />

          {/* Right Sprout Leaf (Bigger, Lusher) */}
          <path
            d="M32 25 C38 23 48 18 47 11 C40 12 34 19 32 25 Z"
            fill="url(#dev-leaf-r)"
            filter="drop-shadow(0 2px 3px rgba(22, 101, 52, 0.3))"
          />
          <path d="M32 25 Q41 18 45 13" stroke="#bbf7d0" strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />

          {/* Top Little Sprout Bud */}
          <ellipse cx="32" cy="18" rx="2.5" ry="3.5" fill="#86efac" />

          {/* Dew Drop */}
          <circle cx="21" cy="20" r="1.5" fill="#e0f2fe" opacity="0.9" />
          <circle cx="49" cy="28" r="1.5" fill="#fef08a" />
        </svg>
      );

    case "bisnis":
      // Freepik 3D: Leather Executive Briefcase with Upward Growth Arrow & Shiny Golden Coin
      return (
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="bisnis-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0" />
            </radialGradient>
            {/* Rich Caramel Leather Briefcase */}
            <linearGradient id="bisnis-bag" x1="12" y1="26" x2="48" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="50%" stopColor="#92400e" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
            <linearGradient id="bisnis-gold" x1="26" y1="36" x2="34" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            {/* Growth Arrow (Neon Emerald) */}
            <linearGradient id="bisnis-arrow" x1="38" y1="24" x2="56" y2="8" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            {/* Floating Gold Coin */}
            <linearGradient id="bisnis-coin" x1="42" y1="18" x2="56" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          {/* Shadow */}
          <ellipse cx="28" cy="56" rx="20" ry="4.5" fill="url(#bisnis-shadow)" />

          {/* Handle */}
          <path
            d="M23 26 C23 21 33 21 33 26"
            stroke="#78350f"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M23 26 C23 22 33 22 33 26"
            stroke="#f59e0b"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Briefcase Body */}
          <rect x="11" y="26" width="34" height="26" rx="5" fill="url(#bisnis-bag)" />

          {/* Top Flap */}
          <path
            d="M11 28 C11 26 13 26 16 26 L40 26 C43 26 45 26 45 28 L45 37 C45 38 43 39 41 39 L15 39 C13 39 11 38 11 37 Z"
            fill="#78350f"
          />

          {/* Gold Clasp */}
          <rect x="25.5" y="35" width="5" height="7" rx="1.5" fill="url(#bisnis-gold)" />
          <circle cx="28" cy="38.5" r="1" fill="#78350f" />

          {/* Straps */}
          <rect x="17" y="26" width="3" height="26" fill="#78350f" opacity="0.6" />
          <rect x="36" y="26" width="3" height="26" fill="#78350f" opacity="0.6" />

          {/* Leather Corner Reinforcements */}
          <path d="M11 47 C11 50 14 52 17 52 L11 52 Z" fill="#451a03" />
          <path d="M45 47 C45 50 42 52 39 52 L45 52 Z" fill="#451a03" />

          {/* 3D Ascending Growth Arrow */}
          <path
            d="M36 24 L48 12 M48 12 L41 12 M48 12 L48 19"
            stroke="url(#bisnis-arrow)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="drop-shadow(0 2px 4px rgba(16, 185, 129, 0.4))"
          />

          {/* 3D Floating Gold Coin with "$" */}
          <circle
            cx="49"
            cy="24"
            r="8"
            fill="url(#bisnis-coin)"
            filter="drop-shadow(0 2px 4px rgba(234, 179, 8, 0.4))"
          />
          <circle cx="49" cy="24" r="6.2" stroke="#fef08a" strokeWidth="1" fill="none" opacity="0.8" />
          <text
            x="49"
            y="27.5"
            textAnchor="middle"
            fontSize="8"
            fontWeight="bold"
            fill="#78350f"
            fontFamily="sans-serif"
          >
            $
          </text>
        </svg>
      );

    case "edukasi":
      // Freepik 3D: Academic Graduation Mortarboard with Gold Tassel & Tied Diploma Scroll
      return (
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="edu-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
            </radialGradient>
            {/* Cap Top Diamond */}
            <linearGradient id="edu-cap-top" x1="10" y1="18" x2="54" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#312e81" />
              <stop offset="50%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            {/* Cap Skull Base */}
            <linearGradient id="edu-cap-base" x1="20" y1="28" x2="44" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            {/* Silk Gold Tassel */}
            <linearGradient id="edu-tassel" x1="44" y1="24" x2="54" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            {/* Diploma Scroll */}
            <linearGradient id="edu-diploma" x1="14" y1="44" x2="38" y2="52" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
          </defs>

          {/* Shadow */}
          <ellipse cx="32" cy="56" rx="22" ry="4.5" fill="url(#edu-shadow)" />

          {/* Cap Skull Base */}
          <path
            d="M21 28 C21 36 25 41 32 41 C39 41 43 36 43 28 Z"
            fill="url(#edu-cap-base)"
          />

          {/* Mortarboard Diamond Top */}
          <path
            d="M32 14 L55 24 L32 34 L9 24 Z"
            fill="url(#edu-cap-top)"
            filter="drop-shadow(0 4px 6px rgba(15, 23, 42, 0.35))"
          />
          {/* Subtle rim highlight */}
          <path d="M9 24 L32 34 L55 24" stroke="#6366f1" strokeWidth="1" fill="none" opacity="0.6" />

          {/* Gold Button on Top */}
          <ellipse cx="32" cy="24" rx="3" ry="2" fill="#fbbf24" />

          {/* Hanging Gold Silk Tassel */}
          <path
            d="M33 24 Q48 26 50 35 L50 43 L47 43 L47 35 Q46 27 33 24"
            fill="url(#edu-tassel)"
          />
          {/* Tassel Fringe */}
          <rect x="46" y="38" width="5" height="7" rx="1.5" fill="url(#edu-tassel)" />

          {/* Rolled Diploma Certificate */}
          <rect
            x="13"
            y="46"
            width="26"
            height="7"
            rx="3.5"
            fill="url(#edu-diploma)"
            stroke="#cbd5e1"
            strokeWidth="0.8"
          />
          <ellipse cx="14" cy="49.5" rx="2.5" ry="3.5" fill="#e2e8f0" />
          {/* Red Satin Ribbon tying diploma */}
          <rect x="23" y="45" width="5" height="9" rx="1" fill="#ef4444" />
          <path d="M25.5 54 L23 58 L28 58 Z" fill="#dc2626" />

          {/* Little Sparkle */}
          <circle cx="16" cy="16" r="1.5" fill="#fbbf24" />
        </svg>
      );

    case "komik":
      // Freepik 3D: Artist Wooden Palette with 3D Glossy Paint Blobs & Action Burst
      return (
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="komik-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#881337" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#881337" stopOpacity="0" />
            </radialGradient>
            {/* Wooden Palette */}
            <linearGradient id="komik-wood" x1="12" y1="16" x2="52" y2="52" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="50%" stopColor="#fdba74" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
            {/* Paint Droplets */}
            <linearGradient id="komik-pink" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#db2777" />
            </linearGradient>
            <linearGradient id="komik-cyan" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <linearGradient id="komik-yellow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
            <linearGradient id="komik-purple" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#9333ea" />
            </linearGradient>
            {/* Comic starburst */}
            <linearGradient id="komik-starburst" x1="36" y1="6" x2="56" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>

          {/* Shadow */}
          <ellipse cx="32" cy="55" rx="20" ry="4.5" fill="url(#komik-shadow)" />

          {/* Comic Action Starburst behind palette */}
          <path
            d="M48 8 L51 14 L57 12 L54 18 L60 21 L53 24 L56 30 L49 28 L48 35 L43 29 L38 33 L40 26 L34 24 L40 20 L37 14 L43 17 Z"
            fill="url(#komik-starburst)"
            filter="drop-shadow(0 2px 4px rgba(249, 115, 22, 0.35))"
          />

          {/* Wooden Palette Base */}
          <path
            d="M14 26 C12 36 16 48 28 51 C38 53 49 48 51 38 C53 30 48 24 42 25 C39 25 37 28 35 27 C32 25 34 20 30 18 C22 14 16 18 14 26 Z"
            fill="url(#komik-wood)"
            filter="drop-shadow(0 4px 6px rgba(180, 83, 9, 0.25))"
          />
          {/* Thumb Hole */}
          <ellipse cx="43" cy="38" rx="4" ry="5" fill="#fff7ed" />
          <ellipse cx="43" cy="38" rx="4" ry="5" stroke="#ea580c" strokeWidth="1" fill="none" opacity="0.6" />

          {/* 3D Glossy Paint Blobs */}
          {/* Pink Blob */}
          <circle cx="21" cy="24" r="4.5" fill="url(#komik-pink)" />
          <circle cx="19.5" cy="22.5" r="1.2" fill="#ffffff" opacity="0.8" />

          {/* Cyan Blob */}
          <circle cx="20" cy="36" r="4.5" fill="url(#komik-cyan)" />
          <circle cx="18.5" cy="34.5" r="1.2" fill="#ffffff" opacity="0.8" />

          {/* Yellow Blob */}
          <circle cx="29" cy="44" r="4.5" fill="url(#komik-yellow)" />
          <circle cx="27.5" cy="42.5" r="1.2" fill="#ffffff" opacity="0.8" />

          {/* Purple Blob */}
          <circle cx="34" cy="20" r="3.5" fill="url(#komik-purple)" />
          <circle cx="33" cy="19" r="1" fill="#ffffff" opacity="0.8" />

          {/* Paintbrush resting across */}
          <path
            d="M10 52 L36 28 L39 31 L13 55 Z"
            fill="#78350f"
            filter="drop-shadow(0 2px 3px rgba(0,0,0,0.2))"
          />
          {/* Metal Ferrule */}
          <path d="M36 28 L40 24 L43 27 L39 31 Z" fill="#e2e8f0" />
          {/* Wet Bristles with Pink Paint Tip */}
          <path d="M40 24 C42 22 46 20 48 20 C46 24 45 27 43 27 Z" fill="#ec4899" />
        </svg>
      );

    case "english":
      // Freepik 3D: Celestial Planet Earth Globe with Orbital Ring & Golden Stand
      return (
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="eng-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
            </radialGradient>
            {/* Ocean Globe Gradient */}
            <radialGradient id="eng-ocean" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="40%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </radialGradient>
            {/* Continents Green */}
            <linearGradient id="eng-land" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
            {/* Gold Metallic Stand */}
            <linearGradient id="eng-gold" x1="18" y1="12" x2="46" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          {/* Ambient Shadow */}
          <ellipse cx="32" cy="56" rx="18" ry="4.5" fill="url(#eng-shadow)" />

          {/* Stand Base */}
          <ellipse cx="32" cy="53" rx="13" ry="3.5" fill="url(#eng-gold)" />
          <path d="M30 46 L34 46 L33 53 L31 53 Z" fill="url(#eng-gold)" />

          {/* Curved Support Arc */}
          <path
            d="M32 46 C18 46 14 30 16 18"
            stroke="url(#eng-gold)"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />

          {/* Earth Globe Sphere */}
          <circle
            cx="34"
            cy="27"
            r="16"
            fill="url(#eng-ocean)"
            filter="drop-shadow(0 4px 8px rgba(37, 99, 235, 0.4))"
          />

          {/* Continents (Americas / Eurasia abstract curves) */}
          <path
            d="M26 19 C28 17 33 16 35 18 C37 20 33 23 31 25 C29 27 30 31 27 33 C24 35 22 30 24 25 C25 21 24 20 26 19 Z"
            fill="url(#eng-land)"
          />
          <path
            d="M37 21 C41 21 44 24 46 27 C48 30 44 33 41 31 C39 29 40 25 37 23 Z"
            fill="url(#eng-land)"
          />
          <path
            d="M28 36 C31 36 34 39 33 42 C30 42 28 39 28 36 Z"
            fill="url(#eng-land)"
          />

          {/* 3D Glass Specular Reflection on Globe */}
          <path
            d="M23 15 C27 13 33 13 37 14 C32 16 26 19 23 24 C22 21 22 17 23 15 Z"
            fill="#ffffff"
            opacity="0.5"
          />

          {/* Golden Orbital Ring */}
          <ellipse
            cx="34"
            cy="27"
            rx="21"
            ry="7"
            stroke="url(#eng-gold)"
            strokeWidth="1.8"
            transform="rotate(-20 34 27)"
            opacity="0.85"
          />

          {/* Little Orbit Star */}
          <circle cx="51" cy="18" r="2.2" fill="#fbbf24" />
          <circle cx="15" cy="38" r="1.5" fill="#fef08a" />
        </svg>
      );

    case "teknologi":
      // Freepik 3D: Cybernetic Laptop / Atom Orbit with Neon Glow
      return (
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="tek-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="tek-screen" x1="14" y1="14" x2="50" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0369a1" />
              <stop offset="50%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="tek-body" x1="8" y1="42" x2="56" y2="52" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="50%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>

          {/* Shadow */}
          <ellipse cx="32" cy="55" rx="22" ry="4" fill="url(#tek-shadow)" />

          {/* Laptop Screen Frame */}
          <rect x="14" y="14" width="36" height="26" rx="4" fill="#0f172a" />
          <rect x="16" y="16" width="32" height="22" rx="2.5" fill="url(#tek-screen)" />

          {/* Glowing Code / Chip Graphic */}
          <path d="M22 23 L26 27 L22 31" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M30 31 L38 31" stroke="#a5f3fc" strokeWidth="2" strokeLinecap="round" />
          <circle cx="34" cy="22" r="2" fill="#f43f5e" />

          {/* Laptop Base / Keyboard */}
          <path
            d="M8 44 C8 42 10 42 13 42 L51 42 C54 42 56 42 56 44 L53 50 C52 52 50 52 48 52 L16 52 C14 52 12 52 11 50 Z"
            fill="url(#tek-body)"
          />
          {/* Trackpad */}
          <rect x="27" y="45" width="10" height="4" rx="1" fill="#475569" />

          {/* Neon Floating AI Core */}
          <circle cx="48" cy="14" r="5" fill="#a855f7" filter="drop-shadow(0 2px 4px rgba(168,85,247,0.5))" />
          <circle cx="48" cy="14" r="2.5" fill="#ffffff" />
        </svg>
      );

    case "anak":
      // Freepik 3D: Retro Cute Space Rocket with Pastel Clouds & Stars
      return (
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="anak-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="anak-rocket" x1="20" y1="10" x2="44" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <linearGradient id="anak-nose" x1="24" y1="8" x2="40" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
            <linearGradient id="anak-fire" x1="32" y1="44" x2="32" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          {/* Ambient Shadow */}
          <ellipse cx="32" cy="56" rx="16" ry="4" fill="url(#anak-shadow)" />

          {/* Rocket Blast Plume */}
          <path d="M26 44 Q32 58 32 60 Q32 58 38 44 Z" fill="url(#anak-fire)" />

          {/* Rocket Left & Right Fins */}
          <path d="M22 34 C16 38 14 46 14 46 L24 44 Z" fill="#e11d48" />
          <path d="M42 34 C48 38 50 46 50 46 L40 44 Z" fill="#be123c" />

          {/* Rocket Fuselage */}
          <path
            d="M32 8 C24 16 22 28 22 44 L42 44 C42 28 40 16 32 8 Z"
            fill="url(#anak-rocket)"
            filter="drop-shadow(0 4px 6px rgba(0,0,0,0.15))"
          />

          {/* Red Nosecone */}
          <path d="M32 8 C28 12 25 18 24 22 L40 22 C39 18 36 12 32 8 Z" fill="url(#anak-nose)" />

          {/* Cyan Porthole Window */}
          <circle cx="32" cy="28" r="5" fill="#38bdf8" stroke="#cbd5e1" strokeWidth="1.5" />
          <circle cx="30.5" cy="26.5" r="1.5" fill="#ffffff" />

          {/* Little Star */}
          <path d="M48 14 L49 17 L52 18 L49 19 L48 22 L47 19 L44 18 L47 17 Z" fill="#fde047" />
          <circle cx="16" cy="22" r="2" fill="#fbbf24" />
        </svg>
      );

    case "religi":
      // Freepik 3D: Glowing Golden Lantern (Fanous) with Warm Amber Radiant Light & Crescent
      return (
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="rel-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="rel-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
              <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="rel-gold" x1="16" y1="8" x2="48" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          {/* Shadow */}
          <ellipse cx="32" cy="56" rx="18" ry="4" fill="url(#rel-shadow)" />

          {/* Radiant Aura */}
          <circle cx="32" cy="34" r="16" fill="url(#rel-glow)" />

          {/* Lantern Top Ring */}
          <circle cx="32" cy="11" r="4" stroke="url(#rel-gold)" strokeWidth="2" fill="none" />

          {/* Lantern Dome Roof */}
          <path d="M22 22 C22 15 32 14 32 14 C32 14 42 15 42 22 Z" fill="url(#rel-gold)" />

          {/* Crescent Ornament */}
          <path
            d="M32 7 C31 7 29.5 8 29.5 9.5 C29.5 11 31 12 32 12 C33 12 33.5 11.5 33.5 11.5 C32.5 11 32 10 32.5 9 C33 8 33.5 7.5 33.5 7.5 C33 7.2 32.5 7 32 7 Z"
            fill="#fde047"
          />

          {/* Lantern Glass Body */}
          <path d="M22 22 L24 44 L40 44 L42 22 Z" fill="#fffbeb" opacity="0.85" />
          {/* Glass Lattice Lines */}
          <path d="M28 22 L29 44 M36 22 L35 44" stroke="url(#rel-gold)" strokeWidth="1.2" />

          {/* Amber Flame inside */}
          <path
            d="M32 30 C30 33 29 36 32 40 C35 36 34 33 32 30 Z"
            fill="#f97316"
            filter="drop-shadow(0 0 4px #fbbf24)"
          />

          {/* Lantern Base */}
          <path d="M20 44 L22 52 L42 52 L44 44 Z" fill="url(#rel-gold)" />
          <rect x="18" y="52" width="28" height="3" rx="1.5" fill="#92400e" />

          {/* Sparkles */}
          <circle cx="16" cy="24" r="1.5" fill="#fef08a" />
          <circle cx="48" cy="26" r="1.5" fill="#fef08a" />
        </svg>
      );

    case "biografi":
      // Freepik 3D: Golden Profile Medal with Laurel Wreath & Royal Burgundy Ribbon
      return (
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="bio-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#831843" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#831843" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="bio-ribbon" x1="20" y1="10" x2="44" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#be123c" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>
            <linearGradient id="bio-gold" x1="16" y1="20" x2="48" y2="52" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>

          {/* Shadow */}
          <ellipse cx="32" cy="56" rx="18" ry="4" fill="url(#bio-shadow)" />

          {/* Ribbon */}
          <path d="M24 10 L32 24 L22 36 L16 10 Z" fill="url(#bio-ribbon)" />
          <path d="M40 10 L32 24 L42 36 L48 10 Z" fill="#9f1239" />

          {/* Golden Medallion */}
          <circle
            cx="32"
            cy="36"
            r="16"
            fill="url(#bio-gold)"
            filter="drop-shadow(0 4px 6px rgba(161, 98, 7, 0.4))"
          />
          <circle cx="32" cy="36" r="13" stroke="#fef08a" strokeWidth="1" fill="none" opacity="0.8" />

          {/* Embossed Profile Head Silhouette */}
          <path
            d="M32 28 C34 28 35.5 29.5 35.5 31.5 C35.5 33 34.5 34.5 33 35 L34.5 36 C36.5 37 38 39 38 41 L26 41 C26 39 27.5 37 29.5 36 L31 35 C29.5 34.5 28.5 33 28.5 31.5 C28.5 29.5 30 28 32 28 Z"
            fill="#78350f"
          />

          {/* Little Star */}
          <circle cx="48" cy="22" r="2" fill="#fbbf24" />
        </svg>
      );

    default:
      // Fallback: 3D Book Icon
      return (
        <svg
          viewBox="0 0 64 64"
          width={size}
          height={size}
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="32" cy="55" rx="20" ry="4" fill="#000000" opacity="0.15" />
          <rect x="16" y="16" width="32" height="36" rx="4" fill="#3b82f6" />
          <rect x="18" y="18" width="8" height="32" rx="2" fill="#1d4ed8" />
          <rect x="28" y="22" width="16" height="3" rx="1.5" fill="#ffffff" />
          <rect x="28" y="28" width="12" height="3" rx="1.5" fill="#93c5fd" />
        </svg>
      );
  }
}
