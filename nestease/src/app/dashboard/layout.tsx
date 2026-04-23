"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { Sidebar } from "@/components/sidebar";
import { api } from "@/lib/api";

function PMLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  // Check if PM needs onboarding (no avatar configured yet)
  useEffect(() => {
    if (!user || loading || pathname === "/dashboard/onboarding") {
      setOnboardingChecked(true);
      return;
    }
    api.getAgentConfig()
      .then((res) => {
        if (!res.data.agent_avatar) {
          router.replace("/dashboard/onboarding");
        }
      })
      .catch(() => {})
      .finally(() => setOnboardingChecked(true));
  }, [user, loading, pathname, router]);

  if (loading || !onboardingChecked) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-full flex">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}

export default function PMLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PMLayoutInner>{children}</PMLayoutInner>
    </AuthProvider>
  );
}
