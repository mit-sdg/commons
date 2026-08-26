"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
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
        <CourseProvider>
          <NotificationCountProvider>
            <ProfilesProvider>
              <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
              <Toaster position="top-center" richColors closeButton />
            </ProfilesProvider>
          </NotificationCountProvider>
        </CourseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
