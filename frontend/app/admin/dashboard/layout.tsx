import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard Admin" };

export default function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
