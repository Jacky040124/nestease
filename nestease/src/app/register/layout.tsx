"use client";

import { AuthProvider } from "@/contexts/auth-context";

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
