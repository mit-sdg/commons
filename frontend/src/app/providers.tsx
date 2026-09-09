"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CourseProvider } from "@/lib/course";
import { NotificationCountProvider } from "@/lib/notification-count";
import { ProfilesProvider } from "@/lib/profiles";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <AccountProviders>{children}</AccountProviders>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AccountProviders({ children }: { children: React.ReactNode }) {
  const { me, permissions } = useAuth();
  const scope = JSON.stringify([
    me?.user ?? null,
    [...permissions.capabilities].sort(),
  ]);
  return (
    <CourseProvider key={scope}>
      <NotificationCountProvider>
        <ProfilesProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster position="bottom-center" richColors closeButton />
        </ProfilesProvider>
      </NotificationCountProvider>
    </CourseProvider>
  );
}
